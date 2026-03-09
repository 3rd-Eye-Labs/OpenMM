/**
 * OpenMM x402 Auto-Payment Handler
 * Detects 402 responses and auto-signs payment using local wallet.
 */

import { createEvmPaymentPayload, isEvmNetwork, checkEvmBalance } from './evm';
import {
  exportWallet,
  listWallets,
  getWalletConfig,
  resolvePassword,
  getDefaultWalletAddresses,
} from './wallet';
import type {
  PaymentRequirement,
  X402FetchOptions,
  ExportedWallet,
  X402BalanceResult,
} from './types';

/**
 * Parse PaymentRequirements from a 402 response.
 */
export function parsePaymentRequirements(response: Response): PaymentRequirement[] | null {
  const header = response.headers.get('payment-required');
  if (!header) return null;

  try {
    const decoded = JSON.parse(atob(header));

    // V2 format: { accepts: [...], ... }
    if (decoded.accepts && Array.isArray(decoded.accepts)) {
      return decoded.accepts;
    }

    // Can be a single object or array of requirements
    return Array.isArray(decoded) ? decoded : [decoded];
  } catch {
    return null;
  }
}

/**
 * Rank payment requirements. Prefers EVM (gasless) over Solana.
 * Returns all supported requirements in priority order.
 */
function rankRequirements(requirements: PaymentRequirement[]): PaymentRequirement[] {
  const ranked: PaymentRequirement[] = [];

  // EVM first (gasless for client)
  for (const r of requirements) {
    if (isEvmNetwork(r.network)) ranked.push(r);
  }

  // Solana support could be added here in the future
  // for (const r of requirements) {
  //   if (isSvmNetwork(r.network)) ranked.push(r);
  // }

  return ranked;
}

/**
 * Build a payment signature for a single requirement.
 */
async function buildPaymentForRequirement(
  requirement: PaymentRequirement,
  exported: ExportedWallet,
  url: string
): Promise<string | null> {
  if (isEvmNetwork(requirement.network)) {
    return createEvmPaymentPayload(
      requirement,
      exported.evm.privateKey,
      exported.evm.address,
      url
    );
  }

  // Solana support could be added here
  return null;
}

/**
 * Generate payment signatures for all viable payment options, in priority order.
 * Yields { signature, network } objects. Caller should try each until one succeeds.
 */
export async function* createPaymentSignatures(
  response: Response,
  url: string,
  options: { password?: string; walletName?: string } = {}
): AsyncGenerator<{ signature: string; network: string }> {
  const requirements = parsePaymentRequirements(response);
  if (!requirements || requirements.length === 0) return;

  const ranked = rankRequirements(requirements);
  if (ranked.length === 0) return;

  const walletConfig = getWalletConfig();
  const password = walletConfig.passwordHash
    ? options.password || resolvePassword() || null
    : null;

  if (walletConfig.passwordHash && password === null) {
    console.error('Wallet is encrypted but no password provided.');
    return;
  }

  const wallets = listWallets();
  if (wallets.wallets.length === 0) {
    console.error('No wallets found. Create one with: openmm wallet create');
    return;
  }

  const walletName = options.walletName || wallets.defaultWallet;
  if (!walletName) {
    console.error('No default wallet set.');
    return;
  }

  let exported: ExportedWallet;
  try {
    exported = exportWallet(walletName, password);
  } catch (err) {
    console.error(`Failed to export wallet: ${(err as Error).message}`);
    return;
  }

  for (const req of ranked) {
    try {
      const sig = await buildPaymentForRequirement(req, exported, url);
      if (sig) yield { signature: sig, network: req.network };
    } catch {
      // This payment option failed to build, try next
      continue;
    }
  }
}

/**
 * Attempt to auto-pay a 402 response (single-shot, returns first viable signature).
 */
export async function createPaymentSignature(
  response: Response,
  url: string,
  options: { password?: string; walletName?: string } = {}
): Promise<string | null> {
  for await (const { signature } of createPaymentSignatures(response, url, options)) {
    return signature;
  }
  return null;
}

/**
 * Check x402 payment wallet balance.
 */
export async function checkX402Balance(network: string): Promise<X402BalanceResult | null> {
  const addresses = getDefaultWalletAddresses();
  if (!addresses) return null;

  if (network.startsWith('eip155:') && addresses.evm) {
    const balance = await checkEvmBalance(addresses.evm);
    if (balance === null) return null;

    return {
      network,
      address: addresses.evm,
      balance,
      symbol: 'USDC',
    };
  }

  // Solana support could be added here
  return null;
}

/**
 * Wrapper for fetch that handles x402 auto-payment.
 *
 * When a request returns HTTP 402:
 * 1. Parses payment requirements from Payment-Required header
 * 2. Signs payment using local wallet
 * 3. Retries request with Payment-Signature header
 */
export async function x402Fetch(
  url: string,
  options: X402FetchOptions = {}
): Promise<Response> {
  const { walletName, password, skipPayment, maxRetries = 1, ...fetchOptions } = options;

  // Make initial request
  let response = await fetch(url, fetchOptions);

  // If not a 402 or payment is skipped, return as-is
  if (response.status !== 402 || skipPayment) {
    return response;
  }

  // Parse payment requirements
  const requirements = parsePaymentRequirements(response);
  if (!requirements || requirements.length === 0) {
    console.error('402 response but no valid payment requirements found');
    return response;
  }

  // Check wallet balance before attempting payment
  const ranked = rankRequirements(requirements);
  if (ranked.length === 0) {
    console.error('No supported payment networks in requirements');
    return response;
  }

  const firstReq = ranked[0];
  const balanceResult = await checkX402Balance(firstReq.network);

  if (balanceResult) {
    const requiredAmount = parseFloat(firstReq.amount) / 1e6; // Assuming 6 decimals
    if (balanceResult.balance < requiredAmount) {
      console.error(
        `Insufficient balance: ${balanceResult.balance} ${balanceResult.symbol}, ` +
          `required: ${requiredAmount} ${balanceResult.symbol}`
      );
      console.error(`Fund your wallet: ${balanceResult.address}`);
      return response;
    }
  }

  // Try to create payment signature
  const signature = await createPaymentSignature(response, url, { password, walletName });

  if (!signature) {
    console.error('Failed to create payment signature');
    return response;
  }

  // Retry with payment signature
  let retries = 0;
  while (retries < maxRetries) {
    const retryHeaders = new Headers(fetchOptions.headers);
    retryHeaders.set('Payment-Signature', signature);

    response = await fetch(url, {
      ...fetchOptions,
      headers: retryHeaders,
    });

    // If no longer 402, we're done
    if (response.status !== 402) {
      return response;
    }

    retries++;
  }

  return response;
}

/**
 * Format payment requirements for display.
 */
export function formatPaymentRequirements(requirements: PaymentRequirement[]): string {
  const lines: string[] = ['Payment required:'];

  for (const req of requirements) {
    const network = req.network;
    const amount = parseFloat(req.amount) / 1e6; // Assuming 6 decimals
    const payTo = req.payTo || req.pay_to || 'unknown';

    lines.push(`  Network: ${network}`);
    lines.push(`  Amount: ${amount.toFixed(6)} USDC`);
    lines.push(`  Pay to: ${payTo}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Check if a response is a 402 payment required.
 */
export function isPaymentRequired(response: Response): boolean {
  return response.status === 402;
}

/**
 * Get supported payment networks from requirements.
 */
export function getSupportedNetworks(requirements: PaymentRequirement[]): string[] {
  return rankRequirements(requirements).map(r => r.network);
}

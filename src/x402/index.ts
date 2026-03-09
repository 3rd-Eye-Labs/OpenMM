/**
 * OpenMM x402 Payment Module
 *
 * Provides x402 payment protocol support for auto-paying API requests
 * that return HTTP 402 Payment Required.
 *
 * Features:
 * - Local wallet management (EVM + Solana)
 * - EIP-3009 TransferWithAuthorization for gasless USDC payments on Base
 * - Auto-detection and handling of 402 responses
 * - Secure key storage with AES-256-GCM encryption
 *
 * Usage:
 * ```typescript
 * import { x402Fetch, createWallet, checkX402Balance } from './x402';
 *
 * // Create a wallet
 * const wallet = createWallet('my-wallet', 'my-secure-password');
 *
 * // Use x402Fetch instead of fetch for auto-payment
 * const response = await x402Fetch('https://api.example.com/data');
 * ```
 */

// Types
export type {
  PaymentRequirement,
  PaymentRequiredResponse,
  EvmWallet,
  SolanaWallet,
  EncryptedKey,
  StoredWallet,
  WalletConfig,
  ExportedWallet,
  WalletListEntry,
  EIP712Domain,
  TransferAuthorization,
  ECDSASignature,
  X402PaymentPayload,
  X402FetchOptions,
  X402BalanceResult,
} from './types';

// Wallet management
export {
  createWallet,
  listWallets,
  showWallet,
  exportWallet,
  setDefaultWallet,
  deleteWallet,
  getWalletConfig,
  resolvePassword,
  getDefaultWalletAddresses,
} from './wallet';

// EVM payment
export {
  createEvmPaymentPayload,
  isEvmNetwork,
  checkEvmBalance,
  hashTypedData,
  getBaseRpcUrl,
} from './evm';

// x402 handler
export {
  x402Fetch,
  parsePaymentRequirements,
  createPaymentSignature,
  createPaymentSignatures,
  checkX402Balance,
  formatPaymentRequirements,
  isPaymentRequired,
  getSupportedNetworks,
} from './handler';

// Crypto utilities (for advanced use)
export {
  keccak256,
  signSecp256k1,
  encryptKey,
  decryptKey,
  hashPassword,
  verifyPassword,
  generatePrivateKey,
  privateKeyToEvmAddress,
  generateSolanaKeypair,
  base58Encode,
} from './crypto';

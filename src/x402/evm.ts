/**
 * OpenMM x402 EVM Auto-Payment
 * Implements EIP-3009 TransferWithAuthorization via EIP-712 typed data signing.
 * Pure Node.js implementation — no external dependencies.
 */

import crypto from 'crypto';
import { keccak256, signSecp256k1 } from './crypto';
import type {
  PaymentRequirement,
  EIP712Domain,
  TransferAuthorization,
  X402PaymentPayload,
} from './types';

// ============= EIP-712 Type Hashing =============

interface TypeField {
  name: string;
  type: string;
}

const DOMAIN_TYPES: TypeField[] = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const AUTHORIZATION_TYPES: TypeField[] = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
];

/**
 * Encode a type string for EIP-712 typeHash.
 */
function encodeType(typeName: string, fields: TypeField[]): string {
  const fieldStrs = fields.map(f => `${f.type} ${f.name}`);
  return `${typeName}(${fieldStrs.join(',')})`;
}

/**
 * Compute typeHash = keccak256(encodeType(...))
 */
function typeHash(typeName: string, fields: TypeField[]): Buffer {
  return keccak256(Buffer.from(encodeType(typeName, fields), 'utf8'));
}

/**
 * ABI-encode a single value to 32 bytes based on its EIP-712 type.
 */
function encodeValue(fieldType: string, value: unknown): Buffer {
  if (fieldType === 'string') {
    // Strings are hashed
    return keccak256(Buffer.from(value as string, 'utf8'));
  }

  if (fieldType === 'bytes') {
    const buf =
      typeof value === 'string'
        ? Buffer.from((value as string).replace(/^0x/, ''), 'hex')
        : (value as Buffer);
    return keccak256(buf);
  }

  if (fieldType === 'bytes32') {
    if (typeof value === 'string') {
      return Buffer.from((value as string).replace(/^0x/, ''), 'hex');
    }
    return value as Buffer;
  }

  if (fieldType === 'address') {
    // Left-pad address to 32 bytes
    const addr = (value as string).replace(/^0x/, '').toLowerCase();
    return Buffer.from(addr.padStart(64, '0'), 'hex');
  }

  if (fieldType.startsWith('uint') || fieldType.startsWith('int')) {
    // Encode as 32-byte big-endian
    const hex = BigInt(value as string | number | bigint)
      .toString(16)
      .padStart(64, '0');
    return Buffer.from(hex, 'hex');
  }

  if (fieldType === 'bool') {
    return Buffer.from((value ? '1' : '0').padStart(64, '0'), 'hex');
  }

  throw new Error(`Unsupported EIP-712 field type: ${fieldType}`);
}

/**
 * Compute struct hash = keccak256(typeHash || encodeValue(field1) || ...)
 */
function hashStruct(
  typeName: string,
  fields: TypeField[],
  data: Record<string, unknown>
): Buffer {
  const parts: Buffer[] = [typeHash(typeName, fields)];

  for (const field of fields) {
    const value = data[field.name];
    if (value === undefined || value === null) {
      throw new Error(`Missing EIP-712 field: ${field.name}`);
    }
    parts.push(encodeValue(field.type, value));
  }

  return keccak256(Buffer.concat(parts));
}

/**
 * Compute EIP-712 domain separator hash.
 */
function hashDomain(domain: EIP712Domain): Buffer {
  return hashStruct('EIP712Domain', DOMAIN_TYPES, domain as unknown as Record<string, unknown>);
}

/**
 * Compute EIP-712 final hash: keccak256("\x19\x01" || domainSeparator || structHash)
 */
export function hashTypedData(
  domain: EIP712Domain,
  primaryType: string,
  fields: TypeField[],
  message: Record<string, unknown>
): Buffer {
  const domainSeparator = hashDomain(domain);
  const structHash = hashStruct(primaryType, fields, message);

  return keccak256(Buffer.concat([Buffer.from([0x19, 0x01]), domainSeparator, structHash]));
}

// ============= x402 EVM Payment =============

/**
 * Extract chain ID from CAIP-2 network identifier.
 * e.g., "eip155:8453" → 8453
 */
function getChainId(network: string): number {
  const match = network.match(/^eip155:(\d+)$/);
  if (!match) throw new Error(`Invalid EVM network: ${network}`);
  return parseInt(match[1], 10);
}

/**
 * Check if a network string is an EVM network.
 */
export function isEvmNetwork(network: string): boolean {
  return typeof network === 'string' && network.startsWith('eip155:');
}

/**
 * Create an x402 payment payload for EVM (EIP-3009 TransferWithAuthorization).
 *
 * @param requirements - Parsed PaymentRequirements from 402 response
 * @param privateKeyHex - 32-byte EVM private key as hex
 * @param walletAddress - Signer's EVM address
 * @param resource - Original request URL
 * @returns Base64-encoded PaymentPayload for Payment-Signature header
 */
export function createEvmPaymentPayload(
  requirements: PaymentRequirement,
  privateKeyHex: string,
  walletAddress: string,
  resource: string
): string {
  const chainId = getChainId(requirements.network);
  const extra = requirements.extra || {};

  // Token name and version from requirements.extra (set by server/facilitator)
  const tokenName = extra.name as string | undefined;
  const tokenVersion = (extra.version as string) || '1';

  if (!tokenName) {
    throw new Error('EIP-712 domain name missing from requirements.extra');
  }

  // Generate random nonce (32 bytes)
  const nonce = '0x' + crypto.randomBytes(32).toString('hex');

  // Validity window: valid now, expires in 1 hour
  const now = Math.floor(Date.now() / 1000);
  const validAfter = '0';
  const validBefore = String(now + 3600);

  // EIP-712 domain
  const domain: EIP712Domain = {
    name: tokenName,
    version: tokenVersion,
    chainId,
    verifyingContract: requirements.asset,
  };

  // EIP-3009 message
  const message: TransferAuthorization = {
    from: walletAddress,
    to: requirements.payTo || requirements.pay_to || '',
    value: BigInt(requirements.amount),
    validAfter: BigInt(validAfter),
    validBefore: BigInt(validBefore),
    nonce,
  };

  // Hash and sign
  const msgHash = hashTypedData(
    domain,
    'TransferWithAuthorization',
    AUTHORIZATION_TYPES,
    message as unknown as Record<string, unknown>
  );

  const { r, s, v } = signSecp256k1(msgHash, Buffer.from(privateKeyHex, 'hex'));
  const signature = '0x' + r.toString('hex') + s.toString('hex') + (27 + v).toString(16);

  // Build payload (camelCase keys per x402 spec)
  const payload: X402PaymentPayload = {
    x402Version: 2,
    payload: {
      authorization: {
        from: walletAddress,
        to: message.to,
        value: String(requirements.amount),
        validAfter: validAfter,
        validBefore: validBefore,
        nonce: nonce,
      },
      signature: signature,
    },
    accepted: requirements,
  };

  // Add resource if provided
  if (resource) {
    payload.resource = { url: resource };
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Check USDC balance on Base network.
 *
 * @param address - EVM address to check
 * @returns Balance in USD (number) or null if check fails
 */
export async function checkEvmBalance(address: string): Promise<number | null> {
  try {
    // Base USDC contract address
    const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    const addr = address.replace('0x', '').toLowerCase().padStart(64, '0');

    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: USDC_BASE, data: `0x70a08231${addr}` }, 'latest'],
      }),
    });

    const data = (await response.json()) as { result?: string };
    if (!data.result) return null;

    return parseInt(data.result, 16) / 1e6;
  } catch {
    return null;
  }
}

/**
 * Get Base network RPC URL.
 */
export function getBaseRpcUrl(): string {
  return process.env.OPENMM_BASE_RPC || 'https://mainnet.base.org';
}

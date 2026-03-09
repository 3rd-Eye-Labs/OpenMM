/**
 * OpenMM x402 Payment Types
 * Type definitions for x402 payment protocol support.
 */

/**
 * Payment requirement from 402 response header.
 */
export interface PaymentRequirement {
  /** CAIP-2 network identifier (e.g., "eip155:8453" for Base) */
  network: string;
  /** Token contract address */
  asset: string;
  /** Amount in smallest unit (e.g., USDC with 6 decimals: 1000000 = $1) */
  amount: string;
  /** Recipient address */
  payTo?: string;
  pay_to?: string;
  /** Additional requirements (e.g., EIP-712 domain info) */
  extra?: {
    name?: string;
    version?: string;
    [key: string]: unknown;
  };
}

/**
 * Parsed 402 response with payment requirements.
 */
export interface PaymentRequiredResponse {
  accepts: PaymentRequirement[];
}

/**
 * EVM wallet keypair.
 */
export interface EvmWallet {
  address: string;
  privateKey: string;
}

/**
 * Solana wallet keypair.
 */
export interface SolanaWallet {
  address: string;
  privateKey: string;
}

/**
 * Encrypted key storage format.
 */
export interface EncryptedKey {
  /** Unencrypted storage */
  data?: string;
  encrypted?: boolean;
  /** Encrypted storage */
  cipher?: string;
  kdf?: string;
  kdfParams?: {
    N: number;
    r: number;
    p: number;
  };
  salt?: string;
  iv?: string;
  authTag?: string;
  ciphertext?: string;
}

/**
 * Stored wallet format.
 */
export interface StoredWallet {
  name: string;
  createdAt: string;
  evm: {
    address: string;
    encrypted: EncryptedKey;
  };
  solana?: {
    address: string;
    encrypted: EncryptedKey;
  };
}

/**
 * Wallet configuration.
 */
export interface WalletConfig {
  defaultWallet: string | null;
  passwordHash: {
    salt: string;
    hash: string;
  } | null;
}

/**
 * Exported wallet with decrypted keys.
 */
export interface ExportedWallet {
  name: string;
  evm: {
    address: string;
    privateKey: string;
  };
  solana?: {
    address: string;
    privateKey: string;
  };
}

/**
 * Wallet list entry (public info only).
 */
export interface WalletListEntry {
  name: string;
  evm: string | null;
  solana: string | null;
  createdAt: string;
  isDefault: boolean;
}

/**
 * EIP-712 domain for typed data signing.
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/**
 * EIP-3009 TransferWithAuthorization message.
 */
export interface TransferAuthorization {
  from: string;
  to: string;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: string;
}

/**
 * ECDSA signature components.
 */
export interface ECDSASignature {
  r: Buffer;
  s: Buffer;
  v: number;
}

/**
 * x402 payment payload for Payment-Signature header.
 */
export interface X402PaymentPayload {
  x402Version: number;
  payload: {
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
    signature: string;
  };
  accepted: PaymentRequirement;
  resource?: {
    url: string;
  };
}

/**
 * Options for x402 fetch wrapper.
 */
export interface X402FetchOptions extends RequestInit {
  /** Wallet name to use (defaults to default wallet) */
  walletName?: string;
  /** Wallet password (defaults to env var OPENMM_WALLET_PASSWORD) */
  password?: string;
  /** Skip auto-payment, just return 402 response */
  skipPayment?: boolean;
  /** Maximum retries after payment */
  maxRetries?: number;
}

/**
 * Result of checking x402 balance.
 */
export interface X402BalanceResult {
  network: string;
  address: string;
  balance: number;
  symbol: string;
}

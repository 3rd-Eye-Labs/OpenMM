/**
 * OpenMM x402 Wallet Management
 * Local key generation and storage for EVM and Solana chains.
 */

import fs from 'fs';
import path from 'path';
import {
  encryptKey,
  decryptKey,
  hashPassword,
  verifyPassword,
  generatePrivateKey,
  privateKeyToEvmAddress,
  generateSolanaKeypair,
  base58Encode,
} from './crypto';
import type {
  StoredWallet,
  WalletConfig,
  ExportedWallet,
  WalletListEntry,
  EncryptedKey,
} from './types';

// ============= Constants =============

function getWalletsDir(): string {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.openmm');
  return path.join(configDir, 'wallets');
}

function getWalletConfigPath(): string {
  return path.join(getWalletsDir(), 'config.json');
}

const WALLET_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// ============= Helpers =============

function ensureWalletsDir(): void {
  const dir = getWalletsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

function validateWalletName(name: string): void {
  if (!name || !WALLET_NAME_RE.test(name)) {
    throw new Error(
      'Wallet name must be 1-64 characters: letters, numbers, hyphens, underscores only'
    );
  }
}

function getWalletFile(name: string): string {
  validateWalletName(name);
  return path.join(getWalletsDir(), `${name}.json`);
}

// ============= Password Resolution =============

/**
 * Resolve wallet password from environment variable.
 */
export function resolvePassword(): string | null {
  return process.env.OPENMM_WALLET_PASSWORD || null;
}

// ============= Configuration =============

/**
 * Get wallet configuration.
 */
export function getWalletConfig(): WalletConfig {
  const configPath = getWalletConfigPath();
  if (!fs.existsSync(configPath)) {
    return { defaultWallet: null, passwordHash: null };
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Save wallet configuration.
 */
function saveWalletConfig(config: WalletConfig): void {
  ensureWalletsDir();
  fs.writeFileSync(getWalletConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

// ============= Wallet Operations =============

/**
 * Generate an EVM wallet (secp256k1).
 */
function generateEvmWallet(): { privateKey: string; address: string } {
  const privateKey = generatePrivateKey();
  const address = privateKeyToEvmAddress(privateKey);
  const privateKeyHex = privateKey.toString('hex');

  // Zero sensitive buffer
  privateKey.fill(0);

  return { privateKey: privateKeyHex, address };
}

/**
 * Generate a Solana wallet (Ed25519).
 */
function generateSolanaWallet(): { privateKey: string; address: string } {
  const { privateKey, publicKey } = generateSolanaKeypair();
  return {
    privateKey: privateKey.toString('hex'),
    address: base58Encode(publicKey),
  };
}

/**
 * List all wallets.
 */
export function listWallets(): { wallets: WalletListEntry[]; defaultWallet: string | null } {
  ensureWalletsDir();
  const config = getWalletConfig();
  const walletsDir = getWalletsDir();

  const files = fs.readdirSync(walletsDir).filter(f => f.endsWith('.json') && f !== 'config.json');

  const wallets = files.map(f => {
    const data: StoredWallet = JSON.parse(fs.readFileSync(path.join(walletsDir, f), 'utf8'));
    return {
      name: data.name,
      evm: data.evm?.address || null,
      solana: data.solana?.address || null,
      createdAt: data.createdAt,
      isDefault: data.name === config.defaultWallet,
    };
  });

  return { wallets, defaultWallet: config.defaultWallet };
}

/**
 * Create a new wallet pair (EVM + Solana).
 */
export function createWallet(
  name: string,
  password: string | null
): {
  name: string;
  evm: string;
  solana: string;
  isDefault: boolean;
} {
  ensureWalletsDir();
  const config = getWalletConfig();
  const walletFile = getWalletFile(name);

  if (fs.existsSync(walletFile)) {
    throw new Error(`Wallet "${name}" already exists`);
  }

  // Validate password requirements
  if (password === null) {
    // Passwordless mode: reject if existing wallets are encrypted
    if (config.passwordHash) {
      throw new Error('Existing wallets are password-protected. Set OPENMM_WALLET_PASSWORD.');
    }
  } else {
    // Encrypted mode
    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }

    if (!config.passwordHash) {
      // First encrypted wallet: reject if passwordless local wallets exist
      const walletsDir = getWalletsDir();
      const existingWallets = fs
        .readdirSync(walletsDir)
        .filter(f => f.endsWith('.json') && f !== 'config.json');

      if (existingWallets.length > 0) {
        throw new Error(
          'Existing wallets are passwordless. Cannot mix encrypted and unencrypted wallets.'
        );
      }
      config.passwordHash = hashPassword(password);
    } else if (!verifyPassword(password, config.passwordHash)) {
      throw new Error('Incorrect password');
    }
  }

  // Generate wallets
  const evm = generateEvmWallet();
  const solana = generateSolanaWallet();

  const wallet: StoredWallet = {
    name,
    createdAt: new Date().toISOString(),
    evm: {
      address: evm.address,
      encrypted: encryptKey(evm.privateKey, password) as EncryptedKey,
    },
    solana: {
      address: solana.address,
      encrypted: encryptKey(solana.privateKey, password) as EncryptedKey,
    },
  };

  fs.writeFileSync(walletFile, JSON.stringify(wallet, null, 2), { mode: 0o600 });

  // Set as default if it's the first wallet
  if (!config.defaultWallet) {
    config.defaultWallet = name;
  }
  saveWalletConfig(config);

  return {
    name,
    evm: evm.address,
    solana: solana.address,
    isDefault: config.defaultWallet === name,
  };
}

/**
 * Show wallet details (addresses only, no keys).
 */
export function showWallet(name: string): {
  name: string;
  evm: string | null;
  solana: string | null;
  createdAt: string;
  isDefault: boolean;
} {
  const walletFile = getWalletFile(name);
  if (!fs.existsSync(walletFile)) {
    throw new Error(`Wallet "${name}" not found`);
  }

  const data: StoredWallet = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
  const config = getWalletConfig();

  return {
    name: data.name,
    evm: data.evm?.address || null,
    solana: data.solana?.address || null,
    createdAt: data.createdAt,
    isDefault: data.name === config.defaultWallet,
  };
}

/**
 * Export private keys for a wallet (requires password).
 */
export function exportWallet(name: string, password: string | null): ExportedWallet {
  const walletFile = getWalletFile(name);
  if (!fs.existsSync(walletFile)) {
    throw new Error(`Wallet "${name}" not found`);
  }

  const data: StoredWallet = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
  const config = getWalletConfig();

  if (config.passwordHash && !verifyPassword(password || '', config.passwordHash)) {
    throw new Error('Incorrect password');
  }

  return {
    name: data.name,
    evm: {
      address: data.evm?.address || '',
      privateKey: data.evm ? decryptKey(data.evm.encrypted, password) : '',
    },
    solana: data.solana
      ? {
          address: data.solana.address,
          privateKey: decryptKey(data.solana.encrypted, password),
        }
      : undefined,
  };
}

/**
 * Set the default wallet.
 */
export function setDefaultWallet(name: string): { defaultWallet: string } {
  const walletFile = getWalletFile(name);
  if (!fs.existsSync(walletFile)) {
    throw new Error(`Wallet "${name}" not found`);
  }

  const config = getWalletConfig();
  config.defaultWallet = name;
  saveWalletConfig(config);

  return { defaultWallet: name };
}

/**
 * Delete a wallet.
 */
export function deleteWallet(
  name: string,
  password: string | null
): { deleted: string; newDefault: string | null } {
  const walletFile = getWalletFile(name);
  if (!fs.existsSync(walletFile)) {
    throw new Error(`Wallet "${name}" not found`);
  }

  const config = getWalletConfig();

  if (config.passwordHash && !verifyPassword(password || '', config.passwordHash)) {
    throw new Error('Incorrect password');
  }

  fs.unlinkSync(walletFile);

  const remaining = fs
    .readdirSync(getWalletsDir())
    .filter(f => f.endsWith('.json') && f !== 'config.json');

  if (remaining.length === 0) {
    config.defaultWallet = null;
    config.passwordHash = null;
  } else if (config.defaultWallet === name) {
    config.defaultWallet = remaining[0].replace('.json', '');
  }
  saveWalletConfig(config);

  return { deleted: name, newDefault: config.defaultWallet };
}

/**
 * Get the default wallet's addresses without requiring password.
 */
export function getDefaultWalletAddresses(): {
  name: string;
  evm: string | null;
  solana: string | null;
} | null {
  const config = getWalletConfig();
  if (!config.defaultWallet) return null;

  try {
    const wallet = showWallet(config.defaultWallet);
    return {
      name: wallet.name,
      evm: wallet.evm,
      solana: wallet.solana,
    };
  } catch {
    return null;
  }
}

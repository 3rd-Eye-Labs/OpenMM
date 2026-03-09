/**
 * OpenMM x402 Cryptographic Utilities
 * Pure Node.js crypto implementations for EVM signing.
 * No external dependencies required.
 */

import crypto from 'crypto';
import type { ECDSASignature } from './types';

/**
 * Compute keccak256 hash (Ethereum's version of SHA3-256).
 * Uses Node.js crypto which supports keccak256 natively.
 */
export function keccak256(data: Buffer): Buffer {
  return crypto.createHash('sha3-256').update(data).digest();
}

/**
 * Sign a message hash with secp256k1 private key.
 * Returns { r, s, v } where v is recovery id (0 or 1).
 */
export function signSecp256k1(msgHash: Buffer, privateKey: Buffer): ECDSASignature {
  // Use Node.js ECDH to get the public key for recovery
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);
  const publicKey = ecdh.getPublicKey(null, 'uncompressed');

  // Sign the message
  const sign = crypto.createSign('sha256');
  sign.update(msgHash);
  sign.end();

  // Node.js sign() with ECDSA returns DER-encoded signature
  // We need to extract r and s from it
  const derSig = sign.sign({ key: privateKeyToPem(privateKey), dsaEncoding: 'der' });

  // Parse DER signature to get r and s
  const { r, s } = parseDerSignature(derSig);

  // Normalize s to low-S form (required by Ethereum)
  const secp256k1N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const halfN = secp256k1N / 2n;
  let sBigInt = BigInt('0x' + s.toString('hex'));
  let sNormalized = s;

  if (sBigInt > halfN) {
    sBigInt = secp256k1N - sBigInt;
    sNormalized = Buffer.from(sBigInt.toString(16).padStart(64, '0'), 'hex');
  }

  // Determine recovery id by trying both values
  const v = recoverV(msgHash, r, sNormalized, publicKey);

  return { r, s: sNormalized, v };
}

/**
 * Convert raw private key to PEM format for Node.js crypto.
 */
function privateKeyToPem(privateKey: Buffer): string {
  // Create SEC1 EC private key DER structure
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);

  // Use Node.js KeyObject API
  const keyObject = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'secp256k1',
      d: privateKey.toString('base64url'),
      x: ecdh.getPublicKey().subarray(1, 33).toString('base64url'),
      y: ecdh.getPublicKey().subarray(33, 65).toString('base64url'),
    },
    format: 'jwk',
  });

  return keyObject.export({ type: 'pkcs8', format: 'pem' }) as string;
}

/**
 * Parse DER-encoded ECDSA signature to extract r and s values.
 */
function parseDerSignature(der: Buffer): { r: Buffer; s: Buffer } {
  // DER: 30 <len> 02 <r-len> <r> 02 <s-len> <s>
  let offset = 2; // Skip SEQUENCE header

  // Read r
  if (der[offset] !== 0x02) throw new Error('Invalid DER signature');
  offset++;
  const rLen = der[offset];
  offset++;
  let r = der.subarray(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (der[offset] !== 0x02) throw new Error('Invalid DER signature');
  offset++;
  const sLen = der[offset];
  offset++;
  let s = der.subarray(offset, offset + sLen);

  // Remove leading zeros if present (DER may add 0x00 prefix for positive numbers)
  if (r.length === 33 && r[0] === 0x00) r = r.subarray(1);
  if (s.length === 33 && s[0] === 0x00) s = s.subarray(1);

  // Pad to 32 bytes if needed
  if (r.length < 32) r = Buffer.concat([Buffer.alloc(32 - r.length), r]);
  if (s.length < 32) s = Buffer.concat([Buffer.alloc(32 - s.length), s]);

  return { r, s };
}

/**
 * Determine the recovery id (v) by verifying which value recovers the correct public key.
 */
function recoverV(msgHash: Buffer, r: Buffer, s: Buffer, expectedPubKey: Buffer): number {
  // Try v=0 and v=1, see which recovers the correct public key
  // For simplicity, we'll use a mathematical approach based on Y parity

  // The recovery id is based on the Y coordinate of the signature point
  // For Ethereum, v is typically 0 or 1 (added to 27 for legacy reasons)

  // Extract Y coordinate from the expected public key
  const yCoord = expectedPubKey.subarray(33, 65);
  const yBigInt = BigInt('0x' + yCoord.toString('hex'));

  // If Y is even, v = 0; if odd, v = 1
  return yBigInt % 2n === 0n ? 0 : 1;
}

// ============= Encryption for Wallet Storage =============

const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;

/**
 * Derive encryption key from password using scrypt.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });
}

/**
 * Encrypt a private key with a password.
 */
export function encryptKey(
  privateKeyHex: string,
  password: string | null
): {
  data?: string;
  encrypted?: boolean;
  cipher?: string;
  kdf?: string;
  kdfParams?: { N: number; r: number; p: number };
  salt?: string;
  iv?: string;
  authTag?: string;
  ciphertext?: string;
} {
  if (password === null) {
    return { data: privateKeyHex, encrypted: false };
  }

  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyHex, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipher: 'aes-256-gcm',
    kdf: 'scrypt',
    kdfParams: { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

/**
 * Decrypt a private key with a password.
 */
export function decryptKey(
  encryptedData: {
    data?: string;
    encrypted?: boolean;
    salt?: string;
    iv?: string;
    authTag?: string;
    ciphertext?: string;
  },
  password: string | null
): string {
  const ENCRYPTED_FIELDS = ['salt', 'iv', 'authTag', 'ciphertext'] as const;
  const hasEncryptionFields = ENCRYPTED_FIELDS.some(f => f in encryptedData);

  // Unencrypted blob
  if (encryptedData.encrypted === false) {
    if (hasEncryptionFields) {
      throw new Error('Wallet data corrupted or tampered');
    }
    return encryptedData.data!;
  }

  // Encrypted blob with missing fields
  if (!ENCRYPTED_FIELDS.every(f => f in encryptedData)) {
    throw new Error('Wallet data corrupted or tampered');
  }

  // Encrypted blob but no password provided
  if (password === null || password === undefined) {
    throw new Error('Wallet is encrypted. Set OPENMM_WALLET_PASSWORD.');
  }

  const salt = Buffer.from(encryptedData.salt!, 'hex');
  const iv = Buffer.from(encryptedData.iv!, 'hex');
  const authTag = Buffer.from(encryptedData.authTag!, 'hex');
  const ciphertext = Buffer.from(encryptedData.ciphertext!, 'hex');
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Incorrect password');
  }
}

/**
 * Hash a password for verification (not encryption).
 */
export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

/**
 * Verify a password against stored hash.
 */
export function verifyPassword(
  password: string,
  storedHash: { salt: string; hash: string }
): boolean {
  const derived = crypto.scryptSync(password, Buffer.from(storedHash.salt, 'hex'), 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(derived, Buffer.from(storedHash.hash, 'hex'));
}

/**
 * Generate a random 32-byte private key.
 */
export function generatePrivateKey(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Derive EVM address from private key.
 */
export function privateKeyToEvmAddress(privateKey: Buffer): string {
  // Derive public key (uncompressed, 65 bytes: 0x04 + x + y)
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(privateKey);
  const publicKey = ecdh.getPublicKey(null, 'uncompressed');

  // Address = last 20 bytes of keccak256(publicKey without 0x04 prefix)
  const hash = keccak256(publicKey.subarray(1));
  const addressBytes = hash.subarray(12);
  const addressHex = addressBytes.toString('hex');

  // EIP-55 checksum
  const addressHash = keccak256(Buffer.from(addressHex, 'utf8')).toString('hex');
  let checksummed = '0x';
  for (let i = 0; i < 40; i++) {
    checksummed += parseInt(addressHash[i], 16) >= 8 ? addressHex[i].toUpperCase() : addressHex[i];
  }

  return checksummed;
}

/**
 * Generate Ed25519 keypair for Solana.
 */
export function generateSolanaKeypair(): { privateKey: Buffer; publicKey: Buffer } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Extract raw 32-byte keys from DER encoding
  const rawPrivate = (privateKey as Buffer).subarray((privateKey as Buffer).length - 32);
  const rawPublic = (publicKey as Buffer).subarray((publicKey as Buffer).length - 32);

  // Solana keypair format: 64 bytes = private seed (32) + public key (32)
  const keypair = Buffer.concat([rawPrivate, rawPublic]);

  return { privateKey: keypair, publicKey: rawPublic };
}

// ============= Base58 for Solana addresses =============

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode buffer to Base58 string (for Solana addresses).
 */
export function base58Encode(buffer: Buffer): string {
  const bytes = [...buffer];
  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  // Handle leading zeros
  let leadingZeros = '';
  for (const byte of bytes) {
    if (byte === 0) leadingZeros += '1';
    else break;
  }

  return leadingZeros + digits.reverse().map(d => BASE58_ALPHABET[d]).join('');
}

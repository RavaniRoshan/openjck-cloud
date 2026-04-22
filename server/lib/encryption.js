import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

// Encryption key from environment — NEVER hardcode
// Must be exactly 32 bytes (64 hex chars)
function getMasterKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns: { encrypted: string (base64), iv: string (base64) }
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const masterKey = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Store encrypted + authTag together (separated by ":")
  return {
    encrypted: encrypted + ':' + authTag.toString('base64'),
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt a previously encrypted string.
 * Returns: plaintext string
 */
export function decrypt(encryptedWithTag, ivBase64) {
  const [encrypted, authTagBase64] = encryptedWithTag.split(':');
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get the first N characters of a plaintext key for display.
 * Example: "sk-ant-api03-abc..." → "sk-ant-api"
 */
export function getKeyPrefix(plaintext, length = 10) {
  return plaintext.slice(0, length);
}

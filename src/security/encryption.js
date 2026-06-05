/**
 * encryption.js — FinGuard Field-Level Encryption
 *
 * Algorithm : AES-256-GCM
 * Key source : VITE_ENCRYPTION_KEY env variable (32-byte, base64-encoded)
 * API used   : Browser Web Crypto API (window.crypto.subtle) — no extra deps
 *
 * ─── What is encrypted ────────────────────────────────────────────────────────
 *  Sensitive financial fields written to / read from Firestore:
 *    salary, loanAmount, loanBalance, income, expenses, netWorth,
 *    accountNumber, cardNumber, balance (per-user financial balance)
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *  encrypt(value)  →  "<base64-iv>:<base64-ciphertext>"   (stored in Firestore)
 *  decrypt(value)  →  original plaintext string / number
 *
 *  A fresh 12-byte random IV is generated for EVERY encryption call.
 *  The IV is stored alongside the ciphertext (this is safe and standard).
 *
 * ─── Mobile app compatibility ─────────────────────────────────────────────────
 *  The Flutter mobile app must use the same key and algorithm:
 *    Package : encrypt (pub.dev/packages/encrypt)
 *    Algorithm : AES-GCM, 256-bit key, 12-byte IV
 *    Key format : same base64 key from VITE_ENCRYPTION_KEY
 *    Stored format : "<base64-iv>:<base64-ciphertext>"
 */

// ─── Key cache (imported once per session) ────────────────────────────────────
let _cryptoKey = null;

/**
 * Imports the raw key bytes from the env variable into a CryptoKey object.
 * Called lazily — only once per session.
 * @returns {Promise<CryptoKey>}
 */
async function getCryptoKey() {
  if (_cryptoKey) return _cryptoKey;

  const base64Key = import.meta.env.VITE_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error(
      '[FinGuard Encryption] VITE_ENCRYPTION_KEY is not set. ' +
      'Add it to your .env file before using encryption.'
    );
  }

  // Decode base64 → raw bytes
  const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  if (rawKey.length !== 32) {
    throw new Error(
      '[FinGuard Encryption] VITE_ENCRYPTION_KEY must be exactly 32 bytes (256 bits). ' +
      `Got ${rawKey.length} bytes.`
    );
  }

  _cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,           // non-extractable — cannot be exported from the browser
    ['encrypt', 'decrypt']
  );

  return _cryptoKey;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Uint8Array → base64 string */
function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

/** base64 string → Uint8Array */
function fromBase64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Check whether a string looks like our encrypted format "<iv>:<ct>" */
export function isEncrypted(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Encrypts a sensitive value.
 *
 * @param {string|number} value  The plaintext value to encrypt.
 * @returns {Promise<string>}    Encrypted string in format "<base64-iv>:<base64-ciphertext>".
 */
export async function encryptField(value) {
  if (value === null || value === undefined || value === '') return value;

  const key       = await getCryptoKey();
  const iv        = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const plaintext = new TextEncoder().encode(String(value));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipherBuffer))}`;
}

/**
 * Decrypts an encrypted field value.
 *
 * @param {string} encryptedValue  Encrypted string "<base64-iv>:<base64-ciphertext>".
 * @returns {Promise<string>}      Decrypted plaintext string.
 */
export async function decryptField(encryptedValue) {
  if (!isEncrypted(encryptedValue)) return encryptedValue; // already plaintext

  const key           = await getCryptoKey();
  const [ivB64, ctB64] = encryptedValue.split(':');
  const iv            = fromBase64(ivB64);
  const ciphertext    = fromBase64(ctB64);

  try {
    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plainBuffer);
  } catch (err) {
    console.error('[FinGuard Encryption] Decryption failed — wrong key or corrupted data:', err);
    return '[encrypted]'; // never crash the UI; return a placeholder
  }
}

/**
 * Encrypts a whole object's sensitive fields in one call.
 *
 * @param {object} data            Raw object to be stored in Firestore.
 * @param {string[]} sensitiveFields  Array of field names to encrypt.
 * @returns {Promise<object>}      New object with those fields encrypted.
 */
export async function encryptSensitiveFields(data, sensitiveFields) {
  const result = { ...data };
  await Promise.all(
    sensitiveFields.map(async (field) => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = await encryptField(result[field]);
      }
    })
  );
  return result;
}

/**
 * Decrypts a whole object's sensitive fields in one call.
 *
 * @param {object} data            Object read from Firestore (may have encrypted fields).
 * @param {string[]} sensitiveFields  Array of field names to decrypt.
 * @returns {Promise<object>}      New object with those fields decrypted.
 */
export async function decryptSensitiveFields(data, sensitiveFields) {
  const result = { ...data };
  await Promise.all(
    sensitiveFields.map(async (field) => {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = await decryptField(result[field]);
      }
    })
  );
  return result;
}

// ─── Sensitive field list (single source of truth) ───────────────────────────
/**
 * The canonical list of fields that must always be encrypted in Firestore.
 * Import this constant wherever you read/write user documents.
 */
export const USER_SENSITIVE_FIELDS = [
  'salary',
  'loanAmount',
  'loanBalance',
  'income',
  'expenses',
  'netWorth',
  'balance',
  'accountNumber',
  'cardNumber',
];

export const TRANSACTION_SENSITIVE_FIELDS = [
  'amount',
  'description',
];

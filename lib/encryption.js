// lib/encryption.js
// WebCrypto API helpers for End-to-End Encryption

/**
 * Derives a 256-bit AES-GCM master key from a PIN and salt (e.g. userId)
 * @param {string} pin - The user's 6-digit PIN
 * @param {string} saltString - A consistent salt (e.g., Clerk User ID)
 * @returns {Promise<CryptoKey>} - The derived AES-GCM key
 */
export async function deriveKey(pin, saltString) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = enc.encode(saltString);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can store it in memory/context if needed, though mostly used directly
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a JSON object into a Base64 string containing IV and Ciphertext.
 * @param {Object} payloadObj - The JSON object to encrypt (e.g. { symptoms, mood })
 * @param {CryptoKey} key - The AES-GCM key
 * @returns {Promise<string>} - Base64 encoded 'iv:ciphertext'
 */
export async function encryptPayload(payloadObj, key) {
  if (!key) throw new Error("Missing encryption key");
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = enc.encode(JSON.stringify(payloadObj));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encoded
  );

  // Convert to Base64
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

  return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypts a Base64 string containing IV and Ciphertext back into a JSON object.
 * @param {string} encryptedStr - Base64 encoded 'iv:ciphertext'
 * @param {CryptoKey} key - The AES-GCM key
 * @returns {Promise<Object>} - The original JSON object
 */
export async function decryptPayload(encryptedStr, key) {
  if (!key) throw new Error("Missing encryption key");
  if (!encryptedStr || !encryptedStr.includes(':')) {
    return null; // Handle legacy unencrypted data or invalid strings if needed
  }
  
  const [ivB64, cipherB64] = encryptedStr.split(':');
  
  const iv = new Uint8Array(atob(ivB64).split('').map(c => c.charCodeAt(0)));
  const cipherBuffer = new Uint8Array(atob(cipherB64).split('').map(c => c.charCodeAt(0)));

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      cipherBuffer
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (e) {
    console.error("Decryption failed", e);
    return null; // Fail gracefully
  }
}

/**
 * Generates a deterministic HMAC-SHA256 hash of a string (like a date) to use as an index.
 * Note: We derive an HMAC key from the master AES key to prevent reuse of the encryption key for hashing.
 * @param {string} dateString - The date string to hash
 * @param {CryptoKey} masterKey - The AES-GCM master key
 * @returns {Promise<string>} - Hex or Base64 encoded hash
 */
export async function hashDate(dateString, masterKey) {
  if (!masterKey) throw new Error("Missing encryption key");

  // Since masterKey is AES-GCM, we need an HMAC key. 
  // We can export the AES key and re-import as HMAC, or just use SHA-256 on a concat.
  // For simplicity and speed, let's export the raw key material and use it for HMAC.
  const rawKey = await crypto.subtle.exportKey('raw', masterKey);
  
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    enc.encode(dateString)
  );

  // Return hex string
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

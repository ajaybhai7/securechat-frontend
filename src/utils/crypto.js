// src/utils/crypto.js

// Generate a new RSA key pair for a user
export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keyPair;
}

// Convert CryptoKey to base64 string for sending to server
export async function exportPublicKey(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function exportPrivateKey(key) {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import base64 string back to CryptoKey
export async function importPublicKey(base64Key) {
  const binaryDer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(base64Key) {
  const binaryDer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// Encrypt a message using the recipient's public key
export async function encryptMessage(message, publicKey) {
  const encoded = new TextEncoder().encode(message);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoded
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// Decrypt a message using your own private key
export async function decryptMessage(encryptedBase64, privateKey) {
  const binaryDer = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    binaryDer
  );
  return new TextDecoder().decode(decrypted);
}

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Safely convert any Uint8Array to an exact ArrayBuffer respecting byteOffset and byteLength
function toSafeArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

// Format 128-bit entropy into 3 groups of 4 uppercase alphanumeric characters: ABCD-EFGH-IJKL
export function generateSecurityKey(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Unambiguous Base32 charset
  let raw = '';
  for (let i = 0; i < bytes.length; i++) {
    raw += chars[bytes[i] % chars.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

// Generate Curve25519 Identity Keypair
export function generateIdentityKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  };
}

// Derive public key from existing Curve25519 private key
export function getPublicKeyFromPrivateKey(privateKeyBase64: string): string {
  try {
    const secretKey = decodeBase64(privateKeyBase64);
    const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
    return encodeBase64(keyPair.publicKey);
  } catch (err) {
    console.warn('Failed to derive public key from secret key:', err);
    return '';
  }
}

// Convert string password to WebCrypto CryptoKey via PBKDF2
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const saltBuffer = toSafeArrayBuffer(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Compute salted PBKDF2 password hash (100,000 rounds)
export async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const saltBuffer = toSafeArrayBuffer(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return encodeBase64(new Uint8Array(hashBuffer));
}

// Encrypt local private data with password-derived CryptoKey (AES-256-GCM)
export async function encryptWithCryptoKey(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toSafeArrayBuffer(iv) },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: encodeBase64(new Uint8Array(encrypted)),
    iv: encodeBase64(iv),
  };
}

// Decrypt local private data with password-derived CryptoKey
export async function decryptWithCryptoKey(ciphertextBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const dec = new TextDecoder();
  const ciphertext = decodeBase64(ciphertextBase64);
  const iv = decodeBase64(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toSafeArrayBuffer(iv) },
    key,
    toSafeArrayBuffer(ciphertext)
  );

  return dec.decode(decrypted);
}

// E2EE Payload Encryption using Curve25519 DH + AES-256-GCM
export async function encryptE2EEPayload(
  plaintext: string,
  recipientPublicKeyBase64: string,
  senderPrivateKeyBase64: string
): Promise<string> {
  const recipientPubKey = decodeBase64(recipientPublicKeyBase64);
  const senderPrivKey = decodeBase64(senderPrivateKeyBase64);

  // Compute Curve25519 Shared Secret
  const sharedSecret = nacl.box.before(recipientPubKey, senderPrivKey);

  // Import shared secret into WebCrypto
  const sharedCryptoKey = await crypto.subtle.importKey(
    'raw',
    toSafeArrayBuffer(sharedSecret),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random 96-bit IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toSafeArrayBuffer(iv) },
    sharedCryptoKey,
    enc.encode(plaintext)
  );

  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);

  return encodeBase64(combined);
}

// E2EE Payload Decryption
export async function decryptE2EEPayload(
  combinedBase64: string,
  peerPublicKeyBase64: string,
  myPrivateKeyBase64: string
): Promise<string> {
  const combined = decodeBase64(combinedBase64);
  if (combined.length < 12) {
    throw new Error('Invalid ciphertext payload format: length less than IV header');
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const peerPubKey = decodeBase64(peerPublicKeyBase64);
  const myPrivKey = decodeBase64(myPrivateKeyBase64);

  // Compute Curve25519 Shared Secret: DH(peerPubKey, myPrivKey)
  const sharedSecret = nacl.box.before(peerPubKey, myPrivKey);

  const sharedCryptoKey = await crypto.subtle.importKey(
    'raw',
    toSafeArrayBuffer(sharedSecret),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toSafeArrayBuffer(iv) },
    sharedCryptoKey,
    toSafeArrayBuffer(ciphertext)
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

// Generate printable Safety Number fingerprint from two public keys
export async function generateSafetyNumber(pubKeyA: string, pubKeyB: string): Promise<string> {
  const sorted = [pubKeyA, pubKeyB].sort().join(':');
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(sorted));
  const byteArray = new Uint8Array(hashBuffer);

  let digits = '';
  for (let i = 0; i < 15; i++) {
    const num = (byteArray[i] % 100000).toString().padStart(5, '0');
    digits += num + ' ';
    if ((i + 1) % 3 === 0 && i < 14) {
      digits += '\n';
    }
  }

  return digits.trim();
}

// Convert and compress client-side Image File to Base64 data URL
export function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Compute a cryptographic SHA-256 tamper-proof token for Aegis QR verification
export async function computeAegisQRToken(uid: string, username: string, publicKey: string, origin: string): Promise<string> {
  const enc = new TextEncoder();
  const cleanUid = (uid || '').trim().toLowerCase();
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanPub = (publicKey || '').trim();
  const cleanOrigin = (origin || '').trim();
  const data = enc.encode(`aegis-qr-auth-v2:${cleanUid}:${cleanUsername}:${cleanPub}:${cleanOrigin}:shield-secure-v3`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

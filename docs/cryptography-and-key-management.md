# Aegis Cryptography and Key Management

## 1. Key Taxonomy
1. **Identity Key Pair (IK):** Long-term Ed25519 / Curve25519 key pair representing the user's permanent identity.
2. **Signed Prekey (SPK):** Medium-term Curve25519 key pair signed by the Identity Key.
3. **One-Time Prekeys (OPK):** Pool of single-use Curve25519 key pairs consumed during initial session establishment.
4. **Ratchet Header & Chain Keys:** Ephemeral symmetric ratchet keys updated on every message turn (Forward Secrecy & Break-in Recovery).
5. **Security Key:** 128-bit cryptographically secure random value (`ABCD-EFGH-IJKL`). Used as a high-entropy key recovery credential.

## 2. Cryptographic Algorithms
- **Asymmetric Signature:** Ed25519 (`tweetnacl.sign`).
- **Asymmetric Diffie-Hellman:** Curve25519 / X25519 (`tweetnacl.box` / `scalarMult`).
- **Symmetric Encryption:** AES-256-GCM (via Web Crypto API `crypto.subtle.encrypt` with 96-bit random IV and 128-bit tag).
- **Key Derivation Function:** HKDF-SHA256 (Web Crypto) and PBKDF2-SHA256 (100,000 iterations for password wrapping).

## 3. Key Storage & Device Protection
- Private key material is derived and wrapped locally using PBKDF2 derived from user credentials.
- Stored exclusively in IndexedDB.
- Never sent to Firebase, external logs, analytics, or URL parameters.
- Cleared from active runtime memory on session end / logout.

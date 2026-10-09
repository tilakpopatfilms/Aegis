# Aegis System Architecture

## 1. Overview & Core Philosophy
Aegis is a zero-knowledge, privacy-first, end-to-end encrypted (E2EE) messaging platform built with TypeScript, React, IndexedDB, Firebase Firestore, and Web Cryptography / Curve25519 (X25519 + Ed25519 + AES-256-GCM). The primary goal is to ensure that message content and media attachments are strictly readable only by the intended recipient devices. The server (Firebase / cloud infrastructure) serves solely as an untrusted store-and-forward relay and public key directory.

## 2. Platform Layers & Trust Boundaries
- **Client (Untrusted Environment wrt Third Parties, Trusted Environment wrt End User):**
  - Executes E2EE key generation, session establishment, symmetric encryption/decryption, and local conversation history storage in IndexedDB.
  - Keeps private identity keys and session keys local-only (never uploaded to any server or cloud database).
- **Relay Server (Firebase Firestore / Cloud Storage - Untrusted wrt Plaintext):**
  - Stores public identity keys, signed prekeys, and short-lived encrypted ciphertext payloads.
  - Manages atomic username reservation to enforce unique public usernames.
  - Holds zero decryption keys and cannot read message text, attachments, or conversation titles.
- **Network Boundary:**
  - Transport Layer Security (TLS 1.3) protects transit metadata between clients and Firebase.
  - End-to-end payload encryption ensures that even if TLS is terminated or intercepted at proxy levels, the message payload remains unreadable ciphertext.

## 3. Cryptographic Foundation
- **Identity & Signatures:** Ed25519 for identity keys and prekey signatures.
- **Key Exchange:** X25519 (Diffie-Hellman over Curve25519) combined with HKDF-SHA256 for Double-Ratchet or Extended Triple Diffie-Hellman (X3DH) session initialization.
- **Payload Encryption:** AES-256-GCM with unique 96-bit initialization vectors (IVs) and 128-bit authentication tags for message bodies and media attachments.
- **Security Key Generation:** 128 bits of cryptographically secure random entropy encoded in 3-group format (`ABCD-EFGH-IJKL`).

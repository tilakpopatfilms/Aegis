# Aegis System Data Flow

```
+------------------+         (1) E2EE Key Initialization         +------------------+
|                  | -------------------------------------------> |                  |
| Sender Client A  |                                              | Firestore Relay  |
|                  | <------------------------------------------- |                  |
+------------------+         (2) Fetch Recipient B Public Keys    +------------------+
         |                                                                 ^
         | (3) Local E2EE Encryption (AES-GCM-256 + Ephemeral DH)          |
         v                                                                 |
+------------------+         (4) Submit Ciphertext Payload                 |
| Sender IndexedDB | ------------------------------------------------------+
+------------------+
                                                                           |
                                                                           | (5) Real-time Sync / Store-and-Forward
                                                                           v
                                                                 +------------------+
                                                                 | Recipient B      |
                                                                 | Client           |
                                                                 +------------------+
                                                                           |
                                                                           | (6) Local E2EE Decryption
                                                                           v
                                                                 +------------------+
                                                                 | Recipient B      |
                                                                 | IndexedDB        |
                                                                 +------------------+
```

## Step-by-Step Data Flows

### 1. Account Creation & Key Generation
1. User enters Profile Photo, Full Name, Username, Account Type (Public/Private), Password.
2. Username availability is atomically checked and reserved on Firestore.
3. Client generates:
   - Client Identity Keypair (Ed25519 & X25519).
   - Signed Prekey & Ephemeral Prekeys.
   - 128-bit Security Key (`ABCD-EFGH-IJKL`).
4. Public keys are published to Firestore `/public_profiles/{uid}` and `/prekeys/{uid}`.
5. Private identity material is wrapped with a PBKDF2/Argon2 key derived from the user password + salt and saved into local browser IndexedDB.

### 2. Message Outbound Flow
1. Sender composes message / selects image.
2. Sender fetches Recipient's public identity key and current signed prekey from Firestore.
3. Client executes X3DH / Double Ratchet session calculation locally.
4. Payload (text, reaction, image key) is encrypted with AES-256-GCM.
5. Ciphertext + ephemeral header + sender UID + recipient UID + expiration TTL is posted to Firestore `/messages`.
6. Decrypted copy is saved locally to Sender's IndexedDB.

### 3. Message Inbound & Decryption Flow
1. Recipient receives Firestore realtime notification or query for incoming messages targeting recipient UID.
2. Client loads ratcheted session or initial prekey session from local IndexedDB.
3. Client verifies MAC/AEAD tag and decrypts payload locally.
4. Decrypted message is saved in Recipient's IndexedDB.
5. Server ciphertext document is acknowledged and marked for auto-deletion / cleaned up.
6. Local timer schedules expiration based on requested ephemeral settings.

# Aegis Data Model Schema

## 1. Firestore Collections (Relay & Public Metadata)

### `/usernames/{username}`
- **Purpose:** Unique username claim registry.
- **Fields:**
  - `uid` (string): Owner user ID.
  - `createdAt` (timestamp): Registration time.
- **Access:** Read by signed-in users for uniqueness check. Write strictly atomic during sign-up.

### `/public_profiles/{uid}`
- **Purpose:** Directory for account discovery and identity verification.
- **Fields:**
  - `username` (string): Lowercase normalized username.
  - `fullName` (string): Display name.
  - `photoURL` (string, optional): Avatar image URL.
  - `accountType` (string): `'public'` or `'private'`.
  - `publicKey` (string): Base64 encoded Ed25519 public identity key.
  - `createdAt` (timestamp).
- **Access:** Public account search queries only match `accountType == 'public'`. Direct lookup by exact UID or username permitted for connections.

### `/prekeys/{uid}`
- **Purpose:** Public E2EE prekeys for session establishment (X3DH).
- **Fields:**
  - `signedPrekey` (string): Base64 public key.
  - `signedPrekeySignature` (string): Base64 signature by Identity Key.
  - `oneTimePrekeys` (array of strings): Pool of single-use public prekeys.
  - `updatedAt` (timestamp).

### `/conversations/{conversationId}`
- **Purpose:** Shared state and membership for 1-on-1 chats.
- **Fields:**
  - `participants` (array of strings): Pair `[uid1, uid2]`.
  - `createdAt` (timestamp).
  - `ephemeralSetting` (string): `'off'`, `'viewed'`, `'1h'`, `'24h'`, `'7d'`.
  - `updatedAt` (timestamp).

### `/messages/{messageId}`
- **Purpose:** Temporary store-and-forward encrypted payloads.
- **Fields:**
  - `conversationId` (string): Associated chat ID.
  - `senderUid` (string): Author UID.
  - `recipientUid` (string): Target recipient UID.
  - `ciphertext` (string): Base64 payload containing encrypted message/attachment metadata.
  - `ephemeralType` (string): Expiration setting.
  - `createdAt` (timestamp).
  - `expiresAt` (timestamp): TTL timestamp for backend cleanup.

## 2. IndexedDB Schema (Client Local-First Storage)

### Database: `AegisLocalDB` (Version 1)
- `conversations` (keyPath: `id`): Local conversation metadata, unread counts, pinned state, muted state.
- `messages` (keyPath: `id`): Decrypted message text, local image blobs, status (`sending`, `delivered`, `read`), timestamp, expiration date.
- `keyStore` (keyPath: `id`): Encrypted private identity keys, prekey state, Double Ratchet session ratchets.
- `contacts` (keyPath: `uid`): Verified safety numbers, local nicknames, and connection state.

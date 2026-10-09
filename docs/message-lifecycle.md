# Aegis Message Lifecycle

## 1. Lifecycle States
1. **Composition:** Local draft created in memory.
2. **Local Encrypt:** Message payload encrypted via AES-256-GCM. Decrypted copy written to local IndexedDB (`status: 'sending'`).
3. **Relay Enqueue:** Ciphertext posted to Firestore `/messages`.
4. **Relay Delivery:** Recipient client fetches or receives real-time payload snapshot.
5. **Local Decrypt:** Recipient verifies AEAD tag, decrypts payload, and writes to recipient IndexedDB (`status: 'delivered'` / `'read'`).
6. **Relay Cleanup:** Server ciphertext document deleted upon delivery or upon reaching `expiresAt` TTL.
7. **Local Expiration:** Local client timer deletes message from local IndexedDB based on ephemeral settings.

## 2. Receipt Handling
- Delivery Receipts & Read Receipts sent as encrypted micro-payloads if enabled in Privacy Settings.
- Receipts contain message ID and timestamp; zero message text.

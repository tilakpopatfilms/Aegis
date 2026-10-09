# Aegis Security Specification & Rules Architecture

## 1. Core Security Invariants
- **Zero-Knowledge Ciphertext Storage:** Messages, attachments, and private keys MUST NOT exist in plaintext in Firestore documents.
- **Participant Access Gate:** Reading or writing a document in `/messages/{messageId}` or `/conversations/{conversationId}` requires `request.auth.uid` to be listed as a participant in the conversation or sender/recipient.
- **Atomic Username Claim:** `/usernames/{username}` requires `uid == request.auth.uid`. No user can claim or overwrite another user's registered username.
- **System Field Immutability:** `createdAt`, `senderUid`, `uid`, and `conversationId` cannot be updated post-creation.

## 2. Dirty Dozen Threat Payloads Tested
1. **Public Eavesdrop Attack:** Unauthenticated read request to `/messages/{messageId}`. -> REJECTED
2. **Third-Party Read Attack:** Authenticated user C attempting read on conversation between A & B. -> REJECTED
3. **Username Spoof Attack:** User A attempting to create `/usernames/bob` with `uid: 'alice_uid'`. -> REJECTED
4. **Ciphertext Tampering Attack:** User B updating `senderUid` on an existing message to impersonate User A. -> REJECTED
5. **Denial-of-Wallet String Inflation:** Submitting 2MB ciphertext into message payload exceeding 100,000 char boundary. -> REJECTED
6. **Path Traversal ID Poisoning:** Document ID containing path traversal symbols or invalid characters. -> REJECTED
7. **Identity Key Overwrite:** User B attempting to overwrite User A's public key in `/public_profiles/alice_uid`. -> REJECTED
8. **Private Profile Exposure:** Public username search query trying to fetch private account profiles (`accountType: 'private'`). -> REJECTED
9. **Ephemeral Timestamp Forgery:** Setting client-forged `createdAt` timestamp 10 years in the future. -> REJECTED
10. **Prekey Hijacking:** User B updating User A's signed prekey in `/prekeys/alice_uid`. -> REJECTED
11. **Conversation Member Escalation:** User C adding themselves to conversation `[A, B]` via partial update. -> REJECTED
12. **System Timestamp Overwrite:** Overwriting server `expiresAt` or `createdAt` on existing messages. -> REJECTED

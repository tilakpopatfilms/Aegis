# Aegis Firebase Security Architecture

## 1. Zero-Trust Access Strategy
1. **Default Deny:** All Firestore collections and Storage buckets reject read and write by default.
2. **Authentication Required:** All read and write operations require valid `request.auth != null` with `email_verified == true` where relevant.
3. **Immutability Protection:** Critical relational fields (`uid`, `senderUid`, `createdAt`) cannot be altered post-creation.
4. **Data Isolation:** Private profile metadata and user messages are isolated to authorized conversation participants.

## 2. Firestore Rule Pillars Enforced
- **Master Gate:** Sub-collections require participant membership check in parent document.
- **Validation Blueprints:** Every write calls `isValid[Entity]()` helper validating data types, string max lengths, and regex patterns.
- **ID Poisoning Guard:** Path variables verified with `isValidId()`.
- **System Field Lock:** Users cannot overwrite server-managed `createdAt` or `expiresAt` timestamps with forged client time.
- **Payload Size Control:** String fields capped (e.g. `ciphertext` max 100,000 chars, `username` max 30 chars).

# Aegis Security Test Plan

## 1. Cryptographic Validation
- Test AES-256-GCM encryption/decryption with valid and tampered IVs.
- Verify signature checks on signed prekeys reject forged signatures.
- Ensure private key exports are blocked and unauthenticated endpoints return no secrets.

## 2. Firestore Rule Verification
- Test unauthorized read on `/messages/{id}` from non-participants (expect PERMISSION_DENIED).
- Test illegal payload modification during update (expect PERMISSION_DENIED).
- Test duplicate username reservation race conditions.
- Test private account exclusion from public username search queries.

## 3. Account & Local Storage Security
- Verify Security Key unmasking requires re-authentication.
- Verify IndexedDB local storage wipes active keys on logout.
- Test ephemeral message expiration cleanup from local storage and backend TTL.

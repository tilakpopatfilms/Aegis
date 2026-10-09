# Aegis Ephemeral Messaging Specification

## 1. Timer Options
- **Off:** Messages persist in local IndexedDB until manually deleted.
- **After Viewed:** Expiration timer starts immediately when recipient views message in active viewport.
- **1 Hour:** Expiration set to 3,600 seconds from send time.
- **24 Hours:** Expiration set to 86,400 seconds from send time.
- **7 Days:** Expiration set to 604,800 seconds from send time.

## 2. Expiration & Deletion Operations
1. **Server TTL Enforcement:** Firestore security rules and backend cleanup enforce deletion of temporary ciphertexts matching `expiresAt <= request.time`.
2. **Client Garbage Collection:** Client background worker runs periodic sweep on local IndexedDB to permanently purge expired messages, thumbnails, and key blocks.
3. **Storage Sanitization:** Local IndexedDB record removal uses explicit key deletion to prevent stale references.

# Aegis QR-Based Connection Protocol

## 1. QR Payload Format
QR code payload consists of a structured JSON object:
```json
{
  "protocol": "aegis-v1",
  "username": "alice",
  "uid": "USER_ID_123",
  "publicKey": "BASE64_PUBLIC_IDENTITY_KEY",
  "token": "SHORT_LIVED_SIGNED_NONCE"
}
```

## 2. Security Boundaries & Verification
- QR payload contains ONLY public identity material and short-lived nonces.
- NEVER contains passwords, Security Keys, private keys, or session tokens.
- Scanning QR automatically verifies the user's public identity key ("Safety Number"), establishing verified status for 1-on-1 chats.
- Prevents Man-in-the-Middle (MITM) key replacement attacks.

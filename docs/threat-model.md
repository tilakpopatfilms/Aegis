# Aegis Threat Model

## 1. Primary Assets
1. **Message Plaintext & Media:** Confidentiality and integrity of conversations between users.
2. **Private Cryptographic Keys:** Long-term Identity Private Keys, Ratchet Keys, and Session Master Keys.
3. **User Account Credentials:** Passwords, password salt/hash, and Security Keys (`ABCD-EFGH-IJKL`).
4. **Metadata & Social Graph:** Relationship linkages between sender and recipient, activity timestamps, and private account discovery status.

## 2. Threat Actors & Attack Vectors
1. **Malicious / Compromised Server (Untrusted Cloud Provider):**
   - *Goal:* Intercept or decrypt messages, alter public prekeys, harvest contact graphs.
   - *Mitigation:* E2EE payload encryption with AES-GCM-256; identity key verification via safety numbers and QR code signatures; server holds zero decryption keys.
2. **Eavesdropper on Network (Man-In-The-Middle / Wi-Fi Sniffer):**
   - *Goal:* Intercept transit data or modify payloads in transit.
   - *Mitigation:* Strict TLS 1.3 requirement + double protection via E2EE payload signatures.
3. **Malicious Client / Malicious User:**
   - *Goal:* Impersonate usernames, reserve arbitrary accounts, harvest public usernames, replay old ciphertexts.
   - *Mitigation:* Atomic Firestore rules for username reservation; strict non-replay IV tracking; client-side rate limiting and server-side rules.
4. **Physical Device Theft / Compromised Browser Storage:**
   - *Goal:* Read cached conversation history in IndexedDB.
   - *Mitigation:* Local IndexedDB dataset encrypted with a device-bound key; clear session memory on logout; disappearing message cleanup.

## 3. Security Boundary & Explicit Non-Goals
- **Screenshots / External Cameras:** Browser platforms cannot physically prevent a secondary hardware camera from recording a screen. Ephemeral timers reduce window of exposure but cannot prevent analogue capture.
- **Compromised Operating System / Browser Malware (Keyloggers):** If malware possesses root access to the browser runtime, it can hook DOM inputs. Web application isolation relies on browser SOP (Same-Origin Policy).

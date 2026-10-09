# Aegis Authentication and Account Recovery

## 1. Authentication Flows
### Option A: Username + Password
1. Client resolves normalized username to user ID via `/usernames/{username}`.
2. Performs Firebase Authentication sign-in using registered credentials.
3. Decrypts locally stored private identity keys using password-derived wrapping key.

### Option B: Username + Security Key
1. Client verifies normalized username and validates 128-bit Security Key (`ABCD-EFGH-IJKL`).
2. Security Key acts as entropy seed to unlock account recovery state or re-key identity.

## 2. Security Key Handling
- Generated ONCE at account creation (`crypto.getRandomValues`).
- Formatting: 12 uppercase alphanumeric characters in 3 groups of 4 separated by dashes (`ABCD-EFGH-IJKL`).
- Displayed masked (`••••-••••-••••`) in Profile Settings.
- Requires password re-authentication before unmasking or copying to clipboard.
- Never stored plaintext on server.

## 3. Account Recovery Model
- Server password reset ONLY resets authentication access to the server account.
- It does NOT grant access to existing encrypted message history stored on local devices unless backed up with a recovery secret.
- Clear user notices explicitly inform users that losing both password and Security Key prevents message history recovery.

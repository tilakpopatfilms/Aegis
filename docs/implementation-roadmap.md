# Aegis Implementation Roadmap

## Phase 1 — Discovery & Architecture Documentation
- Complete repository audit and dependencies configuration.
- Generate standard architecture, security, and data flow documentation (`docs/*`).

## Phase 2 — Firebase Provisioning & Security Rules
- Provision Firebase backend via AI Studio interface (`show_aistudio_ui` / `GetFirebaseTos` / `ProvisionFirebase`).
- Construct `firebase-blueprint.json` and strict zero-trust `firestore.rules`.

## Phase 3 — Authentication & Account Setup
- Build 6-field registration flow with race-safe atomic username reservation.
- Implement 128-bit Security Key generation (`ABCD-EFGH-IJKL`) and secure display.
- Build Sign-In and Session Management.

## Phase 4 — Cryptographic Foundation & Local Storage
- Implement Curve25519/Ed25519 E2EE protocol and key derivation engine.
- Configure IndexedDB schema (`AegisLocalDB`) for local-first encrypted chat history.

## Phase 5 — Real-time E2EE Store-and-Forward Messaging
- Build 1-on-1 chat interface, message composer, and real-time store-and-forward relay.
- Implement image attachment client-side encryption and preview rendering.

## Phase 6 — Ephemeral Messaging & QR Connections
- Implement disappearing message timers (Off, After viewed, 1h, 24h, 7d) and local/server cleanup.
- Build QR code identity generator and QR code camera/file scanner.

## Phase 7 — User Discovery, Settings & UI Polish
- Implement Public username search & Private account exact lookup.
- Polish Chats, Search, and Profile UI with dark/light themes and full mobile responsiveness.

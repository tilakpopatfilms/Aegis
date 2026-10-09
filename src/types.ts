export type AccountType = 'public' | 'private';

export type EphemeralSetting = 'off' | 'viewed' | '1h' | '24h' | '7d';

export interface UserProfile {
  uid: string;
  username: string; // Lowercase normalized
  fullName: string;
  photoURL?: string;
  accountType: AccountType;
  publicKey: string; // Base64 Ed25519/Curve25519 identity public key
  bio?: string;
  createdAt: string;
}

export interface UserPrekeys {
  uid: string;
  signedPrekey: string;
  signedPrekeySignature: string;
  updatedAt: string;
}

export interface LocalKeyPair {
  publicKey: string;
  privateKeyEncrypted: string; // Encrypted with password derived key
  salt: string;
}

export interface LocalSecurityKey {
  maskedKey: string;
  unmaskedKeyEncrypted: string;
  salt: string;
}

export interface Conversation {
  id: string; // Unique conversation id
  participants: string[]; // [uid1, uid2]
  ephemeralSetting: EphemeralSetting;
  createdAt: string;
  updatedAt: string;
  // Local transient fields:
  otherUser?: UserProfile;
  unreadCount?: number;
  lastMessageText?: string;
  lastMessageTime?: string;
  isPinned?: boolean;
  isMuted?: boolean;
}

export interface EncryptedMessagePayload {
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  ciphertext: string; // Base64 payload (JSON encrypted via AES-256-GCM)
  ephemeralType: EphemeralSetting;
  createdAt: string;
  expiresAt?: string;
  read?: boolean;
}

export interface PlaintextMessageContent {
  text?: string;
  imageBlobUrl?: string; // Local Object URL for decrypted images
  imageBase64?: string;
  fileName?: string;
  replyToId?: string;
  reactions?: Record<string, string[]>; // reactionEmoji -> array of uids
}

export interface DecryptedMessage {
  id: string;
  conversationId: string;
  senderUid: string;
  recipientUid: string;
  content: PlaintextMessageContent;
  ephemeralType: EphemeralSetting;
  status: 'sending' | 'delivered' | 'read' | 'expired';
  timestamp: string;
  expiresAtTimestamp?: number; // UNIX ms for expiration
  reactions?: Record<string, string[]>;
  replyToId?: string;
}

export interface SafetyNumberInfo {
  contactUid: string;
  fingerprint: string; // Printable safety number string (e.g., 5-digit blocks)
  verified: boolean;
  verifiedAt?: string;
}

export interface UserPrivacySettings {
  readReceipts: boolean;
  typingIndicators: boolean;
  onlineStatus: boolean;
  defaultEphemeral: EphemeralSetting;
  blockedUids: string[];
}

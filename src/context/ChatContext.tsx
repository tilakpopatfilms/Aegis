import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import {
  Conversation,
  DecryptedMessage,
  EncryptedMessagePayload,
  PlaintextMessageContent,
  UserProfile,
  EphemeralSetting,
} from '../types';
import {
  saveLocalMessage,
  getLocalMessages,
  deleteLocalMessage,
  saveLocalConversation,
  getLocalConversations,
  deleteLocalConversation,
  purgeExpiredLocalMessages,
  isConversationDeleted,
  markConversationAsDeleted,
  unmarkConversationAsDeleted,
  getLocalConversation,
  getKeyStoreItem,
  saveKeyStoreItem,
  saveLocalProfile,
  getLocalProfile,
} from '../db/localDb';
import {
  encryptE2EEPayload,
  decryptE2EEPayload,
  compressImageFile,
  getPublicKeyFromPrivateKey,
  generateIdentityKeyPair,
} from '../crypto/crypto';

export const getDeterministicConversationId = (uid1: string, uid2: string): string => {
  const sorted = [uid1, uid2].sort();
  const cleanA = sorted[0].replace(/[^a-zA-Z0-9_]/g, '');
  const cleanB = sorted[1].replace(/[^a-zA-Z0-9_]/g, '');
  return `conv_${cleanA}__${cleanB}`;
};

interface ChatContextType {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: DecryptedMessage[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  selectConversation: (conv: Conversation | null) => Promise<void>;
  startOrGetConversation: (otherUserUid: string) => Promise<Conversation>;
  sendTextMessage: (text: string, replyToId?: string) => Promise<void>;
  sendImageMessage: (file: File) => Promise<void>;
  sendVoiceMessage: (audioBlob: Blob, durationSeconds: number) => Promise<void>;
  updateEphemeralSetting: (setting: EphemeralSetting) => Promise<void>;
  addMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessageLocally: (messageId: string) => Promise<void>;
  deleteConversationLocally: (conversationId: string) => Promise<void>;
  togglePinConversation: (conversationId: string) => Promise<boolean>;
  toggleMuteConversation: (conversationId: string) => Promise<void>;
  pinnedConversations: Conversation[];
  pinLimitNotice: string | null;
  clearPinNotice: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile, getLocalPrivateKey } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  // Helper to calculate ephemeral expiration timestamp
  const calculateExpiresAt = (setting: EphemeralSetting): number | undefined => {
    const now = Date.now();
    switch (setting) {
      case '1h':
        return now + 3600 * 1000;
      case '24h':
        return now + 24 * 3600 * 1000;
      case '7d':
        return now + 7 * 86400 * 1000;
      case 'viewed':
        return now + 60 * 1000;
      default:
        return undefined;
    }
  };

  // 1. Sync Conversations from Local DB & Firestore
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setSelectedConversation(null);
      setMessages([]);
      setLoadingConversations(false);
      return;
    }

    // Always load local conversations first for instant offline review
    const loadLocal = async () => {
      const localList = await getLocalConversations(user.uid);

      // Asynchronously ensure all conversations have peer profiles populated from local cache first
      for (const c of localList) {
        const otherUid = c.participants.find((p) => p !== user.uid);
        if (otherUid && (!c.otherUser || !c.otherUser.fullName || c.otherUser.username === 'contact')) {
          // 1. Check local IndexedDB / localStorage cache
          const cachedProfile = await getLocalProfile(otherUid);
          if (cachedProfile) {
            c.otherUser = cachedProfile;
            await saveLocalConversation(c, true);
          } else {
            // 2. Fallback to cloud if online
            try {
              const snap = await getDoc(doc(db, 'public_profiles', otherUid));
              if (snap.exists()) {
                const cloudProfile = snap.data() as UserProfile;
                c.otherUser = cloudProfile;
                await saveLocalProfile(cloudProfile);
                await saveLocalConversation(c, true);
              }
            } catch (e) {}
          }
        }
      }

      // Clean up any empty ghost conversations that have no messages from local DB
      for (const c of localList) {
        const hasMessages = !!c.lastMessageText || !!c.lastMessageTime;
        if (!hasMessages) {
          await deleteLocalConversation(c.id);
        }
      }

      // Filter out ghost conversations that have no messages or invalid contact placeholders
      const validConvs = localList.filter((c) => {
        const hasMessages = !!c.lastMessageText || !!c.lastMessageTime;
        const isValidUsername = c.otherUser?.username && c.otherUser.username !== 'contact';
        return hasMessages && isValidUsername;
      });

      setConversations(validConvs);
      setLoadingConversations(false);
    };

    loadLocal();

    // Firestore real-time listener for user's active conversations
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const loaded: Conversation[] = [];
        for (const changeDoc of snapshot.docs) {
          const convId = changeDoc.id;

          // Check if user previously deleted this conversation
          const isDeleted = await isConversationDeleted(convId);
          if (isDeleted) continue;

          const data = changeDoc.data() as Conversation;
          data.id = convId;

          // Only sync cloud conversations that have messages or valid activity
          if (!data.lastMessageText && !data.lastMessageTime) continue;

          // Resolve peer contact profile
          const otherUid = data.participants.find((p) => p !== user.uid);
          if (otherUid) {
            // First check local offline profile cache
            const cachedProfile = await getLocalProfile(otherUid);
            if (cachedProfile) {
              data.otherUser = cachedProfile;
            }

            if (data.participantDetails && data.participantDetails[otherUid]) {
              const details = data.participantDetails[otherUid];
              if (!data.otherUser || data.otherUser.username === 'contact') {
                data.otherUser = {
                  uid: otherUid,
                  username: details.username && details.username !== 'contact' ? details.username : (otherUid.startsWith('usr_') ? otherUid.split('_')[1] : 'user'),
                  fullName: details.fullName || details.username || 'Contact',
                  photoURL: details.photoURL,
                  accountType: 'public',
                  publicKey: details.publicKey || '',
                  createdAt: data.createdAt || new Date().toISOString(),
                };
                if (data.otherUser) await saveLocalProfile(data.otherUser);
              }
            }

            if (!data.otherUser || !data.otherUser.fullName) {
              try {
                const otherSnap = await getDoc(doc(db, 'public_profiles', otherUid));
                if (otherSnap.exists()) {
                  data.otherUser = otherSnap.data() as UserProfile;
                  await saveLocalProfile(data.otherUser);
                }
              } catch (err) {
                console.warn('Notice loading contact profile:', err);
              }
            }
          }

          loaded.push(data);
          await saveLocalConversation(data);
        }

        // Merge with existing local conversations
        const localList = await getLocalConversations(user.uid);
        const mergedMap = new Map<string, Conversation>();

        localList.forEach((c) => mergedMap.set(c.id, c));
        loaded.forEach((c) => {
          const existing = mergedMap.get(c.id);
          mergedMap.set(c.id, {
            ...existing,
            ...c,
            lastMessageText: c.lastMessageText || existing?.lastMessageText,
            lastMessageTime: c.lastMessageTime || existing?.lastMessageTime,
            lastSenderUid: c.lastSenderUid || existing?.lastSenderUid,
            lastMessageStatus: c.lastMessageStatus || existing?.lastMessageStatus,
            lastReaction: c.lastReaction || existing?.lastReaction,
            otherUser: c.otherUser || existing?.otherUser,
            isPinned: existing?.isPinned,
            isMuted: existing?.isMuted,
            localEphemeralSetting: existing?.localEphemeralSetting || c.localEphemeralSetting,
          });
        });

        const finalList = Array.from(mergedMap.values())
          .filter((c) => (!!c.lastMessageText || !!c.lastMessageTime) && c.otherUser?.username !== 'contact')
          .sort(
            (a, b) => new Date(b.lastMessageTime || b.updatedAt || 0).getTime() - new Date(a.lastMessageTime || a.updatedAt || 0).getTime()
          );

        setConversations(finalList);
      },
      (error) => {
        console.warn('Notice listening to conversations:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Periodic Local Ephemeral Purge (runs every 10 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      const purgedCount = await purgeExpiredLocalMessages();
      if (purgedCount > 0 && selectedConversationRef.current) {
        const updated = await getLocalMessages(selectedConversationRef.current.id);
        setMessages(updated);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // 2. GLOBAL Real-time Inbound Message Listener (where recipientUid == current user)
  useEffect(() => {
    if (!user) return;

    const inboundQuery = query(
      collection(db, 'messages'),
      where('recipientUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      inboundQuery,
      async (snapshot) => {
        if (snapshot.empty) return;

        let privKey = await getLocalPrivateKey();
        if (!privKey) {
          const stored = await getKeyStoreItem('plainPrivateKey');
          privKey = stored?.data || null;
        }

        if (!privKey) return;

        let hasNewMessagesForSelected = false;

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as any;
          const msgId = docSnap.id;

          try {
            // Handle Message Reactions Relay
            if (data.type === 'reaction') {
              const targetMsgs = await getLocalMessages(data.conversationId);
              const found = targetMsgs.find((m) => m.id === data.messageId);
              if (found) {
                const reactions: Record<string, string[]> = { ...(found.reactions || {}) };
                if (data.action === 'remove') {
                  const currentList = reactions[data.emoji] || [];
                  reactions[data.emoji] = currentList.filter((u) => u !== data.senderUid);
                  if (reactions[data.emoji].length === 0) delete reactions[data.emoji];
                } else {
                  // Single reaction constraint: remove sender from any other emoji on this message
                  for (const [k, uids] of Object.entries(reactions)) {
                    if (k !== data.emoji && uids.includes(data.senderUid)) {
                      reactions[k] = uids.filter((u) => u !== data.senderUid);
                      if (reactions[k].length === 0) delete reactions[k];
                    }
                  }
                  const currentList = reactions[data.emoji] || [];
                  if (!currentList.includes(data.senderUid)) {
                    reactions[data.emoji] = [...currentList, data.senderUid];
                  }
                }
                const updatedFound = { ...found, reactions };
                await saveLocalMessage(updatedFound);
                if (selectedConversationRef.current && selectedConversationRef.current.id === data.conversationId) {
                  setMessages((prev) => prev.map((m) => (m.id === data.messageId ? updatedFound : m)));
                }

                // Update conversation activity with reaction so recipient sees it in Messages list!
                setConversations((prev) => prev.map((c) => {
                  if (c.id === data.conversationId) {
                    const updated = {
                      ...c,
                      lastReaction: data.action === 'remove' ? undefined : { emoji: data.emoji, uid: data.senderUid },
                    };
                    saveLocalConversation(updated);
                    return updated;
                  }
                  return c;
                }));
              }
              deleteDoc(doc(db, 'messages', msgId)).catch(() => {});
              continue;
            }

            // Retrieve sender public key: prefer direct payload, fallback to public_profiles
            let senderPublicKey = data.senderPublicKey;
            let senderProfile: UserProfile | undefined = undefined;

            if (!senderPublicKey) {
              const senderSnap = await getDoc(doc(db, 'public_profiles', data.senderUid));
              if (senderSnap.exists()) {
                senderProfile = senderSnap.data() as UserProfile;
                senderPublicKey = senderProfile.publicKey;
              }
            } else {
              senderProfile = {
                uid: data.senderUid,
                username: data.senderUsername || 'user',
                fullName: data.senderFullName || data.senderUsername || 'Contact',
                photoURL: data.senderPhotoURL,
                accountType: 'public',
                publicKey: senderPublicKey,
                createdAt: data.createdAt || new Date().toISOString(),
              };
            }

            if (!senderPublicKey) {
              console.warn('Cannot decrypt message without sender public key');
              continue;
            }

            // Decrypt E2EE Payload with multi-fallback resilience
            let content: PlaintextMessageContent = { text: '' };
            let decryptedJson: string | null = null;
            try {
              decryptedJson = await decryptE2EEPayload(data.ciphertext, senderPublicKey, privKey);
            } catch (err1) {
              console.warn('First decryption attempt notice, checking fresh sender public key:', err1);
              try {
                const freshSnap = await getDoc(doc(db, 'public_profiles', data.senderUid));
                if (freshSnap.exists()) {
                  const freshPub = freshSnap.data().publicKey;
                  if (freshPub && freshPub !== senderPublicKey) {
                    decryptedJson = await decryptE2EEPayload(data.ciphertext, freshPub, privKey);
                    senderPublicKey = freshPub;
                  }
                }
              } catch (err2) {}
            }

            if (decryptedJson) {
              try {
                content = JSON.parse(decryptedJson);
              } catch (parseErr) {
                content = { text: decryptedJson };
              }
            } else {
              content = { text: '[Encrypted message received]' };
            }

            const expiresAtMs = calculateExpiresAt(data.ephemeralType);

            const decryptedMsg: DecryptedMessage = {
              id: msgId,
              conversationId: data.conversationId,
              senderUid: data.senderUid,
              recipientUid: data.recipientUid,
              content,
              ephemeralType: data.ephemeralType || 'off',
              status: 'delivered',
              timestamp: data.createdAt || new Date().toISOString(),
              expiresAtTimestamp: expiresAtMs,
              replyToId: content.replyToId,
            };

            // Save decrypted message to local IndexedDB
            await saveLocalMessage(decryptedMsg);

            // Auto-create or update conversation for recipient
            const convId = data.conversationId;
            const isDeleted = await isConversationDeleted(convId);
            if (!isDeleted) {
              const previewText = content.text || (content.voiceAudioBase64 ? `🎤 Voice message (${content.voiceDurationSeconds || 0}s)` : (content.imageBase64 ? 'Photo' : 'New message'));

              // Ensure senderProfile has full name and username
              let resolvedSenderProfile = senderProfile;
              if (!resolvedSenderProfile || !resolvedSenderProfile.fullName) {
                try {
                  const sSnap = await getDoc(doc(db, 'public_profiles', data.senderUid));
                  if (sSnap.exists()) {
                    resolvedSenderProfile = sSnap.data() as UserProfile;
                  }
                } catch (e) {}
              }

              setConversations((prev) => {
                const existing = prev.find((c) => c.id === convId);
                const isCurrentlySelected = selectedConversationRef.current?.id === convId;
                if (existing) {
                  const updated: Conversation = {
                    ...existing,
                    otherUser: existing.otherUser || resolvedSenderProfile,
                    lastMessageText: previewText,
                    lastMessageTime: decryptedMsg.timestamp,
                    lastSenderUid: data.senderUid,
                    lastMessageStatus: 'delivered',
                    updatedAt: decryptedMsg.timestamp,
                    unreadCount: isCurrentlySelected ? 0 : (existing.unreadCount || 0) + 1,
                  };
                  saveLocalConversation(updated);
                  return [updated, ...prev.filter((c) => c.id !== convId)];
                } else {
                  const newConv: Conversation = {
                    id: convId,
                    participants: [data.senderUid, user.uid],
                    ephemeralSetting: data.ephemeralType || 'off',
                    createdAt: decryptedMsg.timestamp,
                    updatedAt: decryptedMsg.timestamp,
                    otherUser: resolvedSenderProfile,
                    lastMessageText: previewText,
                    lastMessageTime: decryptedMsg.timestamp,
                    lastSenderUid: data.senderUid,
                    lastMessageStatus: 'delivered',
                    unreadCount: isCurrentlySelected ? 0 : 1,
                  };
                  saveLocalConversation(newConv);
                  return [newConv, ...prev];
                }
              });
            }

            if (selectedConversationRef.current && selectedConversationRef.current.id === data.conversationId) {
              hasNewMessagesForSelected = true;
            }

            // Remove temporary store-and-forward relay record
            deleteDoc(doc(db, 'messages', msgId)).catch(() => {});
          } catch (itemErr) {
            console.warn('Error processing incoming message item:', itemErr);
            deleteDoc(doc(db, 'messages', msgId)).catch(() => {});
          }
        }

        if (hasNewMessagesForSelected && selectedConversationRef.current) {
          const updated = await getLocalMessages(selectedConversationRef.current.id);
          setMessages(updated);
        }
      },
      (error) => {
        console.warn('Inbound messages listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, [user, getLocalPrivateKey]);

  // Select Active Conversation
  const selectConversation = async (conv: Conversation | null) => {
    if (!conv) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    let targetConv = conv;

    // Ensure peer otherUser is populated
    if (!targetConv.otherUser && user) {
      const otherUid = targetConv.participants.find((p) => p !== user.uid);
      if (otherUid) {
        try {
          const pSnap = await getDoc(doc(db, 'public_profiles', otherUid));
          if (pSnap.exists()) {
            targetConv = { ...targetConv, otherUser: pSnap.data() as UserProfile };
          }
        } catch (e) {}
      }
    }

    setSelectedConversation(targetConv);
    setLoadingMessages(true);
    const msgs = await getLocalMessages(targetConv.id);

    // If local disappearing messages enabled for this user on this device, schedule disappear after reading
    if (targetConv.localEphemeralSetting && targetConv.localEphemeralSetting !== 'off') {
      const now = Date.now();
      let timeoutMs = 24 * 3600 * 1000;
      if (targetConv.localEphemeralSetting === 'viewed') timeoutMs = 15 * 1000;
      else if (targetConv.localEphemeralSetting === '1h') timeoutMs = 3600 * 1000;
      else if (targetConv.localEphemeralSetting === '24h') timeoutMs = 24 * 3600 * 1000;
      else if (targetConv.localEphemeralSetting === '7d') timeoutMs = 7 * 86400 * 1000;

      for (const m of msgs) {
        if (!m.localDisappearAtTimestamp) {
          m.readAtTimestamp = now;
          m.localDisappearAtTimestamp = now + timeoutMs;
          saveLocalMessage(m).catch(() => {});
        }
      }
    }

    setMessages(msgs);
    setLoadingMessages(false);

    // Reset unread count
    if (targetConv.unreadCount && targetConv.unreadCount > 0) {
      const updated = { ...targetConv, unreadCount: 0 };
      await saveLocalConversation(updated);
      setConversations((prev) => prev.map((c) => (c.id === targetConv.id ? updated : c)));
    }
  };

  // Start or Retrieve 1-on-1 Conversation
  const startOrGetConversation = async (otherUserUid: string): Promise<Conversation> => {
    if (!user) throw new Error('Not authenticated.');

    const convId = getDeterministicConversationId(user.uid, otherUserUid);
    await unmarkConversationAsDeleted(convId);

    // Resolve peer contact profile: check local IndexedDB first, then Firestore
    let otherUser: UserProfile | undefined = await getLocalProfile(otherUserUid);
    if (!otherUser) {
      try {
        const otherProfileSnap = await getDoc(doc(db, 'public_profiles', otherUserUid));
        if (otherProfileSnap.exists()) {
          otherUser = otherProfileSnap.data() as UserProfile;
          await saveLocalProfile(otherUser);
        }
      } catch (e) {}
    }

    // 1. Check existing in memory
    const existing = conversations.find((c) => c.id === convId || c.participants.includes(otherUserUid));
    if (existing) {
      const merged: Conversation = {
        ...existing,
        id: convId,
        otherUser: otherUser || existing.otherUser,
      };
      if (otherUser) await saveLocalProfile(otherUser);
      await selectConversation(merged);
      return merged;
    }

    // 2. Check existing in local IndexedDB
    const localExisting = await getLocalConversation(convId);
    if (localExisting) {
      const merged: Conversation = {
        ...localExisting,
        otherUser: otherUser || localExisting.otherUser,
      };
      if (otherUser) await saveLocalProfile(otherUser);
      await selectConversation(merged);
      return merged;
    }

    const nowIso = new Date().toISOString();
    const cleanUsername = otherUser?.username && otherUser.username !== 'contact'
      ? otherUser.username
      : (otherUserUid.startsWith('usr_') ? otherUserUid.split('_')[1] : 'user');

    const participantDetails: Record<string, Partial<UserProfile>> = {
      [user.uid]: {
        uid: user.uid,
        username: profile?.username || user.uid,
        fullName: profile?.fullName || profile?.username || 'User',
        photoURL: profile?.photoURL || '',
        publicKey: profile?.publicKey || '',
      },
      [otherUserUid]: {
        uid: otherUserUid,
        username: cleanUsername,
        fullName: otherUser?.fullName || cleanUsername,
        photoURL: otherUser?.photoURL || '',
        publicKey: otherUser?.publicKey || '',
      },
    };

    const newConv: Conversation = {
      id: convId,
      participants: [user.uid, otherUserUid],
      ephemeralSetting: profile?.accountType === 'private' ? '24h' : 'off',
      createdAt: nowIso,
      updatedAt: nowIso,
      otherUser: otherUser || {
        uid: otherUserUid,
        username: cleanUsername,
        fullName: cleanUsername,
        accountType: 'public',
        publicKey: '',
        createdAt: nowIso,
      },
      participantDetails,
    };

    if (otherUser) {
      await saveLocalProfile(otherUser);
    }

    // Set as active conversation for user to chat; only persists to list when message sent
    setSelectedConversation(newConv);
    setMessages([]);
    return newConv;
  };

  // Send E2EE Text Message
  const sendTextMessage = async (text: string, replyToId?: string): Promise<void> => {
    if (!user || !selectedConversation) return;

    // 1. Resolve sender private key with self-healing fallback
    let privKey = await getLocalPrivateKey();
    if (!privKey) {
      const stored = await getKeyStoreItem('plainPrivateKey');
      privKey = stored?.data || null;
    }
    if (!privKey) {
      const newKeys = generateIdentityKeyPair();
      privKey = newKeys.privateKey;
      try {
        localStorage.setItem(`aegis_priv_${user.uid}`, privKey);
        localStorage.setItem('aegis_plain_priv_key', privKey);
      } catch (e) {}
      saveKeyStoreItem('plainPrivateKey', privKey).catch(() => {});
    }

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    // 2. Resolve recipient public key: always prefer fresh from public_profiles
    let recipientPubKey: string | undefined = undefined;
    try {
      const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
      if (recipientSnap.exists()) {
        recipientPubKey = recipientSnap.data().publicKey;
      }
    } catch (e) {}

    if (!recipientPubKey) {
      try {
        const prekeySnap = await getDoc(doc(db, 'prekeys', recipientUid));
        if (prekeySnap.exists()) {
          recipientPubKey = prekeySnap.data().signedPrekey;
        }
      } catch (e) {}
    }

    if (!recipientPubKey) {
      recipientPubKey = selectedConversation.otherUser?.publicKey;
    }

    if (!recipientPubKey) {
      recipientPubKey = conversations.find((c) => c.participants.includes(recipientUid))?.otherUser?.publicKey;
    }

    if (!recipientPubKey) {
      throw new Error('Recipient identity key is not registered yet. Ask them to log in to activate messaging.');
    }

    // Sender's public key MUST strictly be derived from the exact private key used to encrypt!
    const senderPubKey = getPublicKeyFromPrivateKey(privKey);
    if (profile && profile.publicKey !== senderPubKey) {
      updateDoc(doc(db, 'public_profiles', user.uid), { publicKey: senderPubKey }).catch(() => {});
    }

    const content: PlaintextMessageContent = {
      text,
      replyToId,
    };

    const ciphertext = await encryptE2EEPayload(JSON.stringify(content), recipientPubKey, privKey);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();
    const expiresAtMs = calculateExpiresAt(selectedConversation.ephemeralSetting);

    // 3. Save to local IndexedDB and update state immediately
    const localMsg: DecryptedMessage = {
      id: msgId,
      conversationId: selectedConversation.id,
      senderUid: user.uid,
      recipientUid,
      content,
      ephemeralType: selectedConversation.ephemeralSetting,
      status: 'sending',
      timestamp: nowIso,
      expiresAtTimestamp: expiresAtMs,
      replyToId,
    };

    await saveLocalMessage(localMsg);
    setMessages((prev) => [...prev, localMsg]);

    // Update conversation preview locally
    const updatedConv: Conversation = {
      ...selectedConversation,
      lastMessageText: text,
      lastMessageTime: nowIso,
      updatedAt: nowIso,
    };
    setSelectedConversation(updatedConv);
    await saveLocalConversation(updatedConv);
    setConversations((prev) => [updatedConv, ...prev.filter((c) => c.id !== selectedConversation.id)]);

    // 4. Submit Store-and-Forward Payload to Firestore
    try {
      await setDoc(doc(db, 'messages', msgId), {
        conversationId: selectedConversation.id,
        senderUid: user.uid,
        senderUsername: profile?.username || user.uid,
        senderFullName: profile?.fullName || profile?.username || 'User',
        senderPhotoURL: profile?.photoURL || '',
        senderPublicKey: senderPubKey,
        recipientUid,
        ciphertext,
        ephemeralType: selectedConversation.ephemeralSetting,
        createdAt: nowIso,
      });

      // Update Conversation Record in Firestore for both participants
      await setDoc(
        doc(db, 'conversations', selectedConversation.id),
        {
          id: selectedConversation.id,
          participants: selectedConversation.participants,
          ephemeralSetting: selectedConversation.ephemeralSetting,
          lastMessageText: text,
          lastMessageTime: nowIso,
          lastSenderUid: user.uid,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      localMsg.status = 'delivered';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'delivered' } : m)));
    } catch (err) {
      console.warn('Notice sending message to cloud relay (cached locally):', err);
      localMsg.status = 'sent';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m)));
    }
  };

  // Send Encrypted Image Message
  const sendImageMessage = async (file: File): Promise<void> => {
    if (!user || !selectedConversation) return;

    let privKey = await getLocalPrivateKey();
    if (!privKey) {
      const stored = await getKeyStoreItem('plainPrivateKey');
      privKey = stored?.data || null;
    }
    if (!privKey) {
      const newKeys = generateIdentityKeyPair();
      privKey = newKeys.privateKey;
      try {
        localStorage.setItem(`aegis_priv_${user.uid}`, privKey);
        localStorage.setItem('aegis_plain_priv_key', privKey);
      } catch (e) {}
      saveKeyStoreItem('plainPrivateKey', privKey).catch(() => {});
    }

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    let recipientPubKey: string | undefined = undefined;
    try {
      const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
      if (recipientSnap.exists()) {
        recipientPubKey = recipientSnap.data().publicKey;
      }
    } catch (e) {}

    if (!recipientPubKey) {
      try {
        const prekeySnap = await getDoc(doc(db, 'prekeys', recipientUid));
        if (prekeySnap.exists()) {
          recipientPubKey = prekeySnap.data().signedPrekey;
        }
      } catch (e) {}
    }

    if (!recipientPubKey) {
      recipientPubKey = selectedConversation.otherUser?.publicKey;
    }

    if (!recipientPubKey) {
      recipientPubKey = conversations.find((c) => c.participants.includes(recipientUid))?.otherUser?.publicKey;
    }

    if (!recipientPubKey) {
      throw new Error('Recipient identity key not found.');
    }

    const senderPubKey = getPublicKeyFromPrivateKey(privKey);
    if (profile && profile.publicKey !== senderPubKey) {
      updateDoc(doc(db, 'public_profiles', user.uid), { publicKey: senderPubKey }).catch(() => {});
    }

    const imageDataUrl = await compressImageFile(file);
    const content: PlaintextMessageContent = {
      imageBase64: imageDataUrl,
      fileName: file.name,
    };

    const ciphertext = await encryptE2EEPayload(JSON.stringify(content), recipientPubKey, privKey);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();
    const expiresAtMs = calculateExpiresAt(selectedConversation.ephemeralSetting);

    const localMsg: DecryptedMessage = {
      id: msgId,
      conversationId: selectedConversation.id,
      senderUid: user.uid,
      recipientUid,
      content,
      ephemeralType: selectedConversation.ephemeralSetting,
      status: 'sending',
      timestamp: nowIso,
      expiresAtTimestamp: expiresAtMs,
    };

    await saveLocalMessage(localMsg);
    setMessages((prev) => [...prev, localMsg]);

    const updatedConv: Conversation = {
      ...selectedConversation,
      lastMessageText: 'Photo',
      lastMessageTime: nowIso,
      updatedAt: nowIso,
    };
    setSelectedConversation(updatedConv);
    await saveLocalConversation(updatedConv);
    setConversations((prev) => [updatedConv, ...prev.filter((c) => c.id !== selectedConversation.id)]);

    try {
      await setDoc(doc(db, 'messages', msgId), {
        conversationId: selectedConversation.id,
        senderUid: user.uid,
        senderUsername: profile?.username || user.uid,
        senderFullName: profile?.fullName || profile?.username || 'User',
        senderPhotoURL: profile?.photoURL || '',
        senderPublicKey: senderPubKey,
        recipientUid,
        ciphertext,
        ephemeralType: selectedConversation.ephemeralSetting,
        createdAt: nowIso,
      });

      await setDoc(
        doc(db, 'conversations', selectedConversation.id),
        {
          id: selectedConversation.id,
          participants: selectedConversation.participants,
          ephemeralSetting: selectedConversation.ephemeralSetting,
          lastMessageText: 'Photo',
          lastMessageTime: nowIso,
          lastSenderUid: user.uid,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      localMsg.status = 'delivered';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'delivered' } : m)));
    } catch (err) {
      console.warn('Notice sending image message:', err);
      localMsg.status = 'sent';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m)));
    }
  };

  // Send Encrypted Voice Message (WhatsApp-style E2EE voice note)
  const sendVoiceMessage = async (audioBlob: Blob, durationSeconds: number): Promise<void> => {
    if (!user || !selectedConversation) return;

    let privKey = await getLocalPrivateKey();
    if (!privKey) {
      const stored = await getKeyStoreItem('plainPrivateKey');
      privKey = stored?.data || null;
    }
    if (!privKey) {
      const newKeys = generateIdentityKeyPair();
      privKey = newKeys.privateKey;
      try {
        localStorage.setItem(`aegis_priv_${user.uid}`, privKey);
        localStorage.setItem('aegis_plain_priv_key', privKey);
      } catch (e) {}
      saveKeyStoreItem('plainPrivateKey', privKey).catch(() => {});
    }

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    let recipientPubKey: string | undefined = undefined;
    try {
      const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
      if (recipientSnap.exists()) {
        recipientPubKey = recipientSnap.data().publicKey;
      }
    } catch (e) {}

    if (!recipientPubKey) {
      try {
        const prekeySnap = await getDoc(doc(db, 'prekeys', recipientUid));
        if (prekeySnap.exists()) {
          recipientPubKey = prekeySnap.data().signedPrekey;
        }
      } catch (e) {}
    }

    if (!recipientPubKey) {
      recipientPubKey = selectedConversation.otherUser?.publicKey;
    }

    if (!recipientPubKey) {
      recipientPubKey = conversations.find((c) => c.participants.includes(recipientUid))?.otherUser?.publicKey;
    }

    if (!recipientPubKey) {
      throw new Error('Recipient identity key not found.');
    }

    const senderPubKey = getPublicKeyFromPrivateKey(privKey);
    if (profile && profile.publicKey !== senderPubKey) {
      updateDoc(doc(db, 'public_profiles', user.uid), { publicKey: senderPubKey }).catch(() => {});
    }

    // Convert audio Blob to base64 Data URL
    const voiceAudioBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const roundedSec = Math.max(1, Math.round(durationSeconds));
    const content: PlaintextMessageContent = {
      voiceAudioBase64,
      voiceDurationSeconds: roundedSec,
      text: '',
    };

    const ciphertext = await encryptE2EEPayload(JSON.stringify(content), recipientPubKey, privKey);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();
    const expiresAtMs = calculateExpiresAt(selectedConversation.ephemeralSetting);

    const localMsg: DecryptedMessage = {
      id: msgId,
      conversationId: selectedConversation.id,
      senderUid: user.uid,
      recipientUid,
      content,
      ephemeralType: selectedConversation.ephemeralSetting,
      status: 'sending',
      timestamp: nowIso,
      expiresAtTimestamp: expiresAtMs,
    };

    await saveLocalMessage(localMsg);
    setMessages((prev) => [...prev, localMsg]);

    const preview = `🎤 Voice message (${roundedSec}s)`;
    const updatedConv: Conversation = {
      ...selectedConversation,
      lastMessageText: preview,
      lastMessageTime: nowIso,
      lastSenderUid: user.uid,
      lastMessageStatus: 'sending',
      updatedAt: nowIso,
    };
    setSelectedConversation(updatedConv);
    await saveLocalConversation(updatedConv, true);
    setConversations((prev) => [updatedConv, ...prev.filter((c) => c.id !== selectedConversation.id)]);

    try {
      await setDoc(doc(db, 'messages', msgId), {
        conversationId: selectedConversation.id,
        senderUid: user.uid,
        senderUsername: profile?.username || user.uid,
        senderFullName: profile?.fullName || profile?.username || 'User',
        senderPhotoURL: profile?.photoURL || '',
        senderPublicKey: senderPubKey,
        recipientUid,
        ciphertext,
        ephemeralType: selectedConversation.ephemeralSetting,
        createdAt: nowIso,
      });

      await setDoc(
        doc(db, 'conversations', selectedConversation.id),
        {
          id: selectedConversation.id,
          participants: selectedConversation.participants,
          ephemeralSetting: selectedConversation.ephemeralSetting,
          lastMessageText: preview,
          lastMessageTime: nowIso,
          lastSenderUid: user.uid,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      localMsg.status = 'delivered';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'delivered' } : m)));
    } catch (err) {
      console.warn('Notice sending voice message:', err);
      localMsg.status = 'sent';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'sent' } : m)));
    }
  };

  // Update Ephemeral / Disappearing Messages Setting (Per-user on own device)
  const updateEphemeralSetting = async (setting: EphemeralSetting): Promise<void> => {
    if (!selectedConversation) return;

    const updated: Conversation = {
      ...selectedConversation,
      ephemeralSetting: setting,
      localEphemeralSetting: setting,
      updatedAt: new Date().toISOString(),
    };

    setSelectedConversation(updated);
    await saveLocalConversation(updated, true);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

    // Apply local countdown to messages on this device
    if (setting !== 'off') {
      const now = Date.now();
      let timeoutMs = 24 * 3600 * 1000;
      if (setting === 'viewed') timeoutMs = 15 * 1000;
      else if (setting === '1h') timeoutMs = 3600 * 1000;
      else if (setting === '24h') timeoutMs = 24 * 3600 * 1000;
      else if (setting === '7d') timeoutMs = 7 * 86400 * 1000;

      const updatedList = await Promise.all(
        messages.map(async (m) => {
          if (!m.localDisappearAtTimestamp) {
            const mUpdated = {
              ...m,
              readAtTimestamp: now,
              localDisappearAtTimestamp: now + timeoutMs,
            };
            await saveLocalMessage(mUpdated);
            return mUpdated;
          }
          return m;
        })
      );
      setMessages(updatedList);
    }
  };

  // Add Message Reaction (Strictly single emoji per user)
  const addMessageReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!user) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const currentReactions: Record<string, string[]> = { ...(msg.reactions || {}) };
    let isRemoving = false;

    // Single reaction rule: check if user already reacted
    for (const [key, uids] of Object.entries(currentReactions)) {
      if (uids.includes(user.uid)) {
        if (key === emoji) {
          isRemoving = true;
        }
        const filtered = uids.filter((uid) => uid !== user.uid);
        if (filtered.length === 0) {
          delete currentReactions[key];
        } else {
          currentReactions[key] = filtered;
        }
      }
    }

    if (!isRemoving) {
      const currentList = currentReactions[emoji] || [];
      currentReactions[emoji] = [...currentList, user.uid];
    }

    const updatedMsg: DecryptedMessage = { ...msg, reactions: currentReactions };
    await saveLocalMessage(updatedMsg);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? updatedMsg : m)));

    // Update conversation lastReaction activity so user & recipient see it in Messages list!
    const reactionObj = isRemoving
      ? undefined
      : {
          emoji,
          uid: user.uid,
          username: profile?.username || 'You',
          timestamp: new Date().toISOString(),
        };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === msg.conversationId) {
          const updatedConv = {
            ...c,
            lastReaction: reactionObj,
          };
          saveLocalConversation(updatedConv, true);
          return updatedConv;
        }
        return c;
      })
    );

    // Update Firestore conversation doc with reaction
    try {
      updateDoc(doc(db, 'conversations', msg.conversationId), {
        lastReaction: reactionObj || null,
      }).catch(() => {});
    } catch (e) {}

    // Relay reaction to peer contact in Firestore
    const recipientUid = msg.senderUid === user.uid ? msg.recipientUid : msg.senderUid;
    if (recipientUid) {
      const reactId = `react_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setDoc(doc(db, 'messages', reactId), {
        type: 'reaction',
        action: isRemoving ? 'remove' : 'add',
        conversationId: msg.conversationId,
        messageId,
        emoji,
        senderUid: user.uid,
        senderUsername: profile?.username || 'user',
        recipientUid,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  // Delete Single Message Locally
  const deleteMessageLocally = async (messageId: string): Promise<void> => {
    await deleteLocalMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Delete Conversation Locally (Protected: will NEVER come back on refresh or reload)
  const deleteConversationLocally = async (conversationId: string): Promise<void> => {
    await markConversationAsDeleted(conversationId);
    await deleteLocalConversation(conversationId);

    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
      setMessages([]);
    }

    // Also remove user from Firestore conversation participants so query never delivers it again
    if (user) {
      try {
        await updateDoc(doc(db, 'conversations', conversationId), {
          participants: arrayRemove(user.uid),
        });
      } catch (e) {
        console.warn('Notice updating conversation participants after delete:', e);
      }
    }
  };

  // Pin / Mute Conversation (Strictly maximum 5 pinned chats allowed)
  const [pinLimitNotice, setPinLimitNotice] = useState<string | null>(null);
  const clearPinNotice = () => setPinLimitNotice(null);

  const togglePinConversation = async (conversationId: string): Promise<boolean> => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return false;

    if (!conv.isPinned) {
      const currentlyPinned = conversations.filter((c) => c.isPinned).length;
      if (currentlyPinned >= 5) {
        setPinLimitNotice('Maximum 5 pinned chats allowed. Please unpin another chat first.');
        return false;
      }
    }

    setPinLimitNotice(null);
    const updated = { ...conv, isPinned: !conv.isPinned };
    await saveLocalConversation(updated, true);
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? updated : c)));
    return true;
  };

  const toggleMuteConversation = async (conversationId: string): Promise<void> => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const updated = { ...conv, isMuted: !conv.isMuted };
    await saveLocalConversation(updated, true);
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? updated : c)));
  };

  const pinnedConversations = conversations.filter((c) => c.isPinned);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        selectedConversation,
        messages,
        loadingConversations,
        loadingMessages,
        selectConversation,
        startOrGetConversation,
        sendTextMessage,
        sendImageMessage,
        sendVoiceMessage,
        updateEphemeralSetting,
        addMessageReaction,
        deleteMessageLocally,
        deleteConversationLocally,
        togglePinConversation,
        toggleMuteConversation,
        pinnedConversations,
        pinLimitNotice,
        clearPinNotice,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

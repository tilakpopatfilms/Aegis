import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  getKeyStoreItem,
  saveKeyStoreItem,
} from '../db/localDb';
import {
  encryptE2EEPayload,
  decryptE2EEPayload,
  encryptImageFile,
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
  updateEphemeralSetting: (setting: EphemeralSetting) => Promise<void>;
  addMessageReaction: (messageId: string, emoji: string) => Promise<void>;
  deleteMessageLocally: (messageId: string) => Promise<void>;
  deleteConversationLocally: (conversationId: string) => Promise<void>;
  togglePinConversation: (conversationId: string) => Promise<void>;
  toggleMuteConversation: (conversationId: string) => Promise<void>;
  pinnedConversations: Conversation[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile, getLocalPrivateKey } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
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
      const localList = await getLocalConversations();
      setConversations(localList);
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

          // Resolve peer contact profile
          const otherUid = data.participants.find((p) => p !== user.uid);
          if (otherUid) {
            try {
              const otherSnap = await getDoc(doc(db, 'public_profiles', otherUid));
              if (otherSnap.exists()) {
                data.otherUser = otherSnap.data() as UserProfile;
              }
            } catch (err) {
              console.warn('Notice loading contact profile:', err);
            }
          }

          loaded.push(data);
          await saveLocalConversation(data);
        }

        // Merge with existing local conversations
        const localList = await getLocalConversations();
        const mergedMap = new Map<string, Conversation>();

        localList.forEach((c) => mergedMap.set(c.id, c));
        loaded.forEach((c) => {
          const existing = mergedMap.get(c.id);
          mergedMap.set(c.id, {
            ...existing,
            ...c,
            otherUser: c.otherUser || existing?.otherUser,
            isPinned: existing?.isPinned,
            isMuted: existing?.isMuted,
          });
        });

        const finalList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
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
      if (purgedCount > 0 && selectedConversation) {
        const updated = await getLocalMessages(selectedConversation.id);
        setMessages(updated);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedConversation]);

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

            // Decrypt E2EE Payload
            let content: PlaintextMessageContent = { text: '' };
            try {
              const decryptedJson = await decryptE2EEPayload(data.ciphertext, senderPublicKey, privKey);
              content = JSON.parse(decryptedJson);
            } catch (decErr) {
              console.warn('Ciphertext decryption notice (re-trying or fallback):', decErr);
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
              const previewText = content.text || (content.imageBase64 ? 'Photo' : 'New message');

              setConversations((prev) => {
                const existing = prev.find((c) => c.id === convId);
                if (existing) {
                  const updated: Conversation = {
                    ...existing,
                    otherUser: existing.otherUser || senderProfile,
                    lastMessageText: previewText,
                    lastMessageTime: decryptedMsg.timestamp,
                    updatedAt: decryptedMsg.timestamp,
                    unreadCount: selectedConversation?.id === convId ? 0 : (existing.unreadCount || 0) + 1,
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
                    otherUser: senderProfile,
                    lastMessageText: previewText,
                    lastMessageTime: decryptedMsg.timestamp,
                    unreadCount: selectedConversation?.id === convId ? 0 : 1,
                  };
                  saveLocalConversation(newConv);
                  return [newConv, ...prev];
                }
              });
            }

            if (selectedConversation && selectedConversation.id === data.conversationId) {
              hasNewMessagesForSelected = true;
            }

            // Remove temporary store-and-forward relay record
            deleteDoc(doc(db, 'messages', msgId)).catch(() => {});
          } catch (itemErr) {
            console.warn('Error processing incoming message item:', itemErr);
            deleteDoc(doc(db, 'messages', msgId)).catch(() => {});
          }
        }

        if (hasNewMessagesForSelected && selectedConversation) {
          const updated = await getLocalMessages(selectedConversation.id);
          setMessages(updated);
        }
      },
      (error) => {
        console.warn('Inbound messages listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, [user, selectedConversation, getLocalPrivateKey]);

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

    // 1. Check existing in memory
    const existing = conversations.find((c) => c.participants.includes(otherUserUid));
    if (existing) {
      await selectConversation(existing);
      return existing;
    }

    // 2. Deterministic Conversation ID
    const convId = getDeterministicConversationId(user.uid, otherUserUid);

    // 3. Resolve peer contact profile
    let otherUser: UserProfile | undefined = undefined;
    try {
      const otherProfileSnap = await getDoc(doc(db, 'public_profiles', otherUserUid));
      if (otherProfileSnap.exists()) {
        otherUser = otherProfileSnap.data() as UserProfile;
      }
    } catch (e) {}

    const nowIso = new Date().toISOString();
    const newConv: Conversation = {
      id: convId,
      participants: [user.uid, otherUserUid],
      ephemeralSetting: profile?.accountType === 'private' ? '24h' : 'off',
      createdAt: nowIso,
      updatedAt: nowIso,
      otherUser,
    };

    // Save to Firestore
    try {
      await setDoc(
        doc(db, 'conversations', convId),
        {
          id: convId,
          participants: newConv.participants,
          ephemeralSetting: newConv.ephemeralSetting,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Notice saving cloud conversation:', err);
    }

    await saveLocalConversation(newConv);
    setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== convId)]);
    await selectConversation(newConv);

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

    // 2. Resolve recipient public key
    let recipientPubKey: string | undefined = selectedConversation.otherUser?.publicKey;
    if (!recipientPubKey) {
      try {
        const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
        if (recipientSnap.exists()) {
          recipientPubKey = recipientSnap.data().publicKey;
        }
      } catch (e) {}
    }
    if (!recipientPubKey) {
      try {
        const prekeySnap = await getDoc(doc(db, 'prekeys', recipientUid));
        if (prekeySnap.exists()) {
          recipientPubKey = prekeySnap.data().signedPrekey;
        }
      } catch (e) {}
    }
    if (!recipientPubKey) {
      recipientPubKey = conversations.find((c) => c.participants.includes(recipientUid))?.otherUser?.publicKey;
    }
    if (!recipientPubKey) {
      throw new Error('Recipient identity key is not registered yet. Ask them to log in to activate messaging.');
    }

    const senderPubKey = profile?.publicKey || getPublicKeyFromPrivateKey(privKey);

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

    let recipientPubKey: string | undefined = selectedConversation.otherUser?.publicKey;
    if (!recipientPubKey) {
      try {
        const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
        if (recipientSnap.exists()) {
          recipientPubKey = recipientSnap.data().publicKey;
        }
      } catch (e) {}
    }
    if (!recipientPubKey) {
      try {
        const prekeySnap = await getDoc(doc(db, 'prekeys', recipientUid));
        if (prekeySnap.exists()) {
          recipientPubKey = prekeySnap.data().signedPrekey;
        }
      } catch (e) {}
    }
    if (!recipientPubKey) {
      throw new Error('Recipient identity key not found.');
    }

    const senderPubKey = profile?.publicKey || getPublicKeyFromPrivateKey(privKey);

    const encryptedDataUri = await encryptImageFile(file, recipientPubKey, privKey);
    const content: PlaintextMessageContent = {
      imageBase64: encryptedDataUri,
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

  // Update Ephemeral Setting
  const updateEphemeralSetting = async (setting: EphemeralSetting): Promise<void> => {
    if (!selectedConversation) return;

    const updated: Conversation = {
      ...selectedConversation,
      ephemeralSetting: setting,
      updatedAt: new Date().toISOString(),
    };

    setSelectedConversation(updated);
    await saveLocalConversation(updated);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

    try {
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        ephemeralSetting: setting,
        updatedAt: updated.updatedAt,
      });
    } catch (err) {
      console.warn('Notice updating ephemeral setting in cloud:', err);
    }
  };

  // Add Message Reaction
  const addMessageReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!user) return;
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const currentReactions: Record<string, string[]> = { ...(msg.reactions || {}) };
    const userList = currentReactions[emoji] || [];

    if (userList.includes(user.uid)) {
      currentReactions[emoji] = userList.filter((uid) => uid !== user.uid);
      if (currentReactions[emoji].length === 0) {
        delete currentReactions[emoji];
      }
    } else {
      currentReactions[emoji] = [...userList, user.uid];
    }

    const updatedMsg: DecryptedMessage = { ...msg, reactions: currentReactions };
    await saveLocalMessage(updatedMsg);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? updatedMsg : m)));
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

  // Pin / Mute Conversation
  const togglePinConversation = async (conversationId: string): Promise<void> => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const updated = { ...conv, isPinned: !conv.isPinned };
    await saveLocalConversation(updated);
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? updated : c)));
  };

  const toggleMuteConversation = async (conversationId: string): Promise<void> => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    const updated = { ...conv, isMuted: !conv.isMuted };
    await saveLocalConversation(updated);
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
        updateEphemeralSetting,
        addMessageReaction,
        deleteMessageLocally,
        deleteConversationLocally,
        togglePinConversation,
        toggleMuteConversation,
        pinnedConversations,
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

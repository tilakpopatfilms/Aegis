import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
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
} from '../db/localDb';
import { encryptE2EEPayload, decryptE2EEPayload, encryptImageFile } from '../crypto/crypto';

interface ChatContextType {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: DecryptedMessage[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  selectConversation: (conv: Conversation) => Promise<void>;
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
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
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

        // Merge with existing local conversations that might not be in cloud
        const localList = await getLocalConversations();
        const mergedMap = new Map<string, Conversation>();

        localList.forEach((c) => mergedMap.set(c.id, c));
        loaded.forEach((c) => {
          const existing = mergedMap.get(c.id);
          mergedMap.set(c.id, { ...existing, ...c, isPinned: existing?.isPinned, isMuted: existing?.isMuted });
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
  // This guarantees incoming messages arrive live and auto-create conversations!
  useEffect(() => {
    if (!user) return;

    const inboundQuery = query(
      collection(db, 'messages'),
      where('recipientUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      inboundQuery,
      async (snapshot) => {
        const privKey = await getLocalPrivateKey();
        if (!privKey || snapshot.empty) return;

        let hasNewMessagesForSelected = false;

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as EncryptedMessagePayload;
          const msgId = docSnap.id;

          try {
            // Retrieve sender's public key from public_profiles
            const senderSnap = await getDoc(doc(db, 'public_profiles', data.senderUid));
            if (!senderSnap.exists()) continue;
            const senderProfile = senderSnap.data() as UserProfile;
            const senderPublicKey = senderProfile.publicKey;

            // Decrypt E2EE Payload
            let content: PlaintextMessageContent = { text: '' };
            try {
              const decryptedJson = await decryptE2EEPayload(data.ciphertext, senderPublicKey, privKey);
              content = JSON.parse(decryptedJson);
            } catch (decErr) {
              console.warn('Ciphertext decryption notice (key mismatch or format):', decErr);
              content = { text: '[Encrypted message received]' };
            }

            const expiresAtMs = calculateExpiresAt(data.ephemeralType);

            const decryptedMsg: DecryptedMessage = {
              id: msgId,
              conversationId: data.conversationId,
              senderUid: data.senderUid,
              recipientUid: data.recipientUid,
              content,
              ephemeralType: data.ephemeralType,
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
                    ephemeralSetting: data.ephemeralType,
                    createdAt: decryptedMsg.timestamp,
                    updatedAt: decryptedMsg.timestamp,
                    otherUser: senderProfile,
                    lastMessageText: previewText,
                    lastMessageTime: decryptedMsg.timestamp,
                    unreadCount: 1,
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
            // Delete corrupt message doc to prevent loop
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
  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setLoadingMessages(true);
    const msgs = await getLocalMessages(conv.id);
    setMessages(msgs);
    setLoadingMessages(false);

    // Reset unread count
    if (conv.unreadCount && conv.unreadCount > 0) {
      const updated = { ...conv, unreadCount: 0 };
      await saveLocalConversation(updated);
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? updated : c)));
    }
  };

  // Start or Retrieve 1-on-1 Conversation
  const startOrGetConversation = async (otherUserUid: string): Promise<Conversation> => {
    if (!user) throw new Error('Not authenticated.');

    // Check existing in memory
    const existing = conversations.find((c) => c.participants.includes(otherUserUid));
    if (existing) {
      setSelectedConversation(existing);
      const msgs = await getLocalMessages(existing.id);
      setMessages(msgs);
      return existing;
    }

    // Deterministic, valid ID
    const cleanUidA = user.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const cleanUidB = otherUserUid.replace(/[^a-zA-Z0-9]/g, '').slice(20) || otherUserUid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
    const sorted = [cleanUidA, cleanUidB].sort();
    const convId = `conv_${sorted[0]}_${sorted[1]}`;

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

    try {
      await setDoc(doc(db, 'conversations', convId), {
        participants: newConv.participants,
        ephemeralSetting: newConv.ephemeralSetting,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (err) {
      console.warn('Notice saving cloud conversation:', err);
    }

    await saveLocalConversation(newConv);
    setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== convId)]);
    setSelectedConversation(newConv);
    const msgs = await getLocalMessages(convId);
    setMessages(msgs);

    return newConv;
  };

  // Send E2EE Text Message
  const sendTextMessage = async (text: string, replyToId?: string): Promise<void> => {
    if (!user || !selectedConversation) return;

    const privKey = await getLocalPrivateKey();
    if (!privKey) throw new Error('Private identity key not accessible. Please sign in again.');

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    let recipientPubKey: string | undefined = selectedConversation.otherUser?.publicKey;
    if (!recipientPubKey) {
      const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
      if (!recipientSnap.exists()) throw new Error('Recipient identity key could not be found.');
      recipientPubKey = recipientSnap.data().publicKey;
    }
    if (!recipientPubKey) throw new Error('Recipient identity key could not be found.');

    const content: PlaintextMessageContent = {
      text,
      replyToId,
    };

    const ciphertext = await encryptE2EEPayload(JSON.stringify(content), recipientPubKey, privKey);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();
    const expiresAtMs = calculateExpiresAt(selectedConversation.ephemeralSetting);

    // Local Record
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

    // Submit Store-and-Forward Payload to Firestore
    try {
      await setDoc(doc(db, 'messages', msgId), {
        conversationId: selectedConversation.id,
        senderUid: user.uid,
        recipientUid,
        ciphertext,
        ephemeralType: selectedConversation.ephemeralSetting,
        createdAt: nowIso,
      });

      // Update Conversation Record
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        updatedAt: nowIso,
      }).catch(() => {});

      localMsg.status = 'delivered';
      await saveLocalMessage(localMsg);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'delivered' } : m)));
    } catch (err) {
      console.warn('Notice sending message to cloud relay:', err);
    }
  };

  // Send Encrypted Image Message
  const sendImageMessage = async (file: File): Promise<void> => {
    if (!user || !selectedConversation) return;

    const privKey = await getLocalPrivateKey();
    if (!privKey) throw new Error('Private key not accessible.');

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    let recipientPubKey: string | undefined = selectedConversation.otherUser?.publicKey;
    if (!recipientPubKey) {
      const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
      if (!recipientSnap.exists()) throw new Error('Recipient key missing.');
      recipientPubKey = recipientSnap.data().publicKey;
    }
    if (!recipientPubKey) throw new Error('Recipient key missing.');
    const validRecipientPubKey: string = recipientPubKey;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawDataUrl = reader.result as string;
        const content: PlaintextMessageContent = {
          imageBase64: rawDataUrl,
          fileName: file.name,
        };

        const ciphertext = await encryptE2EEPayload(JSON.stringify(content), validRecipientPubKey, privKey);
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

        await setDoc(doc(db, 'messages', msgId), {
          conversationId: selectedConversation.id,
          senderUid: user.uid,
          recipientUid,
          ciphertext,
          ephemeralType: selectedConversation.ephemeralSetting,
          createdAt: nowIso,
        });

        localMsg.status = 'delivered';
        await saveLocalMessage(localMsg);
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status: 'delivered' } : m)));
      } catch (err) {
        console.error('Image send error:', err);
      }
    };

    reader.readAsDataURL(file);
  };

  // Update Ephemeral Setting
  const updateEphemeralSetting = async (setting: EphemeralSetting): Promise<void> => {
    if (!selectedConversation) return;

    const updated = { ...selectedConversation, ephemeralSetting: setting };
    setSelectedConversation(updated);
    await saveLocalConversation(updated);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

    try {
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        ephemeralSetting: setting,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Ephemeral update notice:', err);
    }
  };

  // Add Message Reaction
  const addMessageReaction = async (messageId: string, emoji: string): Promise<void> => {
    if (!user) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const current = m.reactions || {};
        const uids = current[emoji] || [];
        const updatedUids = uids.includes(user.uid) ? uids.filter((u) => u !== user.uid) : [...uids, user.uid];
        const updatedReactions = { ...current, [emoji]: updatedUids };
        const updatedMsg = { ...m, reactions: updatedReactions };
        saveLocalMessage(updatedMsg);
        return updatedMsg;
      })
    );
  };

  // Delete Message Locally
  const deleteMessageLocally = async (messageId: string): Promise<void> => {
    await deleteLocalMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // Delete Conversation Permanently (Tracks deleted state so it never resurrects)
  const deleteConversationLocally = async (conversationId: string): Promise<void> => {
    await markConversationAsDeleted(conversationId);
    await deleteLocalConversation(conversationId);
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
      setMessages([]);
    }

    // Attempt deleting cloud conversation document if current user is owner/participant
    deleteDoc(doc(db, 'conversations', conversationId)).catch(() => {});
  };

  // Pin / Unpin Conversation
  const togglePinConversation = async (conversationId: string): Promise<void> => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        const updated = { ...c, isPinned: !c.isPinned };
        saveLocalConversation(updated);
        return updated;
      })
    );
  };

  // Mute / Unmute Conversation
  const toggleMuteConversation = async (conversationId: string): Promise<void> => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        const updated = { ...c, isMuted: !c.isMuted };
        saveLocalConversation(updated);
        return updated;
      })
    );
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
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};

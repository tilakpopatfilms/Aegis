import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import {
  Conversation,
  DecryptedMessage,
  EphemeralSetting,
  EncryptedMessagePayload,
  UserProfile,
  PlaintextMessageContent,
} from '../types';
import {
  encryptE2EEPayload,
  decryptE2EEPayload,
  encryptImageFile,
} from '../crypto/crypto';
import {
  saveLocalMessage,
  getLocalMessages,
  deleteLocalMessage,
  saveLocalConversation,
  getLocalConversations,
  deleteLocalConversation,
  purgeExpiredLocalMessages,
} from '../db/localDb';

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
  pinnedConversations: Conversation[];
  togglePinConversation: (conversationId: string) => Promise<void>;
  toggleMuteConversation: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile, getLocalPrivateKey } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  // Helper: calculate expiration timestamp in UNIX ms
  const calculateExpiresAt = (ephemeral: EphemeralSetting): number | undefined => {
    const now = Date.now();
    switch (ephemeral) {
      case '1h':
        return now + 3600 * 1000;
      case '24h':
        return now + 86400 * 1000;
      case '7d':
        return now + 7 * 86400 * 1000;
      case 'viewed':
        return now + 60 * 1000; // 60s window once viewed
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

    const loadLocal = async () => {
      const localList = await getLocalConversations();
      setConversations(localList);
      setLoadingConversations(false);
    };

    loadLocal();

    // Firestore real-time listener for user's conversations
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const loaded: Conversation[] = [];
        for (const changeDoc of snapshot.docs) {
          const data = changeDoc.data() as Conversation;
          data.id = changeDoc.id;

          // Resolve other user's profile
          const otherUid = data.participants.find((p) => p !== user.uid);
          if (otherUid) {
            try {
              const otherSnap = await getDoc(doc(db, 'public_profiles', otherUid));
              if (otherSnap.exists()) {
                data.otherUser = otherSnap.data() as UserProfile;
              }
            } catch (err) {
              console.error('Error loading participant profile:', err);
            }
          }

          loaded.push(data);
          await saveLocalConversation(data);
        }

        setConversations(loaded.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'conversations');
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

  // 2. Real-time Inbound Store-and-Forward Message Listener
  useEffect(() => {
    if (!user || !selectedConversation) return;

    setLoadingMessages(true);

    // First, load local IndexedDB messages
    getLocalMessages(selectedConversation.id).then((localMsgs) => {
      setMessages(localMsgs);
      setLoadingMessages(false);
    });

    // Real-time listener on Firestore `/messages` for selected conversation
    const msgQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversation.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      msgQuery,
      async (snapshot) => {
        const privKey = await getLocalPrivateKey();
        if (!privKey) return;
        let hasNewMessages = false;

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data() as EncryptedMessagePayload;
          const msgId = docSnap.id;

          // If current user is the sender:
          // The sender already has the decrypted message in local storage.
          if (data.senderUid === user.uid) {
            continue;
          }

          // If current user is the recipient:
          if (data.recipientUid === user.uid) {
            try {
              const senderProfileSnap = await getDoc(doc(db, 'public_profiles', data.senderUid));
              if (!senderProfileSnap.exists()) continue;
              const senderPublicKey = senderProfileSnap.data().publicKey;

              // Decrypt using sender's public key and our private key
              const decryptedJson = await decryptE2EEPayload(data.ciphertext, senderPublicKey, privKey);
              const content: PlaintextMessageContent = JSON.parse(decryptedJson);

              const expiresAtMs = calculateExpiresAt(data.ephemeralType);

              const decryptedMsg: DecryptedMessage = {
                id: msgId,
                conversationId: data.conversationId,
                senderUid: data.senderUid,
                recipientUid: data.recipientUid,
                content,
                ephemeralType: data.ephemeralType,
                status: 'delivered',
                timestamp: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()) : new Date().toISOString(),
                expiresAtTimestamp: expiresAtMs,
                replyToId: content.replyToId,
              };

              await saveLocalMessage(decryptedMsg);
              hasNewMessages = true;

              // Clean up temporary server store-and-forward document
              deleteDoc(doc(db, 'messages', msgId)).catch(() => {});
            } catch (err) {
              console.error('Failed to decrypt store-and-forward message:', err);
            }
          }
        }

        // Reload local messages if new decrypted messages arrived
        if (hasNewMessages) {
          const updated = await getLocalMessages(selectedConversation.id);
          setMessages(updated);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'messages');
      }
    );

    return () => unsubscribe();
  }, [user, selectedConversation, getLocalPrivateKey]);

  // Select Active Conversation
  const selectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    const msgs = await getLocalMessages(conv.id);
    setMessages(msgs);
  };

  // Start or Retrieve 1-on-1 Conversation
  const startOrGetConversation = async (otherUserUid: string): Promise<Conversation> => {
    if (!user) throw new Error('Not authenticated.');

    // Check existing
    const existing = conversations.find((c) => c.participants.includes(otherUserUid));
    if (existing) {
      setSelectedConversation(existing);
      return existing;
    }

    // Generate deterministic conv ID
    const sorted = [user.uid, otherUserUid].sort();
    const convId = `conv_${sorted[0].slice(0, 8)}_${sorted[1].slice(0, 8)}`;

    const otherProfileSnap = await getDoc(doc(db, 'public_profiles', otherUserUid));
    const otherUser = otherProfileSnap.exists() ? (otherProfileSnap.data() as UserProfile) : undefined;

    const newConv: Conversation = {
      id: convId,
      participants: [user.uid, otherUserUid],
      ephemeralSetting: profile?.accountType === 'private' ? '24h' : 'off',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      otherUser,
    };

    try {
      await setDoc(doc(db, 'conversations', convId), {
        participants: newConv.participants,
        ephemeralSetting: newConv.ephemeralSetting,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `conversations/${convId}`);
    }

    await saveLocalConversation(newConv);
    setConversations((prev) => [newConv, ...prev]);
    setSelectedConversation(newConv);

    return newConv;
  };

  // Send E2EE Text Message
  const sendTextMessage = async (text: string, replyToId?: string): Promise<void> => {
    if (!user || !selectedConversation) return;

    const privKey = await getLocalPrivateKey();
    if (!privKey) throw new Error('Private identity key not accessible.');

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
    if (!recipientSnap.exists()) throw new Error('Recipient public key missing.');
    const recipientPubKey = recipientSnap.data().publicKey;

    const content: PlaintextMessageContent = {
      text,
      replyToId,
    };

    const ciphertext = await encryptE2EEPayload(JSON.stringify(content), recipientPubKey, privKey);
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const expiresAtMs = calculateExpiresAt(selectedConversation.ephemeralSetting);

    // Local Decrypted Record
    const localMsg: DecryptedMessage = {
      id: msgId,
      conversationId: selectedConversation.id,
      senderUid: user.uid,
      recipientUid,
      content,
      ephemeralType: selectedConversation.ephemeralSetting,
      status: 'sending',
      timestamp: new Date().toISOString(),
      expiresAtTimestamp: expiresAtMs,
      replyToId,
    };

    await saveLocalMessage(localMsg);
    setMessages((prev) => [...prev, localMsg]);

    // Submit Store-and-Forward Payload to Firestore
    try {
      await setDoc(doc(db, 'messages', msgId), {
        conversationId: selectedConversation.id,
        senderUid: user.uid,
        recipientUid,
        ciphertext,
        ephemeralType: selectedConversation.ephemeralSetting,
        createdAt: serverTimestamp(),
      });

      // Update Conversation Timestamp
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        updatedAt: serverTimestamp(),
      });

      localMsg.status = 'delivered';
      await saveLocalMessage(localMsg);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `messages/${msgId}`);
    }
  };

  // Send Encrypted Image Message
  const sendImageMessage = async (file: File): Promise<void> => {
    if (!user || !selectedConversation) return;

    const privKey = await getLocalPrivateKey();
    if (!privKey) throw new Error('Private key not accessible.');

    const recipientUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!recipientUid) return;

    const recipientSnap = await getDoc(doc(db, 'public_profiles', recipientUid));
    if (!recipientSnap.exists()) throw new Error('Recipient key missing.');
    const recipientPubKey = recipientSnap.data().publicKey;

    // Read image as Data URL
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawDataUrl = reader.result as string;
        const content: PlaintextMessageContent = {
          imageBase64: rawDataUrl,
          fileName: file.name,
        };

        const ciphertext = await encryptE2EEPayload(JSON.stringify(content), recipientPubKey, privKey);
        const msgId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const localMsg: DecryptedMessage = {
          id: msgId,
          conversationId: selectedConversation.id,
          senderUid: user.uid,
          recipientUid,
          content,
          ephemeralType: selectedConversation.ephemeralSetting,
          status: 'sending',
          timestamp: new Date().toISOString(),
          expiresAtTimestamp: calculateExpiresAt(selectedConversation.ephemeralSetting),
        };

        await saveLocalMessage(localMsg);
        setMessages((prev) => [...prev, localMsg]);

        await setDoc(doc(db, 'messages', msgId), {
          conversationId: selectedConversation.id,
          senderUid: user.uid,
          recipientUid,
          ciphertext,
          ephemeralType: selectedConversation.ephemeralSetting,
          createdAt: serverTimestamp(),
        });

        localMsg.status = 'delivered';
        await saveLocalMessage(localMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'messages');
      }
    };
    reader.readAsDataURL(file);
  };

  // Update Ephemeral Setting
  const updateEphemeralSetting = async (setting: EphemeralSetting): Promise<void> => {
    if (!selectedConversation) return;

    try {
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        ephemeralSetting: setting,
        updatedAt: serverTimestamp(),
      });

      const updated = { ...selectedConversation, ephemeralSetting: setting };
      setSelectedConversation(updated);
      await saveLocalConversation(updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${selectedConversation.id}`);
    }
  };

  // Add Reaction
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

  // Delete Conversation Locally
  const deleteConversationLocally = async (conversationId: string): Promise<void> => {
    await deleteLocalConversation(conversationId);
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (selectedConversation?.id === conversationId) {
      setSelectedConversation(null);
      setMessages([]);
    }
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
        pinnedConversations,
        togglePinConversation,
        toggleMuteConversation,
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

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Conversation, DecryptedMessage, SafetyNumberInfo } from '../types';

interface AegisDBSchema extends DBSchema {
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-updated': string };
  };
  messages: {
    key: string;
    value: DecryptedMessage;
    indexes: { 'by-conversation': string; 'by-timestamp': string };
  };
  keyStore: {
    key: string;
    value: { id: string; data: string; iv?: string; salt?: string };
  };
  contacts: {
    key: string;
    value: SafetyNumberInfo;
  };
}

const DB_NAME = 'AegisLocalDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AegisDBSchema>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<AegisDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AegisDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Conversations Store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('by-updated', 'updatedAt');
        }

        // Messages Store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-conversation', 'conversationId');
          msgStore.createIndex('by-timestamp', 'timestamp');
        }

        // KeyStore
        if (!db.objectStoreNames.contains('keyStore')) {
          db.createObjectStore('keyStore', { keyPath: 'id' });
        }

        // Contacts Safety Numbers Store
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'contactUid' });
        }
      },
    });
  }
  return dbPromise;
}

// Local Messages API
export async function saveLocalMessage(message: DecryptedMessage): Promise<void> {
  const db = await getLocalDB();
  await db.put('messages', message);
}

export async function getLocalMessages(conversationId: string): Promise<DecryptedMessage[]> {
  const db = await getLocalDB();
  const all = await db.getAllFromIndex('messages', 'by-conversation', conversationId);
  // Filter out expired messages
  const now = Date.now();
  const valid = all.filter((m) => !m.expiresAtTimestamp || m.expiresAtTimestamp > now);

  return valid.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function deleteLocalMessage(messageId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('messages', messageId);
}

// Local Conversations API
export async function saveLocalConversation(conv: Conversation): Promise<void> {
  const db = await getLocalDB();
  await db.put('conversations', conv);
}

export async function getLocalConversations(): Promise<Conversation[]> {
  const db = await getLocalDB();
  const list = await db.getAll('conversations');
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getLocalConversation(id: string): Promise<Conversation | undefined> {
  const db = await getLocalDB();
  return db.get('conversations', id);
}

export async function deleteLocalConversation(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('conversations', id);
  // Delete associated local messages
  const msgs = await db.getAllFromIndex('messages', 'by-conversation', id);
  for (const m of msgs) {
    await db.delete('messages', m.id);
  }
}

// Key Store API
export async function saveKeyStoreItem(id: string, data: string, iv?: string, salt?: string): Promise<void> {
  const db = await getLocalDB();
  await db.put('keyStore', { id, data, iv, salt });
}

export async function getKeyStoreItem(id: string): Promise<{ id: string; data: string; iv?: string; salt?: string } | undefined> {
  const db = await getLocalDB();
  return db.get('keyStore', id);
}

// Contacts Safety Numbers API
export async function saveSafetyNumber(info: SafetyNumberInfo): Promise<void> {
  const db = await getLocalDB();
  await db.put('contacts', info);
}

export async function getSafetyNumber(contactUid: string): Promise<SafetyNumberInfo | undefined> {
  const db = await getLocalDB();
  return db.get('contacts', contactUid);
}

// Purge expired local messages
export async function purgeExpiredLocalMessages(): Promise<number> {
  const db = await getLocalDB();
  const all = await db.getAll('messages');
  const now = Date.now();
  let purgedCount = 0;

  for (const m of all) {
    if (m.expiresAtTimestamp && m.expiresAtTimestamp <= now) {
      await db.delete('messages', m.id);
      purgedCount++;
    }
  }

  return purgedCount;
}

// Wipe local storage on session destruction
export async function wipeLocalDatabase(): Promise<void> {
  const db = await getLocalDB();
  await db.clear('messages');
  await db.clear('conversations');
  await db.clear('keyStore');
  await db.clear('contacts');
}

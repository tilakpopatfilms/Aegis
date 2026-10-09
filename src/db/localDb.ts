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
  deletedConversations: {
    key: string;
    value: { id: string; deletedAt: string };
  };
}

const DB_NAME = 'AegisLocalDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<AegisDBSchema>> | null = null;

export function getLocalDB(): Promise<IDBPDatabase<AegisDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AegisDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
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

        // Deleted Conversations Store (prevents resurrected chats)
        if (!db.objectStoreNames.contains('deletedConversations')) {
          db.createObjectStore('deletedConversations', { keyPath: 'id' });
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
  const isDeleted = await isConversationDeleted(conv.id);
  if (isDeleted) return; // Do not save if previously deleted
  await db.put('conversations', conv);
}

export async function getLocalConversations(): Promise<Conversation[]> {
  const db = await getLocalDB();
  const list = await db.getAll('conversations');
  const deletedSet = await getDeletedConversationIds();
  const filtered = list.filter((c) => !deletedSet.has(c.id));
  return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getLocalConversation(id: string): Promise<Conversation | undefined> {
  const db = await getLocalDB();
  const isDeleted = await isConversationDeleted(id);
  if (isDeleted) return undefined;
  return db.get('conversations', id);
}

// Deleted Conversations Management (permanently prevents revival upon reload)
export async function markConversationAsDeleted(id: string): Promise<void> {
  const db = await getLocalDB();
  await db.put('deletedConversations', { id, deletedAt: new Date().toISOString() });
  // Also store in localStorage as immediate cache
  try {
    const raw = localStorage.getItem('aegis_deleted_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    if (!arr.includes(id)) {
      arr.push(id);
      localStorage.setItem('aegis_deleted_convs', JSON.stringify(arr));
    }
  } catch (e) {}
}

export async function isConversationDeleted(id: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem('aegis_deleted_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    if (arr.includes(id)) return true;
  } catch (e) {}

  const db = await getLocalDB();
  const entry = await db.get('deletedConversations', id);
  return !!entry;
}

export async function getDeletedConversationIds(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem('aegis_deleted_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    arr.forEach((id) => set.add(id));
  } catch (e) {}

  const db = await getLocalDB();
  const entries = await db.getAll('deletedConversations');
  entries.forEach((e) => set.add(e.id));
  return set;
}

export async function deleteLocalConversation(id: string): Promise<void> {
  await markConversationAsDeleted(id);
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
  await db.clear('deletedConversations');
  localStorage.removeItem('aegis_deleted_convs');
}

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Conversation, DecryptedMessage, SafetyNumberInfo, UserProfile } from '../types';

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
  profiles: {
    key: string;
    value: UserProfile;
  };
}

const DB_NAME = 'AegisLocalDB';
const DB_VERSION = 3;

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

        // User Profiles Cache Store (for 100% offline access)
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'uid' });
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
  return all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function markMessageAsDeletedLocally(messageId: string): void {
  try {
    const raw = localStorage.getItem('aegis_deleted_msg_ids') || '[]';
    const list: string[] = JSON.parse(raw);
    if (!list.includes(messageId)) {
      list.push(messageId);
      localStorage.setItem('aegis_deleted_msg_ids', JSON.stringify(list));
    }
  } catch (e) {}
}

export function isMessageDeletedLocally(messageId: string): boolean {
  try {
    const raw = localStorage.getItem('aegis_deleted_msg_ids') || '[]';
    const list: string[] = JSON.parse(raw);
    return list.includes(messageId);
  } catch (e) {
    return false;
  }
}

export async function deleteLocalMessage(messageId: string): Promise<void> {
  markMessageAsDeletedLocally(messageId);
  const db = await getLocalDB();
  await db.delete('messages', messageId);
}

// Local Conversations API
export async function saveLocalConversation(conv: Conversation, force: boolean = false): Promise<void> {
  if (!force) {
    const isDeleted = await isConversationDeleted(conv.id);
    if (isDeleted) return; // Do not save if previously deleted
  }
  const db = await getLocalDB();
  await db.put('conversations', conv);
}

export async function getLocalConversations(userUid?: string): Promise<Conversation[]> {
  const db = await getLocalDB();
  const list = await db.getAll('conversations');
  const deletedSet = await getDeletedConversationIds();
  const filtered = list.filter((c) => {
    if (deletedSet.has(c.id)) {
      if (!c.lastMessageText && !c.lastMessageTime) return false;
      // If conversation has active messages, unmark it as deleted so user sees it!
      unmarkConversationAsDeleted(c.id).catch(() => {});
    }
    if (userUid && c.participants && !c.participants.includes(userUid)) return false;
    return true;
  });
  return filtered.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

export async function getLocalConversation(id: string): Promise<Conversation | undefined> {
  const db = await getLocalDB();
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

export async function unmarkConversationAsDeleted(id: string): Promise<void> {
  try {
    const raw = localStorage.getItem('aegis_deleted_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    const filtered = arr.filter((x) => x !== id);
    localStorage.setItem('aegis_deleted_convs', JSON.stringify(filtered));
  } catch (e) {}

  const db = await getLocalDB();
  await db.delete('deletedConversations', id);
}

export async function isConversationDeleted(id: string, compareTimeIso?: string): Promise<boolean> {
  const db = await getLocalDB();
  const entry = await db.get('deletedConversations', id);

  // If cloud has activity (messages or conversation update) newer than local delete, auto-revive immediately!
  if (entry && entry.deletedAt && compareTimeIso) {
    const deletedTime = new Date(entry.deletedAt).getTime();
    const cloudTime = new Date(compareTimeIso).getTime();
    if (cloudTime > deletedTime) {
      await unmarkConversationAsDeleted(id);
      return false;
    }
    return true;
  }

  if (entry) return true;

  try {
    const raw = localStorage.getItem('aegis_deleted_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    if (arr.includes(id)) {
      if (compareTimeIso) {
        await unmarkConversationAsDeleted(id);
        return false;
      }
      return true;
    }
  } catch (e) {}

  return false;
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

// Pinned Conversations Persistence (Dual: localStorage + IndexedDB)
export function getPinnedConversationIds(): Set<string> {
  const set = new Set<string>();
  try {
    const raw = localStorage.getItem('aegis_pinned_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    arr.forEach((id) => set.add(id));
  } catch (e) {}
  return set;
}

export function setConversationPinned(id: string, pinned: boolean): void {
  try {
    const raw = localStorage.getItem('aegis_pinned_convs') || '[]';
    const arr: string[] = JSON.parse(raw);
    const set = new Set(arr);
    if (pinned) {
      set.add(id);
    } else {
      set.delete(id);
    }
    localStorage.setItem('aegis_pinned_convs', JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function isConversationPinned(id: string): boolean {
  return getPinnedConversationIds().has(id);
}

// Key Store API (Dual Persistence: IndexedDB + localStorage fallback)
export async function saveKeyStoreItem(id: string, data: string, iv?: string, salt?: string): Promise<void> {
  const item = { id, data, iv, salt };
  try {
    localStorage.setItem(`aegis_keystore_${id}`, JSON.stringify(item));
    if (id === 'plainPrivateKey') {
      localStorage.setItem('aegis_plain_priv_key', data);
    }
  } catch (e) {}

  try {
    const db = await getLocalDB();
    await db.put('keyStore', item);
  } catch (e) {
    console.warn('IndexedDB saveKeyStoreItem notice:', e);
  }
}

export async function getKeyStoreItem(id: string): Promise<{ id: string; data: string; iv?: string; salt?: string } | undefined> {
  // 1. Try IndexedDB
  try {
    const db = await getLocalDB();
    const item = await db.get('keyStore', id);
    if (item?.data) return item;
  } catch (e) {}

  // 2. Try localStorage fallback
  try {
    const raw = localStorage.getItem(`aegis_keystore_${id}`);
    if (raw) {
      return JSON.parse(raw);
    }
    if (id === 'plainPrivateKey') {
      const fallbackPlain = localStorage.getItem('aegis_plain_priv_key');
      if (fallbackPlain) {
        return { id: 'plainPrivateKey', data: fallbackPlain };
      }
    }
  } catch (e) {}

  return undefined;
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
    if (m.localDisappearAtTimestamp && m.localDisappearAtTimestamp <= now) {
      await db.delete('messages', m.id);
      purgedCount++;
    } else if (m.expiresAtTimestamp && m.expiresAtTimestamp <= now) {
      await db.delete('messages', m.id);
      purgedCount++;
    }
  }

  return purgedCount;
}

// Offline User Profiles Cache API
export async function saveLocalProfile(profile: UserProfile): Promise<void> {
  if (!profile || !profile.uid) return;
  try {
    localStorage.setItem(`aegis_profile_${profile.uid}`, JSON.stringify(profile));
  } catch (e) {}

  try {
    const db = await getLocalDB();
    await db.put('profiles', profile);
  } catch (e) {
    console.warn('saveLocalProfile notice:', e);
  }
}

export async function getLocalProfile(uid: string): Promise<UserProfile | undefined> {
  if (!uid) return undefined;
  // 1. Try IndexedDB
  try {
    const db = await getLocalDB();
    const found = await db.get('profiles', uid);
    if (found) return found;
  } catch (e) {}

  // 2. Try localStorage synchronous fallback
  try {
    const raw = localStorage.getItem(`aegis_profile_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return undefined;
}

export async function getAllLocalProfiles(): Promise<UserProfile[]> {
  try {
    const db = await getLocalDB();
    return await db.getAll('profiles');
  } catch (e) {
    return [];
  }
}

// Wipe local storage on session destruction
export async function wipeLocalDatabase(): Promise<void> {
  const db = await getLocalDB();
  await db.clear('messages');
  await db.clear('conversations');
  await db.clear('keyStore');
  await db.clear('contacts');
  await db.clear('deletedConversations');
  await db.clear('profiles');
  localStorage.removeItem('aegis_deleted_convs');
}

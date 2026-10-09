import React, { useState } from 'react';
import { Search, QrCode, Lock, UserPlus, Globe, Shield } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { UserProfile } from '../../types';

interface SearchViewProps {
  onSelectUser: (uid: string) => void;
  onOpenQR: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onSelectUser, onOpenQR }) => {
  const { user } = useAuth();
  const { startOrGetConversation } = useChat();

  const [activeTab, setActiveTab] = useState<'public' | 'exactPrivate'>('public');
  const [queryInput, setQueryInput] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!queryInput.trim()) return;

    setLoading(true);
    setSearched(true);
    setResults([]);

    const cleanInput = queryInput.trim().toLowerCase().replace('@', '');

    try {
      if (activeTab === 'public') {
        const q = query(
          collection(db, 'public_profiles'),
          where('accountType', '==', 'public')
        );
        const snapshot = await getDocs(q);
        const list: UserProfile[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as UserProfile;
          if (
            data.uid !== user?.uid &&
            (data.username.includes(cleanInput) || data.fullName.toLowerCase().includes(cleanInput))
          ) {
            list.push(data);
          }
        });

        setResults(list);
      } else {
        const usernameSnap = await getDoc(doc(db, 'usernames', cleanInput));
        if (usernameSnap.exists()) {
          const targetUid = usernameSnap.data().uid;
          if (targetUid === user?.uid) {
            setError('That is your own username.');
          } else {
            const profileSnap = await getDoc(doc(db, 'public_profiles', targetUid));
            if (profileSnap.exists()) {
              setResults([profileSnap.data() as UserProfile]);
            }
          }
        } else {
          setResults([]);
        }
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError('Search could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (targetUid: string) => {
    try {
      await startOrGetConversation(targetUid);
      onSelectUser(targetUid);
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation.');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-[#09090b] max-w-2xl mx-auto space-y-6 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Search & Connections</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Find contacts by username or connect using QR codes
          </p>
        </div>

        <button
          onClick={onOpenQR}
          className="px-3.5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-sm transition-colors"
        >
          <QrCode className="w-4 h-4" />
          <span>My QR Code</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-neutral-100 dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => {
            setActiveTab('public');
            setResults([]);
            setSearched(false);
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'public'
              ? 'bg-white dark:bg-[#09090b] text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Public Directory</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('exactPrivate');
            setResults([]);
            setSearched(false);
          }}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'exactPrivate'
              ? 'bg-white dark:bg-[#09090b] text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Private Exact Lookup</span>
        </button>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={
              activeTab === 'public'
                ? 'Search public names or usernames...'
                : 'Enter exact private username (e.g. akshatpopat)'
            }
            className="w-full pl-9 pr-3 py-2 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !queryInput.trim()}
          className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-40"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {searched && results.length === 0 && !loading && (
          <div className="text-center py-8 px-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">No account found</p>
            <p className="text-[11px] text-neutral-400 mt-1">
              Verify the exact username or connect via QR code.
            </p>
          </div>
        )}

        {results.map((u) => {
          const hasPhoto = u.photoURL && !u.photoURL.startsWith('data:image/svg+xml;utf8');
          return (
            <div
              key={u.uid}
              className="p-3.5 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between hover:border-neutral-400 transition-colors"
            >
              <div className="flex items-center space-x-3.5">
                {hasPhoto ? (
                  <img
                    src={u.photoURL}
                    alt={u.fullName}
                    className="w-11 h-11 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs select-none">
                    {getInitials(u.fullName)}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-sm">{u.fullName}</h4>
                  <p className="text-xs text-neutral-400 font-mono">@{u.username}</p>
                </div>
              </div>

              <button
                onClick={() => handleStartChat(u.uid)}
                className="px-3.5 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

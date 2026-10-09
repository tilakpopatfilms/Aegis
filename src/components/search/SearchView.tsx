import React, { useState, useEffect } from 'react';
import { Search, QrCode, UserPlus, AlertCircle, MessageSquare } from 'lucide-react';
import { collection, getDocs, query } from 'firebase/firestore';
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

  const [queryInput, setQueryInput] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Live real-time search with space insensitivity and 5-result limit
  const performSearch = async (searchTerm: string) => {
    setError(null);
    const cleaned = searchTerm.trim().toLowerCase();
    if (!cleaned) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // Space-insensitive sanitized query
      const sanitized = cleaned.replace(/\s+/g, '').replace('@', '');

      // Fetch public profiles from Firestore
      const snap = await getDocs(collection(db, 'public_profiles'));
      const matches: UserProfile[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        if (data.uid === user?.uid) return;

        const usernameSanitized = (data.username || '').toLowerCase().replace(/\s+/g, '');
        const fullNameSanitized = (data.fullName || '').toLowerCase().replace(/\s+/g, '');

        if (
          usernameSanitized.includes(sanitized) ||
          fullNameSanitized.includes(sanitized) ||
          data.fullName.toLowerCase().includes(cleaned)
        ) {
          matches.push(data);
        }
      });

      // Limit results to maximum 5 as explicitly requested
      setResults(matches.slice(0, 5));
    } catch (err: any) {
      console.warn('Search error:', err);
      setError('Search could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (queryInput.trim()) {
        performSearch(queryInput);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [queryInput]);

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
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-8 bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Search Directory</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Find contacts live or scan QR codes to start an end-to-end encrypted chat
          </p>
        </div>

        <button
          onClick={onOpenQR}
          className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-xs transition-colors shrink-0"
        >
          <QrCode className="w-4 h-4" />
          <span>My QR Code</span>
        </button>
      </div>

      {/* Unified Search Input (Space-insensitive) */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="Search by username or name (e.g. akshatpopat)..."
          className="w-full pl-9 pr-4 py-2.5 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
        />
      </div>

      {error && (
        <div className="p-3 bg-neutral-100 dark:bg-[#18181b] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-neutral-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Header */}
      {hasSearched && (
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            {loading ? 'Searching live directory...' : `Found ${results.length} ${results.length === 1 ? 'account' : 'accounts'} (max 5)`}
          </span>
          {results.length === 5 && (
            <span className="text-[10px] text-neutral-400">
              Refine your query for more specific accounts
            </span>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="space-y-2.5">
        {!hasSearched && (
          <div className="text-center py-12 px-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-2">
            <Search className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Live Public Directory Search
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
              Type any name or username to search live accounts. All new accounts are immediately discoverable.
            </p>
          </div>
        )}

        {hasSearched && results.length === 0 && !loading && (
          <div className="text-center py-10 px-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1">
            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              No account found matching "{queryInput}"
            </p>
            <p className="text-[11px] text-neutral-400">
              Check spelling or ask the contact for their direct link ({window.location.origin}/username)
            </p>
          </div>
        )}

        {results.map((u) => {
          const hasPhoto = u.photoURL && !u.photoURL.startsWith('data:image/svg+xml;utf8');
          return (
            <div
              key={u.uid}
              className="p-3.5 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                {hasPhoto ? (
                  <img
                    src={u.photoURL}
                    alt={u.fullName}
                    className="w-11 h-11 rounded-full object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs select-none shrink-0">
                    {getInitials(u.fullName)}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
                    {u.fullName}
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-mono truncate">
                    @{u.username}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleStartChat(u.uid)}
                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-bold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Pin,
  VolumeX,
  Clock,
  Trash2,
  Plus,
  CheckCheck,
  MoreVertical,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Conversation } from '../../types';

interface ChatsViewProps {
  onOpenSearch: () => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({ onOpenSearch }) => {
  const { profile } = useAuth();
  const {
    conversations,
    selectedConversation,
    selectConversation,
    togglePinConversation,
    toggleMuteConversation,
    deleteConversationLocally,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [activeMenuConvId, setActiveMenuConvId] = useState<string | null>(null);

  const filtered = conversations.filter((c) => {
    const nameMatch = c.otherUser?.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    const usernameMatch = c.otherUser?.username.toLowerCase().includes(searchQuery.toLowerCase());
    const textMatch = c.lastMessageText?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || usernameMatch || textMatch;

    if (filterMode === 'unread') {
      return matchesSearch && (c.unreadCount || 0) > 0;
    }
    return matchesSearch;
  });

  const pinned = filtered.filter((c) => c.isPinned);
  const unpinned = filtered.filter((c) => !c.isPinned);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
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

  const renderConversationItem = (c: Conversation) => {
    const isSelected = selectedConversation?.id === c.id;
    const name = c.otherUser?.fullName || `@${c.otherUser?.username || 'contact'}`;
    const username = c.otherUser?.username || 'user';
    const photo = c.otherUser?.photoURL;
    const hasCustomPhoto = photo && !photo.startsWith('data:image/svg+xml;utf8');

    return (
      <div
        key={c.id}
        onClick={() => {
          setActiveMenuConvId(null);
          selectConversation(c);
        }}
        className={`group relative flex items-center space-x-3 px-3.5 py-3 cursor-pointer transition-colors border-b border-neutral-100 dark:border-neutral-900 ${
          isSelected
            ? 'bg-neutral-100 dark:bg-[#1c1c20]'
            : 'hover:bg-neutral-50 dark:hover:bg-[#141417]'
        }`}
      >
        {/* Contact Avatar */}
        <div className="relative shrink-0">
          {hasCustomPhoto ? (
            <img
              src={photo}
              alt={name}
              className="w-11 h-11 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs select-none">
              {getInitials(name)}
            </div>
          )}

          {c.ephemeralSetting && c.ephemeralSetting !== 'off' && (
            <span
              className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-[8px] border border-white dark:border-black"
              title={`Disappearing: ${c.ephemeralSetting}`}
            >
              <Clock className="w-2.5 h-2.5" />
            </span>
          )}
        </div>

        {/* Text information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
              {name}
            </span>
            <span className="text-[10px] text-neutral-400 shrink-0 font-normal">
              {formatTime(c.lastMessageTime || c.updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <p className="truncate text-[11px] flex-1 pr-2">
              {c.lastMessageText || 'Encrypted conversation ready'}
            </p>

            <div className="flex items-center space-x-1.5 shrink-0">
              {c.isMuted && <VolumeX className="w-3 h-3 text-neutral-400" />}
              {c.isPinned && <Pin className="w-3 h-3 text-neutral-400 fill-current" />}
              {c.unreadCount && c.unreadCount > 0 ? (
                <span className="px-1.5 py-0.2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-[10px] font-bold">
                  {c.unreadCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Conversation Action Menu Toggle */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuConvId(activeMenuConvId === c.id ? null : c.id);
            }}
            className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity rounded"
            title="Conversation Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {activeMenuConvId === c.id && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-6 z-30 bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl py-1 w-36 text-xs text-neutral-800 dark:text-neutral-200"
            >
              <button
                onClick={() => {
                  togglePinConversation(c.id);
                  setActiveMenuConvId(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-[#202024] flex items-center space-x-2"
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{c.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
              </button>
              <button
                onClick={() => {
                  toggleMuteConversation(c.id);
                  setActiveMenuConvId(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-[#202024] flex items-center space-x-2"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>{c.isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              <button
                onClick={() => {
                  deleteConversationLocally(c.id);
                  setActiveMenuConvId(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-[#202024] text-rose-600 flex items-center space-x-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0c0c0e] border-r border-neutral-200 dark:border-neutral-800 select-none overflow-hidden">
      {/* Top Header of Chats */}
      <div className="px-4 py-3 bg-white dark:bg-[#0c0c0e] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
        <h2 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
          Messages
        </h2>

        <button
          onClick={onOpenSearch}
          className="p-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl transition-all shadow-xs"
          title="New Chat"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar & Filters */}
      <div className="p-3 bg-white dark:bg-[#0c0c0e] border-b border-neutral-200 dark:border-neutral-800 space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-200 dark:border-neutral-800 focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              filterMode === 'all'
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#18181b]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('unread')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              filterMode === 'unread'
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#18181b]'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Conversations Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-900">
        {conversations.length === 0 ? (
          <div className="text-center py-16 px-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#18181b] text-neutral-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              No conversations yet
            </p>
            <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
              Search the directory or share your account link ({window.location.origin}/{profile?.username || 'username'}) to start an encrypted chat.
            </p>
            <button
              onClick={onOpenSearch}
              className="px-3.5 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-xl"
            >
              Start New Chat
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-xs text-neutral-400">
            No chats matching "{searchQuery}"
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinned.length > 0 && (
              <div>
                <p className="px-3.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-neutral-50 dark:bg-[#121215]">
                  Pinned
                </p>
                {pinned.map(renderConversationItem)}
              </div>
            )}

            {/* Unpinned Section */}
            <div>
              {pinned.length > 0 && unpinned.length > 0 && (
                <p className="px-3.5 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-neutral-50 dark:bg-[#121215]">
                  All Chats
                </p>
              )}
              {unpinned.map(renderConversationItem)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

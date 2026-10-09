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
    pinnedConversations,
    togglePinConversation,
    toggleMuteConversation,
    deleteConversationLocally,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

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

  const unpinned = filtered.filter((c) => !c.isPinned);

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
    const name = c.otherUser?.fullName || 'Encrypted User';
    const username = c.otherUser?.username || 'user';
    const photo = c.otherUser?.photoURL;
    const hasCustomPhoto = photo && !photo.startsWith('data:image/svg+xml;utf8');

    return (
      <div
        key={c.id}
        onClick={() => selectConversation(c)}
        className={`group relative flex items-center space-x-3 px-3.5 py-3 cursor-pointer transition-colors border-b border-neutral-100 dark:border-neutral-800/60 ${
          isSelected
            ? 'bg-neutral-100 dark:bg-[#1c1c20]'
            : 'hover:bg-neutral-50 dark:hover:bg-[#16161a]'
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

          {c.ephemeralSetting !== 'off' && (
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
              {formatTime(c.updatedAt)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 text-xs text-neutral-500 dark:text-neutral-400 truncate pr-2">
              <CheckCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate text-[11px]">
                {c.lastMessageText || 'End-to-end encrypted session'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              {c.isMuted && <VolumeX className="w-3.5 h-3.5 text-neutral-400" />}
              {c.isPinned && <Pin className="w-3.5 h-3.5 text-neutral-900 dark:text-white fill-current" />}

              {c.unreadCount ? (
                <span className="text-[10px] font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full px-1.5 py-0.2 min-w-[16px] text-center">
                  {c.unreadCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Hover action menu buttons */}
        <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center space-x-1 bg-white dark:bg-[#18181b] p-1 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePinConversation(c.id);
            }}
            className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded"
            title={c.isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className={`w-3.5 h-3.5 ${c.isPinned ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMuteConversation(c.id);
            }}
            className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded"
            title={c.isMuted ? 'Unmute' : 'Mute'}
          >
            <VolumeX className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteConversationLocally(c.id);
            }}
            className="p-1 text-neutral-400 hover:text-rose-600 rounded"
            title="Delete Chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0c0e] border-r border-neutral-200 dark:border-neutral-800">
      {/* Search Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
            Conversations
          </h2>

          <button
            onClick={onOpenSearch}
            className="p-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg shadow-xs transition-colors flex items-center space-x-1 text-xs font-semibold"
            title="Start New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search input with clean black/white styling */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-[#18181b] rounded-lg text-xs text-neutral-900 dark:text-white placeholder-neutral-400 border border-neutral-200 dark:border-neutral-800 focus:outline-none"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
              filterMode === 'all'
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('unread')}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
              filterMode === 'unread'
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Conversations List with smooth scrolling */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-[#18181b] text-neutral-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              No conversations found
            </p>
            <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
              Search by username or scan a QR code to start an encrypted conversation.
            </p>
            <button
              onClick={onOpenSearch}
              className="px-3.5 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-lg shadow-xs"
            >
              Find Contacts
            </button>
          </div>
        ) : (
          <div>
            {pinnedConversations.length > 0 && !searchQuery && filterMode === 'all' && (
              <div>
                <p className="px-3.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Pinned
                </p>
                {pinnedConversations.map(renderConversationItem)}
              </div>
            )}

            <div>
              {pinnedConversations.length > 0 && !searchQuery && filterMode === 'all' && (
                <p className="px-3.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  All Messages
                </p>
              )}
              {unpinned.map(renderConversationItem)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

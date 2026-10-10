import React from 'react';
import { MessageSquare, Search, User } from 'lucide-react';
import { useChat } from '../context/ChatContext';

interface NavigationProps {
  currentPath: string;
  onNavigate: (route: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentPath, onNavigate }) => {
  const { conversations, selectConversation } = useChat();

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const isChatActive = currentPath === '/' || currentPath === '/chat';
  const isSearchActive = currentPath === '/search';
  const isProfileActive = currentPath === '/profile';

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0c0c0e] border-t border-neutral-200 dark:border-neutral-800 py-1.5 px-4 shadow-md">
      <div className="flex items-center justify-around max-w-sm mx-auto">
        <button
          onClick={() => {
            selectConversation(null);
            onNavigate('/chat');
          }}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors ${
            isChatActive
              ? 'text-neutral-900 dark:text-white font-bold'
              : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-2 text-[9px] font-bold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full h-3.5 min-w-[14px] px-0.5 flex items-center justify-center">
                {totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 font-medium">Chats</span>
        </button>

        <button
          onClick={() => onNavigate('/search')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors ${
            isSearchActive
              ? 'text-neutral-900 dark:text-white font-bold'
              : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Search & QR</span>
        </button>

        <button
          onClick={() => onNavigate('/profile')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition-colors ${
            isProfileActive
              ? 'text-neutral-900 dark:text-white font-bold'
              : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Profile</span>
        </button>
      </div>
    </nav>
  );
};

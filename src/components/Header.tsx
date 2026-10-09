import React from 'react';
import { Shield, Lock, MessageSquare, Search, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './common/ThemeToggle';
import { PWAInstallButton } from './pwa/PWAInstallButton';

interface HeaderProps {
  currentPath: string;
  onNavigate: (route: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const { user, profile, logout } = useAuth();

  const initials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'A';

  const isChatActive = currentPath === '/' || currentPath === '/chat';
  const isSearchActive = currentPath === '/search';
  const isProfileActive = currentPath === '/profile';

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0c0c0e] text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 px-4 py-2.5 transition-colors shrink-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand identity */}
        <div
          className="flex items-center space-x-3 cursor-pointer select-none"
          onClick={() => onNavigate('/chat')}
        >
          <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-tight">Aegis</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 flex items-center space-x-1">
                <Lock className="w-2.5 h-2.5 inline" />
                <span>E2EE</span>
              </span>
            </div>
            <p className="text-[10px] text-neutral-500 font-medium">Private by Design</p>
          </div>
        </div>

        {/* 3 Main Desktop Navigation Tabs */}
        {user && (
          <div className="hidden sm:flex items-center space-x-1 bg-neutral-100 dark:bg-[#18181b] p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => onNavigate('/chat')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isChatActive
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chats</span>
            </button>

            <button
              onClick={() => onNavigate('/search')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSearchActive
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search & QR</span>
            </button>

            <button
              onClick={() => onNavigate('/profile')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isProfileActive
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>
          </div>
        )}

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {/* In-App PWA Install Button */}
          <PWAInstallButton />

          <ThemeToggle />

          {user && profile ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => onNavigate('/profile')}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title="Profile"
              >
                {profile.photoURL && !profile.photoURL.startsWith('data:image/svg+xml;utf8') ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.fullName}
                    className="w-7 h-7 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[11px]">
                    {initials}
                  </div>
                )}
                <span className="text-xs font-semibold hidden md:inline truncate max-w-[120px]">
                  {profile.fullName.split(' ')[0]}
                </span>
              </button>

              <button
                onClick={logout}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-lg transition-colors"
                title="Sign out session"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onNavigate('/login')}
                className="px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => onNavigate('/register')}
                className="px-3 py-1.5 text-xs font-semibold bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-lg shadow-sm transition-all"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

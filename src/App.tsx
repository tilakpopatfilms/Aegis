import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ChatsView } from './components/chats/ChatsView';
import { ChatRoom } from './components/chats/ChatRoom';
import { SearchView } from './components/search/SearchView';
import { ProfileView } from './components/profile/ProfileView';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { DirectChatInvitePage } from './components/chats/DirectChatInvitePage';
import { QRModal } from './components/qr/QRModal';
import { Shield, Lock, Key, ArrowRight, MessageSquare } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const { selectedConversation, selectConversation } = useChat();

  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/chat');
  const [isQROpen, setIsQROpen] = useState(false);

  // Browser Navigation & History API sync
  const navigate = (newPath: string) => {
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    setCurrentPath(newPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/chat');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-white dark:bg-[#09090b] flex flex-col items-center justify-center text-neutral-900 dark:text-white space-y-3">
        <div className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center animate-pulse">
          <Shield className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-neutral-500">
          Loading Aegis...
        </p>
      </div>
    );
  }

  // Route 1: Dedicated Full Page Sign In
  if (currentPath === '/login') {
    return <LoginPage onNavigate={navigate} />;
  }

  // Route 2: Dedicated Full Page Sign Up
  if (currentPath === '/register') {
    return <RegisterPage onNavigate={navigate} />;
  }

  // Route 3: Direct User Link `/:username` (e.g. `/akshatpopat`)
  const isDirectUserRoute =
    currentPath !== '/' &&
    currentPath !== '/chat' &&
    currentPath !== '/search' &&
    currentPath !== '/profile' &&
    currentPath.startsWith('/');

  if (isDirectUserRoute) {
    const targetUsername = currentPath.slice(1);
    return (
      <DirectChatInvitePage
        targetUsername={targetUsername}
        onNavigate={navigate}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 overflow-hidden select-none transition-colors">
      {/* Top Header */}
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
      />

      {/* Main Workspace */}
      {!user ? (
        /* Welcome Landing for Unauthenticated Users */
        <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col items-center justify-center p-6 text-center space-y-8 my-auto">
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto shadow-sm">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              Aegis Private Messaging
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed">
              Genuine end-to-end encrypted messaging with local storage, disappearing messages, and zero plaintext on cloud servers.
            </p>
          </div>

          {/* Architecture Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left">
            <div className="p-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-2xs">
              <Lock className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="font-bold text-xs">End-to-End Encrypted</h3>
              <p className="text-[11px] text-neutral-500">
                Curve25519 DH + AES-256-GCM payload encryption before network transmission.
              </p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-2xs">
              <Key className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="font-bold text-xs">Permanent Security Key</h3>
              <p className="text-[11px] text-neutral-500">
                128-bit client recovery entropy formatted as ABCD-EFGH-IJKL.
              </p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-2xs">
              <Shield className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="font-bold text-xs">Offline Local Storage</h3>
              <p className="text-[11px] text-neutral-500">
                Messages cached in device memory so you can review chats even when disconnected.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={() => navigate('/register')}
              className="flex-1 py-3 px-5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-xl shadow-sm transition-all text-xs"
            >
              Create Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-3 px-5 bg-white dark:bg-[#18181b] hover:bg-neutral-100 dark:hover:bg-[#202024] text-neutral-900 dark:text-white font-bold rounded-xl border border-neutral-200 dark:border-neutral-800 transition-all text-xs"
            >
              Sign In
            </button>
          </div>
        </main>
      ) : (
        /* Authenticated Main App: WhatsApp Layout */
        <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row overflow-hidden pb-14 sm:pb-0 sm:my-2 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-200 dark:border-neutral-800">
          {(currentPath === '/chat' || currentPath === '/') && (
            <div className="flex-1 flex w-full h-full overflow-hidden">
              {/* Left Sidebar: Conversations List */}
              <div
                className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
                  selectedConversation ? 'hidden md:block' : 'block'
                }`}
              >
                <ChatsView onOpenSearch={() => navigate('/search')} />
              </div>

              {/* Right Conversation Window */}
              <div
                className={`flex-1 h-full ${
                  !selectedConversation ? 'hidden md:block' : 'block'
                }`}
              >
                <ChatRoom onBack={() => selectConversation(null as any)} />
              </div>
            </div>
          )}

          {currentPath === '/search' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <SearchView
                onSelectUser={() => navigate('/chat')}
                onOpenQR={() => setIsQROpen(true)}
              />
            </div>
          )}

          {currentPath === '/profile' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <ProfileView />
            </div>
          )}
        </main>
      )}

      {/* Mobile Bottom Navigation Bar */}
      {user && (
        <Navigation
          currentPath={currentPath}
          onNavigate={navigate}
        />
      )}

      {/* Global QR Code Modal */}
      <QRModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        onSuccessConnect={(targetUidOrUsername) => {
          setIsQROpen(false);
          if (targetUidOrUsername.startsWith('usr_')) {
            navigate('/chat');
          } else {
            navigate(`/${targetUidOrUsername}`);
          }
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <MainApp />
      </ChatProvider>
    </AuthProvider>
  );
}

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
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { Shield, Lock, Key, ArrowRight, MessageSquare } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const { selectedConversation, selectConversation } = useChat();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '') {
      return localStorage.getItem('aegis_session_uid') ? '/chat' : '/home';
    }
    if (path === '/chats') return '/chat';
    return path;
  });
  const [isQROpen, setIsQROpen] = useState(false);

  // Browser Navigation & History API sync
  const navigate = (newPath: string) => {
    const normalized = newPath === '/chats' ? '/chat' : newPath;
    if (normalized === '/chat' && (currentPath === '/chat' || currentPath === '/chats')) {
      selectConversation(null as any);
    }
    if (window.location.pathname !== normalized) {
      window.history.pushState(null, '', normalized);
    }
    setCurrentPath(normalized);
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/chats') {
        setCurrentPath('/chat');
      } else {
        setCurrentPath(p === '/' || p === '' ? (localStorage.getItem('aegis_session_uid') ? '/chat' : '/home') : p);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect unauthenticated user trying to access /chat, and prevent authenticated user accessing /login or /register
  useEffect(() => {
    if (!loading && !user && (currentPath === '/chat' || currentPath === '/chats' || currentPath === '/')) {
      navigate('/home');
    }
    if (!loading && user && (currentPath === '/login' || currentPath === '/register')) {
      navigate('/chat');
    }
  }, [loading, user, currentPath]);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-[#09090b] flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-10 h-10 rounded-full bg-white text-neutral-900 flex items-center justify-center animate-pulse">
          <Shield className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-neutral-400">
          Loading Aegis...
        </p>
      </div>
    );
  }

  // Route 1: Dedicated Full Page Sign In (Inaccessible when user is already signed in)
  if (currentPath === '/login') {
    if (user) {
      navigate('/chat');
      return null;
    }
    return <LoginPage onNavigate={navigate} />;
  }

  // Route 2: Dedicated Full Page Sign Up (Inaccessible when user is already signed in)
  if (currentPath === '/register') {
    if (user) {
      navigate('/chat');
      return null;
    }
    return <RegisterPage onNavigate={navigate} />;
  }

  // Route 3: Direct User Link `/:username` or `/@:username`
  const isDirectUserRoute =
    currentPath !== '/' &&
    currentPath !== '/home' &&
    currentPath !== '/chat' &&
    currentPath !== '/chats' &&
    currentPath !== '/search' &&
    currentPath !== '/profile' &&
    currentPath !== '/login' &&
    currentPath !== '/register' &&
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
    <div className="h-[100dvh] w-full flex flex-col bg-[#09090b] text-neutral-100 overflow-hidden select-none">
      {/* Top Header */}
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
      />

      {/* Main Workspace */}
      {!user || currentPath === '/home' ? (
        /* Welcome Landing for Users at /home or unauthenticated / */
        <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col items-center justify-start py-8 sm:py-16 px-4 sm:px-6 text-center space-y-8">
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-white text-neutral-900 flex items-center justify-center mx-auto shadow-sm">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
              Aegis Private Messaging
            </h1>
            <p className="text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed">
              Genuine end-to-end encrypted messaging with offline local storage, disappearing messages, and zero plaintext on cloud servers.
            </p>
          </div>

          {/* Architecture Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left">
            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-1.5 shadow-2xs">
              <Lock className="w-5 h-5 text-neutral-200" />
              <h3 className="font-bold text-xs text-white">End-to-End Encrypted</h3>
              <p className="text-[11px] text-neutral-400">
                Curve25519 DH + AES-256-GCM payload encryption before network transmission.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-1.5 shadow-2xs">
              <Key className="w-5 h-5 text-neutral-200" />
              <h3 className="font-bold text-xs text-white">Permanent Security Key</h3>
              <p className="text-[11px] text-neutral-400">
                128-bit client recovery entropy formatted as ABCD-EFGH-IJKL.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-1.5 shadow-2xs">
              <Shield className="w-5 h-5 text-neutral-200" />
              <h3 className="font-bold text-xs text-white">Offline Local Storage</h3>
              <p className="text-[11px] text-neutral-400">
                Messages cached in device memory so you can review chats even when disconnected.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            {user ? (
              <button
                onClick={() => navigate('/chat')}
                className="flex-1 py-3 px-5 bg-white hover:bg-neutral-200 text-neutral-900 font-bold rounded-xl shadow-sm transition-all text-xs"
              >
                Go to Chats
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/register')}
                  className="flex-1 py-3 px-5 bg-white hover:bg-neutral-200 text-neutral-900 font-bold rounded-xl shadow-sm transition-all text-xs"
                >
                  Create Account
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 py-3 px-5 bg-[#18181b] hover:bg-[#202024] text-white font-bold rounded-xl border border-neutral-800 transition-all text-xs"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </main>
      ) : (
        /* Authenticated Main App: WhatsApp Layout */
        <main
          className={`flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row overflow-hidden ${
            selectedConversation ? 'pb-0' : 'pb-14'
          } sm:pb-0 sm:my-2 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-200 dark:border-neutral-800`}
        >
          {(currentPath === '/chat' || currentPath === '/chats' || currentPath === '/') && (
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

      {/* Mobile Bottom Navigation Bar (Hidden when inside active conversation) */}
      {user && !selectedConversation && (
        <Navigation
          currentPath={currentPath}
          onNavigate={navigate}
        />
      )}

      {/* Offline Status Notice */}
      <OfflineIndicator />

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

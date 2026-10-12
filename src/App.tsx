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
import { Zap, Mic, Image as ImageIcon, Smartphone, Trash2, RefreshCw, MessageSquare, ArrowRight, CheckCircle2 } from 'lucide-react';

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
      const isAuthenticated = !!localStorage.getItem('aegis_session_uid');
      if (p === '/chats') {
        setCurrentPath('/chat');
      } else if (isAuthenticated && (p === '/' || p === '/home' || p === '/login' || p === '/register')) {
        setCurrentPath('/chat');
      } else {
        setCurrentPath(p === '/' || p === '' ? (isAuthenticated ? '/chat' : '/home') : p);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Enforce strict route protection:
  // 1. Unauthenticated users cannot access /chat or /profile, redirect to /home
  // 2. Authenticated users cannot access /home, /, /login, or /register, redirect immediately to /chat
  useEffect(() => {
    if (!loading) {
      if (!user) {
        if (currentPath !== '/home' && currentPath !== '/login' && currentPath !== '/register' && !isDirectUserRoute) {
          navigate('/home');
        }
      } else {
        if (currentPath === '/home' || currentPath === '/' || currentPath === '/login' || currentPath === '/register') {
          navigate('/chat');
        }
      }
    }
  }, [loading, user, currentPath]);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-[#09090b] flex flex-col items-center justify-center text-white space-y-3">
        <img
          src="/pwa-maskable-512x512.png"
          alt="Aegis"
          className="w-12 h-12 rounded-2xl object-contain animate-pulse"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://raw.githubusercontent.com/tilakpopatfilms/Aegis/main/public/pwa-maskable-512x512.png';
          }}
        />
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
    <div
      className={`w-full flex flex-col bg-[#09090b] text-neutral-100 select-none ${
        !user || currentPath === '/home'
          ? 'min-h-screen overflow-x-hidden overflow-y-auto'
          : 'h-[100dvh] overflow-hidden'
      }`}
    >
      {/* Top Header */}
      <Header
        currentPath={currentPath}
        onNavigate={navigate}
      />

      {/* Main Workspace */}
      {!user || currentPath === '/home' ? (
        /* Welcome Landing for Users at /home or unauthenticated / */
        <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col items-center justify-start py-8 sm:py-14 px-4 sm:px-6 text-center space-y-10 pb-36 min-w-0">
          {/* Hero Banner */}
          <div className="space-y-4 max-w-2xl mx-auto min-w-0 w-full">
            <img
              src="/pwa-maskable-512x512.png"
              alt="Aegis"
              className="w-16 h-16 rounded-2xl object-contain mx-auto shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://raw.githubusercontent.com/tilakpopatfilms/Aegis/main/public/pwa-maskable-512x512.png';
              }}
            />
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Aegis
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed">
              Simple. Fast. Reliable messaging across all your devices with voice notes, photo sharing, and instant sync.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto pt-2">
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
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full max-w-3xl text-left min-w-0">
            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-2 shadow-2xs">
              <Zap className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-xs text-white">Fast Real-Time Chat</h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Send and receive messages instantly. Delivered reliably even if your contacts are offline.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-2 shadow-2xs">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-xs text-white">Live Multi-Device Sync</h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Chat from your browser or mobile app. All messages stay synchronized across your devices.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-2 shadow-2xs">
              <Mic className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-xs text-white">Voice Messages</h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Record and listen to crisp voice notes with realistic waveform visualizer and 1x, 1.5x, 2x speeds.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-2 shadow-2xs">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-xs text-white">Photo & Media Sharing</h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Share photos directly in chat with full screen previews and quick download options.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-2 shadow-2xs">
              <Trash2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-xs text-white">Private Message Deletion</h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Select one or multiple messages to delete them manually from your side anytime.
              </p>
            </div>

            <div className="p-4 bg-[#121215] rounded-2xl border border-neutral-800 space-y-2 shadow-2xs">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-xs text-white">Installable Web App</h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Install as a standalone app on your mobile home screen or computer with full-screen access.
              </p>
            </div>
          </div>

          {/* Simple Clean Footer */}
          <div className="text-[11px] text-neutral-500 pt-4">
            Aegis Messenger • All rights reserved
          </div>
        </main>
      ) : (
        /* Authenticated Main App: WhatsApp Layout */
        <main
          className={`flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row overflow-hidden min-w-0 ${
            selectedConversation ? 'pb-0' : 'pb-14'
          } sm:pb-0 sm:my-2 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-200 dark:border-neutral-800`}
        >
          {(currentPath === '/chat' || currentPath === '/chats' || currentPath === '/') && (
            <div className="flex-1 flex w-full h-full min-w-0 overflow-hidden">
              {/* Left Sidebar: Conversations List */}
              <div
                className={`w-full md:w-80 lg:w-96 shrink-0 h-full overflow-hidden ${
                  selectedConversation ? 'hidden md:block' : 'block'
                }`}
              >
                <ChatsView onOpenSearch={() => navigate('/search')} />
              </div>

              {/* Right Conversation Window */}
              <div
                className={`flex-1 h-full min-w-0 w-full overflow-hidden ${
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

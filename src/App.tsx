import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { ChatsView } from './components/chats/ChatsView';
import { ChatRoom } from './components/chats/ChatRoom';
import { SearchView } from './components/search/SearchView';
import { ProfileView } from './components/profile/ProfileView';
import { RegisterModal } from './components/auth/RegisterModal';
import { LoginModal } from './components/auth/LoginModal';
import { SecurityKeyModal } from './components/auth/SecurityKeyModal';
import { QRModal } from './components/qr/QRModal';
import { Shield, Lock, Key } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const { selectedConversation } = useChat();

  const [activeTab, setActiveTab] = useState<'CHATS' | 'SEARCH' | 'PROFILE'>('CHATS');

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSecurityKeyOpen, setIsSecurityKeyOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-white dark:bg-[#09090b] flex flex-col items-center justify-center text-neutral-900 dark:text-white space-y-3">
        <div className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center animate-pulse">
          <Shield className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-neutral-500">Loading Aegis...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 overflow-hidden select-none transition-colors">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main Content Workspace */}
      {!user ? (
        /* Welcome Screen for Unauthenticated Users */
        <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col items-center justify-center p-6 text-center space-y-8 my-auto">
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto shadow-sm">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              Aegis Private Messaging
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed">
              Genuine end-to-end encrypted messaging with local-first storage, disappearing messages, and zero plaintext on cloud servers.
            </p>
          </div>

          {/* Core Architecture Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl text-left">
            <div className="p-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-2xs">
              <Lock className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="font-bold text-xs">End-to-End Encrypted</h3>
              <p className="text-[11px] text-neutral-500">Curve25519 DH + AES-256-GCM payload encryption before network transmission.</p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-2xs">
              <Key className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="font-bold text-xs">Permanent Security Key</h3>
              <p className="text-[11px] text-neutral-500">128-bit client recovery entropy formatted as ABCD-EFGH-IJKL.</p>
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-2xs">
              <Shield className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
              <h3 className="font-bold text-xs">Zero Server Plaintext</h3>
              <p className="text-[11px] text-neutral-500">Cloud database acts solely as an untrusted store-and-forward ciphertext relay.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="flex-1 py-3 px-5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-xl shadow-sm transition-all text-xs"
            >
              Create Account
            </button>
            <button
              onClick={() => setIsLoginOpen(true)}
              className="flex-1 py-3 px-5 bg-white dark:bg-[#18181b] hover:bg-neutral-100 dark:hover:bg-[#202024] text-neutral-900 dark:text-white font-bold rounded-xl border border-neutral-200 dark:border-neutral-800 transition-all text-xs"
            >
              Sign In
            </button>
          </div>
        </main>
      ) : (
        /* Authenticated Main App */
        <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row overflow-hidden pb-12 sm:pb-0 sm:my-2 rounded-none sm:rounded-2xl border-0 sm:border border-neutral-200 dark:border-neutral-800">
          {activeTab === 'CHATS' && (
            <div className="flex-1 flex w-full h-full overflow-hidden">
              {/* Left Sidebar: Conversations List */}
              <div className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${selectedConversation ? 'hidden md:block' : 'block'}`}>
                <ChatsView onOpenSearch={() => setActiveTab('SEARCH')} />
              </div>

              {/* Right Conversation Window */}
              <div className={`flex-1 h-full ${!selectedConversation ? 'hidden md:block' : 'block'}`}>
                <ChatRoom />
              </div>
            </div>
          )}

          {activeTab === 'SEARCH' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <SearchView
                onSelectUser={() => setActiveTab('CHATS')}
                onOpenQR={() => setIsQROpen(true)}
              />
            </div>
          )}

          {activeTab === 'PROFILE' && (
            <div className="flex-1 w-full h-full overflow-hidden">
              <ProfileView
                onOpenSecurityKeyModal={() => setIsSecurityKeyOpen(true)}
              />
            </div>
          )}
        </main>
      )}

      {/* Mobile Bottom Navigation */}
      {user && <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />}

      {/* Global Modals */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => setActiveTab('CHATS')}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setActiveTab('CHATS')}
      />

      <SecurityKeyModal
        isOpen={isSecurityKeyOpen}
        onClose={() => setIsSecurityKeyOpen(false)}
      />

      <QRModal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        onSuccessConnect={() => setActiveTab('CHATS')}
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

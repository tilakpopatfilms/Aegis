import React, { useState, useEffect } from 'react';
import { Shield, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { UserProfile } from '../../types';

interface DirectChatInvitePageProps {
  targetUsername: string;
  onNavigate: (route: string) => void;
}

export const DirectChatInvitePage: React.FC<DirectChatInvitePageProps> = ({
  targetUsername,
  onNavigate,
}) => {
  const { user, login } = useAuth();
  const { startOrGetConversation } = useChat();

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direct Sign-in Form State for unauthenticated visitors
  const [myUsername, setMyUsername] = useState('');
  const [myCredential, setMyCredential] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const cleanTarget = decodeURIComponent(targetUsername).replace(/^[@/]+/, '').toLowerCase().trim();

  useEffect(() => {
    const resolveUser = async () => {
      setLoading(true);
      setNotFound(false);
      setError(null);

      try {
        const usernameSnap = await getDoc(doc(db, 'usernames', cleanTarget));
        if (!usernameSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const targetUid = usernameSnap.data().uid;

        // If viewing yourself, redirect to profile
        if (user && user.uid === targetUid) {
          onNavigate('/profile');
          return;
        }

        const profileSnap = await getDoc(doc(db, 'public_profiles', targetUid));
        if (profileSnap.exists()) {
          const prof = profileSnap.data() as UserProfile;
          setTargetProfile(prof);

          // If current user is already logged in, automatically open chat!
          if (user) {
            await startOrGetConversation(targetUid);
            onNavigate('/chat');
            return;
          }
        } else {
          setNotFound(true);
        }
      } catch (err: any) {
        console.warn('Direct link resolve notice:', err);
        setError('Could not load user profile.');
      } finally {
        setLoading(false);
      }
    };

    resolveUser();
  }, [cleanTarget, user]);

  const handleDirectSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanMyUser = myUsername.trim().toLowerCase();
    const cleanCred = myCredential.trim();

    if (!cleanMyUser) {
      setLoginError('Please enter your username.');
      return;
    }

    if (!cleanCred) {
      setLoginError('Please enter your password or Security Key.');
      return;
    }

    setLoginLoading(true);
    try {
      await login(cleanMyUser, cleanCred, keepSignedIn);
      // Once signed in, resolve target UID and open chat
      if (targetProfile) {
        await startOrGetConversation(targetProfile.uid);
      }
      onNavigate('/chat');
    } catch (err: any) {
      setLoginError(err.message || 'Sign in failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterToChat = () => {
    localStorage.setItem('aegis_pending_chat_username', cleanTarget);
    onNavigate('/register');
  };

  const initials = targetProfile?.fullName
    ? targetProfile.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const hasPhoto = targetProfile?.photoURL && !targetProfile.photoURL.startsWith('data:image/svg+xml;utf8');

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
          Connecting to @{cleanTarget}...
        </p>
      </div>
    );
  }

  if (notFound || !targetProfile) {
    return (
      <div className="h-[100dvh] w-full bg-[#09090b] text-neutral-100 overflow-y-auto p-4 sm:p-8">
        <div className="w-full max-w-md mx-auto mb-6">
          <button
            onClick={() => onNavigate('/home')}
            className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>

        <div className="w-full max-w-md mx-auto p-8 bg-[#121215] border border-neutral-800 rounded-3xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto" />
          <h2 className="text-xl font-bold tracking-tight text-white">Account Not Found</h2>
          <p className="text-xs text-neutral-400">
            The account <span className="font-mono font-bold text-white">@{cleanTarget}</span> does not exist or may have been removed.
          </p>
          <button
            onClick={() => onNavigate('/home')}
            className="w-full py-2.5 bg-white text-neutral-900 text-xs font-bold rounded-xl"
          >
            Go to Aegis Home
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated visitor view: Direct Sign In page with recipient context
  return (
    <div className="h-[100dvh] w-full bg-[#09090b] text-neutral-100 overflow-y-auto overflow-x-hidden p-4 sm:p-8">
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between mb-6">
        <button
          onClick={() => onNavigate('/home')}
          className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center space-x-2 select-none">
          <img
            src="/pwa-maskable-512x512.png"
            alt="Aegis"
            className="w-6 h-6 rounded-lg object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://raw.githubusercontent.com/tilakpopatfilms/Aegis/main/public/pwa-maskable-512x512.png';
            }}
          />
          <span className="font-bold text-sm tracking-tight text-white">Aegis</span>
        </div>
      </div>

      {/* Target Recipient Card & Sign In Form */}
      <div className="w-full max-w-md mx-auto pb-20">
        <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
          {/* Recipient Badge */}
          <div className="flex items-center space-x-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            {hasPhoto ? (
              <img
                src={targetProfile.photoURL}
                alt={targetProfile.fullName}
                className="w-12 h-12 rounded-full object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm shrink-0 select-none">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <h2 className="text-sm font-bold truncate text-neutral-900 dark:text-white">
                  {targetProfile.fullName}
                </h2>
                <span className="text-[10px] text-neutral-500 font-mono">
                  @{targetProfile.username}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 truncate">
                {targetProfile.bio || 'Available'}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Sign In to Chat with @{targetProfile.username}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Only signed-in accounts can start an encrypted chat with this user.
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-neutral-100 dark:bg-[#1a1a1f] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-neutral-500 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleDirectSignIn} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Your Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-neutral-400 font-mono select-none">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={myUsername}
                  onChange={(e) => setMyUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Password or Security Key
              </label>
              <input
                type="password"
                required
                value={myCredential}
                onChange={(e) => setMyCredential(e.target.value)}
                placeholder="Password or ABCD-EFGH-IJKL"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="directKeepSigned"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-0"
              />
              <label htmlFor="directKeepSigned" className="text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                Keep me signed in
              </label>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              {loginLoading ? 'Signing in & Opening Chat...' : `Sign In & Chat with @${targetProfile.username}`}
            </button>
          </form>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-xs text-neutral-500">
              Don't have an Aegis account yet?
            </p>
            <button
              onClick={handleRegisterToChat}
              className="mt-2 w-full py-2.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#18181b] hover:bg-neutral-100 dark:hover:bg-[#202024] text-neutral-900 dark:text-white font-bold text-xs rounded-xl transition-colors"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-neutral-500">
        Aegis Messenger • All rights reserved
      </div>
    </div>
  );
};

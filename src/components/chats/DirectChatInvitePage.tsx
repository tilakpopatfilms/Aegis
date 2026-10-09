import React, { useState, useEffect } from 'react';
import { Shield, MessageSquare, ArrowLeft, Lock, UserCheck, AlertCircle } from 'lucide-react';
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
  const { user, profile } = useAuth();
  const { startOrGetConversation } = useChat();

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanTarget = targetUsername.toLowerCase().replace(/\s+/g, '');

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

  const handleSignInToChat = () => {
    localStorage.setItem('aegis_pending_chat_username', cleanTarget);
    onNavigate('/login');
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
      <div className="min-h-[100dvh] w-full bg-white dark:bg-[#09090b] flex flex-col items-center justify-center text-neutral-900 dark:text-white space-y-3">
        <div className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center animate-pulse">
          <Shield className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold tracking-wider text-neutral-500">
          Loading contact @{cleanTarget}...
        </p>
      </div>
    );
  }

  if (notFound || !targetProfile) {
    return (
      <div className="min-h-[100dvh] w-full bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-6">
        <div className="w-full max-w-md mx-auto">
          <button
            onClick={() => onNavigate('/chat')}
            className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>

        <div className="w-full max-w-md mx-auto my-auto p-8 bg-neutral-50 dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-3xl text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto" />
          <h2 className="text-xl font-bold tracking-tight">Account Not Found</h2>
          <p className="text-xs text-neutral-500">
            The account <span className="font-mono font-bold text-neutral-900 dark:text-white">@{cleanTarget}</span> does not exist or may have been deleted.
          </p>
          <button
            onClick={() => onNavigate('/chat')}
            className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-xl"
          >
            Go to Aegis Home
          </button>
        </div>

        <div className="text-center text-[11px] text-neutral-400">
          Aegis Private Messaging
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-6 sm:p-8">
      {/* Top Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between">
        <button
          onClick={() => onNavigate('/chat')}
          className="flex items-center space-x-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <div className="flex items-center space-x-1.5 select-none">
          <div className="w-6 h-6 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-sm tracking-tight">Aegis</span>
        </div>
      </div>

      {/* Target User Invite Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-neutral-50 dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 text-center shadow-xs">
          <div className="space-y-3">
            {hasPhoto ? (
              <img
                src={targetProfile.photoURL}
                alt={targetProfile.fullName}
                className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-neutral-300 dark:border-neutral-700 shadow-xs"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-2xl mx-auto shadow-xs select-none">
                {initials}
              </div>
            )}

            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                {targetProfile.fullName}
              </h1>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                @{targetProfile.username}
              </p>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-400 italic max-w-xs mx-auto">
              "{targetProfile.bio || 'Available • End-to-end encrypted'}"
            </p>
          </div>

          <div className="p-3.5 bg-white dark:bg-[#18181b] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-1 text-left">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-neutral-900 dark:text-white">
              <Lock className="w-3.5 h-3.5" />
              <span>Direct Encrypted Chat</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Connect directly with @{targetProfile.username}. Messages are encrypted on your device and can only be decrypted by the recipient.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleSignInToChat}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all shadow-xs"
            >
              Sign In to Chat with @{targetProfile.username}
            </button>

            <button
              onClick={handleRegisterToChat}
              className="w-full py-3 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs rounded-xl transition-colors"
            >
              Create Account to Chat
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-neutral-400">
        Aegis • Zero Server Plaintext • Private by Design
      </div>
    </div>
  );
};

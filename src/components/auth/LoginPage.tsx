import React, { useState } from 'react';
import { Shield, Lock, Key, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginPageProps {
  onNavigate: (route: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [credential, setCredential] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanCred = credential.trim();

    if (!cleanUser) {
      setError('Please enter your username.');
      return;
    }

    if (!cleanCred) {
      setError('Please enter your password or Security Key.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanUser, cleanCred, keepSignedIn);
      // Check if redirect intended
      const redirectUser = localStorage.getItem('aegis_pending_chat_username');
      if (redirectUser) {
        localStorage.removeItem('aegis_pending_chat_username');
        onNavigate(`/${redirectUser}`);
      } else {
        onNavigate('/chat');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#09090b] text-neutral-100 overflow-y-auto overflow-x-hidden p-4 sm:p-8 flex flex-col items-center justify-start">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between shrink-0 mb-6">
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

      {/* Main Login Form Container */}
      <div className="w-full max-w-md mx-auto pb-20">
        <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Sign In to Aegis
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Enter your username and password or 12-character Security Key
            </p>
          </div>

          {error && (
            <div className="p-3 bg-neutral-100 dark:bg-[#1a1a1f] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-neutral-600 dark:text-neutral-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-neutral-400 font-mono select-none">
                  @
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="username"
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                />
              </div>
            </div>

            {/* Unified Credential Input (Password OR Security Key) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Password or Security Key
                </label>
                <span className="text-[10px] text-neutral-400">
                  ABCD-EFGH-IJKL supported
                </span>
              </div>
              <input
                type="password"
                required
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="Enter password or Security Key"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
              />
            </div>

            {/* Keep me signed in */}
            <div className="flex items-center space-x-2.5 pt-1">
              <input
                type="checkbox"
                id="keepSignedIn"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
              />
              <label
                htmlFor="keepSignedIn"
                className="text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
              >
                Keep me signed in on this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50 mt-2"
            >
              {loading ? 'Verifying & Loading Session...' : 'Sign In'}
            </button>
          </form>

          {/* Switch to Register */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-xs text-neutral-500">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="font-bold text-neutral-900 dark:text-white hover:underline ml-1"
              >
                Create Account
              </button>
            </p>
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

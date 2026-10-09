import React, { useState } from 'react';
import { X, Lock, Key, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { loginWithPassword, loginWithSecurityKey } = useAuth();

  const [activeTab, setActiveTab] = useState<'password' | 'securityKey'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityKeyInput, setSecurityKeyInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'password') {
        if (!username.trim() || !password) throw new Error('Please enter both username and password.');
        await loginWithPassword(username.trim(), password);
      } else {
        if (!username.trim() || !securityKeyInput.trim()) throw new Error('Please enter both username and security key.');
        await loginWithSecurityKey(username.trim(), securityKeyInput.trim());
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-[#121215] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 text-neutral-900 dark:text-neutral-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1 mb-5">
          <div className="w-12 h-12 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto mb-2 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign In</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Unlock your end-to-end encrypted session</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex p-1 bg-neutral-100 dark:bg-[#18181b] rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'password'
                ? 'bg-white dark:bg-[#121215] text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('securityKey')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'securityKey'
                ? 'bg-white dark:bg-[#121215] text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Security Key</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-neutral-400 text-sm">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                placeholder="username"
                className="w-full pl-8 pr-4 py-2.5 bg-neutral-50 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          {activeTab === 'password' ? (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Security Key (ABCD-EFGH-IJKL)
              </label>
              <input
                type="text"
                required
                value={securityKeyInput}
                onChange={(e) => setSecurityKeyInput(e.target.value.toUpperCase())}
                placeholder="ABCD-EFGH-IJKL"
                className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-mono text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:outline-none tracking-widest"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-xl shadow-md transition-all disabled:opacity-50 text-xs mt-2 flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Verifying Session...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

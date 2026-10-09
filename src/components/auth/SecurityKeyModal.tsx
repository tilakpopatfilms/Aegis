import React, { useState } from 'react';
import { X, Key, ShieldCheck, Copy, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SecurityKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityKeyModal: React.FC<SecurityKeyModalProps> = ({ isOpen, onClose }) => {
  const { unmaskedSecurityKey, revealSecurityKey, hideSecurityKey } = useAuth();

  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await revealSecurityKey(passwordInput);
      setPasswordInput('');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Incorrect password.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (unmaskedSecurityKey) {
      navigator.clipboard.writeText(unmaskedSecurityKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleCloseModal = () => {
    hideSecurityKey();
    setError(null);
    setPasswordInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 text-neutral-900 dark:text-neutral-100">
        <button
          onClick={handleCloseModal}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1 mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Security Key Verification</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Re-authentication required before unmasking
          </p>
        </div>

        {unmaskedSecurityKey ? (
          <div className="space-y-5">
            <div className="p-4 bg-neutral-100 dark:bg-[#202c33] rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <span className="font-mono text-lg font-bold tracking-widest text-[#00a884]">
                {unmaskedSecurityKey}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#009473] text-white text-xs font-semibold flex items-center space-x-1 transition-all"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              This 128-bit key is derived locally and never sent to servers in plaintext.
            </p>

            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full py-2.5 bg-neutral-200 dark:bg-[#202c33] hover:bg-neutral-300 dark:hover:bg-[#2a3942] text-neutral-900 dark:text-white font-bold rounded-xl transition-all text-xs"
            >
              Mask & Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleReveal} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Enter Current Password to Unmask
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-[#202c33] border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-[#00a884] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#009473] text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50 text-xs"
            >
              {loading ? 'Verifying...' : 'Verify Password & Reveal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

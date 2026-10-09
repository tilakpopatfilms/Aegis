import React, { useState, useRef } from 'react';
import { X, Shield, Lock, Key, Check, Copy, AlertCircle, Eye, EyeOff, Upload, Globe, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AccountType } from '../../types';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { registerUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('public');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Real Profile Photo Upload (Base64)
  const [customPhotoBase64, setCustomPhotoBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Security Key Step
  const [generatedSecKey, setGeneratedSecKey] = useState<string | null>(null);
  const [copiedSecKey, setCopiedSecKey] = useState(false);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file must be under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomPhotoBase64(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const secKey = await registerUser({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        accountType,
        password,
        photoURL: customPhotoBase64 || undefined,
      });

      setGeneratedSecKey(secKey);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecKey = () => {
    if (generatedSecKey) {
      navigator.clipboard.writeText(generatedSecKey);
      setCopiedSecKey(true);
      setTimeout(() => setCopiedSecKey(false), 3000);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  const initials = fullName.trim()
    ? fullName
        .trim()
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#121215] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 my-6 text-neutral-900 dark:text-neutral-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {generatedSecKey ? (
          /* Step 2: Display Permanent Security Key */
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center mx-auto border border-neutral-200 dark:border-neutral-700">
              <Key className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Permanent Security Key</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Your 128-bit cryptographic key is generated on your device. Store it safely to verify or recover your identity.
              </p>
            </div>

            <div className="p-4 bg-neutral-100 dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="font-mono text-lg font-bold tracking-widest text-neutral-900 dark:text-white">
                {generatedSecKey}
              </span>
              <button
                type="button"
                onClick={handleCopySecKey}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
              >
                {copiedSecKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSecKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-3.5 bg-neutral-100 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-start space-x-2.5 text-xs text-neutral-600 dark:text-neutral-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-neutral-500" />
              <span>
                Servers never store this key in plaintext. Keep it recorded securely.
              </span>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-xl shadow-md transition-all text-xs"
            >
              I Have Saved My Security Key
            </button>
          </div>
        ) : (
          /* Step 1: Exactly the 6 Fields */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="text-center space-y-1 mb-5">
              <div className="w-12 h-12 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Create Account</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Private by Design End-to-End Encrypted Messaging</p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Field 1: Profile Picture (Upload or Initials Avatar) */}
            <div className="flex items-center space-x-4 p-3.5 bg-neutral-50 dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="relative">
                {customPhotoBase64 ? (
                  <img
                    src={customPhotoBase64}
                    alt="Uploaded Profile"
                    className="w-14 h-14 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-lg select-none">
                    {initials}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">1. Profile Picture (Optional)</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {customPhotoBase64 ? 'Custom photo attached' : 'Default text initials or upload your picture'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-xs font-medium rounded-lg flex items-center space-x-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            </div>

            {/* Field 2: Full Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                2. Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name (e.g. Akshat Popat)"
                className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:outline-none"
              />
            </div>

            {/* Field 3: Username */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                3. Username
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
              <p className="text-[10px] text-neutral-400 mt-0.5">Permanent account identifier. Cannot be altered later.</p>
            </div>

            {/* Field 4: Account Type */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                4. Account Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType('public')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-start transition-all ${
                    accountType === 'public'
                      ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-[#18181b] text-neutral-900 dark:text-white'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold mb-0.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public Account</span>
                  </div>
                  <span className="text-[10px] font-normal text-neutral-500">Discoverable in username search</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('private')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-start transition-all ${
                    accountType === 'private'
                      ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-[#18181b] text-neutral-900 dark:text-white'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold mb-0.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Private Account</span>
                  </div>
                  <span className="text-[10px] font-normal text-neutral-500">Excluded from search (QR scan only)</span>
                </button>
              </div>
            </div>

            {/* Field 5 & 6: Password and Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  5. Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  6. Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold rounded-xl shadow-md transition-all disabled:opacity-50 mt-3 text-xs flex items-center justify-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'Initializing Cryptographic Keys...' : 'Register & Create Account'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

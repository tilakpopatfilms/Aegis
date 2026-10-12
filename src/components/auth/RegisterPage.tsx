import React, { useState, useRef } from 'react';
import { Shield, Key, ArrowLeft, Camera, AlertCircle, Check, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RegisterPageProps {
  onNavigate: (route: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { registerUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Security key display step
  const [generatedSecurityKey, setGeneratedSecurityKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setError('Profile picture must be under 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoURL(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '');
    const cleanName = fullName.trim();

    if (!cleanName) {
      setError('Please enter your full name.');
      return;
    }

    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 30) {
      setError('Username must be 3-30 characters (letters, numbers, dot, dash, underscore).');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      const secKey = await registerUser({
        fullName: cleanName,
        username: cleanUser,
        accountType: 'public',
        password,
        photoURL,
        keepSignedIn,
      });

      setGeneratedSecurityKey(secKey);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please select a different username.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (generatedSecurityKey) {
      navigator.clipboard.writeText(generatedSecurityKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 3000);
    }
  };

  const handleProceedAfterKey = () => {
    const redirectUser = localStorage.getItem('aegis_pending_chat_username');
    if (redirectUser) {
      localStorage.removeItem('aegis_pending_chat_username');
      onNavigate(`/${redirectUser}`);
    } else {
      onNavigate('/chat');
    }
  };

  const initials = fullName
    ? fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

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

      {/* Main Container */}
      <div className="w-full max-w-md mx-auto pb-20">
        <div className="bg-[#121215] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          {!generatedSecurityKey ? (
            /* Registration Form */
            <>
              <div className="space-y-1.5 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Create Account
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Fast, multi-device messaging with instant sync
                </p>
              </div>

              {error && (
                <div className="p-3 bg-neutral-100 dark:bg-[#1a1a1f] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-neutral-600 dark:text-neutral-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo Upload Avatar (Real device photo, no fake presets) */}
                <div className="flex flex-col items-center space-y-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer"
                  >
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xl select-none">
                        {initials}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  >
                    {photoURL ? 'Change photo' : 'Upload photo (optional)'}
                  </button>
                </div>

                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Username
                    </label>
                    <span className="text-[10px] text-neutral-400">
                      Used for your account link /{username || 'username'}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-neutral-400 font-mono select-none">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="username"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min 4 chars)"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                  />
                </div>

                {/* Keep me signed in */}
                <div className="flex items-center space-x-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="regKeepSignedIn"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                  />
                  <label
                    htmlFor="regKeepSignedIn"
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
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              {/* Switch to Login */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 text-center">
                <p className="text-xs text-neutral-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/login')}
                    className="font-bold text-neutral-900 dark:text-white hover:underline ml-1"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </>
          ) : (
            /* Step 2: Display Generated Security Key */
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto shadow-xs">
                <Key className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Your Security Key
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Save this key in a secure location. You can sign in using either your password or this key.
                </p>
              </div>

              {/* Formatted Key Box */}
              <div className="p-4 bg-white dark:bg-[#18181b] border-2 border-neutral-300 dark:border-neutral-700 rounded-2xl flex items-center justify-between">
                <span className="font-mono text-base font-bold tracking-widest text-neutral-900 dark:text-white select-all">
                  {generatedSecurityKey}
                </span>

                <button
                  onClick={handleCopyKey}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-3 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-left border border-neutral-200 dark:border-neutral-800">
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Your account link will be: <span className="font-mono font-bold text-neutral-900 dark:text-white">{window.location.origin}/{username}</span>. Other Aegis users can chat with you directly using this link.
                </p>
              </div>

              <button
                onClick={handleProceedAfterKey}
                className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all shadow-sm"
              >
                I Have Saved My Security Key — Open Chats
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-neutral-500">
        Aegis Messenger • All rights reserved
      </div>
    </div>
  );
};

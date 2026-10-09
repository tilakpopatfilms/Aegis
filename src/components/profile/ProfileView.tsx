import React, { useState, useRef } from 'react';
import {
  Key,
  Shield,
  Eye,
  Camera,
  Check,
  Copy,
  LogOut,
  Edit2,
  Lock,
  Link as LinkIcon,
  AlertCircle,
  Smartphone,
  Save,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export const ProfileView: React.FC = () => {
  const {
    profile,
    updateProfileData,
    changePassword,
    revealSecurityKey,
    unmaskedSecurityKey,
    logout,
  } = useAuth();

  // Full Name Editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.fullName || '');
  const [nameNotice, setNameNotice] = useState<string | null>(null);

  // Bio Editing
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(profile?.bio || '');

  // Password Change State
  const [currentPassOrSecKey, setCurrentPassOrSecKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Security Key Unmasking
  const [secKeyAuthInput, setSecKeyAuthInput] = useState('');
  const [showSecKeyAuthModal, setShowSecKeyAuthModal] = useState(false);
  const [secKeyError, setSecKeyError] = useState<string | null>(null);
  const [copiedSecKey, setCopiedSecKey] = useState(false);

  // Account Link
  const [copiedLink, setCopiedLink] = useState(false);

  // Photo Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);

  if (!profile) return null;

  const accountLink = `${window.location.origin}/${profile.username}`;

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await updateProfileData({ fullName: nameInput.trim() });
    setIsEditingName(false);
    setNameNotice('Name updated successfully.');
    setTimeout(() => setNameNotice(null), 3000);
  };

  const handleSaveBio = async () => {
    await updateProfileData({ bio: bioInput.trim() });
    setIsEditingBio(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setPhotoNotice('Image file must be under 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await updateProfileData({ photoURL: base64 });
        setPhotoNotice('Profile photo updated.');
        setTimeout(() => setPhotoNotice(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    setPasswordError(null);

    if (!currentPassOrSecKey.trim()) {
      setPasswordError('Please enter current password or Security Key.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match. Please verify.');
      return;
    }

    setPasswordChangeLoading(true);
    try {
      await changePassword(currentPassOrSecKey, newPassword);
      setPasswordNotice('Password changed successfully. Your E2EE keys are re-encrypted.');
      setCurrentPassOrSecKey('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password. Verify current credentials.');
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const handleRevealSecurityKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecKeyError(null);
    try {
      await revealSecurityKey(secKeyAuthInput);
      setShowSecKeyAuthModal(false);
      setSecKeyAuthInput('');
    } catch (err: any) {
      setSecKeyError(err.message || 'Incorrect password.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(accountLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleCopySecurityKey = () => {
    if (unmaskedSecurityKey) {
      navigator.clipboard.writeText(unmaskedSecurityKey);
      setCopiedSecKey(true);
      setTimeout(() => setCopiedSecKey(false), 3000);
    }
  };

  const initials = profile.fullName
    ? profile.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const hasCustomPhoto = profile.photoURL && !profile.photoURL.startsWith('data:image/svg+xml;utf8');

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-8 bg-white dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <h1 className="text-xl font-bold tracking-tight">Profile & Account Settings</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Manage your personal details, custom link, password, and E2EE recovery key
        </p>
      </div>

      {/* Main Profile Info Card */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-5">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />

        <div className="flex items-center space-x-4">
          <div
            className="relative group cursor-pointer shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            {hasCustomPhoto ? (
              <img
                src={profile.photoURL}
                alt={profile.fullName}
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

          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-[#18181b] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-semibold focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold truncate">{profile.fullName}</h2>
                <button
                  onClick={() => {
                    setNameInput(profile.fullName);
                    setIsEditingName(true);
                  }}
                  className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                  title="Edit Name"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <p className="text-xs text-neutral-500 font-mono mt-0.5">@{profile.username}</p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white mt-1 underline"
            >
              Upload new profile picture
            </button>
          </div>
        </div>

        {photoNotice && (
          <div className="p-2.5 bg-neutral-200 dark:bg-neutral-800 text-xs rounded-xl text-neutral-800 dark:text-neutral-200">
            {photoNotice}
          </div>
        )}

        {nameNotice && (
          <div className="p-2.5 bg-neutral-200 dark:bg-neutral-800 text-xs rounded-xl text-neutral-800 dark:text-neutral-200">
            {nameNotice}
          </div>
        )}

        {/* Bio / About */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">About Info</p>
          {isEditingBio ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                placeholder="About text..."
                className="flex-1 px-3 py-1.5 bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs focus:outline-none"
              />
              <button
                onClick={handleSaveBio}
                className="px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-xl"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <p className="italic">{profile.bio || 'Available • End-to-end encrypted'}</p>
              <button
                onClick={() => {
                  setBioInput(profile.bio || '');
                  setIsEditingBio(true);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Account Direct Chat Link */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center space-x-2.5">
          <LinkIcon className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <h3 className="font-bold text-sm">My Account Direct Link</h3>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Share this URL with anyone so they can directly open an encrypted chat with you on Aegis:
        </p>

        <div className="p-3 bg-white dark:bg-[#18181b] rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-semibold truncate text-neutral-900 dark:text-white">
            {accountLink}
          </span>
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors shrink-0"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Change Password Form (with Security Key / Current Password verification) */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="flex items-center space-x-2.5">
          <Lock className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <h3 className="font-bold text-sm">Change Password</h3>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Enter your current password or 12-character Security Key, then enter and confirm your new password.
        </p>

        {passwordNotice && (
          <div className="p-3 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl text-xs font-medium">
            {passwordNotice}
          </div>
        )}

        {passwordError && (
          <div className="p-3 bg-neutral-100 dark:bg-[#18181b] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-neutral-500 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Current Password or Security Key
            </label>
            <input
              type="password"
              required
              value={currentPassOrSecKey}
              onChange={(e) => setCurrentPassOrSecKey(e.target.value)}
              placeholder="Current password or ABCD-EFGH-IJKL"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 4 chars)"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#18181b] rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={passwordChangeLoading}
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            {passwordChangeLoading ? 'Verifying & Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Permanent Security Key Card */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center space-x-2.5">
          <Key className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <h3 className="font-bold text-sm">Permanent Security Key</h3>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Your 128-bit cryptographic client recovery key formatted as ABCD-EFGH-IJKL.
        </p>

        <div className="p-3.5 bg-white dark:bg-[#18181b] rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="font-mono text-xs font-bold tracking-widest text-neutral-900 dark:text-white select-all">
            {unmaskedSecurityKey ? unmaskedSecurityKey : '••••-••••-••••'}
          </span>

          {unmaskedSecurityKey ? (
            <button
              onClick={handleCopySecurityKey}
              className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold rounded-xl flex items-center space-x-1.5"
            >
              {copiedSecKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSecKey ? 'Copied' : 'Copy'}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowSecKeyAuthModal(true)}
              className="px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold rounded-xl flex items-center space-x-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Reveal Key</span>
            </button>
          )}
        </div>
      </div>

      {/* PWA Install Card */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center space-x-2.5">
          <Smartphone className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <h3 className="font-bold text-sm">Standalone Application</h3>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Install Aegis to your home screen or desktop dock for an app-like experience with offline message review.
        </p>
        <PWAInstallButton variant="full" />
      </div>

      {/* Session Details & Logout */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-neutral-500" />
            <span className="font-semibold">Web Client Session</span>
          </div>
          <span className="text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full">
            Active
          </span>
        </div>

        <button
          onClick={logout}
          className="w-full py-2.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Session</span>
        </button>
      </div>

      {/* Modal: Re-authenticate to Reveal Security Key */}
      {showSecKeyAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-white dark:bg-[#121215] rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-4">
            <h3 className="font-bold text-sm">Enter Password to Reveal Key</h3>
            <p className="text-xs text-neutral-500">
              To verify identity, enter your account password.
            </p>

            {secKeyError && (
              <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-white">
                {secKeyError}
              </div>
            )}

            <form onSubmit={handleRevealSecurityKey} className="space-y-3">
              <input
                type="password"
                required
                autoFocus
                value={secKeyAuthInput}
                onChange={(e) => setSecKeyAuthInput(e.target.value)}
                placeholder="Password"
                className="w-full px-3.5 py-2.5 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSecKeyAuthModal(false)}
                  className="flex-1 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold"
                >
                  Reveal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

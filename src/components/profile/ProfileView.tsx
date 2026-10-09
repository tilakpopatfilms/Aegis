import React, { useState, useRef } from 'react';
import { Key, Shield, Eye, Lock, LogOut, Edit2, Smartphone, Check, User, Camera, ShieldCheck, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EphemeralSetting } from '../../types';

interface ProfileViewProps {
  onOpenSecurityKeyModal: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenSecurityKeyModal }) => {
  const { profile, updateProfileData, logout } = useAuth();

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(profile?.bio || '');

  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicators, setTypingIndicators] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [defaultEphemeral, setDefaultEphemeral] = useState<EphemeralSetting>('off');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  if (!profile) return null;

  const handleSaveBio = async () => {
    await updateProfileData({ bio: bioInput });
    setIsEditingBio(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setUploadNotice('Image must be under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await updateProfileData({ photoURL: base64 });
        setUploadNotice('Profile photo updated.');
        setTimeout(() => setUploadNotice(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const initials = profile.fullName
    ? profile.fullName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'A';

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-[#09090b] max-w-2xl mx-auto space-y-6 text-neutral-900 dark:text-neutral-100">
      {/* Profile Card */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />

        <div className="flex items-center space-x-4">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {profile.photoURL && !profile.photoURL.startsWith('data:image/svg+xml;utf8') ? (
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
            <h2 className="text-lg font-bold truncate">{profile.fullName}</h2>
            <p className="text-xs text-neutral-500 font-mono truncate">@{profile.username}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                {profile.accountType} Account
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white underline"
              >
                Change photo
              </button>
            </div>
          </div>
        </div>

        {uploadNotice && (
          <div className="p-2.5 bg-neutral-200 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 rounded-lg">
            {uploadNotice}
          </div>
        )}

        {/* Bio */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-[10px] font-bold uppercase text-neutral-400 mb-1">About Status</p>
          {isEditingBio ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                placeholder="About text..."
                className="flex-1 px-3 py-1.5 bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs focus:outline-none"
              />
              <button
                onClick={handleSaveBio}
                className="px-3 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-lg"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
              <p className="italic">{profile.bio || 'Available • End-to-end encrypted'}</p>
              <button
                onClick={() => setIsEditingBio(true)}
                className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Key Card */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Permanent Security Key</h3>
            <p className="text-xs text-neutral-500">128-bit client-wrapped recovery entropy</p>
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="font-mono text-sm font-bold text-neutral-400 tracking-widest">
            ••••-••••-••••
          </span>
          <button
            onClick={onOpenSecurityKeyModal}
            className="px-3.5 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Unmask</span>
          </button>
        </div>
        <p className="text-[10px] text-neutral-400">
          Password re-authentication is required before unmasking.
        </p>
      </div>

      {/* Privacy Preferences */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-4">
        <h3 className="font-bold text-sm flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
          <span>Privacy & Security</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Read Receipts</p>
              <p className="text-[10px] text-neutral-400">Send checkmarks when messages are viewed</p>
            </div>
            <input
              type="checkbox"
              checked={readReceipts}
              onChange={(e) => setReadReceipts(e.target.checked)}
              className="w-4 h-4 accent-neutral-900 dark:accent-neutral-100 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Typing Indicators</p>
              <p className="text-[10px] text-neutral-400">Broadcast typing status in active chat</p>
            </div>
            <input
              type="checkbox"
              checked={typingIndicators}
              onChange={(e) => setTypingIndicators(e.target.checked)}
              className="w-4 h-4 accent-neutral-900 dark:accent-neutral-100 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Online Status</p>
              <p className="text-[10px] text-neutral-400">Show online presence to contacts</p>
            </div>
            <input
              type="checkbox"
              checked={onlineStatus}
              onChange={(e) => setOnlineStatus(e.target.checked)}
              className="w-4 h-4 accent-neutral-900 dark:accent-neutral-100 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">Default Ephemeral Timer</p>
              <p className="text-[10px] text-neutral-400">Disappearing timer for new conversations</p>
            </div>
            <select
              value={defaultEphemeral}
              onChange={(e) => setDefaultEphemeral(e.target.value as EphemeralSetting)}
              className="px-2 py-1 bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs"
            >
              <option value="off">Off</option>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Session Details & Logout */}
      <div className="p-6 bg-neutral-50 dark:bg-[#121215] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">Current Web Session</span>
          </div>
          <span className="text-[10px] text-neutral-600 dark:text-neutral-400 font-bold bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded">
            Active
          </span>
        </div>

        <button
          onClick={logout}
          className="w-full py-2.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Session</span>
        </button>
      </div>
    </div>
  );
};

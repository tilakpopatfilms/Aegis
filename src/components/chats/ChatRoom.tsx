import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Clock,
  Send,
  Paperclip,
  X,
  Trash2,
  CheckCheck,
  Check,
  CornerDownRight,
  MoreVertical,
  Star,
  Copy,
  ArrowLeft,
  ShieldCheck,
  Link as LinkIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { EphemeralSetting, DecryptedMessage } from '../../types';
import { generateSafetyNumber } from '../../crypto/crypto';
import { saveSafetyNumber, getSafetyNumber } from '../../db/localDb';

interface ChatRoomProps {
  onBack?: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ onBack }) => {
  const { user, profile } = useAuth();
  const {
    selectedConversation,
    messages,
    sendTextMessage,
    sendImageMessage,
    updateEphemeralSetting,
    deleteMessageLocally,
    deleteConversationLocally,
  } = useChat();

  const [textInput, setTextInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<DecryptedMessage | null>(null);

  // Modals & Panels
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyFingerprint, setSafetyFingerprint] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [selectedImageFull, setSelectedImageFull] = useState<string | null>(null);
  const [starredMsgIds, setStarredMsgIds] = useState<Set<string>>(new Set());
  const [copiedLinkNotice, setCopiedLinkNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message on change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Safety Fingerprint
  useEffect(() => {
    if (!profile || !selectedConversation?.otherUser) return;

    const loadSafety = async () => {
      const otherPubKey = selectedConversation.otherUser!.publicKey || profile.publicKey;
      const fingerprint = await generateSafetyNumber(profile.publicKey, otherPubKey);
      setSafetyFingerprint(fingerprint);

      const stored = await getSafetyNumber(selectedConversation.otherUser!.uid);
      if (stored) {
        setIsVerified(stored.verified);
      }
    };

    loadSafety();
  }, [profile, selectedConversation]);

  if (!selectedConversation || !selectedConversation.otherUser) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#0c0c0e] text-neutral-800 dark:text-neutral-200">
        <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-[#18181b] text-neutral-900 dark:text-white flex items-center justify-center mb-3 border border-neutral-200 dark:border-neutral-800">
          <Shield className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold mb-1">Aegis Encrypted Messaging</h3>
        <p className="text-xs text-neutral-500 max-w-sm">
          Select a chat from the sidebar or find contacts in the search directory to begin an end-to-end encrypted session.
        </p>
      </div>
    );
  }

  const otherUser = selectedConversation.otherUser;

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;

    const textToSend = textInput.trim();
    setTextInput('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    await sendTextMessage(textToSend, replyId);
    inputRef.current?.focus();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await sendImageMessage(file);
    }
  };

  const handleToggleStar = (msgId: string) => {
    setStarredMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleCopyText = (text?: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
    }
  };

  const handleCopyContactLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/${otherUser.username}`);
    setCopiedLinkNotice(true);
    setTimeout(() => setCopiedLinkNotice(false), 2500);
    setShowOptionsMenu(false);
  };

  const toggleSafetyVerification = async () => {
    const nextState = !isVerified;
    setIsVerified(nextState);
    await saveSafetyNumber({
      contactUid: otherUser.uid,
      fingerprint: safetyFingerprint,
      verified: nextState,
      verifiedAt: new Date().toISOString(),
    });
  };

  const otherInitials = otherUser.fullName
    ? otherUser.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const hasOtherPhoto = otherUser.photoURL && !otherUser.photoURL.startsWith('data:image/svg+xml;utf8');

  const formatMsgTime = (iso?: string) => {
    if (!iso) return '';
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fbfbfb] dark:bg-[#0c0c0e] relative overflow-hidden select-none">
      {/* Top Header */}
      <div className="px-4 py-2.5 bg-white dark:bg-[#121215] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg md:hidden shrink-0"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div
            className="flex items-center space-x-3 cursor-pointer min-w-0"
            onClick={() => setShowSafetyModal(true)}
          >
            {hasOtherPhoto ? (
              <img
                src={otherUser.photoURL}
                alt={otherUser.fullName}
                className="w-10 h-10 rounded-full object-cover border border-neutral-300 dark:border-neutral-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs select-none shrink-0">
                {otherInitials}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h3 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                  {otherUser.fullName}
                </h3>
                {isVerified && (
                  <span title="Safety Number Verified">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-900 dark:text-white shrink-0" />
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 font-mono truncate">
                @{otherUser.username} • end-to-end encrypted
              </p>
            </div>
          </div>
        </div>

        {/* Action icons on top right */}
        <div className="flex items-center space-x-1 text-neutral-600 dark:text-neutral-400 shrink-0">
          <button
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            className={`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors relative ${
              selectedConversation.ephemeralSetting !== 'off'
                ? 'text-neutral-900 dark:text-white font-bold'
                : ''
            }`}
            title={`Disappearing Timer: ${selectedConversation.ephemeralSetting}`}
          >
            <Clock className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Disappearing Timer Menu Dropdown */}
      {showTimerMenu && (
        <div className="absolute top-14 right-10 z-30 bg-white dark:bg-[#18181b] rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-1.5 text-xs w-48 text-neutral-800 dark:text-neutral-200">
          <p className="px-2.5 py-1 font-bold text-[10px] uppercase text-neutral-400">
            Disappearing Messages
          </p>
          {(['off', 'viewed', '1h', '24h', '7d'] as EphemeralSetting[]).map((timer) => (
            <button
              key={timer}
              onClick={() => {
                updateEphemeralSetting(timer);
                setShowTimerMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                selectedConversation.ephemeralSetting === timer
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold'
                  : 'hover:bg-neutral-100 dark:hover:bg-[#202024]'
              }`}
            >
              <span>{timer === 'off' ? 'Off' : timer === 'viewed' ? 'After Viewed' : timer}</span>
              {selectedConversation.ephemeralSetting === timer && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}

      {/* Options Dropdown */}
      {showOptionsMenu && (
        <div className="absolute top-14 right-3 z-30 bg-white dark:bg-[#18181b] rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-1.5 text-xs w-52 text-neutral-800 dark:text-neutral-200">
          <button
            onClick={() => {
              setShowOptionsMenu(false);
              setShowSafetyModal(true);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202024] flex items-center space-x-2"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Verify Safety Number</span>
          </button>
          <button
            onClick={handleCopyContactLink}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202024] flex items-center space-x-2"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Copy Contact Account Link</span>
          </button>
          <button
            onClick={() => {
              setShowOptionsMenu(false);
              setShowTimerMenu(true);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202024] flex items-center space-x-2"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Disappearing messages</span>
          </button>
          <div className="border-t border-neutral-100 dark:border-neutral-800 my-1" />
          <button
            onClick={() => {
              setShowOptionsMenu(false);
              deleteConversationLocally(selectedConversation.id);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202024] text-rose-600 flex items-center space-x-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete conversation</span>
          </button>
        </div>
      )}

      {copiedLinkNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-neutral-900 text-white text-xs rounded-xl shadow-lg">
          Contact direct link copied!
        </div>
      )}

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-0">
        {/* Encryption Header Notice */}
        <div className="text-center py-4">
          <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 bg-neutral-100 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-full text-[11px] text-neutral-500">
            <Shield className="w-3 h-3 text-neutral-700 dark:text-neutral-300" />
            <span>Messages are end-to-end encrypted. No third party can read them.</span>
          </div>
        </div>

        {/* Message Thread */}
        {messages.map((m) => {
          const isSender = m.senderUid === user?.uid;
          const isStarred = starredMsgIds.has(m.id);
          const replyParent = m.replyToId ? messages.find((p) => p.id === m.replyToId) : null;

          return (
            <div
              key={m.id}
              className={`group flex flex-col ${isSender ? 'items-end' : 'items-start'} space-y-1`}
            >
              {/* Message Bubble Container */}
              <div
                className={`relative px-3.5 py-2.5 rounded-2xl text-xs shadow-2xs max-w-[85%] sm:max-w-md ${
                  isSender
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-br-xs'
                    : 'bg-white dark:bg-[#18181b] text-neutral-900 dark:text-white rounded-bl-xs border border-neutral-200 dark:border-neutral-800'
                }`}
              >
                {/* Reply Citation */}
                {replyParent && (
                  <div
                    className={`mb-2 p-2 rounded-lg border-l-2 text-[11px] opacity-80 ${
                      isSender
                        ? 'bg-white/10 border-white text-white dark:bg-black/10 dark:border-black dark:text-black'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-400 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    <p className="font-semibold text-[10px]">
                      {replyParent.senderUid === user?.uid ? 'You' : otherUser.fullName}
                    </p>
                    <p className="truncate">
                      {replyParent.content.text || (replyParent.content.imageBase64 ? 'Photo' : '')}
                    </p>
                  </div>
                )}

                {/* Attached Image */}
                {m.content.imageBase64 && (
                  <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                    <img
                      src={m.content.imageBase64}
                      alt={m.content.fileName || 'Attachment'}
                      onClick={() => setSelectedImageFull(m.content.imageBase64!)}
                      className="max-h-60 rounded-xl object-cover hover:opacity-95 transition-opacity"
                    />
                  </div>
                )}

                {/* Plaintext Content */}
                {m.content.text && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {m.content.text}
                  </p>
                )}

                {/* Footer: Timestamp, Ephemeral, Status */}
                <div
                  className={`flex items-center justify-end space-x-1 mt-1 text-[9px] select-none ${
                    isSender
                      ? 'text-neutral-300 dark:text-neutral-600'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {isStarred && <Star className="w-2.5 h-2.5 fill-current" />}
                  {m.ephemeralType !== 'off' && <Clock className="w-2.5 h-2.5" />}
                  <span>{formatMsgTime(m.timestamp)}</span>
                  {isSender && (
                    <span>
                      {m.status === 'delivered' || m.status === 'read' ? (
                        <CheckCheck className="w-3 h-3" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Message Hover Actions */}
              <div
                className={`opacity-0 group-hover:opacity-100 flex items-center space-x-1 px-1 transition-opacity text-neutral-400 text-[11px]`}
              >
                <button
                  onClick={() => setReplyingTo(m)}
                  className="p-1 hover:text-neutral-900 dark:hover:text-white"
                  title="Reply"
                >
                  <CornerDownRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleCopyText(m.content.text)}
                  className="p-1 hover:text-neutral-900 dark:hover:text-white"
                  title="Copy"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleToggleStar(m.id)}
                  className="p-1 hover:text-neutral-900 dark:hover:text-white"
                  title="Star"
                >
                  <Star className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteMessageLocally(m.id)}
                  className="p-1 hover:text-rose-600"
                  title="Delete locally"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-100 dark:bg-[#18181b] border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <CornerDownRight className="w-4 h-4 text-neutral-500 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-neutral-900 dark:text-white">
                Replying to {replyingTo.senderUid === user?.uid ? 'yourself' : otherUser.fullName}:
              </span>{' '}
              <span className="text-neutral-500">
                {replyingTo.content.text || (replyingTo.content.imageBase64 ? 'Photo' : '')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Composer (Always pinned at bottom) */}
      <form
        onSubmit={handleSendText}
        className="p-3 sm:p-4 bg-white dark:bg-[#121215] border-t border-neutral-200 dark:border-neutral-800 flex items-center space-x-2 shrink-0 z-20"
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors shrink-0"
          title="Send Encrypted Image"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type an encrypted message..."
          className="flex-1 px-3.5 py-2.5 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
        />

        <button
          type="submit"
          disabled={!textInput.trim()}
          className="p-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl transition-colors disabled:opacity-40 shrink-0 shadow-xs"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Modal: Safety Number Verification */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-[#121215] rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 text-center space-y-4 text-neutral-900 dark:text-neutral-100">
            <button
              onClick={() => setShowSafetyModal(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#18181b] text-neutral-900 dark:text-white flex items-center justify-center mx-auto border border-neutral-200 dark:border-neutral-800">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold tracking-tight">Verify Safety Number</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Compare this fingerprint with {otherUser.fullName} (@{otherUser.username}) to confirm end-to-end encryption.
            </p>

            <div className="p-4 bg-neutral-100 dark:bg-[#18181b] rounded-2xl border border-neutral-200 dark:border-neutral-800 font-mono text-xs sm:text-sm tracking-wider text-neutral-900 dark:text-white whitespace-pre-line leading-relaxed select-all">
              {safetyFingerprint}
            </div>

            <button
              onClick={toggleSafetyVerification}
              className={`w-full py-2.5 font-bold rounded-xl transition-all text-xs ${
                isVerified
                  ? 'bg-neutral-200 dark:bg-[#202024] text-neutral-800 dark:text-neutral-200'
                  : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 shadow-xs'
              }`}
            >
              {isVerified ? 'Mark as Unverified' : 'Mark as Verified'}
            </button>
          </div>
        </div>
      )}

      {/* Lightbox: Full-screen Image Viewer */}
      {selectedImageFull && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
          onClick={() => setSelectedImageFull(null)}
        >
          <button
            onClick={() => setSelectedImageFull(null)}
            className="absolute top-6 right-6 p-2 text-white bg-neutral-800/80 rounded-full hover:bg-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={selectedImageFull}
            alt="Attachment"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};

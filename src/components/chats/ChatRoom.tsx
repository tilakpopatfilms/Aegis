import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Lock,
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
  Image as ImageIcon,
  ArrowLeft,
  ShieldCheck,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Safety Fingerprint
  useEffect(() => {
    if (!profile || !selectedConversation?.otherUser) return;

    const loadSafety = async () => {
      const fingerprint = await generateSafetyNumber(
        profile.publicKey,
        selectedConversation.otherUser!.publicKey
      );
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#0c0c0e] text-neutral-800 dark:text-neutral-200">
        <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#18181b] text-neutral-900 dark:text-white flex items-center justify-center mb-3 border border-neutral-200 dark:border-neutral-800">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold mb-1">Aegis End-to-End Encryption</h3>
        <p className="text-xs text-neutral-500 max-w-sm">
          Select a conversation from the sidebar or find a contact by username to start an encrypted session.
        </p>
      </div>
    );
  }

  const otherUser = selectedConversation.otherUser;

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const textToSend = textInput;
    setTextInput('');
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    await sendTextMessage(textToSend, replyId);
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fbfbfb] dark:bg-[#0c0c0e] relative overflow-hidden">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-[#121215] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg md:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setShowSafetyModal(true)}
          >
            {hasOtherPhoto ? (
              <img
                src={otherUser.photoURL}
                alt={otherUser.fullName}
                className="w-9 h-9 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs select-none">
                {otherInitials}
              </div>
            )}

            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                  {otherUser.fullName}
                </h3>
                {isVerified && (
                  <span title="Safety Number Verified">
                    <ShieldCheck className="w-3.5 h-3.5 text-neutral-900 dark:text-white" />
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-400">
                online • end-to-end encrypted
              </p>
            </div>
          </div>
        </div>

        {/* Action icons on top right */}
        <div className="flex items-center space-x-1 text-neutral-600 dark:text-neutral-400">
          <button
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors relative"
            title={`Disappearing Timer: ${selectedConversation.ephemeralSetting}`}
          >
            <Clock className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowOptionsMenu(!showOptionsMenu)}
            className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Disappearing Timer Menu Dropdown */}
      {showTimerMenu && (
        <div className="absolute top-12 right-10 z-30 bg-white dark:bg-[#18181b] rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-1.5 text-xs w-44 text-neutral-800 dark:text-neutral-200">
          <p className="px-2 py-1 font-bold text-[10px] uppercase text-neutral-400">Disappearing Messages</p>
          {(['off', 'viewed', '1h', '24h', '7d'] as EphemeralSetting[]).map((timer) => (
            <button
              key={timer}
              onClick={() => {
                updateEphemeralSetting(timer);
                setShowTimerMenu(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
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
        <div className="absolute top-12 right-2 z-30 bg-white dark:bg-[#18181b] rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-1.5 text-xs w-48 text-neutral-800 dark:text-neutral-200">
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
            onClick={() => {
              setShowOptionsMenu(false);
              setShowTimerMenu(true);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202024] flex items-center space-x-2"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Disappearing messages</span>
          </button>
          <button
            onClick={() => {
              setShowOptionsMenu(false);
              deleteConversationLocally(selectedConversation.id);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-[#202024] text-rose-600 flex items-center space-x-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Conversation</span>
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* End-to-End Encryption Notice Banner */}
        <div className="text-center my-3 max-w-sm mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400 shadow-2xs leading-relaxed">
            <Lock className="w-3 h-3 text-neutral-700 dark:text-neutral-300 shrink-0" />
            <span>Messages are end-to-end encrypted. No one outside this chat can read them.</span>
          </div>
        </div>

        {messages.map((m) => {
          const isMe = m.senderUid === user?.uid;
          const isStarred = starredMsgIds.has(m.id);

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
            >
              {/* Message Bubble */}
              <div
                className={`max-w-[85%] md:max-w-[65%] rounded-xl px-3.5 py-2 relative transition-all text-neutral-900 dark:text-neutral-100 ${
                  isMe
                    ? 'bg-neutral-900 dark:bg-[#27272a] text-white rounded-tr-none'
                    : 'bg-white dark:bg-[#18181b] rounded-tl-none border border-neutral-200 dark:border-neutral-800'
                }`}
              >
                {/* Quoted reply banner */}
                {m.content.replyToId && (
                  <div className={`mb-1.5 p-1.5 rounded text-[11px] flex items-center space-x-1 border-l-2 ${
                    isMe
                      ? 'bg-white/10 border-white text-white/90'
                      : 'bg-neutral-100 dark:bg-black/30 border-neutral-900 dark:border-white text-neutral-600 dark:text-neutral-300'
                  }`}>
                    <CornerDownRight className="w-3 h-3 shrink-0" />
                    <span className="truncate">Replying to previous message</span>
                  </div>
                )}

                {/* Encrypted Image */}
                {m.content.imageBase64 && (
                  <div
                    className="mb-1.5 overflow-hidden rounded-lg cursor-pointer"
                    onClick={() => setSelectedImageFull(m.content.imageBase64!)}
                  >
                    <img
                      src={m.content.imageBase64}
                      alt="Encrypted attachment"
                      className="w-full max-h-72 object-cover rounded hover:opacity-95"
                    />
                  </div>
                )}

                {/* Text Message */}
                {m.content.text && (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-normal break-words pr-10">
                    {m.content.text}
                  </p>
                )}

                {/* Bubble Footer (Time + Double Ticks) */}
                <div
                  className={`flex items-center justify-end space-x-1 text-[10px] mt-0.5 select-none ${
                    isMe ? 'text-white/60' : 'text-neutral-400'
                  }`}
                >
                  {isStarred && <Star className="w-2.5 h-2.5 fill-current mr-0.5" />}
                  {m.ephemeralType !== 'off' && <Clock className="w-2.5 h-2.5 mr-0.5" />}
                  <span>
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && (
                    <span className="ml-0.5">
                      <CheckCheck className="w-3.5 h-3.5 inline" />
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons on Hover */}
              <div
                className={`opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 mt-0.5 transition-opacity ${
                  isMe ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setReplyingTo(m)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded"
                  title="Reply"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStar(m.id)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded"
                  title="Star message"
                >
                  <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyText(m.content.text)}
                  className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded"
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMessageLocally(m.id)}
                  className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                  title="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quoted Reply Preview Strip */}
      {replyingTo && (
        <div className="px-4 py-2 bg-neutral-100 dark:bg-[#18181b] border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <CornerDownRight className="w-4 h-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
            <span className="text-neutral-600 dark:text-neutral-300 truncate">
              Replying to: {replyingTo.content.text || 'Image Attachment'}
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Composer */}
      <form
        onSubmit={handleSendText}
        className="p-2.5 bg-white dark:bg-[#121215] border-t border-neutral-200 dark:border-neutral-800 flex items-center space-x-2"
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
          className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg transition-colors"
          title="Attach Encrypted Image"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type an encrypted message..."
          className="flex-1 px-3.5 py-2 bg-neutral-100 dark:bg-[#18181b] rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 border border-neutral-200 dark:border-neutral-800 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!textInput.trim()}
          className="p-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl transition-colors disabled:opacity-40"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Modal: Safety Number Verification */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-[#121215] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 text-center space-y-4 text-neutral-900 dark:text-neutral-100">
            <button
              onClick={() => setShowSafetyModal(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded-full"
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

            <div className="p-4 bg-neutral-100 dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800 font-mono text-sm tracking-wider text-neutral-900 dark:text-white whitespace-pre-line leading-relaxed">
              {safetyFingerprint}
            </div>

            <button
              onClick={toggleSafetyVerification}
              className={`w-full py-2.5 font-bold rounded-xl transition-all text-xs ${
                isVerified
                  ? 'bg-neutral-200 dark:bg-[#202024] text-neutral-800 dark:text-neutral-200'
                  : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
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
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};

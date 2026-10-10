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
  AlertCircle,
  Download,
  Smile,
  Pin,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { EphemeralSetting, DecryptedMessage, UserProfile } from '../../types';
import { generateSafetyNumber } from '../../crypto/crypto';
import { saveSafetyNumber, getSafetyNumber } from '../../db/localDb';

const PRIMARY_EMOJIS = ['👍', '🥳', '🔥', '❤️', '😡', '🙂'];
const EXTENDED_EMOJIS = ['😂', '🙏', '👏', '🎉', '💔', '👀', '🚀', '💯', '✨', '⚡', '😍', '🤔'];

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
    addMessageReaction,
    togglePinConversation,
    toggleMuteConversation,
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
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Reaction picker state
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [showExtendedPicker, setShowExtendedPicker] = useState<boolean>(false);
  const [customEmojiInput, setCustomEmojiInput] = useState<string>('');
  const longPressTimerRef = useRef<any>(null);

  // Swipe-to-reply touch tracking
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

  if (!selectedConversation) {
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

  const otherUid = selectedConversation.participants.find((p) => p !== user?.uid) || '';
  const otherUser: UserProfile = selectedConversation.otherUser || {
    uid: otherUid,
    username: otherUid.replace(/^usr_/, '').split('_')[0] || 'contact',
    fullName: otherUid.replace(/^usr_/, '').split('_')[0] || 'Encrypted Contact',
    accountType: 'public',
    publicKey: '',
    createdAt: new Date().toISOString(),
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || sending) return;

    const textToSend = textInput.trim();
    setTextInput('');
    setSendError(null);
    const replyId = replyingTo?.id;
    setReplyingTo(null);

    setSending(true);
    try {
      await sendTextMessage(textToSend, replyId);
    } catch (err: any) {
      console.warn('Failed to send text message:', err);
      setTextInput(textToSend);
      setSendError(err.message || 'Failed to send message. Please retry.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSendError(null);
      try {
        await sendImageMessage(file);
      } catch (err: any) {
        console.warn('Failed to send image message:', err);
        setSendError(err.message || 'Failed to send image.');
      }
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
      setCopiedNotice('Copied to clipboard');
      setTimeout(() => setCopiedNotice(null), 2000);
    }
  };

  const handleDownloadImage = (e: React.MouseEvent, base64Url: string, fileName?: string) => {
    e.stopPropagation();
    try {
      const a = document.createElement('a');
      a.href = base64Url;
      a.download = fileName || `aegis_image_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setCopiedNotice('Downloading image...');
      setTimeout(() => setCopiedNotice(null), 2000);
    } catch (err) {
      console.warn('Image download failed:', err);
    }
  };

  const handleTouchStart = (msgId: string, e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      setReactionPickerMsgId(msgId);
      setShowExtendedPicker(false);
    }, 400);
  };

  const handleTouchMove = (msgId: string, e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - touchStartRef.current.x;
    const diffY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);

    if (Math.abs(diffX) > 10 || diffY > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (diffX > 0 && diffX > diffY) {
      const offset = Math.min(diffX * 0.6, 65);
      setSwipeOffsets((prev) => ({ ...prev, [msgId]: offset }));
    }
  };

  const handleTouchEnd = (m: DecryptedMessage) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const offset = swipeOffsets[m.id] || 0;
    if (offset >= 35) {
      setReplyingTo(m);
    }
    setSwipeOffsets((prev) => {
      const next = { ...prev };
      delete next[m.id];
      return next;
    });
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
        .map((p: string) => p[0])
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
        <div className="absolute top-14 right-3 z-30 bg-[#18181b] rounded-2xl shadow-2xl border border-neutral-800 p-1.5 text-xs w-56 text-neutral-200 divide-y divide-neutral-800/80">
          <div className="py-1">
            <button
              onClick={() => {
                togglePinConversation(selectedConversation.id);
                setShowOptionsMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#202024] flex items-center space-x-2 transition-colors"
            >
              <Pin className={`w-3.5 h-3.5 ${selectedConversation.isPinned ? 'text-amber-500 fill-current' : ''}`} />
              <span>{selectedConversation.isPinned ? 'Unpin chat' : 'Pin chat to top'}</span>
            </button>
            <button
              onClick={() => {
                toggleMuteConversation(selectedConversation.id);
                setShowOptionsMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#202024] flex items-center space-x-2 transition-colors"
            >
              <VolumeX className={`w-3.5 h-3.5 ${selectedConversation.isMuted ? 'text-rose-400' : ''}`} />
              <span>{selectedConversation.isMuted ? 'Unmute notifications' : 'Mute chat'}</span>
            </button>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setShowOptionsMenu(false);
                setShowSafetyModal(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#202024] flex items-center space-x-2 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Verify Safety Number</span>
            </button>
            <button
              onClick={handleCopyContactLink}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#202024] flex items-center space-x-2 transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Copy Contact Account Link</span>
            </button>
            <button
              onClick={() => {
                setShowOptionsMenu(false);
                setShowTimerMenu(true);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#202024] flex items-center space-x-2 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Disappearing messages</span>
            </button>
          </div>

          <div className="pt-1">
            <button
              onClick={() => {
                setShowOptionsMenu(false);
                deleteConversationLocally(selectedConversation.id);
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#202024] text-rose-500 hover:text-rose-400 flex items-center space-x-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete conversation</span>
            </button>
          </div>
        </div>
      )}

      {copiedNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-neutral-900 border border-neutral-700 text-white text-xs rounded-xl shadow-xl animate-in fade-in zoom-in-95">
          {copiedNotice}
        </div>
      )}

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 bg-[#09090b]">
        {/* Encryption Header Notice */}
        <div className="text-center py-2">
          <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 bg-[#121215] border border-neutral-800 rounded-full text-[11px] text-neutral-400 shadow-2xs">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Messages are end-to-end encrypted. No cloud plaintext.</span>
          </div>
        </div>

        {/* Message Thread */}
        {messages.map((m) => {
          const isSender = m.senderUid === user?.uid;
          const isStarred = starredMsgIds.has(m.id);
          const replyParent = m.replyToId ? messages.find((p) => p.id === m.replyToId) : null;
          const swipeOffset = swipeOffsets[m.id] || 0;
          const isReactionPickerOpen = reactionPickerMsgId === m.id;

          return (
            <div
              key={m.id}
              className={`group relative flex flex-col ${isSender ? 'items-end' : 'items-start'} space-y-1`}
            >
              {/* Swipe to reply sliding indicator */}
              {swipeOffset > 8 && (
                <div
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 text-emerald-400 flex items-center justify-center transition-all shadow-md z-10 pointer-events-none"
                  style={{
                    opacity: Math.min(swipeOffset / 35, 1),
                    transform: `translateY(-50%) scale(${Math.min(swipeOffset / 35, 1)})`,
                  }}
                >
                  <CornerDownRight className="w-4 h-4" />
                </div>
              )}

              {/* Reaction & Action Bar (WhatsApp style popup on click or hold) */}
              {isReactionPickerOpen && (
                <div
                  className={`absolute -top-12 z-40 flex items-center space-x-1 p-1 bg-[#18181b] border border-neutral-700 rounded-full shadow-2xl animate-in zoom-in-95 duration-150 backdrop-blur-md ${
                    isSender ? 'right-0' : 'left-0'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {PRIMARY_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        addMessageReaction(m.id, emoji);
                        setReactionPickerMsgId(null);
                        setShowExtendedPicker(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center text-sm hover:scale-130 active:scale-95 transition-transform rounded-full hover:bg-neutral-800"
                      title={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowExtendedPicker(!showExtendedPicker)}
                    className="w-6 h-6 flex items-center justify-center text-xs font-bold text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
                    title="More & Custom Emojis"
                  >
                    +
                  </button>

                  <div className="h-4 w-[1px] bg-neutral-700 mx-0.5" />

                  {/* Quick message actions within selection bar */}
                  {m.content.text && (
                    <button
                      onClick={() => {
                        handleCopyText(m.content.text);
                        setReactionPickerMsgId(null);
                      }}
                      className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
                      title="Copy message"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReplyingTo(m);
                      setReactionPickerMsgId(null);
                    }}
                    className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
                    title="Reply"
                  >
                    <CornerDownRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      handleToggleStar(m.id);
                      setReactionPickerMsgId(null);
                    }}
                    className={`w-6 h-6 flex items-center justify-center rounded-full hover:bg-neutral-800 ${
                      isStarred ? 'text-amber-400' : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Star message"
                  >
                    <Star className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      deleteMessageLocally(m.id);
                      setReactionPickerMsgId(null);
                    }}
                    className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-rose-400 rounded-full hover:bg-neutral-800"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>

                  {/* Extended Emoji Grid & Custom Emoji Input */}
                  {showExtendedPicker && (
                    <div className="absolute top-11 left-0 bg-[#1c1c20] border border-neutral-700 p-2.5 rounded-2xl shadow-2xl space-y-2 w-64 z-50 animate-in fade-in zoom-in-95">
                      <div className="grid grid-cols-6 gap-1">
                        {EXTENDED_EMOJIS.map((extEmoji) => (
                          <button
                            key={extEmoji}
                            onClick={() => {
                              addMessageReaction(m.id, extEmoji);
                              setReactionPickerMsgId(null);
                              setShowExtendedPicker(false);
                            }}
                            className="w-8 h-8 flex items-center justify-center text-sm hover:scale-125 transition-transform rounded-lg hover:bg-neutral-800"
                          >
                            {extEmoji}
                          </button>
                        ))}
                      </div>

                      {/* Custom Emoji / Reactor input */}
                      <div className="flex items-center space-x-1.5 pt-1.5 border-t border-neutral-800">
                        <input
                          type="text"
                          placeholder="Custom emoji..."
                          maxLength={6}
                          value={customEmojiInput}
                          onChange={(e) => setCustomEmojiInput(e.target.value)}
                          className="flex-1 px-2 py-1 bg-black rounded-lg text-xs text-white border border-neutral-700 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            if (customEmojiInput.trim()) {
                              addMessageReaction(m.id, customEmojiInput.trim());
                              setCustomEmojiInput('');
                              setReactionPickerMsgId(null);
                              setShowExtendedPicker(false);
                            }
                          }}
                          className="px-2.5 py-1 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200"
                        >
                          React
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Message Bubble Container with touch gesture & click/hold selector */}
              <div
                onClick={() => {
                  setReactionPickerMsgId(reactionPickerMsgId === m.id ? null : m.id);
                  setShowExtendedPicker(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setReactionPickerMsgId(m.id);
                  setShowExtendedPicker(false);
                }}
                onTouchStart={(e) => handleTouchStart(m.id, e)}
                onTouchMove={(e) => handleTouchMove(m.id, e)}
                onTouchEnd={() => handleTouchEnd(m)}
                style={{
                  transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
                  transition: swipeOffset === 0 ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' : undefined,
                }}
                className={`relative px-3.5 py-2.5 rounded-2xl text-xs shadow-sm max-w-[85%] sm:max-w-md cursor-pointer transition-all ${
                  isReactionPickerOpen ? 'ring-2 ring-emerald-500/50' : ''
                } ${
                  isSender
                    ? 'bg-[#27272a] text-white rounded-br-xs border border-neutral-700/60'
                    : 'bg-[#18181b] text-white rounded-bl-xs border border-neutral-800'
                }`}
              >
                {/* Reply Citation */}
                {replyParent && (
                  <div
                    className={`mb-2 p-2 rounded-lg border-l-2 text-[11px] opacity-85 ${
                      isSender
                        ? 'bg-black/30 border-emerald-400 text-neutral-200'
                        : 'bg-neutral-900 border-neutral-500 text-neutral-300'
                    }`}
                  >
                    <p className="font-semibold text-[10px] text-emerald-400">
                      {replyParent.senderUid === user?.uid ? 'You' : otherUser.fullName}
                    </p>
                    <p className="truncate">
                      {replyParent.content.text || (replyParent.content.imageBase64 ? 'Photo' : '')}
                    </p>
                  </div>
                )}

                {/* Attached Image with Download Button */}
                {m.content.imageBase64 && (
                  <div className="relative mb-2 rounded-xl overflow-hidden group/img">
                    <img
                      src={m.content.imageBase64}
                      alt={m.content.fileName || 'Attachment'}
                      onClick={() => setSelectedImageFull(m.content.imageBase64!)}
                      className="max-h-64 rounded-xl object-cover hover:opacity-95 transition-opacity cursor-pointer border border-neutral-700/50"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleDownloadImage(e, m.content.imageBase64!, m.content.fileName)}
                      className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 hover:bg-black text-white rounded-lg backdrop-blur-xs flex items-center space-x-1.5 text-[10px] shadow-md border border-white/10 transition-colors"
                      title="Download image"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="font-semibold text-[10px]">Save</span>
                    </button>
                  </div>
                )}

                {/* Plaintext Content */}
                {m.content.text && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed select-text">
                    {m.content.text}
                  </p>
                )}

                {/* Footer: Timestamp, Ephemeral, Status */}
                <div
                  className={`flex items-center justify-end space-x-1 mt-1 text-[9px] select-none text-neutral-400`}
                >
                  {isStarred && <Star className="w-2.5 h-2.5 fill-current text-amber-400" />}
                  {m.ephemeralType !== 'off' && <Clock className="w-2.5 h-2.5" />}
                  <span>{formatMsgTime(m.timestamp)}</span>
                  {isSender && (
                    <span>
                      {m.status === 'delivered' || m.status === 'read' ? (
                        <CheckCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Check className="w-3 h-3 text-neutral-400" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Reaction Badges Display under bubble */}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1 px-1 z-10">
                  {Object.entries(m.reactions).map(([emoji, uids]) => {
                    const hasMyReaction = user && uids.includes(user.uid);
                    return (
                      <button
                        key={emoji}
                        onClick={() => addMessageReaction(m.id, emoji)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                          hasMyReaction
                            ? 'bg-[#27272a] border-emerald-500/80 text-white font-bold'
                            : 'bg-[#18181b] border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                        title={`${uids.length} reaction${uids.length > 1 ? 's' : ''}`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px] font-mono">{uids.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Message Actions (Quick access buttons) */}
              <div
                className={`flex items-center space-x-1 px-1 text-neutral-400 text-[11px] ${
                  isReactionPickerOpen ? 'opacity-100' : 'opacity-70 sm:opacity-0 sm:group-hover:opacity-100'
                } transition-opacity`}
              >
                <button
                  onClick={() => {
                    setReactionPickerMsgId(reactionPickerMsgId === m.id ? null : m.id);
                    setShowExtendedPicker(false);
                  }}
                  className="p-1 hover:text-white rounded hover:bg-neutral-800"
                  title="React with Emoji"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setReplyingTo(m)}
                  className="p-1 hover:text-white rounded hover:bg-neutral-800"
                  title="Reply (Swipe right)"
                >
                  <CornerDownRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCopyText(m.content.text)}
                  className="p-1 hover:text-white rounded hover:bg-neutral-800"
                  title="Copy text"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleToggleStar(m.id)}
                  className="p-1 hover:text-white rounded hover:bg-neutral-800"
                  title="Star"
                >
                  <Star className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteMessageLocally(m.id)}
                  className="p-1 hover:text-rose-400 rounded hover:bg-neutral-800"
                  title="Delete locally"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

      {/* Send Error Notice */}
      {sendError && (
        <div className="px-4 py-2 bg-neutral-100 dark:bg-[#1a1a1f] border-t border-neutral-300 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-800 dark:text-neutral-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-3.5 h-3.5 text-neutral-500" />
            <span>{sendError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs ml-2"
          >
            Dismiss
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
          <div
            className="absolute top-6 right-6 flex items-center space-x-2 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => handleDownloadImage(e, selectedImageFull)}
              className="px-3.5 py-2 text-white bg-neutral-800/90 hover:bg-neutral-700 rounded-xl border border-neutral-700 flex items-center space-x-1.5 text-xs font-semibold shadow-lg transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            <button
              onClick={() => setSelectedImageFull(null)}
              className="p-2 text-white bg-neutral-800/90 hover:bg-neutral-700 rounded-xl border border-neutral-700 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={selectedImageFull}
            alt="Attachment"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-neutral-800"
          />
        </div>
      )}
    </div>
  );
};

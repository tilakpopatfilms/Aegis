import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Send,
  Paperclip,
  X,
  Trash2,
  CheckCheck,
  Check,
  CornerDownRight,
  MoreVertical,
  Copy,
  ArrowLeft,
  ShieldCheck,
  Link as LinkIcon,
  Download,
  Smile,
  Pin,
  VolumeX,
  Mic,
  Lock,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { DecryptedMessage, UserProfile } from '../../types';
import { generateSafetyNumber } from '../../crypto/crypto';
import { saveSafetyNumber, getSafetyNumber, saveLocalProfile } from '../../db/localDb';
import { VoiceAudioPlayer } from './VoiceAudioPlayer';

const PRIMARY_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const FULL_EMOJI_CATEGORIES = [
  {
    category: 'Smileys & Emotion',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴',
      '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯', '😲',
      '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
      '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '💩', '🤡',
    ],
  },
  {
    category: 'Gestures & People',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏',
      '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪', '🦾',
      '🙏', '🤝', '👏', '🙌', '👐', '🤲', '✍️', '💅', '🤳', '💃', '🕺', '🚶', '🏃',
    ],
  },
  {
    category: 'Hearts & Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '⚡', '💥', '💯', '🎉', '🎊',
      '🎈', '🎁', '🏆', '⭐', '🌟', '💫', '🎯', '🚀', '🔮', '🧿', '💎', '👑',
    ],
  },
];

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
    sendVoiceMessage,
    deleteMessageLocally,
    deleteMessagesLocally,
    deleteConversationLocally,
    addMessageReaction,
    togglePinConversation,
    toggleMuteConversation,
  } = useChat();

  const [textInput, setTextInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<DecryptedMessage | null>(null);

  // Multi-select & Single-select state (Activated ONLY on holding a message)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showEmojiDrawer, setShowEmojiDrawer] = useState<boolean>(false);

  // Live peer profile state for instant real-time sync when other user updates name/photo
  const [liveOtherUser, setLiveOtherUser] = useState<UserProfile | null>(null);

  // Modals & Panels
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyFingerprint, setSafetyFingerprint] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedImageFull, setSelectedImageFull] = useState<string | null>(null);
  const [copiedLinkNotice, setCopiedLinkNotice] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Hold / Long-press touch tracking
  const longPressTimerRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isHoldingRef = useRef<boolean>(false);
  const suppressClickUntilRef = useRef<number>(0);
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WhatsApp-style Voice Recording State & Refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Clean up timers & media stream on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time peer profile listener so other user's changes (name, photo, bio) update live instantly
  useEffect(() => {
    if (!user || !selectedConversation) return;
    const otherUid = selectedConversation.participants.find((p) => p !== user.uid);
    if (!otherUid) return;

    const unsub = onSnapshot(
      doc(db, 'public_profiles', otherUid),
      (snap) => {
        if (snap.exists()) {
          const freshProfile = snap.data() as UserProfile;
          setLiveOtherUser(freshProfile);
          saveLocalProfile(freshProfile).catch(() => {});
        }
      },
      (err) => {
        console.warn('Notice listening to peer profile in room:', err);
      }
    );

    return () => unsub();
  }, [user, selectedConversation?.id]);

  // Load Safety Fingerprint
  useEffect(() => {
    if (!profile || !selectedConversation?.otherUser) return;

    const loadSafety = async () => {
      const activeOther = liveOtherUser || selectedConversation.otherUser;
      const otherPubKey = activeOther?.publicKey || profile.publicKey;
      const fingerprint = await generateSafetyNumber(profile.publicKey, otherPubKey);
      setSafetyFingerprint(fingerprint);

      if (activeOther?.uid) {
        const stored = await getSafetyNumber(activeOther.uid);
        if (stored) {
          setIsVerified(stored.verified);
        }
      }
    };

    loadSafety();
  }, [profile, selectedConversation, liveOtherUser]);

  // Early return placeholder if no chat selected (MUST be after all hooks!)
  if (!selectedConversation) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-[#0b141a] text-[#8696a0] w-full max-w-full overflow-hidden select-none">
        <div className="w-16 h-16 rounded-full bg-[#202c33] text-[#00a884] flex items-center justify-center mb-4 border border-[#2a3942] shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-[#e9edef] mb-1.5">Aegis Encrypted Messaging</h3>
        <p className="text-xs text-[#8696a0] max-w-sm leading-relaxed">
          Select a chat from your messages list or search contacts to begin an end-to-end encrypted session.
        </p>
      </div>
    );
  }

  const otherUid = selectedConversation.participants.find((p) => p !== user?.uid) || '';
  const fallbackUsername = otherUid.startsWith('usr_') ? otherUid.split('_')[1] : 'user';
  const otherUser: UserProfile = liveOtherUser || selectedConversation.otherUser || {
    uid: otherUid,
    username: fallbackUsername,
    fullName: fallbackUsername,
    accountType: 'public',
    publicKey: '',
    createdAt: new Date().toISOString(),
  };

  const isSelectMode = selectedMessageIds.size > 0;
  const isSingleSelect = selectedMessageIds.size === 1;
  const singleSelectedMsg = isSingleSelect
    ? messages.find((m) => selectedMessageIds.has(m.id)) || null
    : null;

  const toggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
    setShowEmojiDrawer(false);
  };

  const clearSelection = () => {
    setSelectedMessageIds(new Set());
    setShowEmojiDrawer(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedMessageIds.size === 0) return;
    const ids = Array.from(selectedMessageIds);
    clearSelection();
    await deleteMessagesLocally(ids);
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

  const startVoiceRecording = async () => {
    try {
      setSendError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone access notice:', err);
      setSendError('Microphone access was denied or is not supported.');
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }

    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const stopAndSendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = Math.max(1, recordingSeconds);

    mediaRecorderRef.current.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm',
        });

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }

        setIsRecording(false);
        setRecordingSeconds(0);

        setSending(true);
        await sendVoiceMessage(audioBlob, duration);
      } catch (err: any) {
        console.warn('Failed to send voice message:', err);
        setSendError(err.message || 'Failed to send voice message.');
      } finally {
        setSending(false);
      }
    };

    mediaRecorderRef.current.stop();
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

  // Touch handlers for holding (long press 320ms) to select message
  const handleTouchStart = (m: DecryptedMessage, e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    isHoldingRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      suppressClickUntilRef.current = Date.now() + 650;
      setSelectedMessageIds((prev) => {
        const next = new Set(prev);
        next.add(m.id);
        return next;
      });
      setShowEmojiDrawer(false);
      try {
        if ('vibrate' in navigator) navigator.vibrate(40);
      } catch (err) {}
    }, 320);
  };

  const handleTouchMove = (msgId: string, e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - touchStartRef.current.x;
    const diffY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);

    // Only cancel long press if finger moved significantly (allow minor micro-jitter up to 18px)
    if (Math.abs(diffX) > 18 || diffY > 18) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    if (diffX > 0 && diffX > diffY && !isHoldingRef.current && selectedMessageIds.size === 0) {
      const offset = Math.min(diffX * 0.6, 65);
      setSwipeOffsets((prev) => ({ ...prev, [msgId]: offset }));
    }
  };

  const handleTouchEnd = (m: DecryptedMessage, e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // If a long press was triggered, suppress the subsequent click event!
    if (Date.now() < suppressClickUntilRef.current) {
      if (e.cancelable) {
        e.preventDefault();
      }
      return;
    }

    const offset = swipeOffsets[m.id] || 0;
    if (offset >= 35 && !isHoldingRef.current && selectedMessageIds.size === 0) {
      setReplyingTo(m);
    }
    setSwipeOffsets((prev) => {
      const next = { ...prev };
      delete next[m.id];
      return next;
    });
  };

  // Desktop mouse handlers for holding (mouse hold 320ms)
  const handleMouseDown = (m: DecryptedMessage, e: React.MouseEvent) => {
    if (e.button === 0) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressTimerRef.current = setTimeout(() => {
        isHoldingRef.current = true;
        suppressClickUntilRef.current = Date.now() + 650;
        setSelectedMessageIds((prev) => {
          const next = new Set(prev);
          next.add(m.id);
          return next;
        });
        setShowEmojiDrawer(false);
      }, 320);
    }
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageBubbleClick = (m: DecryptedMessage, e: React.MouseEvent) => {
    // If the click event is fired immediately after releasing a hold/long-press, SUPPRESS IT!
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // In select mode, a deliberate tap toggles selection
    if (selectedMessageIds.size > 0) {
      e.stopPropagation();
      toggleSelectMessage(m.id);
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
    <div
      onClick={() => {
        if (showEmojiDrawer) {
          setShowEmojiDrawer(false);
        }
      }}
      className="flex-1 flex flex-col h-full bg-[#0b141a] relative w-full max-w-full overflow-hidden select-none"
    >
      {/* Top Header / Contextual Selection Bar (WhatsApp-style) */}
      {isSelectMode ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="px-3 sm:px-4 py-2.5 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between shrink-0 z-30 shadow-md w-full max-w-full min-w-0 animate-in fade-in duration-150"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={clearSelection}
              className="p-1.5 text-[#8696a0] hover:text-[#e9edef] rounded-lg transition-colors shrink-0"
              title="Close selection"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-[#e9edef] truncate">
              {selectedMessageIds.size} selected
            </span>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 text-[#8696a0] shrink-0">
            {/* When SINGLE message is selected: React, Reply, Copy, and Delete */}
            {isSingleSelect && singleSelectedMsg && (
              <>
                {/* React Button: toggles emoji picker */}
                <button
                  onClick={() => setShowEmojiDrawer(!showEmojiDrawer)}
                  className="p-2 hover:text-[#00a884] hover:bg-[#2a3942] rounded-xl transition-colors"
                  title="React with emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Reply Button */}
                <button
                  onClick={() => {
                    setReplyingTo(singleSelectedMsg);
                    clearSelection();
                  }}
                  className="p-2 hover:text-[#00a884] hover:bg-[#2a3942] rounded-xl transition-colors"
                  title="Reply"
                >
                  <CornerDownRight className="w-5 h-5" />
                </button>

                {/* Copy Button */}
                {singleSelectedMsg.content.text && (
                  <button
                    onClick={() => {
                      handleCopyText(singleSelectedMsg.content.text);
                      clearSelection();
                    }}
                    className="p-2 hover:text-[#00a884] hover:bg-[#2a3942] rounded-xl transition-colors"
                    title="Copy text"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            {/* DELETE Button (Beside copy button, available for both single and multi-select!) */}
            <button
              onClick={handleDeleteSelected}
              className="p-2 text-[#8696a0] hover:text-rose-400 hover:bg-[#2a3942] rounded-xl transition-colors"
              title={isSingleSelect ? 'Delete message (for me)' : `Delete ${selectedMessageIds.size} messages (for me)`}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 sm:px-4 py-2 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between shrink-0 z-20 w-full max-w-full min-w-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-lg md:hidden shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer min-w-0 flex-1"
              onClick={() => setShowSafetyModal(true)}
            >
              <div className="relative shrink-0">
                {hasOtherPhoto ? (
                  <img
                    src={otherUser.photoURL}
                    alt={otherUser.fullName}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-[#2a3942]"
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#111b21] text-[#e9edef] border border-[#2a3942] flex items-center justify-center font-bold text-xs select-none">
                    {otherInitials}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] ring-2 ring-[#202c33]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5 truncate">
                  <h3 className="font-semibold text-xs sm:text-sm text-[#e9edef] truncate">
                    {otherUser.fullName}
                  </h3>
                  {isVerified && (
                    <span title="Safety Number Verified">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] text-[#8696a0] font-mono truncate flex items-center space-x-1">
                  <span className="truncate">@{otherUser.username}</span>
                  <span>•</span>
                  <span className="text-[#00a884] shrink-0">E2EE</span>
                </p>
              </div>
            </div>
          </div>

          {/* Top Right Action Icons */}
          <div className="flex items-center space-x-1 text-[#8696a0] shrink-0 ml-1">
            {/* Safety Number Shield Button */}
            <button
              onClick={() => setShowSafetyModal(true)}
              className="p-1.5 sm:p-2 hover:text-[#e9edef] hover:bg-[#2a3942] rounded-xl transition-colors"
              title="Verify Safety Number"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* Options Menu */}
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-1.5 sm:p-2 hover:text-[#e9edef] hover:bg-[#2a3942] rounded-xl transition-colors"
              title="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Options Dropdown */}
      {showOptionsMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-14 right-3 z-40 bg-[#202c33] rounded-2xl shadow-2xl border border-[#2a3942] p-1.5 text-xs w-56 text-[#e9edef] divide-y divide-[#2a3942]"
        >
          <div className="py-1">
            <button
              onClick={async () => {
                const ok = await togglePinConversation(selectedConversation.id);
                if (!ok) {
                  setSendError('Maximum 5 pinned chats allowed. Please unpin another chat first.');
                }
                setShowOptionsMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#2a3942] flex items-center space-x-2 transition-colors"
            >
              <Pin className={`w-3.5 h-3.5 ${selectedConversation.isPinned ? 'text-[#00a884] fill-current' : ''}`} />
              <span>{selectedConversation.isPinned ? 'Unpin chat' : 'Pin chat (Max 5)'}</span>
            </button>
            <button
              onClick={() => {
                toggleMuteConversation(selectedConversation.id);
                setShowOptionsMenu(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#2a3942] flex items-center space-x-2 transition-colors"
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
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#2a3942] flex items-center space-x-2 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Verify Safety Fingerprint</span>
            </button>
            <button
              onClick={handleCopyContactLink}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#2a3942] flex items-center space-x-2 transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Copy Account Direct Link</span>
            </button>
          </div>

          <div className="pt-1">
            <button
              onClick={() => {
                setShowOptionsMenu(false);
                deleteConversationLocally(selectedConversation.id);
              }}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#2a3942] text-rose-400 flex items-center space-x-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete conversation</span>
            </button>
          </div>
        </div>
      )}

      {copiedNotice && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 bg-[#202c33] border border-[#2a3942] text-[#e9edef] text-xs rounded-xl shadow-2xl animate-in fade-in zoom-in-95">
          {copiedNotice}
        </div>
      )}

      {/* Main Messages Scroll Area (WhatsApp-grade Wallpaper & Screen Fitting) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 space-y-2.5 min-h-0 w-full max-w-full bg-[#0b141a] bg-[radial-gradient(#182229_1px,transparent_1px)] [background-size:18px_18px]">
        {/* WhatsApp-style E2EE Notice Banner */}
        <div className="text-center py-1.5">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-[#182229] border border-[#222e35] rounded-xl text-[10px] sm:text-[11px] text-[#ffd279] shadow-xs max-w-sm mx-auto text-center leading-relaxed">
            <Lock className="w-3 h-3 text-[#ffd279] shrink-0" />
            <span>
              Messages to this chat are end-to-end encrypted. No one outside of this chat can read them.
            </span>
          </div>
        </div>

        {/* Message Thread */}
        {messages.map((m) => {
          const isSender = m.senderUid === user?.uid;
          const replyParent = m.replyToId ? messages.find((p) => p.id === m.replyToId) : null;
          const swipeOffset = swipeOffsets[m.id] || 0;
          const isSelected = selectedMessageIds.has(m.id);

          return (
            <div
              key={m.id}
              className={`group relative flex flex-col ${isSender ? 'items-end' : 'items-start'} space-y-1 w-full max-w-full`}
            >
              {/* Swipe to reply sliding indicator */}
              {swipeOffset > 8 && !isSelectMode && (
                <div
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#202c33] border border-[#2a3942] text-[#00a884] flex items-center justify-center transition-all shadow-md z-10 pointer-events-none"
                  style={{
                    opacity: Math.min(swipeOffset / 35, 1),
                    transform: `translateY(-50%) scale(${Math.min(swipeOffset / 35, 1)})`,
                  }}
                >
                  <CornerDownRight className="w-4 h-4" />
                </div>
              )}

              {/* Reaction Bar (Floating above bubble ONLY when EXACTLY 1 message is selected) */}
              {isSingleSelect && singleSelectedMsg?.id === m.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute -top-11 z-40 flex items-center space-x-1 p-1 bg-[#202c33] border border-[#2a3942] rounded-full shadow-2xl animate-in zoom-in-95 duration-150 backdrop-blur-md ${
                    isSender ? 'right-0' : 'left-0'
                  }`}
                >
                  {PRIMARY_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        addMessageReaction(m.id, emoji);
                        clearSelection();
                      }}
                      className="w-7 h-7 flex items-center justify-center text-sm hover:scale-130 active:scale-95 transition-transform rounded-full hover:bg-[#2a3942]"
                      title={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}

                  {/* + Button: Opens WhatsApp-style Emoji-Only Sheet (NO text bar!) */}
                  <button
                    onClick={() => setShowEmojiDrawer(!showEmojiDrawer)}
                    className="w-6 h-6 flex items-center justify-center text-xs font-bold text-[#8696a0] hover:text-[#e9edef] rounded-full hover:bg-[#2a3942]"
                    title="All Emojis"
                  >
                    +
                  </button>
                </div>
              )}

              {/* Message Bubble Container */}
              <div
                onClick={(e) => handleMessageBubbleClick(m, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  suppressClickUntilRef.current = Date.now() + 650;
                  setSelectedMessageIds((prev) => {
                    const next = new Set(prev);
                    next.add(m.id);
                    return next;
                  });
                }}
                onMouseDown={(e) => handleMouseDown(m, e)}
                onMouseUp={handleMouseUp}
                onTouchStart={(e) => handleTouchStart(m, e)}
                onTouchMove={(e) => handleTouchMove(m.id, e)}
                onTouchEnd={(e) => handleTouchEnd(m, e)}
                style={{
                  transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
                  transition: swipeOffset === 0 ? 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)' : undefined,
                }}
                className={`relative px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl text-[13px] shadow-xs max-w-[85%] sm:max-w-[75%] min-w-0 break-words transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-[#00a884] brightness-110 bg-[#025144]/60' : ''
                } ${
                  isSender
                    ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-xs border border-[#005c4b]/40'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-xs border border-[#2a3942]/60'
                }`}
              >
                {/* Reply Citation */}
                {replyParent && (
                  <div
                    className={`mb-1.5 p-2 rounded-lg border-l-3 text-[11px] ${
                      isSender
                        ? 'bg-[#025144] border-[#25d366] text-[#e9edef]/90'
                        : 'bg-[#111b21] border-[#00a884] text-[#e9edef]/90'
                    }`}
                  >
                    <p className="font-semibold text-[10px] text-[#25d366]">
                      {replyParent.senderUid === user?.uid ? 'You' : otherUser.fullName}
                    </p>
                    <p className="truncate">
                      {replyParent.content.text || (replyParent.content.imageBase64 ? 'Photo' : 'Voice note')}
                    </p>
                  </div>
                )}

                {/* Attached Image */}
                {m.content.imageBase64 && (
                  <div className="relative mb-1 rounded-xl overflow-hidden group/img min-w-0">
                    <img
                      src={m.content.imageBase64}
                      alt={m.content.fileName || 'Attachment'}
                      onClick={(e) => {
                        if (!isSelectMode) {
                          e.stopPropagation();
                          setSelectedImageFull(m.content.imageBase64!);
                        }
                      }}
                      className="max-h-60 sm:max-h-64 w-full rounded-xl object-cover hover:opacity-95 transition-opacity cursor-pointer border border-[#2a3942]"
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

                {/* Voice Audio Message Player (WhatsApp style) */}
                {m.content.voiceAudioBase64 && (
                  <div className="mb-0.5 min-w-0">
                    <VoiceAudioPlayer
                      audioBase64={m.content.voiceAudioBase64}
                      durationSeconds={m.content.voiceDurationSeconds}
                      isSender={isSender}
                    />
                  </div>
                )}

                {/* Plaintext Content */}
                {m.content.text && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed select-text pr-1 min-w-0">
                    {m.content.text}
                  </p>
                )}

                {/* Footer: Timestamp, Status checkmarks inside bubble corner */}
                <div className="flex items-center justify-end space-x-1 mt-0.5 text-[10px] select-none text-[#8696a0]">
                  <span>{formatMsgTime(m.timestamp)}</span>
                  {isSender && (
                    <span>
                      {m.status === 'delivered' || m.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-[#8696a0]" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Reaction Badges Display under bubble (Clean counter pills, no action buttons!) */}
              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div className="flex flex-wrap gap-1 px-1 z-10 -mt-1">
                  {Object.entries(m.reactions).map(([emoji, uids]) => {
                    const hasMyReaction = user && uids.includes(user.uid);
                    return (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          addMessageReaction(m.id, emoji);
                        }}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs border transition-colors shadow-xs ${
                          hasMyReaction
                            ? 'bg-[#202c33] border-[#00a884] text-white font-bold'
                            : 'bg-[#182229] border-[#2a3942] text-[#8696a0] hover:text-[#e9edef]'
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
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Pure Emoji-Only Drawer (Strictly ONLY Emojis, No text bar, Same as WhatsApp!) */}
      {showEmojiDrawer && singleSelectedMsg && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-16 sm:bottom-18 left-2 right-2 sm:left-auto sm:right-6 sm:w-80 max-h-72 bg-[#202c33] border border-[#2a3942] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95"
        >
          <div className="px-3.5 py-2 border-b border-[#2a3942] flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-[#e9edef]">Select Emoji Reaction</span>
            <button
              onClick={() => setShowEmojiDrawer(false)}
              className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 overflow-y-auto space-y-3 flex-1">
            {FULL_EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.category} className="space-y-1.5">
                <p className="text-[10px] font-bold text-[#8696a0] uppercase tracking-wider">
                  {cat.category}
                </p>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        addMessageReaction(singleSelectedMsg.id, emoji);
                        clearSelection();
                      }}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:scale-130 active:scale-95 transition-transform rounded-lg hover:bg-[#2a3942]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Replying Citation Banner */}
      {replyingTo && (
        <div className="px-3 sm:px-4 py-2 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between z-20 w-full max-w-full min-w-0">
          <div className="flex items-center space-x-2 text-xs truncate min-w-0 flex-1">
            <CornerDownRight className="w-4 h-4 text-[#00a884] shrink-0" />
            <div className="truncate min-w-0 flex-1">
              <span className="font-semibold text-[#00a884]">
                Replying to {replyingTo.senderUid === user?.uid ? 'yourself' : otherUser.fullName}:
              </span>
              <span className="text-[#8696a0] ml-1 truncate">
                {replyingTo.content.text || (replyingTo.content.imageBase64 ? 'Photo' : 'Voice note')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-lg shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Send Error Notice */}
      {sendError && (
        <div className="px-3 sm:px-4 py-1.5 bg-rose-950/80 border-t border-rose-800 text-rose-300 text-xs flex items-center justify-between z-20 w-full max-w-full min-w-0">
          <span className="truncate">{sendError}</span>
          <button onClick={() => setSendError(null)} className="p-1 shrink-0 ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Input Area (WhatsApp style, 100% Responsive) */}
      {isRecording ? (
        <div className="p-2.5 sm:p-3 bg-[#202c33] border-t border-[#2a3942] flex items-center justify-between shrink-0 z-20 animate-in fade-in w-full max-w-full min-w-0">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 truncate">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shadow-sm shrink-0" />
            <div className="text-xs font-mono font-bold text-[#e9edef] shrink-0">
              {Math.floor(recordingSeconds / 60)}:
              {recordingSeconds % 60 < 10 ? `0${recordingSeconds % 60}` : recordingSeconds % 60}
            </div>
            <span className="text-xs text-[#8696a0] italic truncate">Recording encrypted voice note...</span>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            {/* Cancel & Discard Button */}
            <button
              type="button"
              onClick={cancelVoiceRecording}
              className="p-2 text-[#8696a0] hover:text-rose-400 hover:bg-[#2a3942] rounded-xl transition-colors"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Send Voice Message Button */}
            <button
              type="button"
              onClick={stopAndSendVoiceRecording}
              disabled={sending}
              className="p-2.5 bg-[#00a884] hover:bg-[#009272] text-white rounded-full transition-transform active:scale-95 shadow-md"
              title="Send voice note"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSendText}
          className="p-2 sm:p-2.5 bg-[#202c33] border-t border-[#2a3942] flex items-center space-x-1.5 sm:space-x-2 shrink-0 z-20 w-full max-w-full min-w-0"
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
            className="p-2 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] rounded-full transition-colors shrink-0"
            title="Attach Encrypted Photo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 min-w-0 px-3.5 py-2.5 bg-[#2a3942] rounded-2xl text-xs sm:text-sm text-[#e9edef] placeholder-[#8696a0] border-none focus:outline-none transition-colors"
          />

          {textInput.trim() ? (
            <button
              type="submit"
              disabled={!textInput.trim() || sending}
              className="p-2.5 bg-[#00a884] hover:bg-[#009272] text-white rounded-full transition-colors disabled:opacity-40 shrink-0 shadow-md"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceRecording}
              className="p-2.5 bg-[#00a884] hover:bg-[#009272] text-white rounded-full transition-transform active:scale-95 shrink-0 shadow-md"
              title="Record voice note (WhatsApp style)"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </form>
      )}

      {/* Modal: Safety Number Verification */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-[#202c33] rounded-3xl shadow-2xl border border-[#2a3942] p-6 sm:p-8 text-center space-y-4 text-[#e9edef]">
            <button
              onClick={() => setShowSafetyModal(false)}
              className="absolute top-4 right-4 p-2 text-[#8696a0] hover:text-[#e9edef] rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-full bg-[#111b21] text-[#00a884] flex items-center justify-center mx-auto border border-[#2a3942]">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold tracking-tight">Verify Safety Fingerprint</h3>
            <p className="text-xs text-[#8696a0]">
              Compare this fingerprint with {otherUser.fullName} (@{otherUser.username}) to confirm end-to-end encryption integrity.
            </p>

            <div className="p-4 bg-[#111b21] rounded-2xl border border-[#2a3942] font-mono text-xs sm:text-sm tracking-wider text-[#e9edef] whitespace-pre-line leading-relaxed select-all">
              {safetyFingerprint}
            </div>

            <button
              onClick={toggleSafetyVerification}
              className={`w-full py-2.5 font-bold rounded-xl transition-all text-xs ${
                isVerified
                  ? 'bg-[#2a3942] text-[#8696a0]'
                  : 'bg-[#00a884] hover:bg-[#009272] text-white shadow-md'
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
              className="px-3.5 py-2 text-white bg-[#202c33] hover:bg-[#2a3942] rounded-xl border border-[#2a3942] flex items-center space-x-1.5 text-xs font-semibold shadow-lg transition-colors"
              title="Download image"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
            <button
              onClick={() => setSelectedImageFull(null)}
              className="p-2 text-white bg-[#202c33] hover:bg-[#2a3942] rounded-xl border border-[#2a3942] transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={selectedImageFull}
            alt="Attachment"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-[#2a3942]"
          />
        </div>
      )}
    </div>
  );
};

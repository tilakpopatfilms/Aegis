import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  Scan,
  Download,
  Upload,
  AlertCircle,
  Camera,
  CameraOff,
  Copy,
  Check,
  Link as LinkIcon,
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { saveLocalProfile } from '../../db/localDb';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessConnect: (uid: string) => void;
}

export const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, onSuccessConnect }) => {
  const { user, profile } = useAuth();
  const { startOrGetConversation } = useChat();

  const [activeTab, setActiveTab] = useState<'myQr' | 'scanQr'>('myQr');
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Render My QR Code (and cache locally for offline access)
  useEffect(() => {
    if (isOpen && activeTab === 'myQr' && profile && canvasRef.current) {
      const qrPayload = JSON.stringify({
        protocol: 'aegis-v1',
        username: profile.username,
        uid: profile.uid,
        publicKey: profile.publicKey,
      });

      QRCode.toCanvas(canvasRef.current, qrPayload, {
        width: 240,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).then(() => {
        try {
          if (canvasRef.current) {
            localStorage.setItem(`aegis_qr_${profile.uid}`, canvasRef.current.toDataURL());
          }
        } catch (e) {}
      }).catch((err) => console.error('QR Render Error:', err));
    }
  }, [isOpen, activeTab, profile]);

  // Clean up camera stream when modal closes or tab switches
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, scanMode]);

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
        scanVideoFrame();
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setError('Camera access not granted or not available. Use photo upload instead.');
      setIsCameraActive(false);
    }
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        stopCamera();
        processQRPayload(code.data);
        return;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const processQRPayload = async (payloadStr: string) => {
    setError(null);
    try {
      let data: any = null;
      try {
        data = JSON.parse(payloadStr);
      } catch (e) {
        // Might be a direct link, e.g. domain.com/username
        if (payloadStr.includes('/')) {
          const parts = payloadStr.split('/');
          const userSlug = parts[parts.length - 1];
          if (userSlug) {
            data = { username: userSlug };
          }
        }
      }

      if (!data) throw new Error('Unrecognized QR Code content.');

      if (data.protocol === 'aegis-v1' && data.uid) {
        if (data.uid === user?.uid) {
          throw new Error('This is your own QR code.');
        }
        if (data.username && data.publicKey) {
          saveLocalProfile({
            uid: data.uid,
            username: data.username,
            fullName: data.fullName || data.username,
            accountType: 'public',
            publicKey: data.publicKey,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }
        await startOrGetConversation(data.uid);
        onSuccessConnect(data.uid);
        onClose();
        return;
      }

      if (data.username) {
        if (data.username === profile?.username) {
          throw new Error('This is your own account link.');
        }
        // Direct connect via username
        onSuccessConnect(data.username);
        onClose();
        return;
      }

      throw new Error('QR code does not contain a valid Aegis contact.');
    } catch (err: any) {
      setError(err.message || 'Failed to process QR code.');
    }
  };

  // Robust Photo File Upload Scanner (with downsampling/upsampling for max accuracy)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Try original resolution
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        let imageData = ctx.getImageData(0, 0, img.width, img.height);
        let code = jsQR(imageData.data, imageData.width, imageData.height);

        // If not found and image is very large, downscale and try again
        if (!code && (img.width > 1200 || img.height > 1200)) {
          const scale = Math.min(1000 / img.width, 1000 / img.height);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          code = jsQR(imageData.data, imageData.width, imageData.height);
        }

        if (code && code.data) {
          processQRPayload(code.data);
        } else {
          setError('No valid Aegis QR code detected in this photo. Please try a clearer screenshot.');
        }
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  // Download QR code as PNG file
  const handleDownloadQR = () => {
    if (!canvasRef.current || !profile) return;
    const canvas = canvasRef.current;
    const imageURL = canvas.toDataURL('image/png');

    const downloadLink = document.createElement('a');
    downloadLink.href = imageURL;
    downloadLink.download = `Aegis-QR-${profile.username}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCopyLink = () => {
    if (profile) {
      navigator.clipboard.writeText(`${window.location.origin}/${profile.username}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-[#121215] rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 space-y-5 text-neutral-900 dark:text-neutral-100">
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Toggle */}
        <div className="flex p-1 bg-neutral-100 dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => {
              stopCamera();
              setActiveTab('myQr');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'myQr'
                ? 'bg-white dark:bg-[#121215] text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>My QR Code</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('scanQr');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'scanQr'
                ? 'bg-white dark:bg-[#121215] text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Scan QR Code</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-neutral-100 dark:bg-[#1a1a1f] border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-neutral-500" />
            <span>{error}</span>
          </div>
        )}

        {/* My QR Section */}
        {activeTab === 'myQr' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-white rounded-3xl shadow-xs border border-neutral-200">
              <canvas ref={canvasRef} className="rounded-xl" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm">@{profile?.username}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
                Scan with any Aegis client to establish an encrypted conversation without sharing phone numbers.
              </p>
            </div>

            <div className="flex w-full gap-2 pt-2">
              <button
                onClick={handleDownloadQR}
                className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl text-xs font-bold shadow-xs flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download QR Code</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                title="Copy direct account link"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scan QR Section */}
        {activeTab === 'scanQr' && (
          <div className="space-y-4">
            {/* Sub-modes: Camera Live Scan vs Upload Photo */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  stopCamera();
                  setScanMode('upload');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                  scanMode === 'upload'
                    ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-[#18181b]'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
              </button>

              <button
                onClick={() => {
                  setScanMode('camera');
                  setError(null);
                  startCamera();
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                  scanMode === 'camera'
                    ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-[#18181b]'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Live Camera</span>
              </button>
            </div>

            {scanMode === 'upload' ? (
              <div className="flex flex-col items-center space-y-4 py-4 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 px-6 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-white rounded-3xl bg-neutral-50 dark:bg-[#18181b] cursor-pointer flex flex-col items-center justify-center space-y-3 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Select QR Code Image</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Upload any image or screenshot of an Aegis QR code to connect immediately
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3 py-2">
                <div className="relative w-full aspect-square max-w-[280px] bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                  />
                  {!isCameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-black/70 text-white space-y-2">
                      <CameraOff className="w-6 h-6 text-neutral-400" />
                      <p className="text-xs text-neutral-400">Camera inactive</p>
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}
                  {isCameraActive && (
                    <div className="absolute inset-8 border-2 border-white/60 rounded-xl pointer-events-none animate-pulse" />
                  )}
                </div>

                <p className="text-[11px] text-neutral-500 text-center">
                  Point camera at an Aegis QR code to scan automatically
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

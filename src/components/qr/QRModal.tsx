import React, { useState, useEffect, useRef } from 'react';
import { X, QrCode, Scan, ShieldCheck, Check, Upload, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { saveSafetyNumber } from '../../db/localDb';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessConnect: (uid: string) => void;
}

export const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, onSuccessConnect }) => {
  const { user, profile } = useAuth();
  const { startOrGetConversation } = useChat();

  const [activeTab, setActiveTab] = useState<'myQr' | 'scanQr'>('myQr');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'myQr' && profile && canvasRef.current) {
      const qrPayload = JSON.stringify({
        protocol: 'aegis-v1',
        username: profile.username,
        uid: profile.uid,
        publicKey: profile.publicKey,
      });

      QRCode.toCanvas(canvasRef.current, qrPayload, {
        width: 220,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).catch((err) => console.error('QR Render Error:', err));
    }
  }, [isOpen, activeTab, profile]);

  if (!isOpen) return null;

  const processQRPayload = async (payloadStr: string) => {
    try {
      const data = JSON.parse(payloadStr);
      if (data.protocol !== 'aegis-v1' || !data.uid || !data.publicKey) {
        throw new Error('Invalid Aegis QR payload.');
      }

      if (data.uid === user?.uid) {
        throw new Error('That is your own QR code.');
      }

      setLoading(true);

      await saveSafetyNumber({
        contactUid: data.uid,
        fingerprint: 'VERIFIED_VIA_QR_SCAN',
        verified: true,
        verifiedAt: new Date().toISOString(),
      });

      await startOrGetConversation(data.uid);
      onSuccessConnect(data.uid);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          processQRPayload(code.data);
        } else {
          setError('No valid Aegis QR code detected in the uploaded image.');
        }
      };
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-[#121215] rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 space-y-5 text-neutral-900 dark:text-neutral-100">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Toggle */}
        <div className="flex p-1 bg-neutral-100 dark:bg-[#18181b] rounded-xl border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => {
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
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'myQr' ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-200">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-sm">@{profile?.username}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Your QR code contains public cryptographic identity keys only. Zero plaintext passwords or private keys.
              </p>
            </div>
          </div>
        ) : (
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
              className="w-full py-10 px-6 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-white rounded-2xl bg-neutral-50 dark:bg-[#18181b] cursor-pointer flex flex-col items-center justify-center space-y-3 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Select QR Code Screenshot</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Upload an image of an Aegis QR code to connect and verify identity
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

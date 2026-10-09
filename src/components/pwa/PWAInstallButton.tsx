import React, { useState } from 'react';
import { Download, Smartphone, X, Shield } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={
          className ||
          (variant === 'full'
            ? 'w-full py-3 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-xs'
            : 'px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs')
        }
        title="Install Aegis as a native desktop/mobile application"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (guided prompt)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={
            className ||
            (variant === 'full'
              ? 'w-full py-3 px-4 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-[#18181b] hover:bg-neutral-100 dark:hover:bg-[#202024] text-neutral-900 dark:text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all'
              : 'px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl text-xs font-semibold flex items-center space-x-1.5 hover:bg-neutral-100 dark:hover:bg-[#18181b] transition-colors')
          }
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-sm bg-white dark:bg-[#121215] border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 text-neutral-900 dark:text-neutral-100 space-y-4 shadow-2xl">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#1c1c20] flex items-center justify-center mx-auto text-neutral-900 dark:text-white">
                <Shield className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold">Install Aegis on iPhone / iPad</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Run Aegis as a native standalone app with full-screen experience and instant launch.
                </p>
              </div>

              <div className="p-3 bg-neutral-50 dark:bg-[#18181b] rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>Tap the <strong>Share</strong> button in the Safari navigation bar.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Tap <strong>Add</strong> in the top-right corner.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-bold transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 z-50 flex items-center space-x-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-3.5 py-2 rounded-2xl shadow-xl text-xs font-semibold border border-neutral-700">
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span>Offline Mode — Reviewing cached local messages</span>
    </div>
  );
};

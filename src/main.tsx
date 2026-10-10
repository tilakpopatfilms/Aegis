import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Enforce pure black dark theme permanently
document.documentElement.classList.add('dark');
try {
  localStorage.setItem('theme', 'dark');
} catch (e) {}

// Auto-register service worker for PWA offline app shell & asset caching
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('New Aegis version available');
  },
  onOfflineReady() {
    console.log('Aegis is ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(<App />);

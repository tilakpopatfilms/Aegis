import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface VoiceAudioPlayerProps {
  audioBase64: string;
  durationSeconds?: number;
  isSender: boolean;
}

export const VoiceAudioPlayer: React.FC<VoiceAudioPlayerProps> = ({
  audioBase64,
  durationSeconds = 0,
  isSender,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSeconds);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackRate;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Playback notice:', err);
      });
    }
  };

  const handleSpeedToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || totalDuration <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * (audio.duration || totalDuration);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Generate waveform height bars
  const totalBars = 22;
  const progressRatio = totalDuration > 0 ? currentTime / totalDuration : 0;
  const activeBarCount = Math.floor(progressRatio * totalBars);

  // Deterministic varying bar heights for realistic WhatsApp voice waveform look
  const barHeights = [
    30, 45, 75, 60, 90, 40, 65, 85, 100, 70, 50, 80, 60, 45, 95, 75, 40, 60, 85, 50, 35, 65,
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center space-x-3 py-1.5 px-1 min-w-[210px] sm:min-w-[260px] select-none"
    >
      <audio ref={audioRef} src={audioBase64} preload="metadata" />

      {/* Play / Pause circular button with green accent */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95"
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Timers */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Interactive Waveform Visualizer */}
        <div
          onClick={handleSeek}
          className="h-7 flex items-center space-x-[2.5px] cursor-pointer py-1"
          title="Click to seek"
        >
          {barHeights.map((h, idx) => {
            const isActive = idx <= activeBarCount;
            return (
              <div
                key={idx}
                style={{ height: `${h}%` }}
                className={`flex-1 min-w-[2.5px] rounded-full transition-colors ${
                  isActive
                    ? 'bg-emerald-400'
                    : isSender
                    ? 'bg-neutral-500/60 hover:bg-neutral-400'
                    : 'bg-neutral-600/70 hover:bg-neutral-500'
                }`}
              />
            );
          })}
        </div>

        {/* Counter & Speed Controls */}
        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
          <span className="flex items-center space-x-1">
            <Mic className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span>
              {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
            </span>
          </span>

          {/* Speed Toggle (1x / 1.5x / 2x) */}
          <button
            type="button"
            onClick={handleSpeedToggle}
            className="px-1.5 py-0.5 rounded-md bg-black/40 hover:bg-black/60 text-emerald-400 font-bold border border-emerald-500/20 text-[9px] transition-colors"
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

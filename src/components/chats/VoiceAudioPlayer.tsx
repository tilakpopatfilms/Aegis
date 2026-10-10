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
  const [totalDuration, setTotalDuration] = useState<number>(
    isFinite(durationSeconds) && !isNaN(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0
  );
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      if (audio && isFinite(audio.currentTime) && !isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (audio && isFinite(audio.currentTime)) {
        try {
          audio.currentTime = 0;
        } catch (e) {}
      }
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
    if (!isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    const dur = isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0
      ? audio.duration
      : isFinite(totalDuration) && !isNaN(totalDuration) && totalDuration > 0
      ? totalDuration
      : 0;

    if (dur <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || rect.width <= 0) return;

    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * dur;

    if (isFinite(targetTime) && !isNaN(targetTime) && targetTime >= 0) {
      try {
        audio.currentTime = targetTime;
        setCurrentTime(targetTime);
      } catch (err) {
        console.warn('Seek notice:', err);
      }
    }
  };

  // Generate waveform height bars
  const totalBars = 20;
  const progressRatio = totalDuration > 0 && isFinite(currentTime) ? Math.min(1, Math.max(0, currentTime / totalDuration)) : 0;
  const activeBarCount = Math.floor(progressRatio * totalBars);

  // Deterministic varying bar heights for realistic WhatsApp voice waveform look
  const barHeights = [
    30, 45, 75, 60, 90, 40, 65, 85, 100, 70, 50, 80, 60, 45, 95, 75, 40, 60, 85, 50,
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center space-x-2.5 py-1 px-0.5 w-full max-w-[240px] sm:max-w-[270px] min-w-0 select-none overflow-hidden"
    >
      <audio ref={audioRef} src={audioBase64} preload="metadata" />

      {/* Play / Pause circular button with WhatsApp green accent */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#009272] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95"
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Timers */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Interactive Waveform Visualizer */}
        <div
          onClick={handleSeek}
          className="h-6 flex items-center space-x-[2px] cursor-pointer py-1 min-w-0"
          title="Click to seek"
        >
          {barHeights.map((h, idx) => {
            const isActive = idx <= activeBarCount;
            return (
              <div
                key={idx}
                style={{ height: `${h}%` }}
                className={`flex-1 min-w-[2px] rounded-full transition-colors ${
                  isActive
                    ? 'bg-[#00a884]'
                    : isSender
                    ? 'bg-[#8696a0]/50 hover:bg-[#8696a0]'
                    : 'bg-[#8696a0]/50 hover:bg-[#8696a0]'
                }`}
              />
            );
          })}
        </div>

        {/* Counter & Speed Controls */}
        <div className="flex items-center justify-between text-[10px] text-[#8696a0] font-mono">
          <span className="flex items-center space-x-1 truncate">
            <Mic className="w-2.5 h-2.5 text-[#00a884] shrink-0" />
            <span className="truncate">
              {formatSeconds(currentTime)} / {formatSeconds(totalDuration)}
            </span>
          </span>

          {/* Speed Toggle (1x / 1.5x / 2x) */}
          <button
            type="button"
            onClick={handleSpeedToggle}
            className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/50 text-[#00a884] font-bold border border-[#00a884]/20 text-[9px] transition-colors shrink-0 ml-1"
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

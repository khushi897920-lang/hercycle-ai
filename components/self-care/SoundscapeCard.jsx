'use client'
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

export default function SoundscapeCard({ sound, activeSoundId, onPlay }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (activeSoundId !== sound.id && isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
    }
  }, [activeSoundId]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play();
      setIsPlaying(true);
      onPlay(sound.id);
    }
  };

  return (
    <div className="snap-start shrink-0 flex flex-col items-center gap-3 w-[100px] group">
      <audio ref={audioRef} src={sound.audioUrl} loop />

      <button
        onClick={togglePlay}
        className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg border-2 border-white/10 transition-transform active:scale-95 group-hover:border-white/30 isolate transform-gpu"
        aria-label={isPlaying ? `Pause ${sound.title}` : `Play ${sound.title}`}
      >
        <img
          src={sound.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-all ${isPlaying ? 'opacity-100 bg-black/50' : 'opacity-0 group-hover:opacity-100'}`}>
          {isPlaying ? (
            <Pause className="w-8 h-8 text-white fill-white" />
          ) : (
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          )}
        </div>
      </button>

      <p className="text-white/90 text-sm font-medium text-center leading-tight">
        {sound.title}
      </p>
    </div>
  );
}

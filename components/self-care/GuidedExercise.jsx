'use client'
import React, { useState, useEffect } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function GuidedExercise({ exercise, onFinish }) {
  const t = useTranslations('SelfCare');
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(exercise.poses[0].durationSec);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const pose = exercise.poses[currentStep];

  useEffect(() => {
    setImageLoaded(false);
  }, [currentStep]);

  useEffect(() => {
    let timer;
    if (isPlaying && timeLeft > 0 && !isCompleted) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying) {
      if (currentStep < exercise.poses.length - 1) {
        setCurrentStep(prev => prev + 1);
        setTimeLeft(exercise.poses[currentStep + 1].durationSec);
      } else {
        setIsCompleted(true);
      }
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft, currentStep, isCompleted, exercise.poses]);

  const handleNext = () => {
    if (currentStep < exercise.poses.length - 1) {
      setCurrentStep(prev => prev + 1);
      setTimeLeft(exercise.poses[currentStep + 1].durationSec);
      setIsPlaying(true);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setTimeLeft(exercise.poses[currentStep - 1].durationSec);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isCompleted) {
    return (
      <div className="glass rounded-3xl overflow-hidden flex flex-col items-center justify-center py-16 px-4 text-center w-full max-w-md mx-auto shadow-2xl">
        <CheckCircle2 className="w-20 h-20 text-green-400 mb-6" />
        <h2 className="text-3xl font-bold text-white mb-4">{t('sessionComplete')}</h2>
        <p className="text-white/70 mb-8">{t('greatJob')}</p>
        <button 
          onClick={onFinish}
          className="bg-white text-[#e8527e] px-8 py-3 rounded-full font-semibold shadow-lg hover:bg-white/90 transition-colors"
        >
          {t('finish')}
        </button>
      </div>
    );
  }

  const progress = ((pose.durationSec - timeLeft) / pose.durationSec) * 100;

  return (
    <div className="glass rounded-3xl overflow-hidden relative w-full max-w-md mx-auto shadow-2xl">
      <div className="relative h-64 sm:h-96 w-full">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
        )}
        <img 
          src={pose.image} 
          alt={pose.title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80"></div>
        
        <div className="absolute top-0 left-0 w-full h-1.5 bg-white/20">
          <div 
            className="h-full bg-[#e8527e] transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <button 
          onClick={onFinish}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="absolute bottom-6 left-0 w-full px-6 flex justify-between items-end">
          <div>
            <p className="text-white/80 text-sm font-medium mb-1 tracking-wider uppercase">
              {t('step', { current: currentStep + 1, total: exercise.poses.length })}
            </p>
            <h3 className="text-white text-2xl sm:text-3xl font-bold drop-shadow-md">
              {pose.title}
            </h3>
          </div>
          <div className="text-white text-3xl font-mono font-bold drop-shadow-md">
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="p-6 bg-white/5 flex items-center justify-between">
        <button 
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="p-3 rounded-full hover:bg-white/10 text-white disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button 
          onClick={togglePlay}
          className="w-16 h-16 rounded-full bg-[#e8527e] hover:bg-pink-400 flex items-center justify-center shadow-lg transition-transform active:scale-95 text-white"
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-white" />
          ) : (
            <Play className="w-8 h-8 fill-white ml-1" />
          )}
        </button>

        <button 
          onClick={handleNext}
          className="p-3 rounded-full hover:bg-white/10 text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}

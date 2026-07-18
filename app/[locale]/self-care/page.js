'use client'

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { exercises, soundscapes } from '@/lib/selfCareData';
import HorizontalScroll from '@/components/self-care/HorizontalScroll';
import ExerciseCard from '@/components/self-care/ExerciseCard';
import SoundscapeCard from '@/components/self-care/SoundscapeCard';
import Navbar from '@/components/layout/Navbar';

export default function SelfCarePage() {
  const t = useTranslations('SelfCare');
  const [activeSoundId, setActiveSoundId] = useState(null);

  const handlePlaySound = (id) => {
    setActiveSoundId(id);
  };

  return (
    <div className="page">
      <Navbar />
      <main className="pb-24 pt-6 px-4 max-w-7xl mx-auto w-full space-y-10">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-md">
          {t('title')}
        </h1>
      </header>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-4">{t('crampRelief')}</h2>
        <HorizontalScroll>
          {exercises.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} />
          ))}
        </HorizontalScroll>
      </section>

      <section>
        <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-4">{t('soundscapes')}</h2>
        <HorizontalScroll>
          {soundscapes.map((sound) => (
            <SoundscapeCard 
              key={sound.id} 
              sound={sound} 
              activeSoundId={activeSoundId}
              onPlay={handlePlaySound}
            />
          ))}
        </HorizontalScroll>
      </section>
      </main>
    </div>
  );
}

'use client'

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { exercises, soundscapes } from '@/lib/selfCareData';
import HorizontalScroll from '@/components/self-care/HorizontalScroll';
import ExerciseCard from '@/components/self-care/ExerciseCard';
import SoundscapeCard from '@/components/self-care/SoundscapeCard';
import HydrationTracker from '@/components/self-care/HydrationTracker';
import SelfCareChecklist from '@/components/self-care/SelfCareChecklist';
import CycleTipCard from '@/components/self-care/CycleTipCard';
import NutritionGuideCard from '@/components/self-care/NutritionGuideCard';
import Navbar from '@/components/layout/Navbar';
import { useOffline } from '@/lib/OfflineContext';
import { calculateCyclePhase, getLatestCycle } from '@/lib/calculateCyclePhase';

const FAVORITES_STORAGE_KEY = 'hercycle_selfcare_favorites';

const RECOMMENDATIONS_MAP = {
  menstrual: {
    exercises: ['period-pain-relief', 'foot-massage-cramps', 'lower-back-stretch'],
    soundscapes: ['forest-rain', 'gentle-rain']
  },
  follicular: {
    exercises: ['gentle-hip-opening'],
    soundscapes: ['beach-waves', 'peaceful-night']
  },
  ovulation: {
    exercises: ['pelvic-relaxation'],
    soundscapes: ['beach-waves', 'forest-adventure']
  },
  luteal: {
    exercises: ['lower-back-stretch'],
    soundscapes: ['gentle-rain', 'fireplace']
  }
};

export default function SelfCarePage() {
  const t = useTranslations('SelfCare');
  const locale = useLocale();
  const { offlineClient } = useOffline();
  const [activeSoundId, setActiveSoundId] = useState(null);
  const [phaseKey, setPhaseKey] = useState(null);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState([]);
  const [favoriteSoundscapeIds, setFavoriteSoundscapeIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function getPhase() {
      try {
        const data = await offlineClient.fetchCycles();
        if (data.success && data.data) {
          const latestCycle = getLatestCycle(data.data.cycles);
          if (latestCycle) {
            const periodStart = latestCycle.start_date || latestCycle.period_start || null;
            const periodEnd = latestCycle.end_date || latestCycle.period_end || null;
            const inferredPeriodLength = periodStart && periodEnd
              ? Math.max(
                1,
                Math.round(
                  (new Date(`${periodEnd}T00:00:00`) - new Date(`${periodStart}T00:00:00`)) / 86400000
                ) + 1
              )
              : 5;
            const phaseInfo = calculateCyclePhase({
              periodStart,
              cycleLength: latestCycle.cycle_length || data.data.averageCycleLength || 28,
              periodLength: inferredPeriodLength,
            });
            if (phaseInfo.hasData && phaseInfo.phaseKey) {
              setPhaseKey(phaseInfo.phaseKey);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching cycle data in self-care:', err);
      }
    }
    getPhase();
  }, [offlineClient]);
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY));
      if (saved) {
        setFavoriteExerciseIds(saved.exerciseIds || []);
        setFavoriteSoundscapeIds(saved.soundscapeIds || []);
      }
    } catch (err) {
      // keep defaults on parse error
    }
  }, []);

  const handlePlaySound = (id) => {
    setActiveSoundId(id);
  };

  const toggleFavoriteExercise = (id) => {
    setFavoriteExerciseIds(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ exerciseIds: updated, soundscapeIds: favoriteSoundscapeIds }));
      return updated;
    });
  };

  const toggleFavoriteSoundscape = (id) => {
    setFavoriteSoundscapeIds(prev => {
      const updated = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ exerciseIds: favoriteExerciseIds, soundscapeIds: updated }));
      return updated;
    });
  };

  const phaseRecommendations = RECOMMENDATIONS_MAP[phaseKey];
  const recommendedExercises = phaseRecommendations
    ? exercises.filter(e => phaseRecommendations.exercises.includes(e.id))
    : [];
  const recommendedSoundscapes = phaseRecommendations
    ? soundscapes.filter(s => phaseRecommendations.soundscapes.includes(s.id))
    : [];
  const hasRecommendations = recommendedExercises.length > 0 || recommendedSoundscapes.length > 0;


  const favoriteExercises = exercises.filter(e => favoriteExerciseIds.includes(e.id));
  const favoriteSoundscapes = soundscapes.filter(s => favoriteSoundscapeIds.includes(s.id));
  const hasFavorites = isMounted && (favoriteExercises.length > 0 || favoriteSoundscapes.length > 0);

  const query = searchQuery.trim().toLowerCase();

  const filteredExercises = query
    ? exercises.filter(e => e.title.toLowerCase().includes(query))
    : exercises;

  const filteredSoundscapes = query
    ? soundscapes.filter(s => s.title.toLowerCase().includes(query))
    : soundscapes;

  const noResults = query && filteredExercises.length === 0 && filteredSoundscapes.length === 0;
  const suggestions = query
    ? [
      ...filteredExercises.map(e => ({ type: 'exercise', ...e })),
      ...filteredSoundscapes.map(s => ({ type: 'soundscape', ...s })),
    ].slice(0, 6)
    : [];

  const handleSelectSuggestion = (item) => {
    if (item.type === 'soundscape') {
      handlePlaySound(item.id);
    }
    setIsDropdownOpen(false);
    if (item.type === 'exercise') {
      setSearchQuery('');
    }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="pb-24 pt-6 px-4 max-w-7xl mx-auto w-full space-y-10">
        <header className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-md">
            {t('title')}
          </h1>

          <div ref={searchRef} className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-white/10 border border-white/15 rounded-full px-4 py-2.5 text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
            />

            {isDropdownOpen && query && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#2a1230] border border-white/10 rounded-2xl shadow-xl z-30 overflow-hidden">
                {noResults ? (
                  <p className="text-white/60 text-sm px-4 py-3">{t('noResults')}</p>
                ) : (
                  suggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full text-left px-4 py-2.5 text-sm text-white/85 hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs text-white/40 uppercase">{item.type === 'exercise' ? '🧘' : '🎧'}</span>
                      {item.title}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </header>

        {hasFavorites && (
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">❤️</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {t('yourFavorites')}
              </h2>
            </div>

            {favoriteExercises.length > 0 && (
              <div>
                <h3 className="text-white/80 text-sm font-semibold mb-3 tracking-wide uppercase">
                  {t('recExercises')}
                </h3>
                <HorizontalScroll>
                  {favoriteExercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      isFavorite={true}
                      onToggleFavorite={toggleFavoriteExercise}
                    />
                  ))}
                </HorizontalScroll>
              </div>
            )}

            {favoriteSoundscapes.length > 0 && (
              <div>
                <h3 className="text-white/80 text-sm font-semibold mb-3 tracking-wide uppercase">
                  {t('recSoundscapes')}
                </h3>
                <HorizontalScroll>
                  {favoriteSoundscapes.map((sound) => (
                    <SoundscapeCard
                      key={sound.id}
                      sound={sound}
                      activeSoundId={activeSoundId}
                      onPlay={handlePlaySound}
                      isFavorite={true}
                      onToggleFavorite={toggleFavoriteSoundscape}
                    />
                  ))}
                </HorizontalScroll>
              </div>
            )}
          </section>
        )}

        {/* Today's Cycle Tip Card */}
        <CycleTipCard phaseKey={phaseKey} />

        <NutritionGuideCard phaseKey={phaseKey} />

        {/* Hydration & Cramp Relief Water Tracker */}
        <HydrationTracker phaseKey={phaseKey} />

        {/* Daily Self-Care Checklist */}
        <SelfCareChecklist />

        {/* Recommended for You Section */}      {phaseKey && phaseRecommendations && hasRecommendations && (
          <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {t('recommendedForYou')}
              </h2>
            </div>

            {recommendedExercises.length > 0 && (
              <div>
                <h3 className="text-white/80 text-sm font-semibold mb-3 tracking-wide uppercase">
                  {t('recExercises')}
                </h3>
                <HorizontalScroll>
                  {recommendedExercises.map((exercise) => (
                    <ExerciseCard
                      key={exercise.id}
                      exercise={exercise}
                      isFavorite={favoriteExerciseIds.includes(exercise.id)}
                      onToggleFavorite={toggleFavoriteExercise}
                    />
                  ))}
                </HorizontalScroll>
              </div>
            )}

            {recommendedSoundscapes.length > 0 && (
              <div>
                <h3 className="text-white/80 text-sm font-semibold mb-3 tracking-wide uppercase">
                  {t('recSoundscapes')}
                </h3>
                <HorizontalScroll>
                  {recommendedSoundscapes.map((sound) => (
                    <SoundscapeCard
                      key={sound.id}
                      sound={sound}
                      activeSoundId={activeSoundId}
                      onPlay={handlePlaySound}
                      isFavorite={favoriteSoundscapeIds.includes(sound.id)}
                      onToggleFavorite={toggleFavoriteSoundscape}
                    />
                  ))}
                </HorizontalScroll>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-4">{t('crampRelief')}</h2>
          <HorizontalScroll>
            {filteredExercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                isFavorite={isMounted && favoriteExerciseIds.includes(exercise.id)}
                onToggleFavorite={toggleFavoriteExercise}
              />
            ))}
          </HorizontalScroll>
        </section>

        <section>
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90 mb-4">{t('soundscapes')}</h2>
          <HorizontalScroll>
            {filteredSoundscapes.map((sound) => (
              <SoundscapeCard
                key={sound.id}
                sound={sound}
                activeSoundId={activeSoundId}
                onPlay={handlePlaySound}
                isFavorite={isMounted && favoriteSoundscapeIds.includes(sound.id)}
                onToggleFavorite={toggleFavoriteSoundscape}
              />
            ))}
          </HorizontalScroll>
        </section>
      </main>
    </div>
  );
}


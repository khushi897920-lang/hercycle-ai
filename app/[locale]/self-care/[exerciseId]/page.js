'use client'

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { exercises } from '@/lib/selfCareData';
import { ArrowLeft, Clock, Activity } from 'lucide-react';
import GuidedExercise from '@/components/self-care/GuidedExercise';
import Navbar from '@/components/layout/Navbar';

export default function ExerciseDetailPage() {
  const t = useTranslations('SelfCare');
  const params = useParams();
  const router = useRouter();
  const { exerciseId } = params;
  
  const exercise = exercises.find(e => e.id === exerciseId);
  const [isGuidedMode, setIsGuidedMode] = useState(false);

  if (!exercise) {
    return <div className="text-center text-white mt-20">Exercise not found</div>;
  }

  if (isGuidedMode) {
    return (
      <div className="page">
        <Navbar />
        <main className="pt-12 px-4 flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-full">
            <GuidedExercise 
              exercise={exercise} 
              onFinish={() => setIsGuidedMode(false)} 
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <main className="pb-24">
      <div className="relative h-64 sm:h-[400px] w-full">
        <img 
          src={exercise.image} 
          alt={exercise.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-[#120a1f]"></div>
        
        <button 
          onClick={() => router.back()}
          className="absolute top-6 left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition-colors z-20"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-24 sm:-mt-32 relative z-10">
        <div className="glass p-6 sm:p-8 rounded-3xl shadow-2xl mb-8">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-md">
            {exercise.title}
          </h1>
          
          <p className="text-white/80 text-lg sm:text-xl mb-6 leading-relaxed">
            {exercise.description}
          </p>

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2 border border-white/10">
              <Clock className="w-5 h-5 text-pink-400" />
              <span className="text-white font-medium">{t('duration', { min: exercise.durationMin })}</span>
            </div>
            <div className="bg-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2 border border-white/10">
              <Activity className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">{t('poses', { count: exercise.poses.length })}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-10 pl-2">
          {exercise.poses.map((pose, index) => (
            <div key={index} className="glass p-4 rounded-2xl flex items-center gap-5 border border-white/10 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/20 flex items-center justify-center text-white/90 font-bold shrink-0">
                {index + 1}
              </div>
              <h3 className="text-white text-lg font-medium tracking-wide">{pose.title}</h3>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setIsGuidedMode(true)}
          className="w-full sm:w-80 bg-[#e8527e] hover:bg-pink-400 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-lg transition-transform active:scale-95 flex justify-center mx-auto mt-6"
        >
          {t('start')}
        </button>
      </div>
      </main>
    </div>
  );
}

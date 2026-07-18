import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { useLocale } from 'next-intl';

export default function ExerciseCard({ exercise }) {
  const locale = useLocale();
  return (
    <Link 
      href={`/${locale}/self-care/${exercise.id}`}
      className="snap-start shrink-0 relative overflow-hidden rounded-3xl w-[280px] h-[200px] group block"
    >
      <img 
        src={exercise.image} 
        alt={exercise.title} 
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80"></div>
      
      <div className="absolute inset-0 p-5 flex flex-col justify-between">
        <h3 className="text-white font-bold text-xl max-w-[85%] leading-tight drop-shadow-md">
          {exercise.title}
        </h3>
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-white/40 transition-colors shadow-lg">
          <Play className="w-5 h-5 text-white fill-white ml-1" />
        </div>
      </div>
    </Link>
  );
}

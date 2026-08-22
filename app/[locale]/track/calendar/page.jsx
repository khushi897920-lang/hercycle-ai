import React from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import MultiLangCalendar from '@/components/calendar/MultiLangCalendar';

export default async function CalendarPage({ params }) {
  const { locale } = await params;

  return (
    <div className="page">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Multi-Language Health & Cycle Calendar
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Track habits, health checkups, donation cycles, and recurring reminders with localized date formatting and timezone awareness.
          </p>
        </div>

        <MultiLangCalendar locale={locale || 'en'} />
      </div>
      <Footer />
    </div>
  );
}

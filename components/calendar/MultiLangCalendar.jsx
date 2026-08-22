'use client';

import React, { useState, useEffect } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { enUS, hi } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Globe,
  Trash2,
  Edit3,
  Repeat,
  Heart,
  Bell,
  Sparkles,
  Droplet,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import fetchWithTimeout from '@/lib/fetch-with-timeout';
import toast from 'react-hot-toast';

const TIMEZONES = [
  { label: 'India Standard Time (IST)', value: 'Asia/Kolkata' },
  { label: 'Coordinated Universal Time (UTC)', value: 'UTC' },
  { label: 'US Eastern Time (EST/EDT)', value: 'America/New_York' },
  { label: 'US Pacific Time (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'British Summer Time (BST/GMT)', value: 'Europe/London' },
  { label: 'Japan Standard Time (JST)', value: 'Asia/Tokyo' },
];

const CATEGORIES = [
  { id: 'reminder', label: 'Habit & Reminder', color: 'bg-pink-500', badgeClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  { id: 'habit', label: 'Self-Care Habit', color: 'bg-emerald-500', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'donation', label: 'Donation & Cycle', color: 'bg-red-500', badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  { id: 'health', label: 'Medical & Checkup', color: 'bg-blue-500', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
];

export default function MultiLangCalendar({ locale = 'en' }) {
  const dateLocale = locale === 'hi' ? hi : enUS;
  const today = new Date();

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTimeZone, setSelectedTimeZone] = useState('Asia/Kolkata');
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('reminder');
  const [formRecurrence, setFormRecurrence] = useState('none');
  const [formTime, setFormTime] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const res = await fetchWithTimeout('/api/events');
      const json = await res.json();
      if (json.success) {
        setEvents(json.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      toast.error('Failed to load events');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Month Navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const jumpToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  // Open modal for creating or editing
  const openCreateModal = () => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('reminder');
    setFormRecurrence('none');
    setFormTime('09:00');
    setShowEventModal(true);
  };

  const openEditModal = (event) => {
    setEditingEventId(event.id);
    setFormTitle(event.title);
    setFormDescription(event.description || '');
    setFormCategory(event.category || 'reminder');
    setFormRecurrence(event.recurrence_rule || 'none');
    if (event.start_time) {
      try {
        const dateObj = parseISO(event.start_time);
        setFormTime(format(dateObj, 'HH:mm'));
      } catch (e) {
        setFormTime('09:00');
      }
    }
    setShowEventModal(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(editingEventId ? 'Updating event...' : 'Creating event...');

    try {
      // Build ISO Start Time string combining selectedDate and formTime
      const [hours, minutes] = formTime.split(':').map(Number);
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(hours || 9, minutes || 0, 0, 0);

      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        recurrence_rule: formRecurrence,
        start_time: combinedDate.toISOString(),
        time_zone: selectedTimeZone,
      };

      let res;
      if (editingEventId) {
        res = await fetchWithTimeout('/api/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingEventId, ...payload }),
        });
      } else {
        res = await fetchWithTimeout('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save event');

      toast.success(editingEventId ? 'Event updated!' : 'Event created!', { id: toastId });
      setShowEventModal(false);
      fetchEvents();
    } catch (err) {
      console.error('Save event error:', err);
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;

    const toastId = toast.loading('Deleting event...');
    try {
      const res = await fetchWithTimeout(`/api/events?id=${eventId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');

      toast.success('Event deleted', { id: toastId });
      fetchEvents();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    }
  };

  // Calendar Day Generation
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  // Filter events for selected day (including recurring logic)
  const getEventsForDate = (date) => {
    if (!date) return [];
    return events.filter((evt) => {
      if (!evt.start_time) return false;
      const evtDate = parseISO(evt.start_time);

      if (isSameDay(evtDate, date)) return true;

      // Recurrence Check
      if (evt.recurrence_rule === 'daily' && date >= evtDate) return true;
      if (
        evt.recurrence_rule === 'weekly' &&
        date >= evtDate &&
        date.getDay() === evtDate.getDay()
      )
        return true;
      if (
        evt.recurrence_rule === 'monthly' &&
        date >= evtDate &&
        date.getDate() === evtDate.getDate()
      )
        return true;
      if (
        evt.recurrence_rule === 'yearly' &&
        date >= evtDate &&
        date.getMonth() === evtDate.getMonth() &&
        date.getDate() === evtDate.getDate()
      )
        return true;

      return false;
    });
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  const getCategoryBadge = (catId) => {
    const found = CATEGORIES.find((c) => c.id === catId) || CATEGORIES[0];
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${found.badgeClass}`}>
        {found.label}
      </span>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Calendar Top Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-pink-500" />
            {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Localized in <span className="font-semibold uppercase">{locale}</span> with custom time-zone rendering.
          </p>
        </div>

        {/* Timezone Selector & Today Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <Globe size={14} className="text-pink-500" />
            <select
              value={selectedTimeZone}
              onChange={(e) => setSelectedTimeZone(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white focus:outline-none font-medium"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-slate-900 text-white">
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={jumpToToday}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Today
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-pink-500 hover:bg-pink-600 text-white px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus size={15} /> Add Event
          </button>
        </div>
      </div>

      {/* Main Grid: Calendar View & Selected Date Event Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2-Cols: Month View */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm">
          {/* Controls: Prev / Next */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday Labels (Localized) */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
              const d = new Date(2026, 7, 2 + dayIdx);
              return <span key={dayIdx}>{format(d, 'EEE', { locale: dateLocale })}</span>;
            })}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-sm">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return <div key={idx} className="h-12" />;
              }

              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, today);
              const dayEvents = getEventsForDate(date);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(date)}
                  className={`h-12 rounded-2xl flex flex-col items-center justify-center relative transition-all ${
                    isSelected
                      ? 'bg-pink-500 text-white font-bold shadow-md scale-105'
                      : isToday
                      ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 font-bold border border-pink-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{date.getDate()}</span>
                  {/* Event Indicator Dots */}
                  {dayEvents.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {dayEvents.slice(0, 3).map((evt, i) => (
                        <span
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? 'bg-white'
                              : evt.category === 'habit'
                              ? 'bg-emerald-500'
                              : evt.category === 'donation'
                              ? 'bg-red-500'
                              : evt.category === 'health'
                              ? 'bg-blue-500'
                              : 'bg-pink-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Col: Selected Date Events Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {format(selectedDate, 'EEEE, MMM d', { locale: dateLocale })}
                </h3>
                <p className="text-xs text-slate-400">
                  Timezone: <span className="font-mono text-slate-300">{selectedTimeZone}</span>
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="p-1.5 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-lg transition-colors"
                title="Add event on this date"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Events List */}
            {isLoadingEvents ? (
              <div className="flex justify-center py-10 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
              </div>
            ) : selectedDateEvents.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No events scheduled for this date.
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {selectedDateEvents.map((evt) => {
                  let formattedTime = 'All Day';
                  if (evt.start_time) {
                    try {
                      formattedTime = formatInTimeZone(
                        parseISO(evt.start_time),
                        selectedTimeZone,
                        'hh:mm a',
                        { locale: dateLocale }
                      );
                    } catch (e) {
                      formattedTime = format(parseISO(evt.start_time), 'hh:mm a');
                    }
                  }

                  return (
                    <div
                      key={evt.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                          {evt.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(evt)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {evt.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {evt.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        {getCategoryBadge(evt.category)}
                        <span className="flex items-center gap-1 text-slate-500 font-mono">
                          <Clock size={12} /> {formattedTime}
                        </span>
                        {evt.recurrence_rule && evt.recurrence_rule !== 'none' && (
                          <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium capitalize">
                            <Repeat size={12} /> {evt.recurrence_rule}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE / EDIT EVENT MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold">
                {editingEventId ? 'Edit Calendar Event' : 'Add New Event'}
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Habit Reminder / Donation Cycle"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Add notes or reminders..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 min-h-[60px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Recurrence
                  </label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    <option value="none">Does Not Repeat</option>
                    <option value="daily">Every Day</option>
                    <option value="weekly">Every Week</option>
                    <option value="monthly">Every Month</option>
                    <option value="yearly">Every Year</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Event'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

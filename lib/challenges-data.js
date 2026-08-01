
export const CHALLENGES = {
  water: {
    key: 'water',
    target: 2000,
    points: 30,
    icon: '💧',
  },
  stretch: {
    key: 'stretch',
    target: 600,
    points: 20,
    icon: '🧘',
  },
  mood: {
    key: 'mood',
    target: 1,
    points: 15,
    icon: '😊',
  },
  iron: {
    key: 'iron',
    target: 1,
    points: 15,
    icon: '🥬',
  },
  sleep: {
    key: 'sleep',
    target: 1,
    points: 20,
    icon: '😴',
  },
}

export const BADGES = {
  first_challenge: { key: 'first_challenge', label: 'First Challenge', icon: '🌱', check: (stats) => stats.totalCompletions >= 1 },
  hydration_hero: { key: 'hydration_hero', label: 'Hydration Hero', icon: '🥇', check: (stats) => stats.waterCompletions >= 5 },
  wellness_beginner: { key: 'wellness_beginner', label: 'Wellness Beginner', icon: '🌸', check: (stats) => stats.totalCompletions >= 3 },
  streak_7: { key: 'streak_7', label: '7-Day Streak', icon: '🔥', check: (stats) => stats.streak >= 7 },
}

export const MONTHLY_BADGES = {
  hydration_hero: { label: 'Hydration Hero', icon: '🥇', check: (stats) => stats.waterCompletions >= 15 },
  wellness_champion: { label: 'Wellness Champion', icon: '👑', check: (stats) => stats.totalCompletions >= 20 },
  streak_keeper: { label: 'Streak Keeper', icon: '🔥', check: (stats) => stats.bestStreak >= 7 },
}

export function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthLabel(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
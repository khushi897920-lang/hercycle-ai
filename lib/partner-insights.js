/**
 * Helper module for generating biologically-informed partner insights,
 * care recommendations, energy battery levels, and sensitivity alerts.
 */

export function getBiologicalPhaseContext(phase) {
  switch (phase) {
    case 'Menstrual':
      return {
        title: 'Menstrual Phase 🩸',
        summary: 'Estrogen and progesterone are at their lowest levels. Her body is shedding uterine lining and consuming extra energy.',
        physiologicalFocus: 'Rest, hydration, thermal warmth, and iron replenishment.',
      }
    case 'Follicular':
      return {
        title: 'Follicular Phase 🌱',
        summary: 'Estrogen levels are steadily rising as new follicles develop. Stamina, mood, and mental focus are naturally climbing.',
        physiologicalFocus: 'High energy, creativity, social interaction, and outdoor activities.',
      }
    case 'Ovulation':
      return {
        title: 'Ovulation Phase 🌸',
        summary: 'Estrogen and Luteinizing Hormone (LH) reach peak levels. She experiences maximum confidence, energy, and closeness.',
        physiologicalFocus: 'Quality time, shared experiences, and high-vitality activities.',
      }
    case 'Luteal':
      return {
        title: 'Luteal Phase 🌙',
        summary: 'Progesterone becomes the dominant hormone. Body temperature & metabolism rise, while natural energy gradually decreases.',
        physiologicalFocus: 'Comfort, emotional grounding, stress reduction, and patience.',
      }
    default:
      return {
        title: 'Cycle Tracking active',
        summary: 'Cycle patterns are being analyzed to provide personalized partner recommendations.',
        physiologicalFocus: 'General supportive care and attention.',
      }
  }
}

export function getActionableCareTips(phase, symptoms = [], flow = null) {
  const tips = []

  // Severe symptom callout tip
  if (symptoms.some(s => s.toLowerCase().includes('cramp'))) {
    tips.push('Offer a warm heating pad or hot water bottle to help soothe pelvic cramps.')
  }
  if (symptoms.some(s => s.toLowerCase().includes('headache') || s.toLowerCase().includes('migraine'))) {
    tips.push('Keep lighting dim and create a quiet, low-noise environment to ease head tension.')
  }
  if (symptoms.some(s => s.toLowerCase().includes('fatigue'))) {
    tips.push('Take over strenuous household chores today so she can get extra rest.')
  }

  // Phase-specific tips
  switch (phase) {
    case 'Menstrual':
      tips.push('Prepare warm chamomile or ginger tea to assist with muscle relaxation.')
      tips.push('Keep her favorite dark chocolate or iron-rich snacks easily accessible.')
      if (!tips.some(t => t.includes('heating pad'))) {
        tips.push('Check if she needs pain relief support or a cozy blanket for rest.')
      }
      break

    case 'Follicular':
      tips.push('Great window to plan outdoor dates, walks, or try a new activity together!')
      tips.push('Her focus and energy are rising — great time for meaningful conversations.')
      tips.push('Encourage new creative goals or shared projects.')
      break

    case 'Ovulation':
      tips.push('Peak vitality & connection window! Plan a special evening or quality date night.')
      tips.push('Complement her confidence and express genuine appreciation for her.')
      tips.push('Enjoy active adventures or shared hobbies together.')
      break

    case 'Luteal':
      tips.push('Offer extra emotional reassurance and avoid starting heavy or stressful debates.')
      tips.push('Prepare grounding, warm comfort meals (e.g., warm soups or complex carbs).')
      tips.push('Keep the evening calm and low-pressure to support her rising progesterone levels.')
      break

    default:
      tips.push('Ask how she is feeling today and if she needs any extra water or comfort.')
      tips.push('Express love and offer a gentle massage or back rub.')
      tips.push('Keep dark chocolate or her favorite tea nearby.')
      break
  }

  return tips.slice(0, 3) // Return top 3 actionable tips
}

export function calculateEnergyBattery(phase, cycleDay, symptoms = []) {
  let baseEnergy = 75

  switch (phase) {
    case 'Menstrual':
      baseEnergy = 35
      break
    case 'Follicular':
      baseEnergy = 80
      break
    case 'Ovulation':
      baseEnergy = 95
      break
    case 'Luteal':
      // Energy drops as luteal phase progresses (late luteal phase)
      baseEnergy = cycleDay > 22 ? 45 : 65
      break
    default:
      baseEnergy = 70
  }

  // Symptom deductions
  if (symptoms.some(s => s.toLowerCase().includes('fatigue'))) baseEnergy -= 20
  if (symptoms.some(s => s.toLowerCase().includes('cramp'))) baseEnergy -= 15
  if (symptoms.some(s => s.toLowerCase().includes('headache'))) baseEnergy -= 15
  if (symptoms.some(s => s.toLowerCase().includes('bloating'))) baseEnergy -= 5

  const level = Math.max(15, Math.min(100, baseEnergy))

  let label = 'Moderate Stamina'
  let color = 'bg-yellow-500'

  if (level >= 80) {
    label = 'Peak Energy & Vitality'
    color = 'bg-emerald-500'
  } else if (level >= 55) {
    label = 'Balanced Stamina'
    color = 'bg-blue-500'
  } else if (level >= 35) {
    label = 'Gentle / Rest Needed'
    color = 'bg-amber-500'
  } else {
    label = 'Low Energy / Full Rest Mode'
    color = 'bg-red-500'
  }

  return { level, label, color }
}

export function getPmsAlert(phase, cycleDay) {
  if (phase === 'Luteal' && cycleDay >= 22) {
    return {
      active: true,
      title: 'Pre-Menstrual Window Active 🌙',
      message: 'Progesterone shifts may cause heightened sensitivity, fatigue, or mood fluctuations. Extra patience, listening, and quiet comfort are deeply appreciated.',
    }
  }
  return { active: false }
}

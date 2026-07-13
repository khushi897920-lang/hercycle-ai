export const CYCLE_PHASES = {
  menstrual: {
    key: 'menstrual',
    title: 'Menstrual Phase',
    eyebrow: 'Rest and reset',
    overview:
      'Your period begins during this phase as the uterine lining is shed. Energy levels may feel lower, so a slower pace can be helpful.',
    hormones:
      'Estrogen and progesterone are at their lowest levels at the beginning of the cycle.',
    symptoms: [
      'Cramps or lower-back discomfort',
      'Lower energy or tiredness',
      'Mood changes',
      'Bloating or headaches',
    ],
    selfCare: [
      'Use a heating pad for cramps',
      'Choose gentle movement such as walking or stretching',
      'Stay hydrated and include iron-rich foods',
      'Give yourself extra rest when needed',
    ],
    accent: '#ff6b81',
    softAccent: 'rgba(255, 107, 129, 0.16)',
    icon: 'droplets',
  },
  follicular: {
    key: 'follicular',
    title: 'Follicular Phase',
    eyebrow: 'Energy is rebuilding',
    overview:
      'After menstruation, your body prepares an egg for ovulation. Many people notice gradually improving energy and focus.',
    hormones:
      'Estrogen begins to rise while follicle-stimulating hormone supports the development of an ovarian follicle.',
    symptoms: [
      'Increasing energy',
      'Improved concentration',
      'Lighter mood',
      'Changes in cervical discharge',
    ],
    selfCare: [
      'Try strength training or moderate exercise if comfortable',
      'Plan demanding tasks while energy is improving',
      'Eat balanced meals with protein and fibre',
      'Continue tracking discharge and symptoms',
    ],
    accent: '#a29bfe',
    softAccent: 'rgba(162, 155, 254, 0.16)',
    icon: 'sprout',
  },
  ovulation: {
    key: 'ovulation',
    title: 'Ovulation Phase',
    eyebrow: 'Peak fertility window',
    overview:
      'Ovulation usually happens around the middle of the cycle when an egg is released from the ovary.',
    hormones:
      'A rise in estrogen is followed by a luteinizing hormone surge that triggers ovulation.',
    symptoms: [
      'Clear or slippery cervical discharge',
      'Mild one-sided pelvic discomfort',
      'Higher energy or confidence',
      'Slight rise in body temperature after ovulation',
    ],
    selfCare: [
      'Stay hydrated, especially during active days',
      'Track discharge if you monitor fertility',
      'Choose nourishing meals and regular movement',
      'Use contraception as advised if avoiding pregnancy',
    ],
    accent: '#00b894',
    softAccent: 'rgba(0, 184, 148, 0.16)',
    icon: 'sun',
  },
  luteal: {
    key: 'luteal',
    title: 'Luteal Phase',
    eyebrow: 'Slow down and support',
    overview:
      'After ovulation, the body prepares for a possible pregnancy. If pregnancy does not occur, hormone levels fall before the next period.',
    hormones:
      'Progesterone rises after ovulation and later falls along with estrogen before menstruation.',
    symptoms: [
      'Breast tenderness',
      'Bloating or food cravings',
      'Mood changes or irritability',
      'Lower energy or sleep changes',
    ],
    selfCare: [
      'Prioritise regular sleep',
      'Choose steady meals and reduce excess salt if bloated',
      'Try light exercise, yoga, or breathing exercises',
      'Track severe or unusual symptoms for a clinician',
    ],
    accent: '#fdcb6e',
    softAccent: 'rgba(253, 203, 110, 0.16)',
    icon: 'moon',
  },
  irregular: {
    key: 'irregular',
    title: 'Cycle Timing Varies',
    eyebrow: 'Your cycle may be running longer',
    overview:
      'Your current cycle has gone beyond the expected length. Occasional variation can happen, but repeated or large changes are worth tracking.',
    hormones:
      'Hormonal timing can vary because of stress, sleep, illness, travel, nutrition, PCOS, and other factors.',
    symptoms: [
      'A delayed period',
      'Unpredictable discharge',
      'PMS-like symptoms',
      'Changes from your usual pattern',
    ],
    selfCare: [
      'Keep logging symptoms and cycle dates',
      'Take a pregnancy test when relevant',
      'Maintain regular sleep and meals',
      'Consult a healthcare professional if changes continue',
    ],
    accent: '#95a5a6',
    softAccent: 'rgba(149, 165, 166, 0.16)',
    icon: 'circle-help',
  },
}

export function getCyclePhaseContent(phaseKey) {
  return CYCLE_PHASES[phaseKey] || CYCLE_PHASES.irregular
}

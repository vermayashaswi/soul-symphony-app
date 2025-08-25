import { MusicCategory } from '@/types/music';

export const musicCategories: MusicCategory[] = [
  {
    id: 'sleep',
    name: 'Sleep',
    description: 'Drift into peaceful rest',
    icon: 'Moon',
    color: '#8B5FBF',
    frequencies: [
      { name: 'Deep Sleep Delta', baseFrequency: 200, binauralBeat: 2, duration: 300 },
      { name: 'Sleep Induction', baseFrequency: 180, binauralBeat: 4, duration: 180 },
      { name: 'REM Cycle', baseFrequency: 220, binauralBeat: 6, duration: 600 },
      { name: 'Dream State', baseFrequency: 160, binauralBeat: 1, duration: 240 }
    ]
  },
  {
    id: 'meditation',
    name: 'Meditation',
    description: 'Find inner peace and mindfulness',
    icon: 'Heart',
    color: '#FF6B8A',
    frequencies: [
      { name: 'Alpha Calm', baseFrequency: 200, binauralBeat: 10, duration: 360 },
      { name: 'Theta Deep', baseFrequency: 150, binauralBeat: 6, duration: 480 },
      { name: 'Alpha Flow', baseFrequency: 180, binauralBeat: 8, duration: 300 },
      { name: 'Mindful State', baseFrequency: 220, binauralBeat: 12, duration: 420 }
    ]
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Enhance concentration and productivity',
    icon: 'Brain',
    color: '#4ECDC4',
    frequencies: [
      { name: 'Beta Alert', baseFrequency: 300, binauralBeat: 20, duration: 240 },
      { name: 'Gamma Focus', baseFrequency: 400, binauralBeat: 40, duration: 180 },
      { name: 'SMR Concentration', baseFrequency: 250, binauralBeat: 14, duration: 360 },
      { name: 'High Beta', baseFrequency: 350, binauralBeat: 25, duration: 300 }
    ]
  },
  {
    id: 'relaxation',
    name: 'Relaxation',
    description: 'Unwind and release stress',
    icon: 'Leaf',
    color: '#95E1D3',
    frequencies: [
      { name: 'Alpha Relaxation', baseFrequency: 160, binauralBeat: 10, duration: 300 },
      { name: 'Theta Calm', baseFrequency: 140, binauralBeat: 5, duration: 420 },
      { name: 'Peaceful Alpha', baseFrequency: 200, binauralBeat: 8, duration: 360 },
      { name: 'Stress Relief', baseFrequency: 120, binauralBeat: 7, duration: 480 }
    ]
  },
  {
    id: 'creativity',
    name: 'Creativity',
    description: 'Unlock creative flow and inspiration',
    icon: 'Palette',
    color: '#FFB347',
    frequencies: [
      { name: 'Alpha Creative', baseFrequency: 220, binauralBeat: 10, duration: 360 },
      { name: 'Theta Inspiration', baseFrequency: 150, binauralBeat: 6, duration: 300 },
      { name: 'Creative Flow', baseFrequency: 180, binauralBeat: 8, duration: 420 },
      { name: 'Artistic Mind', baseFrequency: 200, binauralBeat: 9, duration: 300 }
    ]
  },
  {
    id: 'energy',
    name: 'Energy',
    description: 'Boost vitality and motivation',
    icon: 'Zap',
    color: '#FF6B35',
    frequencies: [
      { name: 'Beta Energy', baseFrequency: 320, binauralBeat: 20, duration: 180 },
      { name: 'High Alert', baseFrequency: 380, binauralBeat: 30, duration: 240 },
      { name: 'Motivation Wave', baseFrequency: 280, binauralBeat: 16, duration: 300 },
      { name: 'Power Boost', baseFrequency: 350, binauralBeat: 25, duration: 180 }
    ]
  },
  {
    id: 'anxiety-relief',
    name: 'Anxiety Relief',
    description: 'Calm nerves and reduce stress',
    icon: 'Shield',
    color: '#A8E6CF',
    frequencies: [
      { name: 'Calming Alpha', baseFrequency: 180, binauralBeat: 8, duration: 360 },
      { name: 'Peace Theta', baseFrequency: 140, binauralBeat: 5, duration: 480 },
      { name: 'Gentle Calm', baseFrequency: 160, binauralBeat: 7, duration: 300 },
      { name: 'Stress Release', baseFrequency: 120, binauralBeat: 6, duration: 420 }
    ]
  },
  {
    id: 'deep-work',
    name: 'Deep Work',
    description: 'Enter the zone for focused tasks',
    icon: 'Target',
    color: '#6C5CE7',
    frequencies: [
      { name: 'Focus Beta', baseFrequency: 300, binauralBeat: 18, duration: 300 },
      { name: 'Deep Concentration', baseFrequency: 260, binauralBeat: 15, duration: 480 },
      { name: 'Work Flow', baseFrequency: 320, binauralBeat: 22, duration: 360 },
      { name: 'Sustained Attention', baseFrequency: 280, binauralBeat: 16, duration: 420 }
    ]
  },
  {
    id: 'power-nap',
    name: 'Power Nap',
    description: 'Quick rejuvenation and rest',
    icon: 'Cloud',
    color: '#DDA0DD',
    frequencies: [
      { name: 'Light Sleep', baseFrequency: 100, binauralBeat: 4, duration: 120 },
      { name: 'Restorative Theta', baseFrequency: 140, binauralBeat: 6, duration: 180 },
      { name: 'Quick Rest', baseFrequency: 120, binauralBeat: 5, duration: 90 },
      { name: 'Energy Recovery', baseFrequency: 160, binauralBeat: 8, duration: 150 }
    ]
  }
];
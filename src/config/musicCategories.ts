import { MusicCategory } from '@/types/music';

export const musicCategories: MusicCategory[] = [
  {
    id: 'sleep',
    name: 'Sleep',
    description: 'Deep relaxation and sleep induction',
    icon: 'Moon',
    color: 'hsl(240, 100%, 85%)', // Soft purple
    frequencies: [
      {
        name: 'Deep Sleep Delta 1',
        baseFrequency: 100,
        binauralBeat: 1.5,
        duration: 600 // 10 minutes
      },
      {
        name: 'Deep Sleep Delta 2',
        baseFrequency: 110,
        binauralBeat: 2.5,
        duration: 600
      },
      {
        name: 'REM Sleep',
        baseFrequency: 120,
        binauralBeat: 3.5,
        duration: 600
      },
      {
        name: 'Sleep Transition',
        baseFrequency: 90,
        binauralBeat: 1.0,
        duration: 600
      }
    ]
  },
  {
    id: 'meditation',
    name: 'Meditation',
    description: 'Deep meditation and mindfulness',
    icon: 'Heart',
    color: 'hsl(142, 76%, 65%)', // Soft green
    frequencies: [
      {
        name: 'Theta Meditation 1',
        baseFrequency: 200,
        binauralBeat: 6.0,
        duration: 900 // 15 minutes
      },
      {
        name: 'Theta Meditation 2',
        baseFrequency: 180,
        binauralBeat: 7.0,
        duration: 900
      },
      {
        name: 'Deep Theta',
        baseFrequency: 160,
        binauralBeat: 5.5,
        duration: 900
      },
      {
        name: 'Mindfulness',
        baseFrequency: 220,
        binauralBeat: 6.5,
        duration: 900
      }
    ]
  },
  {
    id: 'focus',
    name: 'Focus',
    description: 'Enhanced concentration and productivity',
    icon: 'Brain',
    color: 'hsl(217, 91%, 65%)', // Bright blue
    frequencies: [
      {
        name: 'Alpha Focus 1',
        baseFrequency: 250,
        binauralBeat: 10.0,
        duration: 1200 // 20 minutes
      },
      {
        name: 'Alpha Focus 2',
        baseFrequency: 280,
        binauralBeat: 12.0,
        duration: 1200
      },
      {
        name: 'Beta Concentration',
        baseFrequency: 300,
        binauralBeat: 15.0,
        duration: 1200
      },
      {
        name: 'Study Mode',
        baseFrequency: 260,
        binauralBeat: 11.0,
        duration: 1200
      }
    ]
  },
  {
    id: 'relaxation',
    name: 'Relaxation',
    description: 'Stress relief and gentle calm',
    icon: 'Leaf',
    color: 'hsl(45, 93%, 65%)', // Warm yellow
    frequencies: [
      {
        name: 'Alpha Relaxation 1',
        baseFrequency: 150,
        binauralBeat: 8.0,
        duration: 720 // 12 minutes
      },
      {
        name: 'Alpha Relaxation 2',
        baseFrequency: 170,
        binauralBeat: 9.0,
        duration: 720
      },
      {
        name: 'Stress Relief',
        baseFrequency: 130,
        binauralBeat: 8.5,
        duration: 720
      },
      {
        name: 'Gentle Calm',
        baseFrequency: 190,
        binauralBeat: 7.5,
        duration: 720
      }
    ]
  }
];
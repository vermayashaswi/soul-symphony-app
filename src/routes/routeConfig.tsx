import { Home } from '@/pages/Home'
import { Insights } from '@/pages/Insights'
import { Journal } from '@/pages/Journal'
import { Auth } from '@/pages/Auth'
import { Settings } from '@/pages/Settings'
import { Focus } from '@/pages/Focus'
import { NotFound } from '@/pages/NotFound'
import { Tutorial } from '@/pages/Tutorial'
import { Onboarding } from '@/pages/Onboarding'
import { Pricing } from '@/pages/Pricing'
import { Legal } from '@/pages/Legal'
import Admin from '@/pages/Admin';

export const routes = [
  {
    path: '/',
    element: <Home />,
    name: 'Home',
    protected: true,
  },
  {
    path: '/insights',
    element: <Insights />,
    name: 'Insights',
    protected: true,
  },
  {
    path: '/journal',
    element: <Journal />,
    name: 'Journal',
    protected: true,
  },
  {
    path: '/auth',
    element: <Auth />,
    name: 'Auth',
    protected: false,
  },
  {
    path: '/settings',
    element: <Settings />,
    name: 'Settings',
    protected: true,
  },
  {
    path: '/focus',
    element: <Focus />,
    name: 'Focus',
    protected: true,
  },
  {
    path: '/tutorial',
    element: <Tutorial />,
    name: 'Tutorial',
    protected: true,
  },
  {
    path: '/onboarding',
    element: <Onboarding />,
    name: 'Onboarding',
    protected: true,
  },
  {
    path: '/pricing',
    element: <Pricing />,
    name: 'Pricing',
    protected: false,
  },
  {
    path: '/legal',
    element: <Legal />,
    name: 'Legal',
    protected: false,
  },
  {
    path: '/admin',
    element: <Admin />,
    name: 'Admin',
    protected: true
  },
  {
    path: '*',
    element: <NotFound />,
    name: 'NotFound',
    protected: false,
  },
]

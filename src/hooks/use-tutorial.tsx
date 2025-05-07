
import { useTutorial as useOriginalTutorial } from '@/contexts/TutorialContext';

/**
 * A hook that provides access to the tutorial context.
 * This is a convenience wrapper that re-exports the context hook.
 */
export function useTutorial() {
  return useOriginalTutorial();
}

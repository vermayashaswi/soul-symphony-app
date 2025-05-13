
import { useCallback } from 'react';

export function useScrollToBottom(ref: React.RefObject<HTMLElement>) {
  const scrollToBottom = useCallback(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [ref]);
  
  return { scrollToBottom };
}

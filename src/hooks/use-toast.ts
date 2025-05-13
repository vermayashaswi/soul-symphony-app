
import { useState, useCallback } from 'react';
import { toast as sonnerToast } from 'sonner';

export interface ToastProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const toast = useCallback(
    ({ title, description, action, variant, duration = 5000 }: ToastProps) => {
      const id = Date.now().toString();
      const newToast = { id, title, description, action, variant };
      
      setToasts((prevToasts) => [...prevToasts, newToast]);
      
      // Also use Sonner for immediate toast feedback
      sonnerToast(title || '', {
        description,
        duration,
        action
      });
      
      return id;
    },
    [setToasts]
  );

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    },
    [setToasts]
  );

  return {
    toasts,
    toast,
    dismiss: dismissToast,
  };
}

// Direct export of the sonner toast for simpler usage
export const toast = sonnerToast;


import { toast as sonnerToast } from 'sonner';

type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  cancel?: React.ReactNode;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
  important?: boolean;
};

export const toast = (props: ToastProps | string) => {
  if (typeof props === 'string') {
    // Simple string toast
    return sonnerToast(props);
  }

  // Object style toast
  const { title, description, action, cancel, duration, position, important } = props;
  
  return sonnerToast(title || '', {
    description,
    action,
    cancel,
    duration,
    position,
    important
  });
};

export const useToast = () => {
  return { toast };
};

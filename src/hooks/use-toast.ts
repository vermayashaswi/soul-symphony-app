
import { toast as sonnerToast } from 'sonner';

// Define the props that can be passed to the toast function
export type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  cancel?: React.ReactNode;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
  important?: boolean;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
};

// Store toasts for the Toaster component to access
const toasts: { id: string | number; title: string; description?: string; action?: React.ReactNode }[] = [];

export const toast = (props: ToastProps | string) => {
  if (typeof props === 'string') {
    // Simple string toast
    const id = sonnerToast(props);
    toasts.push({ id, title: props });
    return id;
  }

  // Object style toast
  const { title, description, action, cancel, duration, position, important, variant } = props;
  
  let variantClass = '';
  if (variant === 'destructive') {
    variantClass = 'destructive';
  } else if (variant === 'success') {
    variantClass = 'success';
  } else if (variant === 'warning') {
    variantClass = 'warning';
  }
  
  const id = sonnerToast(title || '', {
    description,
    action,
    cancel,
    duration,
    position,
    important,
    className: variantClass ? `toast-${variantClass}` : undefined,
  });

  // Store the toast for the Toaster component
  toasts.push({
    id,
    title: title || '',
    description,
    action
  });

  return id;
};

export const useToast = () => {
  return {
    toast,
    toasts,
    dismiss: sonnerToast.dismiss,
    error: (message: string) => toast({ title: 'Error', description: message, variant: 'destructive' }),
    success: (message: string) => toast({ title: 'Success', description: message, variant: 'success' }),
    warning: (message: string) => toast({ title: 'Warning', description: message, variant: 'warning' })
  };
};

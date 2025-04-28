
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/TranslationContext';

let activeToasts: string[] = [];

export const clearAllToasts = () => {
  activeToasts.forEach(id => {
    if (id) toast.dismiss(id);
  });
  activeToasts = [];
};

export const dismissToast = (id: string) => {
  toast.dismiss(id);
  activeToasts = activeToasts.filter(toastId => toastId !== id);
};

export const addToast = (id: string) => {
  activeToasts.push(id);
};

export const getActiveToasts = () => {
  return activeToasts;
};

export const translateAndShowToast = async (
  message: string, 
  type: 'success' | 'error' | 'info' | 'loading' = 'info',
  options: any = {}
) => {
  try {
    const { translate } = useTranslation();
    const translatedMessage = await translate(message);
    
    let toastId;
    
    switch (type) {
      case 'success':
        toastId = toast.success(translatedMessage, options);
        break;
      case 'error':
        toastId = toast.error(translatedMessage, options);
        break;
      case 'loading':
        toastId = toast.loading(translatedMessage, options);
        break;
      default:
        toastId = toast(translatedMessage, options);
    }
    
    if (toastId) {
      addToast(toastId);
    }
    
    return toastId;
  } catch (error) {
    console.error('Error showing translated toast:', error);
    return toast(message, options); // Fallback to original message
  }
};

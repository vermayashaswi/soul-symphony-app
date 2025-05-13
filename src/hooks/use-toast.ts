
import { toast as sonnerToast, ToastT, type ToasterProps } from "sonner";

type ToastProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive" | "success";
  duration?: number;
};

export function toast(props: ToastProps) {
  const { title, description, variant, action, duration } = props;
  
  // Map variant to sonner toast types
  if (variant === "destructive") {
    return sonnerToast.error(title, { description, action, duration });
  } else if (variant === "success") {
    return sonnerToast.success(title, { description, action, duration });
  }
  
  // Default toast
  return sonnerToast(title, { description, action, duration });
}

// Sonner doesn't export a useToast hook directly, so we'll create a simple wrapper
// that provides the toast instance from sonner
export const useToast = () => {
  return {
    toast,
    // We need to provide the expected interface that matches what our components expect
    toasts: [] as ToastT[],
  };
};

export type Toast = ToastT;

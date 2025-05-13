
import { toast as sonnerToast, ToastT, useToaster } from "sonner";

type ToastProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive" | "success";
};

export function toast(props: ToastProps) {
  const { title, description, variant, action } = props;
  
  // Map variant to sonner toast types
  if (variant === "destructive") {
    return sonnerToast.error(title, { description, action });
  } else if (variant === "success") {
    return sonnerToast.success(title, { description, action });
  }
  
  // Default toast
  return sonnerToast(title, { description, action });
}

export const useToast = useToaster;
export type Toast = ToastT;

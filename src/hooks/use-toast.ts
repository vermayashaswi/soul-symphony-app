
import * as React from "react";
import {
  toast as toastPrimitive,
  type ToastActionElement,
} from "@/components/ui/toast";

export type ToastProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: "default" | "destructive" | "success" | "warning" | "info"
  duration?: number
}

export const useToast = () => {
  return {
    toast: (props: ToastProps) => toastPrimitive(props),
    dismiss: (toastId?: string) => toastPrimitive.dismiss(toastId),
  };
};

export const toast = toastPrimitive;

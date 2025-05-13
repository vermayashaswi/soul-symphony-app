
import * as React from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast as useToastPrimitive } from "@/components/ui/use-toast"

export type ToasterToast = React.ComponentPropsWithoutRef<typeof Toast> & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "destructive" | "success" | "warning" | "info"
}

export type ToastProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: "default" | "destructive" | "success" | "warning" | "info"
}

export const useToast = () => {
  const toastContext = useToastPrimitive()
  
  return {
    ...toastContext,
    toast: (props: ToastProps | string) => {
      const id = Math.random().toString(36).substring(2, 9)
      if (typeof props === "string") {
        return toastContext.toast({
          title: props,
          id,
        })
      }
      return toastContext.toast({ ...props, id })
    },
    toasts: toastContext.toasts ?? [],
  }
}

export const toast = (props: ToastProps | string) => {
  const { toast } = useToast()
  return toast(props)
}

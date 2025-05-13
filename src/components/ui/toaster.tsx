
"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useTheme } from "@/hooks/use-theme"
import { useToast } from "@/hooks/use-toast"

export function Toaster() {
  const { toasts } = useToast()
  const { theme, systemTheme } = useTheme();
  
  // Determine dark mode based on theme settings
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Extract any 'variant' property to avoid passing it to the Toast component
        const { variant, ...restProps } = props
        
        return (
          <Toast 
            key={id} 
            {...restProps} 
            className={
              isDarkMode
                ? "bg-theme border-white/10 text-black shadow-lg"
                : ""
            }
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

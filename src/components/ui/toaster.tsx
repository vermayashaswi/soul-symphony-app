
import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useTheme } from "@/hooks/use-theme"

export function Toaster() {
  const { toasts } = useToast()
  const { theme, systemTheme } = useTheme()
  
  // Determine if we're in dark mode
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Ensure we don't pass the incompatible 'type' property to Toast
        // Extract any 'type' property to avoid passing it to the Toast component
        const { type, ...restProps } = props
        
        return (
          <Toast 
            key={id} 
            {...restProps} 
            className={
              isDarkMode
                ? "bg-theme border-white/10 text-black shadow-lg"
                : "bg-theme border-black/10 text-black shadow-lg"
            }
          >
            <div className="grid gap-1">
              {title && (
                <ToastTitle className="text-black">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="text-black">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action && typeof action === 'object' && React.isValidElement(action) ? action : null}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}


import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useSafeTheme } from "@/hooks/use-safe-theme"

export function Toaster() {
  const { toasts } = useToast()
  const { isDarkMode } = useSafeTheme()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Remove any properties that Toast component doesn't accept
        const { duration, dismissible, ...restProps } = props
        
        // Ensure we always have an id
        const toastId = id || crypto.randomUUID()
        
        // Map variant from our expanded set to the Toast component's supported variants
        // Default to 'default' if the variant is not one of the accepted ones
        const mappedVariant = variant === 'default' || variant === 'destructive' 
          ? variant 
          : 'default'
        
        return (
          <Toast 
            key={toastId} 
            {...restProps} 
            variant={mappedVariant}
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

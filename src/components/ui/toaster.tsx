
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
        return (
          <Toast 
            key={id} 
            {...props} 
            className={
              isDarkMode
                ? "bg-theme border-white/10 text-white shadow-lg"
                : "bg-theme border-black/10 text-black shadow-lg"
            }
          >
            <div className="grid gap-1">
              {title && (
                <ToastTitle className={isDarkMode ? "text-white" : "text-black"}>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className={isDarkMode ? "text-white/90" : "text-black/90"}>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

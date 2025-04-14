
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
                ? "bg-slate-800 border border-slate-700 text-white shadow-lg"
                : "bg-white border border-slate-200 text-black shadow-lg"
            }
          >
            <div className="grid gap-1">
              {title && (
                <ToastTitle className={
                  isDarkMode 
                    ? "text-white font-semibold" 
                    : "text-black font-semibold"
                }>
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className={
                  isDarkMode 
                    ? "text-white/90 font-normal" 
                    : "text-black/90 font-normal"
                }>
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

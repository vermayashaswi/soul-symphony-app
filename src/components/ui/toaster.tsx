
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useTheme } from "@/hooks/use-theme"
import { useEffect, useState } from "react"

export function Toaster() {
  const { toasts } = useToast()
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  // Try to safely use theme context
  let themeContextAvailable = true
  let themeData = { theme: 'light', systemTheme: 'light' }
  
  try {
    themeData = useTheme()
  } catch (error) {
    console.error("Theme context not available yet:", error)
    themeContextAvailable = false
  }
  
  // Only access theme values if context is available
  useEffect(() => {
    if (themeContextAvailable) {
      const { theme, systemTheme } = themeData
      setIsDarkMode(theme === 'dark' || (theme === 'system' && systemTheme === 'dark'))
    }
  }, [themeContextAvailable, themeData])

  // Don't render anything if theme context isn't available
  if (!themeContextAvailable) {
    console.log("Skipping Toaster render - theme context not available")
    return null
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast 
            key={id} 
            {...props} 
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
            {action}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}


import React from "react";
import { useTheme } from "@/hooks/use-theme"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  const { theme, systemTheme, colorTheme } = useTheme()
  
  // Determine if we're in dark mode
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  return (
    <Sonner
      theme={isDarkMode ? "dark" : "light"}
      className="toaster group sonner-wrapper"
      closeButton
      richColors
      toastOptions={{
        duration: 3000, // Shorter duration to reduce toast collisions
        classNames: {
          toast: isDarkMode
            ? "group bg-theme text-black font-medium border border-white/10 sonner-toast-element" 
            : "group bg-theme text-black font-medium border border-black/10 sonner-toast-element",
          title: "text-black font-semibold",
          description: "text-black font-normal",
          actionButton: "bg-primary text-primary-foreground font-medium",
          closeButton: "text-black/50 hover:text-black"
        },
        style: {
          zIndex: 1000, // Ensure consistent z-index
          position: 'relative' // Ensure position is set
        }
      }}
      {...props}
    />
  )
}

export { Toaster }

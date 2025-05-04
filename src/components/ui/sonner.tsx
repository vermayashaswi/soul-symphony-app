
import { useEffect, useState } from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  
  // Safely get theme from localStorage instead of context to avoid dependency issues
  useEffect(() => {
    const savedTheme = localStorage.getItem('feelosophy-theme') as 'light' | 'dark' | 'system' || 'system'
    
    if (savedTheme === 'system') {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(isSystemDark ? 'dark' : 'light')
    } else {
      setTheme(savedTheme === 'dark' ? 'dark' : 'light')
    }
    
    // Listen for theme changes
    const handleThemeChange = () => {
      const currentTheme = localStorage.getItem('feelosophy-theme') as 'light' | 'dark' | 'system' || 'system'
      
      if (currentTheme === 'system') {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setTheme(isSystemDark ? 'dark' : 'light')
      } else {
        setTheme(currentTheme === 'dark' ? 'dark' : 'light')
      }
    }
    
    // Listen for storage events to catch theme changes
    window.addEventListener('storage', handleThemeChange)
    document.addEventListener('themeChange', handleThemeChange as EventListener)
    
    return () => {
      window.removeEventListener('storage', handleThemeChange)
      document.removeEventListener('themeChange', handleThemeChange as EventListener)
    }
  }, [])

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: theme === 'dark'
            ? "group bg-theme text-black font-medium border border-white/10" 
            : "group bg-theme text-black font-medium border border-black/10",
          title: "text-black font-semibold",
          description: "text-black font-normal",
          actionButton: "bg-primary text-primary-foreground font-medium",
          closeButton: "text-black/50 hover:text-black"
        }
      }}
      {...props}
    />
  )
}

export { Toaster }

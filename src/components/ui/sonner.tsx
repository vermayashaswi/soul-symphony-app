
import { useTheme } from "@/hooks/use-theme"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  const { theme, systemTheme } = useTheme()
  
  // Determine if we're in dark mode
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  return (
    <Sonner
      theme={isDarkMode ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: isDarkMode
            ? "group bg-slate-800 border-slate-700 text-black font-medium"
            : "group bg-white border-slate-200 text-black font-medium",
          title: isDarkMode 
            ? "text-black font-semibold" 
            : "text-black font-semibold",
          description: isDarkMode 
            ? "text-black font-normal" 
            : "text-black/90 font-normal",
          actionButton: "bg-primary text-primary-foreground font-medium",
          closeButton: isDarkMode
            ? "text-black/50 hover:text-black" 
            : "text-black/50 hover:text-black"
        }
      }}
      {...props}
    />
  )
}

export { Toaster }

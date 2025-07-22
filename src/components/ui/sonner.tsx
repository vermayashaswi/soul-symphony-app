
import { useTheme } from "@/hooks/use-theme"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  // Safely access theme context with fallback
  let theme = 'light';
  let systemTheme = 'light';
  let colorTheme = 'blue';
  
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    systemTheme = themeContext.systemTheme;
    colorTheme = themeContext.colorTheme;
  } catch (error) {
    // Fallback to default values if theme context isn't available
    console.warn('Theme context not available, using defaults');
  }
  
  // Determine if we're in dark mode
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark')

  return (
    <Sonner
      theme={isDarkMode ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: isDarkMode
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


import { useSafeTheme } from "@/hooks/use-safe-theme"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  const { isDarkMode } = useSafeTheme()

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


import { useTheme } from "@/hooks/use-theme";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group z-[100]" // Increased z-index for better visibility
      // Short duration (1000ms = 1 second) for regular notifications
      duration={1000}
      closeButton={false} // Remove close button
      richColors={true} // Use rich colors for better visibility
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg dark:group-[.toaster]:text-white",
          description: "group-[.toast]:text-muted-foreground dark:group-[.toast]:text-white/80",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground dark:group-[.toast]:text-white/80",
          title: "font-medium dark:group-[.toast]:text-white",
          info: "dark:group-[.toast]:text-white group-[.toast]:text-black font-medium",
          success: "dark:group-[.toast]:text-white group-[.toast]:text-black font-medium",
          warning: "dark:group-[.toast]:text-white group-[.toast]:text-black font-medium",
          error: "dark:group-[.toast]:text-white group-[.toast]:text-black font-medium",
          loader: "dark:group-[.toast]:border-t-white/80 dark:group-[.toast]:border-l-white/80"
        },
        style: {
          // Add stronger contrast to make toast more visible
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          border: "1px solid var(--border)",
          padding: "16px",
          fontSize: "14px",
          fontWeight: "500",
          // Higher contrast background for light/dark modes
          background: "var(--background)",
          color: "var(--foreground)",
        }
      }}
      // Enable swipe to dismiss in all directions
      swipeDirection={["up", "down", "left", "right"]}
      // Ensure swipe gestures work properly
      swipeThreshold={10} // Lower threshold to make swipe more responsive
      {...props}
    />
  )
}

export { Toaster }

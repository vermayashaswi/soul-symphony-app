
import { useTheme } from "@/hooks/use-theme";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme, colorTheme } = useTheme();
  
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group z-[100]"
      duration={5000}
      closeButton={true}
      richColors={true}
      expand={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:border-theme-color/30 dark:group-[.toaster]:bg-background/95 dark:group-[.toaster]:text-foreground dark:group-[.toaster]:border-theme-color/30",
          description: "group-[.toast]:text-foreground dark:group-[.toast]:text-foreground",
          actionButton:
            "group-[.toast]:bg-theme-color group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          title: "font-medium text-foreground dark:text-foreground",
          info: "!bg-blue-600 !text-white dark:!bg-blue-700 dark:!text-white font-medium border-2 border-blue-700",
          success: "!bg-theme-color !text-white dark:!bg-theme-color dark:!text-white font-medium border-2 border-theme-darker",
          warning: "!bg-amber-500 !text-black dark:!bg-amber-600 dark:!text-black font-medium border-2 border-amber-600",
          error: "!bg-red-600 !text-white dark:!bg-red-700 dark:!text-white font-medium border-2 border-red-700",
          loader: "text-theme-color dark:text-theme-color"
        },
        style: {
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--color-theme)",
          padding: "16px",
          fontSize: "14px",
          fontWeight: "500",
          color: "var(--foreground)",
          borderRadius: "var(--radius)",
        }
      }}
      {...props}
    />
  )
}

export { Toaster }

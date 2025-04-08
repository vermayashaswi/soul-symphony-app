
import { useTheme } from "@/hooks/use-theme";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

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
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-background dark:group-[.toaster]:text-foreground dark:group-[.toaster]:border-border",
          description: "group-[.toast]:text-foreground dark:group-[.toast]:text-foreground/90",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          title: "font-medium text-foreground dark:text-foreground",
          info: "!bg-blue-600 !text-white dark:!bg-blue-600 dark:!text-white font-medium border-2 border-blue-700",
          success: "!bg-green-600 !text-white dark:!bg-green-600 dark:!text-white font-medium border-2 border-green-700",
          warning: "!bg-amber-500 !text-black dark:!bg-amber-500 dark:!text-black font-medium border-2 border-amber-600",
          error: "!bg-red-600 !text-white dark:!bg-red-600 dark:!text-white font-medium border-2 border-red-700",
          loader: "text-primary dark:text-primary-foreground"
        },
        style: {
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--border)",
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

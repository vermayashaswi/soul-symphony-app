
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "@/hooks/use-theme"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const { colorTheme } = useTheme()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="bg-background border-2 border-theme-color/70 shadow-lg dark:bg-background/90 dark:border-theme-color/50 dark:text-foreground">
            <div className="grid gap-1">
              {title && <ToastTitle className="text-foreground font-semibold dark:text-foreground">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-foreground dark:text-foreground">{description}</ToastDescription>
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

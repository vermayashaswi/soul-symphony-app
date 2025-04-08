
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="bg-background border-2 border-primary shadow-lg dark:bg-background dark:border-primary dark:text-foreground">
            <div className="grid gap-1">
              {title && <ToastTitle className="text-foreground font-semibold dark:text-foreground">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-foreground dark:text-foreground/90">{description}</ToastDescription>
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

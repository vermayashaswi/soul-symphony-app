
// This component is responsible for rendering toast notifications
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  // Adding a fallback for when toasts is undefined
  if (!toasts || !toasts.length) {
    return (
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        // Extract any properties that shouldn't be passed to the Toast component
        const { variant, type, onOpenChange, ...restProps } = props as any;
        
        return (
          <Toast key={id} {...restProps}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

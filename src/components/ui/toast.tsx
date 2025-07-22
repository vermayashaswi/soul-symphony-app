import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useSwipeGesture } from "@/hooks/use-swipe-gesture"
import { X } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border font-medium",
        destructive:
          "destructive group border-destructive bg-destructive font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  const toastRef = React.useRef<React.ElementRef<typeof ToastPrimitives.Root>>(null);
  const { onOpenChange } = props;
  
  // Safely access theme context with fallback
  let colorTheme = 'blue';
  let theme = 'light';
  let systemTheme = 'light';
  
  try {
    const themeContext = useTheme();
    colorTheme = themeContext.colorTheme;
    theme = themeContext.theme;
    systemTheme = themeContext.systemTheme;
  } catch (error) {
    // Fallback to default values if theme context isn't available
    console.warn('Theme context not available in toast, using defaults');
  }
  
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  
  useSwipeGesture(toastRef as React.RefObject<HTMLElement>, {
    onSwipeLeft: () => onOpenChange?.(false),
    onSwipeRight: () => onOpenChange?.(false),
    onSwipeUp: () => onOpenChange?.(false),
    minDistance: 30,
  });
  
  return (
    <ToastPrimitives.Root
      ref={(node) => {
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
        if (toastRef) {
          toastRef.current = node;
        }
      }}
      className={cn(
        toastVariants({ variant }), 
        className, 
        "bg-theme border-theme/30",
        "text-black"
      )}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-black group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => {
  return (
    <ToastPrimitives.Close
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-full p-1 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
        "text-black/50 hover:text-black focus:ring-black",
        className
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </ToastPrimitives.Close>
  );
})
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => {
  return (
    <ToastPrimitives.Title
      ref={ref}
      className={cn(
        "text-sm font-semibold text-black",
        className
      )}
      {...props}
    />
  );
})
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => {
  return (
    <ToastPrimitives.Description
      ref={ref}
      className={cn(
        "text-sm opacity-90 font-normal text-black/90",
        className
      )}
      {...props}
    />
  );
})
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
}

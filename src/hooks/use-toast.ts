
import * as React from "react"
import { toast as sonnerToast, type Toast as SonnerToast } from "sonner"

// Define the toast type for our application
export interface ToasterToast extends SonnerToast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: "default" | "destructive" | "success"
  duration?: number
}

// Create a context to store and retrieve toasts
const ToastContext = React.createContext<{
  toasts: ToasterToast[]
  addToast: (toast: ToasterToast) => void
  removeToast: (id: string) => void
}>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

// Provider component to manage toasts
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  const addToast = React.useCallback((toast: ToasterToast) => {
    setToasts((prev) => [...prev, { ...toast, id: toast.id || crypto.randomUUID() }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

// Hook to use toast functionality
export function useToast() {
  const context = React.useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}

// Helper function to create a toast
export function toast({
  title,
  description,
  variant = "default",
  duration = 5000,
  action,
  ...props
}: Partial<ToasterToast> & { description?: string }) {
  // Use the sonner toast directly
  return sonnerToast(title || "", {
    description,
    duration,
    // Map our variant to sonner toast styling
    className: variant === "destructive" ? "bg-destructive text-destructive-foreground" : "",
    action,
    ...props,
  })
}

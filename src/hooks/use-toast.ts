
import { useState, useCallback } from 'react'
import { createStore } from '@/lib/store'
import { ToasterToast } from '@/components/ui/toaster'

interface ToastData {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: 'default' | 'destructive' | 'success' | 'info' | 'warning'
  duration?: number
  dismissible?: boolean
}

const store = createStore<ToastData[]>([])

export const useToastStore = store

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>(store.get())

  const createToast = useCallback((data: ToasterToast) => {
    const id = crypto.randomUUID()
    const toast = { ...data, id }

    setToasts((toasts) => [...toasts, toast])

    const newToasts = store.get().concat(toast)
    store.set(newToasts)

    return {
      id,
      dismiss: () => dismissToast(id),
      update: (data: ToasterToast) => updateToast(id, data),
    }
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((toasts) => toasts.filter((toast) => toast.id !== id))
    store.set(store.get().filter((toast) => toast.id !== id))
  }, [])

  const updateToast = useCallback((id: string, data: ToasterToast) => {
    setToasts((toasts) =>
      toasts.map((toast) => (toast.id === id ? { ...toast, ...data } : toast))
    )
    store.set(
      store
        .get()
        .map((toast) => (toast.id === id ? { ...toast, ...data } : toast))
    )
  }, [])

  const toast = useCallback(
    (data: ToasterToast) => createToast(data),
    [createToast]
  )

  toast.dismiss = useCallback(
    (id: string) => dismissToast(id),
    [dismissToast]
  )

  toast.update = useCallback(
    (id: string, data: ToasterToast) => updateToast(id, data),
    [updateToast]
  )

  return {
    toast,
    toasts,
    dismiss: dismissToast,
    update: updateToast,
  }
}

// Create direct toast function for easier import
export const toast = ((data) => {
  return store.get().concat({
    id: crypto.randomUUID(),
    ...data,
  })
}) as unknown as ((data: ToasterToast) => void) & {
  dismiss: (id: string) => void
  update: (id: string, data: ToasterToast) => void
}

toast.dismiss = (id) => {
  store.set(store.get().filter((toast) => toast.id !== id))
}

toast.update = (id, data) => {
  store.set(
    store
      .get()
      .map((toast) => (toast.id === id ? { ...toast, ...data } : toast))
  )
}

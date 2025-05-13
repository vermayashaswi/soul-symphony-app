
import { useState, useCallback } from 'react'

// Define ToasterToast type with id as optional
export type ToasterToast = {
  id?: string  // Make id optional
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  variant?: 'default' | 'destructive' | 'success' | 'info' | 'warning'
  duration?: number
  dismissible?: boolean
}

// Simple store implementation to replace the missing @/lib/store dependency
const createSimpleStore = <T,>(initialState: T) => {
  let state = initialState
  const listeners: Array<(state: T) => void> = []

  return {
    get: () => state,
    set: (newState: T) => {
      state = newState
      listeners.forEach(listener => listener(state))
    },
    subscribe: (listener: (state: T) => void) => {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }
}

// Ensure all stored toasts have an ID
type ToasterToastWithId = ToasterToast & { id: string }

const store = createSimpleStore<ToasterToastWithId[]>([])

export const useToastStore = store

export function useToast() {
  const [toasts, setToasts] = useState<ToasterToastWithId[]>(store.get())

  const createToast = useCallback((data: ToasterToast) => {
    // Generate ID if not provided
    const id = data.id || crypto.randomUUID()
    const toast = { ...data, id } as ToasterToastWithId

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
      toasts.map((toast) => (toast.id === id ? { ...toast, ...data, id } : toast))
    )
    store.set(
      store
        .get()
        .map((toast) => (toast.id === id ? { ...toast, ...data, id } : toast))
    )
  }, [])

  const toast = useCallback(
    (data: ToasterToast) => createToast(data),
    [createToast]
  ) as ((data: ToasterToast) => {
    id: string
    dismiss: () => void
    update: (data: ToasterToast) => void
  }) & {
    dismiss: (id: string) => void
    update: (id: string, data: ToasterToast) => void
  }

  // Properly define the methods on the toast function
  toast.dismiss = dismissToast
  toast.update = updateToast

  return {
    toast,
    toasts,
    dismiss: dismissToast,
    update: updateToast,
  }
}

// Create direct toast function for easier import
const toastFunction = ((data: ToasterToast) => {
  // Generate ID if not provided
  const id = data.id || crypto.randomUUID()
  const toast = { ...data, id } as ToasterToastWithId
  const currentToasts = store.get()
  store.set([...currentToasts, toast])
  return {
    id,
    dismiss: () => store.set(store.get().filter(t => t.id !== id)),
    update: (newData: ToasterToast) => store.set(
      store.get().map(t => t.id === id ? { ...t, ...newData, id } : t)
    )
  }
}) as ((data: ToasterToast) => {
  id: string
  dismiss: () => void
  update: (data: ToasterToast) => void
}) & {
  dismiss: (id: string) => void
  update: (id: string, data: ToasterToast) => void
}

toastFunction.dismiss = (id: string) => {
  store.set(store.get().filter((toast) => toast.id !== id))
}

toastFunction.update = (id: string, data: ToasterToast) => {
  store.set(
    store
      .get()
      .map((toast) => (toast.id === id ? { ...toast, ...data, id } : toast))
  )
}

export const toast = toastFunction

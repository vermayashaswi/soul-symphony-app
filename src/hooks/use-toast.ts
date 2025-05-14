
// Import from the UI components
import { useToast as useToastInternal } from "@/components/ui/toast";
import { toast as toastInternal } from "@/components/ui/toast";
import { type ToasterToast } from "@/components/ui/toast";

// Re-export for use throughout the app
export const useToast = useToastInternal;
export const toast = toastInternal;
export type { ToasterToast };

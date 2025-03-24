
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'MMMM d, yyyy');
}

export function formatTime(dateString: string): string {
  return format(new Date(dateString), 'h:mm a');
}


import { useTheme } from "@/hooks/use-theme"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Empty Sonner component for website - no toast notifications
function Toaster({ ...props }: ToasterProps) {
  return null;
}

export { Toaster }

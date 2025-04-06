
import { useTheme } from "@/hooks/use-theme";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={1000} // Set 1 second duration
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg dark:group-[.toaster]:text-white",
          description: "group-[.toast]:text-muted-foreground dark:group-[.toast]:text-white/80",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground dark:group-[.toast]:text-white/80",
          title: "dark:group-[.toast]:text-white",
          info: "dark:group-[.toast]:text-white group-[.toast]:text-black",
          success: "dark:group-[.toast]:text-white group-[.toast]:text-black",
          warning: "dark:group-[.toast]:text-white group-[.toast]:text-black",
          error: "dark:group-[.toast]:text-white group-[.toast]:text-black",
          closeButton: "dark:group-[.toast]:text-white/70 dark:group-[.toast]:hover:text-white group-[.toast]:text-black/70 group-[.toast]:hover:text-black"
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

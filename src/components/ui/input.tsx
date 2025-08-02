import * as React from "react"
import { cn } from "@/lib/utils"

interface EnhancedInputProps extends React.ComponentProps<"input"> {
  mobileOptimized?: boolean;
  keyboardAware?: boolean;
  preventSwipeConflicts?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({ 
    className, 
    type, 
    mobileOptimized = true, 
    keyboardAware = true, 
    preventSwipeConflicts = true,
    onFocus,
    onBlur,
    ...props 
  }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = React.useState(false);

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    // Enhanced focus handling for mobile optimization
    const handleFocus = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      
      if (mobileOptimized) {
        // Add input-focused class for better mobile handling
        e.target.classList.add('input-focused');
        document.body.classList.add('input-active');
        
        // Ensure proper touch policies for this input
        e.target.style.touchAction = 'manipulation';
        e.target.style.userSelect = 'text';
        e.target.style.webkitUserSelect = 'text';
      }

      if (keyboardAware) {
        // Dispatch custom event for keyboard-aware components
        window.dispatchEvent(new CustomEvent('inputFocus', { 
          detail: { 
            element: e.target,
            inputType: type || 'text'
          } 
        }));
      }

      // Scroll into view on mobile with safe area consideration
      if (mobileOptimized && window.innerWidth <= 768) {
        setTimeout(() => {
          e.target.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest' 
          });
        }, 300); // Wait for keyboard animation
      }

      onFocus?.(e);
    }, [mobileOptimized, keyboardAware, onFocus, type]);

    const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      if (mobileOptimized) {
        e.target.classList.remove('input-focused');
        document.body.classList.remove('input-active');
      }

      if (keyboardAware) {
        window.dispatchEvent(new CustomEvent('inputBlur', { 
          detail: { 
            element: e.target,
            inputType: type || 'text'
          } 
        }));
      }

      onBlur?.(e);
    }, [mobileOptimized, keyboardAware, onBlur, type]);

    // Enhanced class names for better mobile support
    const enhancedClassName = cn(
      // Base styles
      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "md:text-sm",
      
      // Mobile optimizations
      mobileOptimized && [
        "touch-manipulation", // Better touch handling
        "select-text", // Allow text selection
        "font-size-16", // Prevent zoom on iOS
      ],
      
      // Keyboard awareness
      keyboardAware && [
        "keyboard-aware",
      ],
      
      // Swipe conflict prevention
      preventSwipeConflicts && [
        "swipe-safe",
        "touch-action-manipulation",
      ],
      
      // Focus state classes
      isFocused && [
        "input-focused",
      ],
      
      className
    );

    // Enhanced input props for mobile
    const enhancedProps = {
      ...props,
      // Mobile-optimized defaults
      autoComplete: props.autoComplete ?? "off",
      autoCorrect: props.autoCorrect ?? "on",
      autoCapitalize: props.autoCapitalize ?? "sentences",
      spellCheck: props.spellCheck ?? true,
      inputMode: props.inputMode ?? "text",
      
      // Enhanced data attributes for better detection
      'data-input': 'true',
      'data-mobile-optimized': mobileOptimized,
      'data-keyboard-aware': keyboardAware,
      'data-prevent-swipe': preventSwipeConflicts,
    };

    return (
      <input
        type={type}
        className={enhancedClassName}
        ref={inputRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...enhancedProps}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
export type { EnhancedInputProps }

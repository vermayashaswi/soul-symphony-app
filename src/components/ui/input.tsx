
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
    onChange,
    ...props 
  }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = React.useState(false);
    const [isComposing, setIsComposing] = React.useState(false);

    // Combine refs
    React.useImperativeHandle(ref, () => inputRef.current!);

    // Handle composition events for better swipe typing (Android)
    const handleCompositionStart = React.useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
      setIsComposing(true);
      console.log('[Input] Composition started');
    }, []);

    const handleCompositionUpdate = React.useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
      if (onChange && e.target instanceof HTMLInputElement) {
        // Create synthetic event for immediate feedback during composition
        const syntheticEvent = {
          target: { value: e.target.value },
          currentTarget: e.target
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }, [onChange]);

    const handleCompositionEnd = React.useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
      setIsComposing(false);
      console.log('[Input] Composition ended');
      
      if (onChange && e.target instanceof HTMLInputElement) {
        // Ensure final value is captured
        const syntheticEvent = {
          target: { value: e.target.value },
          currentTarget: e.target
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }, [onChange]);

    // Enhanced change handler that works with composition
    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e);
      }
    }, [onChange]);

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
      
      // Focus and composition state classes
      isFocused && "input-focused",
      isComposing && "input-composing",
      
      className
    );

    // Enhanced input props for mobile and composition
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
      'data-composing': isComposing,
    };

    return (
      <input
        type={type}
        className={enhancedClassName}
        ref={inputRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
        {...enhancedProps}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
export type { EnhancedInputProps }

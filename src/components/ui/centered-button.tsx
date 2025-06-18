
import React from 'react';
import { cn } from '@/lib/utils';

interface CenteredButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CenteredButton({ 
  children, 
  className, 
  variant = 'default',
  size = 'default',
  ...props 
}: CenteredButtonProps) {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";
  
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input hover:bg-accent hover:text-accent-foreground"
  };
  
  const sizes = {
    default: "h-10 py-2 px-4",
    sm: "h-9 px-3 rounded-md",
    lg: "h-11 px-8 rounded-md", 
    icon: "h-10 w-10"
  };

  // Enhanced centering for arrow buttons and navigation elements
  const centeringStyles = "relative transform-gpu";
  
  // Specific fixes for arrow button centering issues
  const arrowButtonFixes = `
    /* Ensure perfect centering for arrow buttons */
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    
    /* Fix for native app centering */
    box-sizing: border-box !important;
    min-height: 44px !important; /* Touch-friendly minimum */
    min-width: 44px !important;
    
    /* Prevent layout shifts */
    flex-shrink: 0 !important;
    
    /* Center child elements */
    & > * {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
  `;

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        centeringStyles,
        className
      )}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minHeight: size === 'icon' ? '44px' : undefined,
        minWidth: size === 'icon' ? '44px' : undefined,
        flexShrink: 0
      }}
      {...props}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}>
        {children}
      </div>
    </button>
  );
}

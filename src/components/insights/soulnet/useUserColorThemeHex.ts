
export function useUserColorThemeHex() {
  // Return safe defaults without using theme context
  // This prevents the hook from throwing when ThemeProvider isn't available
  let colorTheme = 'Default';
  let customColor = '#3b82f6';
  
  // For now, just use defaults to prevent the error
  // TODO: Implement proper theme integration once provider is stable
  switch (colorTheme) {
    case 'Default':
      return '#3b82f6';
    case 'Calm':
      return '#8b5cf6';
    case 'Soothing':
      return '#FFDEE2';
    case 'Energy':
      return '#f59e0b';
    case 'Focus':
      return '#10b981';
    case 'Custom':
      return customColor || '#3b82f6';
    default:
      return '#3b82f6';
  }
}

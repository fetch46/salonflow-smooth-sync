// Initialize theme on app load
export function initializeTheme() {
  // Check if theme colors are already stored
  const storedPrimary = localStorage.getItem('theme-primary');
  
  // If no theme is stored, apply the default Ocean Blue theme
  if (!storedPrimary) {
    const defaultTheme = {
      primary: '217 91% 60%',
      secondary: '220 14% 96%',
      accent: '220 14% 96%',
    };
    
    // Apply theme to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', defaultTheme.primary);
    root.style.setProperty('--theme-primary-foreground', computeForeground(defaultTheme.primary));
    root.style.setProperty('--secondary', defaultTheme.secondary);
    root.style.setProperty('--secondary-foreground', computeForeground(defaultTheme.secondary));
    root.style.setProperty('--accent', defaultTheme.accent);
    root.style.setProperty('--accent-foreground', computeForeground(defaultTheme.accent));
    
    // Store in localStorage
    localStorage.setItem('theme-primary', defaultTheme.primary);
    localStorage.setItem('theme-primary-foreground', computeForeground(defaultTheme.primary));
    localStorage.setItem('theme-secondary', defaultTheme.secondary);
    localStorage.setItem('theme-secondary-foreground', computeForeground(defaultTheme.secondary));
    localStorage.setItem('theme-accent', defaultTheme.accent);
    localStorage.setItem('theme-accent-foreground', computeForeground(defaultTheme.accent));
  }
}

function computeForeground(hsl: string): string {
  try {
    const parts = hsl.split(' ');
    const lightnessStr = parts[2] || '';
    const lightness = parseInt(lightnessStr.replace('%', ''));
    if (isNaN(lightness)) return '0 0% 100%';
    // Improved threshold for better readability
    return lightness < 60 ? '0 0% 100%' : '0 0% 9%';
  } catch {
    return '0 0% 100%';
  }
}
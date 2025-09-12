// Initialize theme on app load
export function initializeTheme() {
  // Check if theme colors are already stored
  const storedPrimary = localStorage.getItem('theme-primary');
  
  // If no theme is stored, apply the default Blue theme
  if (!storedPrimary) {
    const defaultTheme = {
      primary: '221 83% 53%',
      secondary: '217 19% 94%',
      accent: '210 40% 96.1%',
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
    return lightness < 50 ? '0 0% 100%' : '0 0% 13%';
  } catch {
    return '0 0% 100%';
  }
}
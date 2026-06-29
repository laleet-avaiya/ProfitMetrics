import { useState, useEffect, type ReactNode } from 'react';
import { ThemeContext } from './ThemeContextInstance';
import type { Theme } from './ThemeContext.types';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Apply theme helper function
  const applyTheme = (themeValue: Theme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(themeValue);
    root.setAttribute('data-theme', themeValue);
    root.style.colorScheme = themeValue;
  };

  // Initialize theme
  const getInitialTheme = (): Theme => {
    // Check localStorage first
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'dark' || saved === 'light') {
      applyTheme(saved);
      return saved;
    }
    
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
      return 'dark';
    }
    
    applyTheme('light');
    return 'light';
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    // Apply theme to document root
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  /* Print preview uses the document canvas; inline color-scheme: dark can paint it black. */
  useEffect(() => {
    const restore = () => applyTheme(theme);
    const beforePrint = () => {
      document.documentElement.style.setProperty('color-scheme', 'light', 'important');
    };
    const afterPrint = () => {
      document.documentElement.style.removeProperty('color-scheme');
      restore();
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}


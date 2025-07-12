import { useState, useEffect, useCallback } from 'react';

export type AccessibilityMode = 'normal' | 'high-contrast' | 'dark-high-contrast';

interface AccessibilitySettings {
  mode: AccessibilityMode;
  reduceMotion: boolean;
  largeText: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
}

const defaultSettings: AccessibilitySettings = {
  mode: 'normal',
  reduceMotion: false,
  largeText: false,
  screenReaderMode: false,
  keyboardNavigation: true,
};

export const useAccessibility = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    
    const saved = localStorage.getItem('shareZidiAccessibility');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    
    // Auto-detect system preferences
    const autoSettings = { ...defaultSettings };
    
    // Detect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      autoSettings.reduceMotion = true;
    }
    
    // Detect high contrast preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      autoSettings.mode = 'high-contrast';
    }
    
    // Detect dark mode preference and combine with high contrast
    if (window.matchMedia('(prefers-color-scheme: dark)').matches && 
        autoSettings.mode === 'high-contrast') {
      autoSettings.mode = 'dark-high-contrast';
    }
    
    return autoSettings;
  });

  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('shareZidiAccessibility', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleMode = useCallback(() => {
    const modes: AccessibilityMode[] = ['normal', 'high-contrast', 'dark-high-contrast'];
    const currentIndex = modes.indexOf(settings.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    updateSettings({ mode: nextMode });
    
    // Announce the change to screen readers
    const modeNames = {
      'normal': 'Normal',
      'high-contrast': 'High Contrast Light',
      'dark-high-contrast': 'High Contrast Dark'
    };
    
    // Create announcement
    const announcement = document.getElementById('aria-announcements');
    if (announcement) {
      announcement.textContent = `Display mode changed to ${modeNames[nextMode]}`;
    }
  }, [settings.mode, updateSettings]);

  const toggleReduceMotion = useCallback(() => {
    updateSettings({ reduceMotion: !settings.reduceMotion });
  }, [settings.reduceMotion, updateSettings]);

  const toggleLargeText = useCallback(() => {
    updateSettings({ largeText: !settings.largeText });
  }, [settings.largeText, updateSettings]);

  const toggleScreenReaderMode = useCallback(() => {
    updateSettings({ screenReaderMode: !settings.screenReaderMode });
  }, [settings.screenReaderMode, updateSettings]);

  // Apply CSS classes to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all accessibility classes
    root.classList.remove('accessibility-normal', 'accessibility-high-contrast', 'accessibility-dark-high-contrast');
    root.classList.remove('reduce-motion', 'large-text', 'screen-reader-mode');
    
    // Add current mode class
    root.classList.add(`accessibility-${settings.mode}`);
    
    // Add feature classes
    if (settings.reduceMotion) root.classList.add('reduce-motion');
    if (settings.largeText) root.classList.add('large-text');
    if (settings.screenReaderMode) root.classList.add('screen-reader-mode');
    
    // Set CSS custom properties for dynamic theming
    root.style.setProperty('--motion-duration', settings.reduceMotion ? '0s' : '0.2s');
    root.style.setProperty('--text-scale', settings.largeText ? '1.2' : '1');
    
  }, [settings]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQueries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(prefers-color-scheme: dark)')
    ];

    const handleChange = () => {
      // Only auto-update if user hasn't manually set preferences
      const isDefault = localStorage.getItem('shareZidiAccessibility') === null;
      if (!isDefault) return;

      const autoSettings = { ...defaultSettings };
      
      if (mediaQueries[0].matches) autoSettings.reduceMotion = true;
      if (mediaQueries[1].matches) autoSettings.mode = 'high-contrast';
      if (mediaQueries[2].matches && autoSettings.mode === 'high-contrast') {
        autoSettings.mode = 'dark-high-contrast';
      }
      
      setSettings(autoSettings);
    };

    mediaQueries.forEach(mq => mq.addEventListener('change', handleChange));
    return () => mediaQueries.forEach(mq => mq.removeEventListener('change', handleChange));
  }, []);

  return {
    settings,
    updateSettings,
    toggleMode,
    toggleReduceMotion,
    toggleLargeText,
    toggleScreenReaderMode,
    isHighContrast: settings.mode !== 'normal',
    isDarkHighContrast: settings.mode === 'dark-high-contrast'
  };
};
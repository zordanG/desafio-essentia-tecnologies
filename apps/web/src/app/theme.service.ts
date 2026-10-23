import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
type ThemePreference = Theme | 'system';

const THEME_STORAGE_KEY = 'task-board-theme';
const THEME_COLORS: Record<Theme, string> = {
  dark: '#0c1210',
  light: '#f2f0e9',
};

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly mediaQuery = this.getMediaQuery();
  private readonly themeColorMeta = this.document.querySelector('meta[name="theme-color"]');
  private readonly preference = signal<ThemePreference>(this.readPreference());
  private readonly systemTheme = signal<Theme>(this.getSystemTheme());

  readonly theme = computed<Theme>(() => {
    const preference = this.preference();

    return preference === 'system' ? this.systemTheme() : preference;
  });
  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    this.applyTheme(this.theme());
    this.mediaQuery?.addEventListener('change', this.handleSystemThemeChange);
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.preference.set(theme);
    this.applyTheme(theme, true);
  }

  private readonly handleSystemThemeChange = (event: MediaQueryListEvent): void => {
    this.systemTheme.set(event.matches ? 'dark' : 'light');

    if (this.preference() === 'system') {
      this.applyTheme(this.theme());
    }
  };

  private applyTheme(theme: Theme, persist = false): void {
    const root = this.document.documentElement;

    root.dataset['theme'] = theme;
    root.style.setProperty('color-scheme', theme);
    this.themeColorMeta?.setAttribute('content', THEME_COLORS[theme]);

    if (persist) {
      try {
        this.storage?.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Storage can be unavailable in private browsing contexts.
      }
    }
  }

  private readPreference(): ThemePreference {
    try {
      const storedTheme = this.storage?.getItem(THEME_STORAGE_KEY);

      return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'system';
    } catch {
      return 'system';
    }
  }

  private getSystemTheme(): Theme {
    return this.mediaQuery?.matches ? 'dark' : 'light';
  }

  private getMediaQuery(): MediaQueryList | undefined {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  }

  private get storage(): Storage | undefined {
    try {
      return this.document.defaultView?.localStorage;
    } catch {
      return undefined;
    }
  }
}

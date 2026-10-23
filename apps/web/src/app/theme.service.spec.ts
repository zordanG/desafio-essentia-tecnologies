import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('starts with the light theme when there is no stored or system preference', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('uses the stored theme', () => {
    localStorage.setItem('task-board-theme', 'dark');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('toggles and persists the selected theme', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('task-board-theme')).toBe('dark');

    service.toggle();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('task-board-theme')).toBe('light');
  });
});

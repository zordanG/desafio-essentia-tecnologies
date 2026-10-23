import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');

    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('creates the application shell', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the app heading', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Keep your work in focus.',
    );
  });

  it('renders the Material toolbar and theme toggle', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('mat-toolbar')).toBeTruthy();
    expect(element.querySelector('.brand-name')?.textContent).toContain('TechX Tasks');
    expect(element.querySelector('button[aria-label="Switch to dark theme"]')).toBeTruthy();
  });

  it('toggles between light and dark themes', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Switch to dark theme"]',
    );

    toggle?.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(element.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Switch to light theme',
    );
    expect(localStorage.getItem('task-board-theme')).toBe('dark');

    toggle?.click();
    fixture.detectChanges();

    expect(document.documentElement.dataset['theme']).toBe('light');
  });
});

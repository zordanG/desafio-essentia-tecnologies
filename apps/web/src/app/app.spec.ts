import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { TodoService } from './shared/services/todo.service';
import { AuthService, User } from './core/auth/auth.service';
import { ThemeService } from './theme.service';
import { App } from './app';

// Simple test component to render in router outlet
@Component({ template: '<div>Test Content</div>' })
class TestComponent {}

type MockTodoService = {
  list: ReturnType<typeof vi.fn>;
};

type MockAuthService = {
  isAuthenticated: ReturnType<typeof vi.fn>;
  user: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
};

type MockThemeService = {
  isDark: ReturnType<typeof vi.fn>;
  toggle: ReturnType<typeof vi.fn>;
};

describe('App', () => {
  let mockTodoService: MockTodoService;
  let mockAuthService: MockAuthService;
  let mockThemeService: MockThemeService;

  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('color-scheme');

    mockTodoService = { list: vi.fn(() => of([])) };
    mockAuthService = {
      isAuthenticated: vi.fn(() => true),
      user: vi.fn(() => ({ id: '1', email: 'test@example.com' }) satisfies User),
      logout: vi.fn(),
    };
    mockThemeService = {
      isDark: vi.fn(() => false),
      toggle: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([{ path: '', component: TestComponent }]),
        { provide: TodoService, useValue: mockTodoService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
      ],
    }).compileComponents();
  });

  it('Creates the application shell', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('Renders the Material toolbar with brand', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('mat-toolbar')).toBeTruthy();
    expect(element.querySelector('.brand-name')?.textContent).toContain('TechX Tasks');
  });

  it('Renders the theme toggle button', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('button[aria-label="Switch to dark theme"]')).toBeTruthy();
  });

  it('Renders user email when authenticated', async () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const menuButton = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Menu do usuário"]',
    );

    expect(menuButton).toBeTruthy();

    menuButton!.click();
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    const email = document.querySelector('.user-email');

    expect(email?.textContent).toContain('test@example.com');
  });

  it('Toggles between light and dark themes', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Switch to dark theme"]',
    );

    toggle?.click();
    fixture.detectChanges();

    expect(mockThemeService.isDark).toHaveBeenCalled();
    expect(mockThemeService.toggle).toHaveBeenCalled();
  });
});

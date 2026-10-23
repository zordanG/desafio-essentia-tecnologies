import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfigService } from '../config/app-config.service';
import { AuthService, User } from './auth.service';

const API_URL = 'http://localhost:3000';
const USER: User = {
  id: 'user-1',
  email: 'user@example.com',
};

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AppConfigService,
          useValue: { apiBaseUrl: API_URL },
        },
        { provide: Router, useValue: router },
      ],
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);

    // The constructor automatically attempts to restore the session.
    const request = httpTestingController.expectOne(`${API_URL}/auth/refresh`);

    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('starts unauthenticated when session restoration fails', () => {
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.initialized()).toBe(true);
  });

  it('waits until initialization completes', async () => {
    await expect(firstValueFrom(service.waitUntilInitialized())).resolves.toBe(true);
  });

  it('logs in and updates the authenticated user', () => {
    let receivedUser: User | undefined;

    service
      .login({
        email: USER.email,
        password: 'correct-password',
      })
      .subscribe((user) => {
        receivedUser = user;
      });

    const request = httpTestingController.expectOne(`${API_URL}/auth/login`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: USER.email,
      password: 'correct-password',
    });
    expect(request.request.withCredentials).toBe(true);

    request.flush({ user: USER });

    expect(receivedUser).toEqual(USER);
    expect(service.user()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('registers a user and updates the authenticated state', () => {
    let receivedUser: User | undefined;

    service
      .register({
        email: USER.email,
        password: 'new-password',
      })
      .subscribe((user) => {
        receivedUser = user;
      });

    const request = httpTestingController.expectOne(`${API_URL}/auth/register`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: USER.email,
      password: 'new-password',
    });
    expect(request.request.withCredentials).toBe(true);

    request.flush({ user: USER });

    expect(receivedUser).toEqual(USER);
    expect(service.user()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('refreshes the session and updates the user', () => {
    let receivedUser: User | undefined;

    service.refresh().subscribe((user) => {
      receivedUser = user;
    });

    const request = httpTestingController.expectOne(`${API_URL}/auth/refresh`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBe(true);

    request.flush({ user: USER });

    expect(receivedUser).toEqual(USER);
    expect(service.user()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('logs out and navigates to login after the request completes', () => {
    // Establish an authenticated state first.
    service
      .login({
        email: USER.email,
        password: 'correct-password',
      })
      .subscribe();

    httpTestingController.expectOne(`${API_URL}/auth/login`).flush({ user: USER });

    expect(service.isAuthenticated()).toBe(true);

    service.logout();

    const request = httpTestingController.expectOne(`${API_URL}/auth/logout`);

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);

    request.flush({});

    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears the session and navigates to login when logout fails', () => {
    service
      .login({
        email: USER.email,
        password: 'correct-password',
      })
      .subscribe();

    httpTestingController.expectOne(`${API_URL}/auth/login`).flush({ user: USER });

    service.logout();

    const request = httpTestingController.expectOne(`${API_URL}/auth/logout`);

    request.flush({ message: 'Server unavailable' }, { status: 500, statusText: 'Server Error' });

    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('propagates login errors without authenticating the user', () => {
    let receivedError: unknown;

    service
      .login({
        email: USER.email,
        password: 'wrong-password',
      })
      .subscribe({
        error: (error: unknown) => {
          receivedError = error;
        },
      });

    const request = httpTestingController.expectOne(`${API_URL}/auth/login`);

    request.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(receivedError).toBeTruthy();
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});

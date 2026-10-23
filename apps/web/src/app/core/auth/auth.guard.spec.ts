import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  GuardResult,
} from '@angular/router';
import { of, Subject, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

let authService: {
  waitUntilInitialized: ReturnType<typeof vi.fn>;
  isAuthenticated: ReturnType<typeof vi.fn>;
};

let router: {
  createUrlTree: ReturnType<typeof vi.fn>;
};

const LOGIN_URL_TREE = { path: '/login' } as unknown as UrlTree;

describe('authGuard', () => {
  beforeEach(() => {
    authService = {
      waitUntilInitialized: vi.fn(() => of(undefined)),
      isAuthenticated: vi.fn(),
    };

    router = {
      createUrlTree: vi.fn(() => LOGIN_URL_TREE),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  });

  async function runGuard(): Promise<GuardResult> {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    return firstValueFrom(result as ReturnType<typeof of>);
  }

  it('allows navigation when the user is authenticated', async () => {
    authService.isAuthenticated.mockReturnValue(true);

    const result = await runGuard();

    expect(result).toBe(true);
    expect(authService.waitUntilInitialized).toHaveBeenCalledOnce();
    expect(authService.isAuthenticated).toHaveBeenCalledOnce();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects to login when the user is not authenticated', async () => {
    authService.isAuthenticated.mockReturnValue(false);

    const result = await runGuard();

    expect(result).toBe(LOGIN_URL_TREE);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('waits for authentication initialization before checking the session', async () => {
    const initialization = new Subject<void>();

    authService.waitUntilInitialized.mockReturnValue(initialization);
    authService.isAuthenticated.mockReturnValue(true);

    const resultPromise = runGuard();

    // The guard must not check authentication before initialization.
    expect(authService.isAuthenticated).not.toHaveBeenCalled();

    initialization.next();
    initialization.complete();

    await expect(resultPromise).resolves.toBe(true);
    expect(authService.isAuthenticated).toHaveBeenCalledOnce();
  });

  it('does not redirect before authentication initialization completes', async () => {
    const initialization = new Subject<void>();

    authService.waitUntilInitialized.mockReturnValue(initialization);
    authService.isAuthenticated.mockReturnValue(false);

    const resultPromise = runGuard();

    expect(router.createUrlTree).not.toHaveBeenCalled();

    initialization.next();
    initialization.complete();

    await expect(resultPromise).resolves.toBe(LOGIN_URL_TREE);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});

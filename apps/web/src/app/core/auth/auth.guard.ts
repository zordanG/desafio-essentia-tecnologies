import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { switchMap } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.waitUntilInitialized().pipe(
    switchMap(() => {
      if (auth.isAuthenticated()) {
        return [true];
      }

      return [router.createUrlTree(['/login'])];
    }),
  );
};

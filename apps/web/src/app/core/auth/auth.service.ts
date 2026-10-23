import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AppConfigService } from '../config/app-config.service';
import { catchError, filter, finalize, map, Observable, of, take, tap } from 'rxjs';

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type RegisterRequest = LoginRequest;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);

  private readonly _user = signal<User | null>(null);
  private readonly _initialized = signal(false);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly initialized = this._initialized.asReadonly();

  constructor() {
    this.restoreSession().subscribe();
  }

  private restoreSession(): Observable<User | null> {
    return this.refresh().pipe(
      map((user) => user),
      catchError(() => {
        this._user.set(null);
        return of(null);
      }),
      finalize(() => this._initialized.set(true)),
    );
  }

  waitUntilInitialized(): Observable<boolean> {
    return toObservable(this._initialized).pipe(
      filter((initialized) => initialized),
      take(1),
      map(() => true),
    );
  }

  login(credentials: LoginRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.config.apiBaseUrl}/auth/login`, credentials, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res.user),
        tap((user) => this._user.set(user)),
      );
  }

  register(data: RegisterRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.config.apiBaseUrl}/auth/register`, data, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res.user),
        tap((user) => this._user.set(user)),
      );
  }

  refresh(): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.config.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map((res) => res.user),
        tap((user) => this._user.set(user)),
      );
  }

  logout(): void {
    this.http
      .post(`${this.config.apiBaseUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        catchError(() => of(null)),
        tap(() => {
          this._user.set(null);
          this.router.navigate(['/login']);
        }),
      )
      .subscribe();
  }
}

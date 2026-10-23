import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let router: Router;

  let auth: {
    login: ReturnType<typeof vi.fn>;
  };

  let snackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    auth = {
      login: vi.fn(() => of({ id: 'user-1', email: 'user@example.com' })),
    };

    snackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders email and password fields', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('input[formControlName="email"]')).toBeTruthy();
    expect(element.querySelector('input[formControlName="password"]')).toBeTruthy();
  });

  it('starts with loading disabled and password hidden', () => {
    expect(component.loading()).toBe(false);
    expect(component.hidePassword()).toBe(true);
  });

  it('requires a valid email and a password of at least eight characters', () => {
    expect(component.form.valid).toBe(false);

    component.form.setValue({
      email: 'invalid-email',
      password: 'short',
    });

    expect(component.form.valid).toBe(false);

    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(component.form.valid).toBe(true);
  });

  it('does not submit an invalid form', () => {
    component.onSubmit();

    expect(auth.login).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.form.controls.email.touched).toBe(true);
    expect(component.form.controls.password.touched).toBe(true);
  });

  it('logs in and navigates to the home page on success', () => {
    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
    });

    component.onSubmit();

    expect(auth.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading()).toBe(false);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('keeps loading enabled while the login request is pending', () => {
    const pendingRequest = new Subject<{ id: string; email: string }>();
    auth.login.mockReturnValue(pendingRequest);

    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
    });

    component.onSubmit();

    expect(component.loading()).toBe(true);

    pendingRequest.next({ id: 'user-1', email: 'user@example.com' });

    expect(component.loading()).toBe(false);
  });
});

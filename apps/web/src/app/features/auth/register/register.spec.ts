import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { RegisterComponent } from './register';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let router: Router;

  let auth: {
    register: ReturnType<typeof vi.fn>;
  };

  let snackBar: {
    open: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    auth = {
      register: vi.fn(() => of({ id: 'user-1', email: 'user@example.com' })),
    };

    snackBar = {
      open: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders email, password and confirmation fields', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('input[formControlName="email"]')).toBeTruthy();
    expect(element.querySelector('input[formControlName="password"]')).toBeTruthy();
    expect(element.querySelector('input[formControlName="confirmPassword"]')).toBeTruthy();
  });

  it('starts with loading disabled and passwords hidden', () => {
    expect(component.loading()).toBe(false);
    expect(component.hidePassword()).toBe(true);
    expect(component.hideConfirmPassword()).toBe(true);
  });

  it('requires a valid email and passwords of at least eight characters', () => {
    component.form.setValue({
      email: 'invalid-email',
      password: 'short',
      confirmPassword: 'short',
    });

    expect(component.form.invalid).toBe(true);

    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(component.form.valid).toBe(true);
  });

  it('invalidates the form when passwords do not match', () => {
    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'different123',
    });

    expect(component.form.hasError('mismatch')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('does not submit an invalid form', () => {
    component.form.setValue({
      email: 'invalid-email',
      password: 'password123',
      confirmPassword: 'different123',
    });

    component.onSubmit();

    expect(auth.register).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.form.controls.email.touched).toBe(true);
    expect(component.form.controls.password.touched).toBe(true);
    expect(component.form.controls.confirmPassword.touched).toBe(true);
  });

  it('registers the user and navigates home on success', () => {
    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    component.onSubmit();

    expect(auth.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(component.loading()).toBe(false);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('keeps loading enabled while registration is pending', () => {
    const pendingRequest = new Subject<{ id: string; email: string }>();
    auth.register.mockReturnValue(pendingRequest);

    component.form.setValue({
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    component.onSubmit();

    expect(component.loading()).toBe(true);

    pendingRequest.next({ id: 'user-1', email: 'user@example.com' });

    expect(component.loading()).toBe(false);
  });
});

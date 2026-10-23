import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TodoConfirmDialog, TodoConfirmDialogData } from './todo-confirm-dialog';

const DIALOG_DATA: TodoConfirmDialogData = {
  title: 'Delete task',
  message: 'Are you sure you want to delete this task?',
  confirmLabel: 'Delete',
};

let fixture: ComponentFixture<TodoConfirmDialog>;
let component: TodoConfirmDialog;
let dialogRef: { close: ReturnType<typeof vi.fn> };

describe('TodoConfirmDialog', () => {
  beforeEach(async () => {
    dialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TodoConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: DIALOG_DATA },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TodoConfirmDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders the title, message and confirmation label', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#todo-confirm-title')?.textContent).toContain(DIALOG_DATA.title);
    expect(element.querySelector('mat-dialog-content')?.textContent).toContain(DIALOG_DATA.message);
    expect(element.querySelector('mat-dialog-actions')?.textContent).toContain(
      DIALOG_DATA.confirmLabel,
    );
  });

  it('closes with false when cancellation is requested', () => {
    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('closes with true when confirmation is requested', () => {
    component.confirm();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('calls cancel when the Cancel button is clicked', () => {
    const button = findButton('Cancel');

    button.click();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('calls confirm when the confirmation button is clicked', () => {
    const button = findButton(DIALOG_DATA.confirmLabel);

    button.click();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
  });

  function findButton(label: string): HTMLButtonElement {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    const button = buttons.find((candidate) => candidate.textContent?.trim() === label);

    if (!button) {
      throw new Error(`Button not found: ${label}`);
    }

    return button;
  }
});

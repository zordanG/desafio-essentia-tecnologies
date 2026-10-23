import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { Task } from '../../../shared/models/task.model';
import { TodoFormDialog, TodoFormDialogData } from './todo-form-dialog';

const TASK: Task = {
  id: '9b2f4c1e-6f38-4f6e-9f8a-3a7c1d2e4b5a',
  title: 'Prepare the daily stand-up',
  description: 'Share progress with the team.',
  completed: false,
  created_at: '2026-10-23T09:00:00.000Z',
  updated_at: '2026-10-23T09:00:00.000Z',
};

describe('TodoFormDialog', () => {
  it('Starts empty when creating a task', async () => {
    const { fixture } = await createDialog();

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      title: '',
      description: '',
    });
    expect(fixture.nativeElement.textContent).toContain('New task');
  });

  it('Loads the task when editing', async () => {
    const { fixture } = await createDialog({ task: TASK });

    expect(fixture.componentInstance.form.getRawValue()).toEqual({
      title: TASK.title,
      description: TASK.description,
    });
    expect(fixture.nativeElement.textContent).toContain('Edit task');
  });

  it('Rejects a task without a title', async () => {
    const { fixture, close } = await createDialog();
    const component = fixture.componentInstance;

    component.form.controls.title.setValue('   ');
    component.submit();
    fixture.detectChanges();

    expect(close).not.toHaveBeenCalled();
    expect(component.form.controls.title.hasError('required')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Enter a task title.');
  });

  it('Trims the title and stores an empty description as null', async () => {
    const { fixture, close } = await createDialog();
    const component = fixture.componentInstance;

    component.form.setValue({ title: '  Write tests  ', description: '   ' });
    component.submit();

    expect(close).toHaveBeenCalledWith({ title: 'Write tests', description: null });
  });

  it('Keeps and trims the description when provided', async () => {
    const { fixture, close } = await createDialog();
    const component = fixture.componentInstance;

    component.form.setValue({ title: 'Write tests', description: '  Cover the board.  ' });
    component.submit();

    expect(close).toHaveBeenCalledWith({
      title: 'Write tests',
      description: 'Cover the board.',
    });
  });

  it('Enforces the title and description limits', async () => {
    const { fixture, close } = await createDialog();
    const component = fixture.componentInstance;

    component.form.controls.title.setValue('a'.repeat(256));
    component.form.controls.description.setValue('a'.repeat(2001));
    component.submit();

    expect(component.form.controls.title.hasError('maxlength')).toBe(true);
    expect(component.form.controls.description.hasError('maxlength')).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it('Closes without a result when cancelled', async () => {
    const { fixture, close } = await createDialog();

    fixture.componentInstance.cancel();

    expect(close).toHaveBeenCalledWith();
  });
});

async function createDialog(
  data: TodoFormDialogData = {},
): Promise<{ fixture: ComponentFixture<TodoFormDialog>; close: ReturnType<typeof vi.fn> }> {
  const close = vi.fn();

  await TestBed.configureTestingModule({
    imports: [TodoFormDialog],
    providers: [
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: data },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(TodoFormDialog);

  fixture.detectChanges();

  return { fixture, close };
}

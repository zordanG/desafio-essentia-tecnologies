import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCheckbox, MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpError } from '../../../core/api/api-error';
import { Task } from '../../../shared/models/task.model';
import { TodoService } from '../../../shared/services/todo.service';
import { TodoConfirmDialog } from '../todo-confirm-dialog/todo-confirm-dialog';
import { TodoFormDialog } from '../todo-form-dialog/todo-form-dialog';
import { TodoBoard } from './todo-board';
import { TodoMetadataDialog } from '../todo-metadata-dialog/todo-metadata-dialog';

const TASK: Task = {
  id: '9b2f4c1e-6f38-4f6e-9f8a-3a7c1d2e4b5a',
  title: 'Prepare the daily stand-up',
  description: 'Share progress with the team.',
  completed: false,
  created_at: '2026-10-23T09:00:00.000Z',
  updated_at: '2026-10-23T09:00:00.000Z',
};

let todoService: {
  list: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getMetadata: ReturnType<typeof vi.fn>;
  putMetadata: ReturnType<typeof vi.fn>;
  patchMetadata: ReturnType<typeof vi.fn>;
  removeMetadata: ReturnType<typeof vi.fn>;
};
let listSubject: Subject<Task[]>;
let dialog: { open: ReturnType<typeof vi.fn> };
let snackBar: { open: ReturnType<typeof vi.fn> };

describe('TodoBoard', () => {
  beforeEach(async () => {
    listSubject = new Subject<Task[]>();
    todoService = {
      list: vi.fn(() => listSubject.asObservable()),
      create: vi.fn(() => of(TASK)),
      update: vi.fn(() => of(TASK)),
      remove: vi.fn(() => of(void 0)),
      getMetadata: vi.fn(() =>
        of({
          taskId: TASK.id,
          tags: [],
          updatedAt: '2026-10-23T09:00:00.000Z',
        }),
      ),
      putMetadata: vi.fn(),
      patchMetadata: vi.fn(),
      removeMetadata: vi.fn(() => of(void 0)),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TodoBoard],
      providers: [
        { provide: TodoService, useValue: todoService },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
  });

  it('Shows a loading state while fetching tasks', () => {
    const fixture = createBoard();

    expect(fixture.componentInstance.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('Renders tasks returned by the API', () => {
    const fixture = createBoard();

    flushTasks(fixture, [TASK]);

    expect(fixture.nativeElement.textContent).toContain(TASK.title);
    expect(fixture.nativeElement.textContent).toContain('Open');
  });

  it('Shows an empty state when there are no tasks', () => {
    const fixture = createBoard();

    flushTasks(fixture, []);

    expect(fixture.nativeElement.textContent).toContain('No tasks yet.');
  });

  it('Shows an error state when the API fails', () => {
    todoService.list.mockReturnValue(
      throwError(() => new ApiHttpError('Task service unavailable', 'SERVICE_UNAVAILABLE', 503)),
    );

    const fixture = createBoard();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');

    expect(fixture.componentInstance.error()).toBe('Task service unavailable');
    expect(alert?.textContent).toContain('Task service unavailable');
  });

  it('Creates a task', () => {
    const created: Task = { ...TASK, id: 'new-task', title: 'New task', description: null };
    dialog.open.mockReturnValue({
      afterClosed: () => of({ title: 'New task', description: null }),
    });
    todoService.create.mockReturnValue(of(created));

    const fixture = createBoard();
    flushTasks(fixture, []);

    findButton(fixture, 'New task').click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(TodoFormDialog, expect.objectContaining({ data: {} }));
    expect(todoService.create).toHaveBeenCalledWith({ title: 'New task', description: null });
    expect(fixture.nativeElement.textContent).toContain('New task');
    expect(snackBar.open).toHaveBeenCalledWith('Task created.', 'Dismiss', expect.anything());
  });

  it('Updates a task', () => {
    const updated: Task = {
      ...TASK,
      title: 'Updated title',
      description: 'Updated description',
    };
    dialog.open.mockReturnValue({
      afterClosed: () => of({ title: 'Updated title', description: 'Updated description' }),
    });
    todoService.update.mockReturnValue(of(updated));

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    findButton(fixture, `Edit ${TASK.title}`).click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(
      TodoFormDialog,
      expect.objectContaining({ data: { task: TASK } }),
    );
    expect(todoService.update).toHaveBeenCalledWith(TASK.id, {
      title: 'Updated title',
      description: 'Updated description',
    });
    expect(fixture.nativeElement.textContent).toContain('Updated title');
  });

  it('Deletes a task after confirmation', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    todoService.remove.mockReturnValue(of(void 0));

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    findButton(fixture, `Delete ${TASK.title}`).click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(
      TodoConfirmDialog,
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Delete task' }),
      }),
    );
    expect(todoService.remove).toHaveBeenCalledWith(TASK.id);
    expect(fixture.nativeElement.textContent).not.toContain(TASK.title);
    expect(snackBar.open).toHaveBeenCalledWith('Task deleted.', 'Dismiss', expect.anything());
  });

  it('Keeps the task when deletion is cancelled', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    findButton(fixture, `Delete ${TASK.title}`).click();
    fixture.detectChanges();

    expect(todoService.remove).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(TASK.title);
  });

  it('Toggles task completion', () => {
    const updated: Task = { ...TASK, completed: true };
    todoService.update.mockReturnValue(of(updated));

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    const source = { checked: false } as MatCheckbox;
    const change = { checked: true, source } as MatCheckboxChange;

    fixture.componentInstance.toggleTask(TASK, change);
    fixture.detectChanges();

    expect(todoService.update).toHaveBeenCalledWith(TASK.id, { completed: true });
    expect(fixture.componentInstance.tasks().at(0)?.completed).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Done');
  });

  it('Restores the checkbox when completion fails', () => {
    todoService.update.mockReturnValue(
      throwError(() => new ApiHttpError('Unable to reach the API', 'NETWORK_ERROR', 0)),
    );

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    const source = { checked: false } as MatCheckbox;
    const change = { checked: true, source } as MatCheckboxChange;

    fixture.componentInstance.toggleTask(TASK, change);

    expect(source.checked).toBe(false);
    expect(fixture.componentInstance.tasks().at(0)?.completed).toBe(false);
    expect(fixture.componentInstance.isPending(TASK.id)).toBe(false);
    expect(snackBar.open).toHaveBeenCalledWith(
      'Unable to reach the API',
      'Dismiss',
      expect.anything(),
    );
  });

  it('Refreshes the task list', () => {
    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    findButton(fixture, 'Refresh').click();
    fixture.detectChanges();

    expect(todoService.list).toHaveBeenCalledTimes(2);
  });

  it('Loads the metadata color for a task', () => {
    todoService.getMetadata.mockReturnValue(
      of({
        taskId: TASK.id,
        tags: ['urgent'],
        color: '#336699',
        updatedAt: '2026-10-23T09:00:00.000Z',
      }),
    );

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);
    fixture.detectChanges();

    expect(todoService.getMetadata).toHaveBeenCalledWith(TASK.id);
    expect(fixture.componentInstance.metadataColors()[TASK.id]).toBe('#336699');
  });

  it('Leaves tasks without a metadata color uncolored', () => {
    const fixture = createBoard();
    flushTasks(fixture, [TASK]);
    fixture.detectChanges();

    expect(fixture.componentInstance.metadataColors()[TASK.id]).toBeUndefined();
  });

  it('Opens the metadata dialog for a task', () => {
    const fixture = createBoard();
    flushTasks(fixture, [TASK]);

    findButton(fixture, `Edit metadata for ${TASK.title}`).click();

    expect(dialog.open).toHaveBeenCalledWith(
      TodoMetadataDialog,
      expect.objectContaining({
        data: TASK,
      }),
    );
  });

  it('Displays the metadata color on the task card', () => {
    todoService.getMetadata.mockReturnValue(
      of({
        taskId: TASK.id,
        tags: [],
        color: '#336699',
        updatedAt: '2026-10-23T09:00:00.000Z',
      }),
    );

    const fixture = createBoard();
    flushTasks(fixture, [TASK]);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.task-card') as HTMLElement;

    expect(card).toBeTruthy();
    expect(card.style.getPropertyValue('--metadata-color')).toBe('#336699');
  });
});

function createBoard(): ComponentFixture<TodoBoard> {
  const fixture = TestBed.createComponent(TodoBoard);

  fixture.detectChanges();

  return fixture;
}

function flushTasks(fixture: ComponentFixture<TodoBoard>, tasks: Task[]): void {
  listSubject.next(tasks);
  listSubject.complete();
  fixture.detectChanges();
}

function findButton(fixture: ComponentFixture<TodoBoard>, label: string): HTMLButtonElement {
  const element = fixture.nativeElement as HTMLElement;
  const buttons = Array.from(element.querySelectorAll('button'));
  const button = buttons.find(
    (candidate) =>
      candidate.getAttribute('aria-label') === label || candidate.textContent?.includes(label),
  );

  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }

  return button;
}

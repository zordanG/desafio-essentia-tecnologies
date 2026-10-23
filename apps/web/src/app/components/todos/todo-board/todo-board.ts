import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { ApiHttpError } from '../../../core/api/api-error';
import { CreateTaskDto, Task, UpdateTaskDto } from '../../../shared/models/task.model';
import { TodoService } from '../../../shared/services/todo.service';
import {
  TodoConfirmDialog,
  TodoConfirmDialogData,
} from '../todo-confirm-dialog/todo-confirm-dialog';
import {
  TodoFormDialog,
  TodoFormDialogData,
  TodoFormDialogResult,
} from '../todo-form-dialog/todo-form-dialog';

@Component({
  selector: 'app-todo-board',
  imports: [DatePipe, MatButtonModule, MatCheckboxModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './todo-board.html',
  styleUrl: './todo-board.css',
})
export class TodoBoard implements OnInit {
  private readonly todoService = inject(TodoService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingTaskIds = signal<ReadonlySet<string>>(new Set());
  readonly openCount = computed(() => this.tasks().filter((task) => !task.completed).length);

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);

    this.todoService
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tasks) => this.tasks.set(tasks),
        error: (error: unknown) => {
          this.tasks.set([]);
          this.error.set(this.messageFor(error, 'Unable to load tasks.'));
        },
      });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<TodoFormDialog, TodoFormDialogData, TodoFormDialogResult>(
      TodoFormDialog,
      {
        ...this.dialogConfig,
        data: {},
      },
    );

    dialogRef.afterClosed().subscribe((payload) => {
      if (payload) {
        this.createTask(payload);
      }
    });
  }

  openEditDialog(task: Task): void {
    const dialogRef = this.dialog.open<TodoFormDialog, TodoFormDialogData, TodoFormDialogResult>(
      TodoFormDialog,
      {
        ...this.dialogConfig,
        data: { task },
      },
    );

    dialogRef.afterClosed().subscribe((payload) => {
      if (payload) {
        this.updateTask(task, payload);
      }
    });
  }

  confirmDelete(task: Task): void {
    const dialogRef = this.dialog.open<TodoConfirmDialog, TodoConfirmDialogData, boolean>(
      TodoConfirmDialog,
      {
        ...this.dialogConfig,
        data: {
          title: 'Delete task',
          message: `Delete "${task.title}"? This action cannot be undone.`,
          confirmLabel: 'Delete',
        },
      },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.removeTask(task);
      }
    });
  }

  toggleTask(task: Task, change: MatCheckboxChange): void {
    if (this.isPending(task.id)) {
      return;
    }

    this.markPending(task.id, true);
    this.todoService
      .update(task.id, { completed: change.checked })
      .pipe(finalize(() => this.markPending(task.id, false)))
      .subscribe({
        next: (updated) => this.replaceTask(updated),
        error: (error: unknown) => {
          change.source.checked = task.completed;
          this.showError(error, 'Could not update the task.');
        },
      });
  }

  isPending(id: string): boolean {
    return this.pendingTaskIds().has(id);
  }

  private createTask(payload: CreateTaskDto): void {
    this.creating.set(true);

    this.todoService
      .create(payload)
      .pipe(finalize(() => this.creating.set(false)))
      .subscribe({
        next: (task) => {
          this.tasks.update((tasks) => [task, ...tasks]);
          this.notify('Task created.');
        },
        error: (error: unknown) => this.showError(error, 'Could not create the task.'),
      });
  }

  private updateTask(task: Task, payload: UpdateTaskDto): void {
    this.markPending(task.id, true);

    this.todoService
      .update(task.id, payload)
      .pipe(finalize(() => this.markPending(task.id, false)))
      .subscribe({
        next: (updated) => {
          this.replaceTask(updated);
          this.notify('Task updated.');
        },
        error: (error: unknown) => this.showError(error, 'Could not update the task.'),
      });
  }

  private removeTask(task: Task): void {
    this.markPending(task.id, true);

    this.todoService
      .remove(task.id)
      .pipe(finalize(() => this.markPending(task.id, false)))
      .subscribe({
        complete: () => {
          this.tasks.update((tasks) => tasks.filter((item) => item.id !== task.id));
          this.notify('Task deleted.');
        },
        error: (error: unknown) => this.showError(error, 'Could not delete the task.'),
      });
  }

  private replaceTask(updated: Task): void {
    this.tasks.update((tasks) => tasks.map((task) => (task.id === updated.id ? updated : task)));
  }

  private markPending(id: string, pending: boolean): void {
    this.pendingTaskIds.update((current) => {
      const next = new Set(current);

      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  private showError(error: unknown, fallback: string): void {
    this.snackBar.open(this.messageFor(error, fallback), 'Dismiss', { duration: 6000 });
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 4000 });
  }

  private messageFor(error: unknown, fallback: string): string {
    return error instanceof ApiHttpError ? error.message : fallback;
  }

  private readonly dialogConfig = {
    width: 'min(560px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
    autoFocus: 'first-tabbable' as const,
    restoreFocus: true,
    panelClass: 'todo-dialog-panel',
  };
}

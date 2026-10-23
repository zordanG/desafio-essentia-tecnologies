import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';

import { ApiHttpError } from '../../../core/api/api-error';
import { Task } from '../../../shared/models/task.model';
import { PutTodoMetadataDto, TodoMetadata } from '../../../shared/models/todo-metadata.model';
import { TodoService } from '../../../shared/services/todo.service';

@Component({
  selector: 'app-todo-metadata-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './todo-metadata-dialog.html',
  styleUrl: './todo-metadata-dialog.css',
})
export class TodoMetadataDialog implements OnInit {
  private readonly todoService = inject(TodoService);
  private readonly dialogRef = inject(MatDialogRef<TodoMetadataDialog, TodoMetadata | null>);
  readonly task = inject<Task>(MAT_DIALOG_DATA);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly exists = signal(false);
  readonly error = signal<string | null>(null);

  tagsInput = '';
  colorInput = '';
  customFieldsInput = '{}';
  updatedAt = '';

  ngOnInit(): void {
    this.loadMetadata();
  }

  loadMetadata(): void {
    this.loading.set(true);
    this.error.set(null);

    this.todoService
      .getMetadata(this.task.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (metadata) => this.fillForm(metadata),
        error: (error: unknown) => {
          if (error instanceof ApiHttpError && error.status === 404) {
            this.exists.set(false);
            this.tagsInput = '';
            this.colorInput = '';
            this.customFieldsInput = '{}';
            this.updatedAt = '';
            return;
          }

          this.error.set(
            error instanceof ApiHttpError ? error.message : 'Could not load metadata.',
          );
        },
      });
  }

  save(): void {
    this.error.set(null);

    const tags = this.tagsInput
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (tags.length > 30) {
      this.error.set('You can add at most 30 tags.');
      return;
    }

    if (tags.some((tag) => tag.length > 50)) {
      this.error.set('Each tag must contain at most 50 characters.');
      return;
    }

    const color = this.colorInput.trim();

    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      this.error.set('Color must use hexadecimal format, e.g. #336699.');
      return;
    }

    let customFields: Record<string, unknown>;

    try {
      const parsed: unknown = JSON.parse(this.customFieldsInput);

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.error.set('Custom fields must be a JSON object.');
        return;
      }

      customFields = parsed as Record<string, unknown>;
    } catch {
      this.error.set('Custom fields must contain valid JSON.');
      return;
    }

    const payload: PutTodoMetadataDto = {
      tags,
      ...(color ? { color } : {}),
      ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
    };

    this.saving.set(true);

    this.todoService
      .putMetadata(this.task.id, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (metadata) => this.dialogRef.close(metadata),
        error: (error: unknown) => {
          this.error.set(
            error instanceof ApiHttpError ? error.message : 'Could not save metadata.',
          );
        },
      });
  }

  deleteMetadata(): void {
    if (!this.exists() || this.deleting()) {
      return;
    }

    this.error.set(null);
    this.deleting.set(true);

    this.todoService
      .removeMetadata(this.task.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => this.dialogRef.close(null),
        error: (error: unknown) => {
          this.error.set(
            error instanceof ApiHttpError ? error.message : 'Could not delete metadata.',
          );
        },
      });
  }

  isValidColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
  }

  onColorPickerChange(color: string): void {
    this.colorInput = color;
  }

  private fillForm(metadata: TodoMetadata): void {
    this.exists.set(true);
    this.tagsInput = metadata.tags.join(', ');
    this.colorInput = metadata.color ?? '';
    this.customFieldsInput = JSON.stringify(metadata.customFields ?? {}, null, 2);
    this.updatedAt = metadata.updatedAt;
  }
}

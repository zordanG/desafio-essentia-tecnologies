import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CreateTaskDto, Task } from '../../../shared/models/task.model';

export interface TodoFormDialogData {
  task?: Task;
}

export type TodoFormDialogResult = CreateTaskDto;

function trimmedRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { required: true };
}

function trimmedMaxLength(max: number) {
  return (control: AbstractControl<string>): ValidationErrors | null =>
    control.value.trim().length <= max ? null : { maxlength: true };
}

@Component({
  selector: 'app-todo-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './todo-form-dialog.html',
  styleUrl: './todo-form-dialog.css',
})
export class TodoFormDialog {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<TodoFormDialog, TodoFormDialogResult>);

  protected readonly data = inject<TodoFormDialogData>(MAT_DIALOG_DATA);
  protected readonly isEdit = this.data.task !== undefined;
  readonly form = this.formBuilder.nonNullable.group({
    title: [this.data.task?.title ?? '', [trimmedRequired, trimmedMaxLength(255)]],
    description: [this.data.task?.description ?? '', [trimmedMaxLength(2000)]],
  });

  get title() {
    return this.form.controls.title;
  }

  get description() {
    return this.form.controls.description;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const description = value.description.trim();

    this.dialogRef.close({
      title: value.title.trim(),
      description: description.length > 0 ? description : null,
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}

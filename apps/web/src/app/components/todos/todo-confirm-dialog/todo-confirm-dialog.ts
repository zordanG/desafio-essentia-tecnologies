import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface TodoConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
}

@Component({
  selector: 'app-todo-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './todo-confirm-dialog.html',
  styleUrl: './todo-confirm-dialog.css',
})
export class TodoConfirmDialog {
  private readonly dialogRef = inject(MatDialogRef<TodoConfirmDialog, boolean>);

  protected readonly data = inject<TodoConfirmDialogData>(MAT_DIALOG_DATA);

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}

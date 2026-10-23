import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiHttpError } from '../../../core/api/api-error';
import { Task } from '../../../shared/models/task.model';
import { TodoService } from '../../../shared/services/todo.service';
import { TodoMetadataDialog } from './todo-metadata-dialog';

const TASK: Task = {
  id: '9b2f4c1e-6f38-4f6e-9f8a-3a7c1d2e4b5a',
  title: 'Prepare the daily stand-up',
  description: 'Share progress with the team.',
  completed: false,
  created_at: '2026-10-23T09:00:00.000Z',
  updated_at: '2026-10-23T09:00:00.000Z',
};

const METADATA = {
  taskId: TASK.id,
  tags: ['urgent', 'frontend'],
  color: '#336699',
  customFields: { priority: 'high' },
  updatedAt: '2026-10-23T09:00:00.000Z',
};

let todoService: {
  getMetadata: ReturnType<typeof vi.fn>;
  putMetadata: ReturnType<typeof vi.fn>;
  patchMetadata: ReturnType<typeof vi.fn>;
  removeMetadata: ReturnType<typeof vi.fn>;
};

let dialogRef: {
  close: ReturnType<typeof vi.fn>;
};

describe('TodoMetadataDialog', () => {
  beforeEach(async () => {
    todoService = {
      getMetadata: vi.fn(() => of(METADATA)),
      putMetadata: vi.fn(() => of(METADATA)),
      patchMetadata: vi.fn(() => of(METADATA)),
      removeMetadata: vi.fn(() => of(void 0)),
    };

    dialogRef = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TodoMetadataDialog],
      providers: [
        { provide: TodoService, useValue: todoService },
        { provide: MAT_DIALOG_DATA, useValue: TASK },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
  });

  it('Loads the existing metadata', () => {
    const fixture = TestBed.createComponent(TodoMetadataDialog);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(todoService.getMetadata).toHaveBeenCalledWith(TASK.id);
    expect(component.tagsInput).toBe('urgent, frontend');
    expect(component.colorInput).toBe('#336699');
    expect(component.customFieldsInput).toContain('"priority"');
    expect(component.exists()).toBe(true);
  });

  it('Accepts valid hexadecimal colors', () => {
    const fixture = TestBed.createComponent(TodoMetadataDialog);
    const component = fixture.componentInstance;

    expect(component.isValidColor('#336699')).toBe(true);
    expect(component.isValidColor('#abcdef')).toBe(true);
    expect(component.isValidColor('#ABCDEF')).toBe(true);

    expect(component.isValidColor('336699')).toBe(false);
    expect(component.isValidColor('#fff')).toBe(false);
    expect(component.isValidColor('red')).toBe(false);
    expect(component.isValidColor('#GGGGGG')).toBe(false);
  });

  it('Updates the hexadecimal field when a color is selected', () => {
    const fixture = TestBed.createComponent(TodoMetadataDialog);
    const component = fixture.componentInstance;

    component.onColorPickerChange('#ff8800');

    expect(component.colorInput).toBe('#ff8800');
  });

  it('Saves metadata including the selected color', () => {
    const fixture = TestBed.createComponent(TodoMetadataDialog);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.tagsInput = 'urgent, frontend';
    component.colorInput = '#ff8800';
    component.customFieldsInput = '{"priority":"high"}';

    component.save();

    expect(todoService.putMetadata).toHaveBeenCalledWith(TASK.id, {
      tags: ['urgent', 'frontend'],
      color: '#ff8800',
      customFields: { priority: 'high' },
    });

    expect(dialogRef.close).toHaveBeenCalledWith(METADATA);
  });

  it('Deletes existing metadata', () => {
    const fixture = TestBed.createComponent(TodoMetadataDialog);
    fixture.detectChanges();

    fixture.componentInstance.deleteMetadata();

    expect(todoService.removeMetadata).toHaveBeenCalledWith(TASK.id);
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });

  it('Treats missing metadata as an empty form', () => {
    todoService.getMetadata.mockReturnValue(
      throwError(() => new ApiHttpError('Metadata not found', 'RESOURCE_NOT_FOUND', 404)),
    );

    const fixture = TestBed.createComponent(TodoMetadataDialog);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.exists()).toBe(false);
    expect(component.colorInput).toBe('');
    expect(component.tagsInput).toBe('');
    expect(component.loading()).toBe(false);
  });

  it('Shows an error when metadata cannot be loaded', () => {
    todoService.getMetadata.mockReturnValue(
      throwError(() => new ApiHttpError('Service unavailable', 'SERVICE_UNAVAILABLE', 503)),
    );

    const fixture = TestBed.createComponent(TodoMetadataDialog);
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe('Service unavailable');
  });
});

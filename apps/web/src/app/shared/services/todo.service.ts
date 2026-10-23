import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../core/config/app-config.service';
import { CreateTaskDto, Task, UpdateTaskDto } from '../models/task.model';
import {
  PatchTodoMetadataDto,
  PutTodoMetadataDto,
  TodoMetadata,
} from '../models/todo-metadata.model';

@Injectable({
  providedIn: 'root',
})
export class TodoService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly baseUrl = `${this.config.apiBaseUrl}/api/todos`;

  list(): Observable<Task[]> {
    return this.http.get<Task[]>(this.baseUrl);
  }

  getById(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateTaskDto): Observable<Task> {
    return this.http.patch<Task>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getMetadata(taskId: string): Observable<TodoMetadata> {
    return this.http.get<TodoMetadata>(`${this.baseUrl}/${taskId}/metadata`);
  }

  putMetadata(taskId: string, payload: PutTodoMetadataDto): Observable<TodoMetadata> {
    return this.http.put<TodoMetadata>(`${this.baseUrl}/${taskId}/metadata`, payload);
  }

  patchMetadata(taskId: string, payload: PatchTodoMetadataDto): Observable<TodoMetadata> {
    return this.http.patch<TodoMetadata>(`${this.baseUrl}/${taskId}/metadata`, payload);
  }

  removeMetadata(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${taskId}/metadata`);
  }
}

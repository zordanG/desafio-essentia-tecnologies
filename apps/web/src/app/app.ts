import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TodoBoard } from './components/todos/todo-board/todo-board';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule, TodoBoard],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly themeService = inject(ThemeService);
}

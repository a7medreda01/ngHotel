import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Layout } from './layout/layout/layout';
import { Navbar } from './layout/navbar/navbar';
import { Sidebar } from './layout/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ngHotel');
}

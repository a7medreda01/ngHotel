import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './service/language.service';
import { ProjectBrandService } from './service/project-brand.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('ngHotel');

  constructor() {
    inject(LanguageService).init();
    inject(ProjectBrandService);
  }
}

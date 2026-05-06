import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Navbar } from '../navbar/navbar';
import { Sidebar } from '../sidebar/sidebar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet,Navbar,CommonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  isOpen = true;

  toggleSidebar() {
    this.isOpen = !this.isOpen;
  }

}
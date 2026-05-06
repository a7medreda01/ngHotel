import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../service/Auth-service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.router.navigate(['/login']);
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class ManagerGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.isLoggedIn() && this.auth.isManager()) return true;
    this.router.navigate(['/dashboard']);
    return false;
  }
}
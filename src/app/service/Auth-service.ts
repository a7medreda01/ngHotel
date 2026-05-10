import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment.prod';

export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  refreshToken: string;           // ← جديد
  refreshTokenExpiration: string; // ← جديد
  userId: number;
  email: string;
  fullName: string;
  role: string;
}
export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: 'Manager' | 'Employee';
  partnerId: number;
}
export interface UserItem {
  id: number;
  email: string;
  fullName: string;
  role: string;
}
export interface ForgetPasswordRequest {
  email: string;
}
export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}
export interface UserItem {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean; // ← أضف ده
}
const STORAGE_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseUrl = `${environment.baseUrl}/Auth`;

  constructor(private http: HttpClient, private router: Router) {}

  // ─── Login ───────────────────────────────────────────
  login(body: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, body).pipe(
      tap((res) => this.saveSession(res))
    );
  }

  // ─── Create User (Manager only) ──────────────────────
  createUser(body: CreateUserRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/create-user`, body, {
      responseType: 'text'
    });
  }

  // ─── Get All Users ────────────────────────────────────
  getUsers(): Observable<UserItem[]> {
    return this.http.get<UserItem[]>(`${this.baseUrl}/users`);
  }

  // ─── Delete User ──────────────────────────────────────
  deleteUser(id: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/user/${id}`, {
      responseType: 'text'
    });
  }

  // ─── Forget Password ─────────────────────────────────
  forgetPassword(body: ForgetPasswordRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/forget-password`, body, {
      responseType: 'text'
    });
  }

  // ─── Reset Password ──────────────────────────────────
  resetPassword(body: ResetPasswordRequest): Observable<string> {
    return this.http.post(`${this.baseUrl}/reset-password`, body, {
      responseType: 'text'
    });
  }

  // ─── Session Management ──────────────────────────────
  saveSession(data: LoginResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  getSession(): LoginResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  getToken(): string | null {
    return this.getSession()?.token ?? null;
  }
  isLoggedIn(): boolean {
    const session = this.getSession();
    if (!session?.token) return false;
    try {
      const payload = JSON.parse(atob(session.token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
  isManager(): boolean {
    return this.getSession()?.role === 'Manager';
  }
  hasRole(role: string): boolean {
    return this.getSession()?.role === role;
  }
  toggleActive(userId: number): Observable<{ message: string; isActive: boolean }> {
  return this.http.put<{ message: string; isActive: boolean }>(
    `${this.baseUrl}/toggle-active/${userId}`,
    {}
  );
}

refreshToken(token: string): Observable<LoginResponse> {
  return this.http.post<LoginResponse>(`${this.baseUrl}/refresh-token`, {
    refreshToken: token
  }).pipe(tap(res => this.saveSession(res)));
}

revokeToken(): Observable<any> {
  const session = this.getSession();
  return this.http.post(`${this.baseUrl}/revoke-token`, {
    refreshToken: session?.refreshToken
  }, { responseType: 'text' });
}

// عدّل logout
logout(): void {
  const session = this.getSession();
  if (session?.refreshToken) {
    this.revokeToken().subscribe(); // revoke في الـ backend
  }
  localStorage.removeItem(STORAGE_KEY);
  this.router.navigate(['/login']);
}
}
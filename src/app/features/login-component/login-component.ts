import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../service/Auth-service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login-component.html',
  styleUrls: ['./login-component.css']
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  constructor(private auth: AuthService, private router: Router) {
    // Redirect if already logged in
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (!this.email || !this.password) return;
    if (this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        } else {
          this.errorMessage = 'حدث خطأ، يرجى المحاولة مرة أخرى';
        }
      }
    });
  }
}
import { Component } from '@angular/core';
import { AuthService } from '../../service/Auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forget-password-component',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forget-password-component.html',
  styleUrl: './forget-password-component.css',
})
export class ForgetPasswordComponent {
  email = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';
 
  constructor(private auth: AuthService) {}
 
  onSubmit(): void {
    if (!this.email || this.isLoading) return;
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
 
    this.auth.forgetPassword({ email: this.email }).subscribe({
      next: (msg) => {
        this.isLoading = false;
        this.successMessage = 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني إذا كان مسجلاً لدينا.';
      },
      error: () => {
        this.isLoading = false;
        // API returns 200 even for wrong email, so error = network issue
        this.errorMessage = 'حدث خطأ في الاتصال، يرجى المحاولة لاحقاً';
      }
    });
  }
}
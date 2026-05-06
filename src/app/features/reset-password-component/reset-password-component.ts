import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../service/Auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reset-password-component',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password-component.html',
  styleUrl: './reset-password-component.css',
})
export class ResetPasswordComponent implements OnInit {
  email = '';
  token = '';
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
 
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  tokenMissing = false;
 
  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router
  ) {}
 
  ngOnInit(): void {
    // استخراج email و token من الـ URL query params
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] ?? '';
      this.token = params['token'] ?? '';
      if (!this.email || !this.token) {
        this.tokenMissing = true;
      }
    });
  }
 
  get passwordsMatch(): boolean {
    return this.newPassword === this.confirmPassword;
  }
 
  get isValid(): boolean {
    return (
      this.newPassword.length >= 6 &&
      this.passwordsMatch &&
      !this.isLoading
    );
  }
 
  onSubmit(): void {
    if (!this.isValid) return;
    this.isLoading = true;
    this.errorMessage = '';
      console.log(this.email)
      console.log(this.token)
 
    this.auth.resetPassword({
      email: this.email,
      token: this.token,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'تم تغيير كلمة المرور بنجاح! سيتم توجيهك لتسجيل الدخول...';
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 400) {
          this.errorMessage = 'الرابط منتهي الصلاحية أو غير صالح. يرجى طلب رابط جديد.';
        } else {
          this.errorMessage = 'حدث خطأ، يرجى المحاولة لاحقاً';
        }
      }
    });
  }
}
 
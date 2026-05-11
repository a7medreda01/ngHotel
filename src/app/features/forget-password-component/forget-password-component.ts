import { Component } from '@angular/core';
import { AuthService } from '../../service/Auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-forget-password-component',
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './forget-password-component.html',
  styleUrl: './forget-password-component.css',
})
export class ForgetPasswordComponent {
  email = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';
 
  constructor(
    private auth: AuthService,
    private translate: TranslateService
  ) {}
 
  onSubmit(): void {
    if (!this.email || this.isLoading) return;
    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';
 
    this.auth.forgetPassword({ email: this.email }).subscribe({
      next: (msg) => {
        this.isLoading = false;
        this.successMessage = this.translate.instant('features.forget.success');
      },
      error: () => {
        this.isLoading = false;
        // API returns 200 even for wrong email, so error = network issue
        this.errorMessage = this.translate.instant('features.forget.error');
      }
    });
  }
}
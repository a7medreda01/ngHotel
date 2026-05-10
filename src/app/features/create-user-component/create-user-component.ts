import { Component, OnInit } from '@angular/core';
import { AuthService, CreateUserRequest, UserItem } from '../../service/Auth-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-create-user-component',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './create-user-component.html',
  styleUrl: './create-user-component.css',
})
export class CreateUserComponent implements OnInit {

  // ─── Create Form ─────────────────────────────────────
  form: CreateUserRequest = {
    email: '',
    password: '',
    fullName: '',
    role: 'Employee',
    partnerId: 0
  };
  showPassword = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  // ─── Users List ──────────────────────────────────────
  users: UserItem[] = [];
  isLoadingUsers = false;
  usersError = '';
  deletingId: number | null = null;
  showDeleteConfirm = false;
  userToDelete: UserItem | null = null;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  // ─── Load All Users ───────────────────────────────────
  loadUsers(): void {
    this.isLoadingUsers = true;
    this.usersError = '';
    this.auth.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.isLoadingUsers = false;
      },
      error: () => {
        this.usersError = 'تعذّر تحميل قائمة المستخدمين';
        this.isLoadingUsers = false;
      }
    });
  }

  // ─── Delete Flow ──────────────────────────────────────
  openDeleteConfirm(user: UserItem): void {
    this.userToDelete = user;
    this.showDeleteConfirm = true;
  }
  closeDeleteConfirm(): void {
    this.userToDelete = null;
    this.showDeleteConfirm = false;
  }
  confirmDelete(): void {
    if (!this.userToDelete) return;
    const id = this.userToDelete.id;
    this.deletingId = id;
    this.auth.deleteUser(id).subscribe({
      next: () => {
        // تحديث لحظي — مفيش حاجة تتحمل تاني
        this.users = this.users.filter(u => u.id !== id);
        this.deletingId = null;
        this.closeDeleteConfirm();
      },
      error: () => {
        this.deletingId = null;
        this.closeDeleteConfirm();
        this.usersError = 'حدث خطأ أثناء الحذف، حاول مرة أخرى';
      }
    });
  }

  // ─── Create Submit ────────────────────────────────────
  onSubmit(): void {
    if (!this.form.email || !this.form.password || !this.form.fullName) return;
    if (this.isLoading) return;

    this.isLoading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.auth.createUser(this.form).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = `تم إنشاء حساب "${this.form.fullName}" بنجاح!`;
        this.resetForm();
        // تحديث لحظي — إعادة تحميل القائمة
        this.loadUsers();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 409) {
          this.errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
        } else {
          this.errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        }
      }
    });
  }

  resetForm(): void {
    this.form = {
      email: '',
      password: '',
      fullName: '',
      role: 'Employee',
      partnerId: 0
    };
  }

  // ─── Helpers ──────────────────────────────────────────
  getRoleLabel(role: string): string {
    const map: Record<string, string> = {
      Manager: 'مدير',
      Employee: 'موظف',
      Partner: 'شريك'
    };
    return map[role] ?? role;
  }

  getRoleClass(role: string): string {
    const map: Record<string, string> = {
      Manager: 'role-manager',
      Employee: 'role-employee',
      Partner: 'role-partner'
    };
    return map[role] ?? 'role-default';
  }

  getRoleIcon(role: string): string {
    const map: Record<string, string> = {
      Manager: 'bi-star-fill',
      Employee: 'bi-person-fill',
      Partner: 'bi-briefcase-fill'
    };
    return map[role] ?? 'bi-person-fill';
  }
  // في الـ properties
togglingId: number | null = null;

// ميثود جديدة
toggleActive(user: UserItem): void {
  this.togglingId = user.id;
  this.auth.toggleActive(user.id).subscribe({
    next: (res) => {
      user.isActive = res.isActive; // تحديث لحظي بدون reload
      this.togglingId = null;
    },
    error: (err) => {
      this.togglingId = null;
      this.usersError = err.error?.message || 'حدث خطأ أثناء تغيير حالة الحساب';
    }
  });
}
}
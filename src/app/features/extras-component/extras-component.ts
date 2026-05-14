import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Extra, ExtraCreateDto, ExtrasService, ExtraUpdateDto } from '../../service/extras-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-extras-component',
  templateUrl: './extras-component.html',
  imports: [CommonModule, FormsModule],
  styleUrls: ['./extras-component.scss']
})
export class ExtrasComponent implements OnInit {

  extras: Extra[] = [];
  filteredExtras: Extra[] = [];
  searchTerm: string = '';

  loading = false;
  saving = false;
  deleting = false;

  showModal = false;
  showDeleteModal = false;

  isEditMode = false;
  selectedExtra: Extra | null = null;

  form: ExtraCreateDto & { isActive?: boolean } = {
    name: '',
    price: 0,
    isActive: true
  };

  formErrors: { name?: string; price?: string } = {};

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;

  constructor(private extrasService: ExtrasService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadExtras();
  }

  loadExtras(): void {
    this.loading = true;
    this.extrasService.getAll().subscribe({
      next: (data) => {
        this.extras = data;
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.showNotification('حدث خطأ أثناء تحميل البيانات', 'error');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredExtras = [...this.extras];
    } else {
      this.filteredExtras = this.extras.filter(e =>
        e.name.toLowerCase().includes(term)
      );
    }
  }

  get activeCount(): number {
    return this.extras.filter(e => e.isActive).length;
  }

  get inactiveCount(): number {
    return this.extras.filter(e => !e.isActive).length;
  }

  get totalPrice(): number {
    return this.extras.filter(e => e.isActive).reduce((sum, e) => sum + e.price, 0);
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.selectedExtra = null;
    this.form = { name: '', price: 0, isActive: true };
    this.formErrors = {};
    this.showModal = true;
  }

  openEditModal(extra: Extra): void {
    this.isEditMode = true;
    this.selectedExtra = extra;
    this.form = { name: extra.name, price: extra.price, isActive: extra.isActive };
    this.formErrors = {};
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedExtra = null;
    this.formErrors = {};
  }

  validateForm(): boolean {
    this.formErrors = {};
    if (!this.form.name || this.form.name.trim() === '') {
      this.formErrors.name = 'اسم الخدمة مطلوب';
    }
    if (this.form.price == null || this.form.price < 0) {
      this.formErrors.price = 'السعر يجب أن يكون 0 أو أكثر';
    }
    return Object.keys(this.formErrors).length === 0;
  }

  saveExtra(): void {
    if (!this.validateForm()) return;

    this.saving = true;

    if (this.isEditMode && this.selectedExtra) {
      const dto: ExtraUpdateDto = {
        name: this.form.name,
        price: this.form.price,
        isActive: this.form.isActive ?? true
      };
      this.extrasService.update(this.selectedExtra.id, dto).subscribe({
        next: () => {
          this.showNotification('تم تحديث الخدمة بنجاح', 'success');
          this.closeModal();
          this.loadExtras();
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.showNotification('حدث خطأ أثناء التحديث', 'error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      const dto: ExtraCreateDto = {
        name: this.form.name,
        price: this.form.price
      };
      this.extrasService.create(dto).subscribe({
        next: () => {
          this.showNotification('تمت إضافة الخدمة بنجاح', 'success');
          this.closeModal();
          this.loadExtras();
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.showNotification('حدث خطأ أثناء الإضافة', 'error');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  confirmDelete(extra: Extra): void {
    this.selectedExtra = extra;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.selectedExtra = null;
  }

  deleteExtra(): void {
    if (!this.selectedExtra) return;
    this.deleting = true;
    this.extrasService.delete(this.selectedExtra.id).subscribe({
      next: () => {
        this.showNotification('تم حذف الخدمة بنجاح', 'success');
        this.cancelDelete();
        this.loadExtras();
        this.deleting = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.showNotification('حدث خطأ أثناء الحذف', 'error');
        this.deleting = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleActive(extra: Extra): void {
    const dto: ExtraUpdateDto = {
      name: extra.name,
      price: extra.price,
      isActive: !extra.isActive
    };
    this.extrasService.update(extra.id, dto).subscribe({
      next: () => {
        extra.isActive = !extra.isActive;
        this.applyFilter();
        this.showNotification(
          extra.isActive ? 'تم تفعيل الخدمة' : 'تم إيقاف الخدمة',
          'success'
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.showNotification('حدث خطأ', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.markForCheck();
    }, 3000);
  }
}
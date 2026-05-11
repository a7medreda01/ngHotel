import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Extra, ExtraCreateDto, ExtrasService, ExtraUpdateDto } from '../../service/extras-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-extras-component',
  templateUrl: './extras-component.html',
  imports: [CommonModule, FormsModule, TranslatePipe],
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

  constructor(
    private extrasService: ExtrasService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

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
              this.cdr.detectChanges(); // 🔥 مهم

      },
      error: () => {
        this.showNotification(this.translate.instant('features.extras.toastLoadFail'), 'error');
        this.loading = false;
              this.cdr.detectChanges(); // 🔥 مهم

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
      this.formErrors.name = this.translate.instant('features.extras.errName');
    }
    if (this.form.price == null || this.form.price < 0) {
      this.formErrors.price = this.translate.instant('features.extras.errPrice');
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
          this.showNotification(this.translate.instant('features.extras.toastUpdateOk'), 'success');
          this.closeModal();
          this.loadExtras();
          this.saving = false;
        },
        error: () => {
          this.showNotification(this.translate.instant('features.extras.toastUpdateFail'), 'error');
          this.saving = false;
        }
      });
    } else {
      const dto: ExtraCreateDto = {
        name: this.form.name,
        price: this.form.price
      };
      this.extrasService.create(dto).subscribe({
        next: () => {
          this.showNotification(this.translate.instant('features.extras.toastAddOk'), 'success');
          this.closeModal();
          this.loadExtras();
          this.saving = false;
        },
        error: () => {
          this.showNotification(this.translate.instant('features.extras.toastAddFail'), 'error');
          this.saving = false;
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
      },
      error: () => {
        this.showNotification('حدث خطأ أثناء الحذف', 'error');
        this.deleting = false;
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
          extra.isActive
            ? this.translate.instant('features.extras.toastToggleOk')
            : this.translate.instant('features.extras.toastToggleOffOk'),
          'success'
        );
      },
      error: () => {
        this.showNotification(this.translate.instant('features.extras.toastToggleFail'), 'error');
      }
    });
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }
}
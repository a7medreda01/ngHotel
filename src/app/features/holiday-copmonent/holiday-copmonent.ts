import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Holiday, HolidayService } from '../../service/holiday-service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-holiday-copmonent',
  imports: [CommonModule, FormsModule, TranslatePipe],

  templateUrl: './holiday-copmonent.html',
  styleUrl: './holiday-copmonent.css',
})
export class HolidayCopmonent implements OnInit {
  holidays: Holiday[] = [];
  loading = false;
  toast = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;
 
  showModal = false;
  isEdit = false;
  submitting = false;
 
  showDeleteModal = false;
  deleteTarget: Holiday | null = null;
 
  form = { id: 0, name: '', date: '' };
 
  constructor(
    private holidayService: HolidayService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}
 
  ngOnInit(): void {
    this.load();
  }
 
  load(): void {
    this.loading = true;
    this.holidayService.getAll().subscribe({
      next: (data) => {
        // ترتيب تصاعدي بالتاريخ
        this.holidays = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notify(this.translate.instant('features.holiday.loadFail'), 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
 
  openAdd(): void {
    this.isEdit = false;
    this.form = { id: 0, name: '', date: '' };
    this.showModal = true;
  }
 
  openEdit(h: Holiday): void {
    this.isEdit = true;
    this.form = { id: h.id, name: h.name, date: this.toInputDate(h.date) };
    this.showModal = true;
  }
 
  closeModal(): void {
    this.showModal = false;
  }
 
  submit(): void {
    if (!this.form.name.trim() || !this.form.date) {
      this.notify(this.translate.instant('features.holiday.fillAll'), 'error');
      return;
    }
    this.submitting = true;
    const dto = { name: this.form.name.trim(), date: this.form.date };
    const req$ = this.isEdit
      ? this.holidayService.update(this.form.id, dto)
      : this.holidayService.create(dto);
 
    req$.subscribe({
      next: () => {
        this.submitting = false;
        this.showModal = false;
        this.notify(
          this.isEdit
            ? this.translate.instant('features.holiday.saveOkEdit')
            : this.translate.instant('features.holiday.saveOkAdd'),
          'success'
        );
        this.load();
      },
      error: () => {
        this.submitting = false;
        this.notify(this.translate.instant('features.holiday.saveFail'), 'error');
      }
    });
  }
 
  confirmDelete(h: Holiday): void {
    this.deleteTarget = h;
    this.showDeleteModal = true;
  }
 
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTarget = null;
  }
 
  doDelete(): void {
    if (!this.deleteTarget) return;
    this.holidayService.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.deleteTarget = null;
        this.notify(this.translate.instant('features.holiday.deleteOk'), 'success');
        this.load();
      },
      error: () => {
        this.showDeleteModal = false;
        this.notify(this.translate.instant('features.holiday.deleteFail'), 'error');
      }
    });
  }
 
  formatDate(d: string): string {
    if (!d) return '';
    const part = d.split('T')[0];
    const [y, m, day] = part.split('-').map(Number);
    const lang = this.translate.currentLang || 'ar';
    const loc = lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-GB';
    return new Date(y, m - 1, day).toLocaleDateString(loc, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
 
  toInputDate(d: string): string {
    if (!d) return '';
    return d.split('T')[0];
  }
 
  /** هل الإجازة مرت؟ */
  isPast(d: string): boolean {
    const part = d.split('T')[0];
    const [y, m, day] = part.split('-').map(Number);
    return new Date(y, m - 1, day) < new Date(new Date().setHours(0, 0, 0, 0));
  }
 
  notify(msg: string, type: 'success' | 'error'): void {
    this.toast = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3000);
  }
}
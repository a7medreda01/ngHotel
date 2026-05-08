import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ChaletService } from '../../service/chalet-service';
import * as chaletSvc from '../../service/chalet-service';
import { normalizeChalet } from '../../service/chalet-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatCountPipe } from '../../adds/pipes/count.pipe';

interface ImageItem {
  id: number;
  url: string;
}

@Component({
  selector: 'app-chalet',
  imports: [CommonModule, FormsModule, StatCountPipe],
  templateUrl: './chalet.html',
  styleUrl: './chalet.css',
})
export class Chalet implements OnInit {

  chalets: chaletSvc.Chalet[] = [];
  loading    = false;
  error      = '';
  successMsg = '';

  showModal      = false;
  isEditMode     = false;
  submitting     = false;

  showDeleteModal = false;
  chaletToDelete: chaletSvc.Chalet | null = null;

  currentImageItems: ImageItem[] = [];
  removedImageIds: number[] = [];
  selectedFiles: File[]   = [];
  previewUrls: string[]   = [];

  form = {
    id:         0,
    name:       '',
    type:       0,
    status:     0,
    partnerId:  0,
    hasMorning: true,
    hasEvening: true,
    hasFullDay: true,
  };

  typeOptions = [
    { value: 0, label: '🏠 عادي' },
    { value: 1, label: '👑 رويال' }
  ];

  statusOptions = [
    { value: 0, label: 'متاح' },
    { value: 1, label: 'محجوز' },
    { value: 2, label: 'صيانة' }
  ];

  constructor(
    private chaletService: ChaletService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadChalets();
  }

  loadChalets(): void {
    this.loading = true;
    this.chaletService.getAll().subscribe({
      next: (data) => {
        // ✅ normalizeChalet بتتطبق في الـ service مباشرة
        this.chalets = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error   = 'حدث خطأ أثناء تحميل البيانات';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ════ LABELS ════

  getTypeLabel(type: string): string {
    return type === 'Royal' ? '👑 رويال' : '🏠 عادي';
  }

  getStatusLabel(status: string): string {
    return ({ Available: 'متاح', Booked: 'محجوز', Maintenance: 'صيانة' } as any)[status] ?? status;
  }

  getStatusClass(status: string): string {
    return ({ Available: 'badge-available', Booked: 'badge-booked', Maintenance: 'badge-maintenance' } as any)[status] ?? '';
  }

  /**
   * ✅ استخراج الفترات المتاحة من الكوخ
   * بعد الـ normalize القيم دايماً boolean صح
   */
  getChaletPeriods(chalet: chaletSvc.Chalet): { morning: boolean; evening: boolean; fullDay: boolean } {
    return {
      morning: chalet.hasMorning === true,
      evening: chalet.hasEvening === true,
      fullDay: chalet.hasFullDay === true,
    };
  }

  getPeriodsLabel(chalet: chaletSvc.Chalet): string {
    const p = this.getChaletPeriods(chalet);
    const labels: string[] = [];
    if (p.morning) labels.push('🌅 صباحي');
    if (p.evening) labels.push('🌇 مسائي');
    if (p.fullDay) labels.push('🌞 كامل');
    if (labels.length === 3) return '🌅🌇🌞 كل الفترات';
    if (labels.length === 0) return 'لا توجد فترات';
    return labels.join(' + ');
  }

  // ════ MODALS ════

  openAddModal(): void {
    this.isEditMode        = false;
    this.form              = {
      id: 0, name: '', type: 0, status: 0, partnerId: 0,
      hasMorning: true, hasEvening: true, hasFullDay: true
    };
    this.currentImageItems = [];
    this.removedImageIds   = [];
    this.selectedFiles     = [];
    this.previewUrls       = [];
    this.error             = '';
    this.showModal         = true;
  }

  openEditModal(chalet: chaletSvc.Chalet): void {
    this.isEditMode = true;

    // ✅ بعد الـ normalize القيم boolean صح مباشرة
    this.form = {
      id:         chalet.id,
      name:       chalet.name,
      type:       chalet.type === 'Royal' ? 1 : 0,
      status:     chalet.status === 'Available' ? 0 : chalet.status === 'Booked' ? 1 : 2,
      partnerId:  chalet.partnerId ?? 0,
      hasMorning: chalet.hasMorning === true,
      hasEvening: chalet.hasEvening === true,
      hasFullDay: chalet.hasFullDay === true,
    };

    // بناء قائمة الصور
    if (chalet.imageObjects && chalet.imageObjects.length > 0) {
      this.currentImageItems = chalet.imageObjects.map(img => ({ id: img.id, url: img.url }));
    } else if (chalet.images && chalet.images.length > 0) {
      this.currentImageItems = chalet.images.map((url, i) => ({ id: i, url }));
    } else {
      this.currentImageItems = [];
    }

    this.removedImageIds = [];
    this.selectedFiles   = [];
    this.previewUrls     = [];
    this.error           = '';
    this.showModal       = true;
    
  }

  closeModal(): void {
    this.showModal = false;
    this.error     = '';
  }

  // ════ VALIDATION ════

  get atLeastOnePeriod(): boolean {
    return this.form.hasMorning || this.form.hasEvening || this.form.hasFullDay;
  }

  // ════ FILES ════

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.selectedFiles = Array.from(input.files);
    this.previewUrls   = [];
    this.selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrls.push(e.target?.result as string);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    });
  }

  removeCurrentImage(index: number): void {
    const removed = this.currentImageItems.splice(index, 1);
    if (removed.length > 0) this.removedImageIds.push(removed[0].id);
    this.cdr.detectChanges();
  }

  // ════ FORM BUILD ════

  buildFormData(): FormData {
    const fd = new FormData();
    fd.append('Id',         this.form.id.toString());
    fd.append('Name',       this.form.name.trim());
    fd.append('Status',     this.form.status.toString());

    // ✅ إرسال boolean fields مباشرة
    fd.append('HasMorning', this.form.hasMorning.toString());
    fd.append('HasEvening', this.form.hasEvening.toString());
    fd.append('HasFullDay', this.form.hasFullDay.toString());

    this.selectedFiles.forEach(file => fd.append('NewImages', file));

    if (this.removedImageIds.length > 0) {
      console.log(this.removedImageIds)
      this.removedImageIds.forEach(id => fd.append('RemovedImageIds', id.toString()));
    } 

    return fd;
  }

  buildCreateFormData(): FormData {
    const fd = new FormData();
    fd.append('Name',      this.form.name.trim());
    fd.append('Type',      this.form.type.toString());
    fd.append('Status',    this.form.status.toString());
    fd.append('PartnerId', this.form.partnerId.toString());

    fd.append('HasMorning', this.form.hasMorning.toString());
    fd.append('HasEvening', this.form.hasEvening.toString());
    fd.append('HasFullDay', this.form.hasFullDay.toString());

    this.selectedFiles.forEach(file => fd.append('Images', file));

    return fd;
  }

  submitForm(): void {
    if (!this.form.name.trim()) {
      this.error = 'يرجى إدخال اسم الشاليه';
      return;
    }
    if (!this.atLeastOnePeriod) {
      this.error = 'يرجى اختيار فترة واحدة على الأقل';
      return;
    }

    this.submitting = true;
    this.error      = '';

    const fd       = this.isEditMode ? this.buildFormData() : this.buildCreateFormData();
    const request$ = this.isEditMode
      ? this.chaletService.update(fd)
      : this.chaletService.create(fd);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.showModal  = false;
        this.successMsg = this.isEditMode ? 'تم تعديل الشاليه بنجاح ✓' : 'تم إضافة الشاليه بنجاح ✓';
        this.loadChalets();
        setTimeout(() => this.successMsg = '', 3500);
      },
      error: (err) => {
        this.submitting = false;
        this.error      = err?.error?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى';
      }
    });
  }

  // ════ DELETE ════

  confirmDelete(chalet: chaletSvc.Chalet): void {
    this.chaletToDelete  = chalet;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.chaletToDelete  = null;
  }

  doDelete(): void {
    if (!this.chaletToDelete) return;
    this.chaletService.delete(this.chaletToDelete.id).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.chaletToDelete  = null;
        this.successMsg      = 'تم حذف الشاليه بنجاح';
        this.loadChalets();
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => {
        this.showDeleteModal = false;
        this.error           = 'حدث خطأ أثناء الحذف';
      }
    });
  }
}
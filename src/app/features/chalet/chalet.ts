import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ChaletService } from '../../service/chalet-service';
import * as chaletSvc from '../../service/chalet-service';
import { normalizeChalet } from '../../service/chalet-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatCountPipe } from '../../adds/pipes/count.pipe';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

interface ImageItem {
  id: number;
  url: string;
}

@Component({
  selector: 'app-chalet',
  imports: [CommonModule, FormsModule, StatCountPipe, TranslatePipe],
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

  constructor(
    private chaletService: ChaletService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
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
        this.error   = this.translate.instant('features.chalet.loadError');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ════ LABELS ════

  getTypeLabel(type: string): string {
    return type === 'Royal'
      ? this.translate.instant('misc.royal')
      : this.translate.instant('misc.normal');
  }

  getStatusLabel(status: string): string {
    const key = `chaletStatus.${status}`;
    const t = this.translate.instant(key);
    return t !== key ? t : status;
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
    if (p.morning) labels.push(this.translate.instant('misc.overviewPeriodMorning'));
    if (p.evening) labels.push(this.translate.instant('misc.overviewPeriodEvening'));
    if (p.fullDay) labels.push(this.translate.instant('misc.overviewPeriodFull'));
    if (labels.length === 3) return this.translate.instant('features.chalet.allPeriodsShort');
    if (labels.length === 0) return this.translate.instant('features.chalet.noPeriods');
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

  this.form = {
    id:         chalet.id,
    name:       chalet.name,
    type:       chalet.type === 'Royal' ? 1 : 0,
    status:     chalet.status === 'Available' ? 0
                : chalet.status === 'Booked' ? 1 : 2,
    partnerId:  chalet.partnerId ?? 0,
    hasMorning: chalet.hasMorning === true,
    hasEvening: chalet.hasEvening === true,
    hasFullDay: chalet.hasFullDay === true,
  };

  // ✅ imageObjects دلوقتي بييجي صح مع Id حقيقي
  if (chalet.imageObjects && chalet.imageObjects.length > 0) {
    this.currentImageItems = (chalet.imageObjects ?? [])
    .filter(img => !!img.url)
    .map(img => ({ id: img.id, url: img.url }));
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
  fd.append('HasMorning', this.form.hasMorning.toString());
  fd.append('HasEvening', this.form.hasEvening.toString());
  fd.append('HasFullDay', this.form.hasFullDay.toString());

  this.selectedFiles.forEach(file => fd.append('NewImages', file));

  // ✅ تحقق إن الـ ids مش صفر قبل الإرسال
  const validRemovedIds = this.removedImageIds.filter(id => id > 0);
  validRemovedIds.forEach(id => fd.append('RemovedImageIds', id.toString()));

  // Debug — احذفه بعد التأكد
  console.log('RemovedImageIds being sent:', validRemovedIds);
  console.log('currentImageItems:', this.currentImageItems);

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
      this.error = this.translate.instant('features.chalet.nameRequired');
      return;
    }
    if (!this.atLeastOnePeriod) {
      this.error = this.translate.instant('features.chalet.periodRequired');
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
        this.successMsg = this.isEditMode
          ? this.translate.instant('features.chalet.saveOkEdit')
          : this.translate.instant('features.chalet.saveOkAdd');
        this.loadChalets();
        setTimeout(() => this.successMsg = '', 3500);
      },
      error: (err) => {
        this.submitting = false;
        this.error      = err?.error?.message || this.translate.instant('features.chalet.saveError');
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
        this.successMsg      = this.translate.instant('features.chalet.deleteOk');
        this.loadChalets();
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: () => {
        this.showDeleteModal = false;
        this.error           = this.translate.instant('features.chalet.deleteError');
      }
    });
  }
}
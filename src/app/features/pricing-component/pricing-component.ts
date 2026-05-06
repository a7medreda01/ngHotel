import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Chalet, ChaletService, getAvailablePeriodsArray } from '../../service/chalet-service';
import { Pricing, CreatePricingDto, PricingService } from '../../service/pricing-service';

@Component({
  selector: 'app-pricing-component',
  imports: [CommonModule, FormsModule],

  templateUrl: './pricing-component.html',
  styleUrl: './pricing-component.css',
})
export class PricingComponent implements OnInit {
  pricings: Pricing[] = [];
  chalets: Chalet[]   = [];
  loading = false;
  toast = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;
 
  showModal   = false;
  isEdit      = false;
  submitting  = false;
  deleteTarget: Pricing | null = null;
  showDeleteModal = false;
 
  // حساب السعر
  calcType    = 0;
  calcPeriod  = 0;
  calcDayType = 0;
  calcResult: number | null = null;
  calcLoading = false;
 
  form: CreatePricingDto & { id: number } = {
    id: 0,
    chaletType: 0,
    period: 0,
    price: 0,
    dayType: 0,
  };
 
  // تسميات من الـ enums
  readonly chaletTypeLabels: Record<string, string> = { Normal: 'عادي', Royal: 'رويال' };
  readonly periodLabels: Record<string, string>     = { Morning: 'صباحي', Evening: 'مسائي', Full: 'يوم كامل' };
  readonly dayTypeLabels: Record<string, string>    = { Weekday: 'يوم عادي', Weekend: 'عطلة', Holiday: 'إجازة رسمية' };
 
  readonly chaletTypeOptions = [
    { value: 0, label: 'عادي (Normal)' },
    { value: 1, label: 'رويال (Royal)' },
  ];
  readonly periodOptions = [
    { value: 0, label: '🌅 صباحي' },
    { value: 1, label: '🌇 مسائي' },
    { value: 2, label: '🌞 يوم كامل' },
  ];
  readonly dayTypeOptions = [
    { value: 0, label: '📅 يوم عادي' },
    { value: 1, label: '🏖️ عطلة' },
    { value: 2, label: '🎉 إجازة رسمية' },
  ];
 
  constructor(
    private pricingService: PricingService,
    private chaletService: ChaletService,
    private cdr: ChangeDetectorRef
  ) {}
 
  ngOnInit(): void {
    this.load();
  }
 
  load(): void {
    this.loading = true;
    forkJoin({
      pricings: this.pricingService.getAll(),
      chalets:  this.chaletService.getAll(),
    }).subscribe({
      next: ({ pricings, chalets }) => {
        this.pricings = pricings;
        this.chalets  = chalets;
        this.loading  = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notify('فشل تحميل البيانات', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
 
  openAdd(): void {
    this.isEdit = false;
    this.form = { id: 0, chaletType: 0, period: 0, price: 0, dayType: 0 };
    this.showModal = true;
  }
 
  openEdit(p: Pricing): void {
    this.isEdit = true;
    this.form = {
      id: p.id,
      chaletType: p.chaletType === 'Royal' ? 1 : 0,
      period:     p.period === 'Morning' ? 0 : p.period === 'Evening' ? 1 : 2,
      price:      p.price,
      dayType:    p.dayType === 'Weekday' ? 0 : p.dayType === 'Weekend' ? 1 : 2,
    };
    this.showModal = true;
  }
 
  closeModal(): void { this.showModal = false; }
 
  submit(): void {
    if (this.form.price <= 0) { this.notify('يرجى إدخال سعر صحيح', 'error'); return; }
    this.submitting = true;
    const dto: CreatePricingDto = {
      chaletType: this.form.chaletType,
      period:     this.form.period,
      price:      this.form.price,
      dayType:    this.form.dayType,
    };
    const req$ = this.isEdit
      ? this.pricingService.update(this.form.id, dto)
      : this.pricingService.create(dto);
 
    req$.subscribe({
      next: () => {
        this.submitting = false;
        this.showModal  = false;
        this.notify(this.isEdit ? 'تم التعديل بنجاح' : 'تمت الإضافة بنجاح', 'success');
        this.load();
      },
      error: () => {
        this.submitting = false;
        this.notify('حدث خطأ، يرجى المحاولة مرة أخرى', 'error');
      }
    });
  }
 
  confirmDelete(p: Pricing): void {
    this.deleteTarget   = p;
    this.showDeleteModal = true;
  }
 
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTarget   = null;
  }
 
  doDelete(): void {
    if (!this.deleteTarget) return;
    this.pricingService.delete(this.deleteTarget.id).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.deleteTarget    = null;
        this.notify('تم الحذف بنجاح', 'success');
        this.load();
      },
      error: () => {
        this.showDeleteModal = false;
        this.notify('فشل الحذف', 'error');
      }
    });
  }
 
  // ── حساب السعر ──
  calculate(): void {
    this.calcLoading = true;
    this.calcResult  = null;
    this.pricingService.calculate(this.calcType, this.calcPeriod, this.calcDayType).subscribe({
      next: (res) => {
        this.calcResult  = res.price;
        this.calcLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.calcResult  = null;
        this.calcLoading = false;
        this.notify('لم يتم العثور على سعر لهذه المعطيات', 'error');
        this.cdr.detectChanges();
      }
    });
  }
 
  // ── مساعدات عرض ──
  getChaletTypeLabel(v: string): string  { return this.chaletTypeLabels[v] ?? v; }
  getPeriodLabel(v: string): string      { return this.periodLabels[v]     ?? v; }
  getDayTypeLabel(v: string): string     { return this.dayTypeLabels[v]    ?? v; }
 
  getDayTypeClass(v: string): string {
    return v === 'Holiday' ? 'day-holiday' : v === 'Weekend' ? 'day-weekend' : 'day-weekday';
  }
 
  getPeriodClass(v: string): string {
    return v === 'Full' ? 'period-full' : v === 'Evening' ? 'period-eve' : 'period-morn';
  }
 
  /** الشاليهات المتاحة لنوع معين مع فتراتها */
  chaletsOfType(type: 'Normal' | 'Royal'): Chalet[] {
    return this.chalets.filter(c => c.type === type);
  }
 
  getPeriodsText(ch: Chalet): string {
    const map: Record<number, string> = { 0: 'صباحي', 1: 'مسائي', 2: 'كامل' };
    return getAvailablePeriodsArray(ch).map(p => map[p]).join(' | ');
  }
 
  notify(msg: string, type: 'success' | 'error'): void {
    this.toast     = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3000);
  }
}
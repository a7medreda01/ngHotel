import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Chalet, ChaletService, getAvailablePeriodsArray } from '../../service/chalet-service';
import { Pricing, CreatePricingDto, PricingService } from '../../service/pricing-service';

@Component({
  selector: 'app-pricing-component',
  imports: [CommonModule, FormsModule, TranslatePipe],

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

  readonly chaletTypeOptions = [
    { value: 0, labelKey: 'features.pricing.optChaletNormal' },
    { value: 1, labelKey: 'features.pricing.optChaletRoyal' },
  ];
  readonly periodOptions = [
    { value: 0, labelKey: 'features.pricing.optPeriodMorning' },
    { value: 1, labelKey: 'features.pricing.optPeriodEvening' },
    { value: 2, labelKey: 'features.pricing.optPeriodFull' },
  ];
  readonly dayTypeOptions = [
    { value: 0, labelKey: 'features.pricing.optDayWeekday' },
    { value: 1, labelKey: 'features.pricing.optDayWeekend' },
    { value: 2, labelKey: 'features.pricing.optDayHoliday' },
  ];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private pricingService: PricingService,
    private chaletService: ChaletService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cdr.markForCheck());
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
        this.notify(this.translate.instant('features.pricing.loadFail'), 'error');
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
    if (this.form.price <= 0) { this.notify(this.translate.instant('features.pricing.priceInvalid'), 'error'); return; }
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
        this.notify(this.translate.instant('features.pricing.saveOk'), 'success');
        this.load();
      },
      error: () => {
        this.submitting = false;
        this.notify(this.translate.instant('features.pricing.saveFail'), 'error');
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
        this.notify(this.translate.instant('features.pricing.deleteOk'), 'success');
        this.load();
      },
      error: () => {
        this.showDeleteModal = false;
        this.notify(this.translate.instant('features.pricing.deleteFail'), 'error');
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
        this.notify(this.translate.instant('features.pricing.calcNotFound'), 'error');
        this.cdr.detectChanges();
      }
    });
  }
 
  // ── مساعدات عرض ──
  getChaletTypeLabel(v: string): string {
    return v === 'Royal'
      ? this.translate.instant('misc.royalPlain')
      : this.translate.instant('misc.normalPlain');
  }

  getPeriodLabel(v: string): string {
    const key =
      v === 'Morning' ? 'period.Morning' : v === 'Evening' ? 'period.Evening' : v === 'Full' ? 'period.2' : '';
    return key ? this.translate.instant(key) : v;
  }

  getDayTypeLabel(v: string): string {
    const map: Record<string, string> = {
      Weekday: 'features.pricing.optDayWeekday',
      Weekend: 'features.pricing.optDayWeekend',
      Holiday: 'features.pricing.optDayHoliday',
    };
    const k = map[v];
    return k ? this.translate.instant(k) : v;
  }

  getChaletStatusLabel(status: string): string {
    return this.translate.instant(`chaletStatus.${status}`);
  }
 
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
    return getAvailablePeriodsArray(ch)
      .map((p) => this.translate.instant(`period.${p}`))
      .join(' | ');
  }
 
  notify(msg: string, type: 'success' | 'error'): void {
    this.toast     = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3000);
  }
}
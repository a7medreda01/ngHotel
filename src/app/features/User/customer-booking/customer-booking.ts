import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';
import { UpcomingBooking, Bookings, BookingService, normalizeChaletType, normalizePeriod, CreateBookingDto } from '../../../service/booking-service';
import { Chalet, ChaletService } from '../../../service/chalet-service';
import { Extra, ExtrasService } from '../../../service/extras-service';
// ─── Local Storage key ───
const LS_PHONE_KEY = 'customer_phone';
const LS_NAME_KEY  = 'customer_name';

export interface CustomerBookingDto {
  customerName: string;
  phone: string;
  date: string;
  period: number;
  chaletType: number;
  numOfGuests: number;
  extras: { extraId: number; quantity: number }[];
  note: string;
}
@Component({
  selector: 'app-customer-booking',
  imports: [    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,],
  templateUrl: './customer-booking.html',
  styleUrl: './customer-booking.css',
})
export class CustomerBooking implements OnInit {

  // ─── Auth / Registration ───────────────────────────────────
  isRegistered   = false;
  regPhone       = '';
  regName        = '';
  regStep        = 1;          // 1 = ادخل الاسم والهاتف
  regError       = '';

  savedPhone     = '';
  savedName      = '';

  // ─── Data ─────────────────────────────────────────────────
  chalets:  Chalet[] = [];
  extras:   Extra[]  = [];
  upcomingBookings: UpcomingBooking[] = [];
  myBookings: Bookings[] = [];

  // ─── UI State ─────────────────────────────────────────────
  currentView: 'home' | 'book' | 'mybookings' = 'home';
  bookStep = 1;   // 1=نوع الكوخ  2=الفترة  3=التاريخ  4=التفاصيل  5=تأكيد

  // ─── Booking Form ──────────────────────────────────────────
  selectedChaletType = 0;   // 0=عادي  1=رويال
  selectedPeriod     = -1;
  selectedDate       = '';
  calendarDate: Date | null = null;
  minDate = new Date();

  numOfGuests = 1;
  note        = '';

  selectedCountryCode = '+20';
  countryCodes = [
    { label: '🇪🇬 +20',  value: '+20'  },
    { label: '🇯🇴 +962', value: '+962' },
    { label: '🇦🇪 +971', value: '+971' },
    { label: '🇸🇦 +966', value: '+966' },
    { label: '🇶🇦 +974', value: '+974' },
    { label: '🇰🇼 +965', value: '+965' },
    { label: '🇧🇭 +973', value: '+973' },
    { label: '🇴🇲 +968', value: '+968' },
  ];

  // ─── Availability ──────────────────────────────────────────
  chaletCountMap:    Record<string, number> = {};
  bookingStatusMap:  Record<string, { confirmed: number; pending: number }> = {};
  bookedChaletIdsMap: Record<string, Set<number>> = {};
  loadingChaletsForType = false;

  // ─── Price ─────────────────────────────────────────────────
  basePrice        = 0;
  basePriceLoading = false;
  priceLoaded      = false;

  // ─── Extras ────────────────────────────────────────────────
  addSelectedExtraId  = 0;
  addSelectedExtraQty = 1;
  addExtrasList: { extraId: number; name: string; price: number; quantity: number }[] = [];

  // ─── Modal: My Bookings ────────────────────────────────────
  showMyBookingsModal = false;
  loadingMyBookings   = false;

  // ─── Modal: Booking Confirm ────────────────────────────────
  showConfirmModal = false;
  isSubmitting     = false;
  submitSuccess    = false;
  submitError      = '';

  // ─── Toast ────────────────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;

  // ─── Waiting ───────────────────────────────────────────────
  showWaitingConfirm    = false;
  waitingDateFormatted  = '';

  readonly periodLabels: Record<number, string> = {
    0: 'صباحي 🌅',
    1: 'مسائي 🌇',
    2: 'يوم كامل 🌞'
  };
  readonly statusLabels: Record<string, string> = {
    Pending:     'قيد الانتظار',
    Confirmed:   'مؤكد',
    Cancelled:   'ملغي',
    WaitingList: 'قائمة الانتظار',
    Done:        'تم الاستلام',
  };
  readonly statusClasses: Record<string, string> = {
    Pending:     'badge-pending',
    Confirmed:   'badge-confirmed',
    Cancelled:   'badge-cancelled',
    WaitingList: 'badge-waiting',
    Done:        'badge-done',
  };

  constructor(
    private bookingService: BookingService,
    private chaletService:  ChaletService,
    private extrasService:  ExtrasService,
    private cdr: ChangeDetectorRef,
  ) {}

  // ══════════════════════════════════════════════════════════
  ngOnInit(): void {
    this.checkRegistration();
    if (this.isRegistered) {
      this.loadInitialData();
    }
  }

  // ─── Registration ─────────────────────────────────────────
  checkRegistration(): void {
    const phone = localStorage.getItem(LS_PHONE_KEY);
    const name  = localStorage.getItem(LS_NAME_KEY);
    if (phone && name) {
      this.savedPhone   = phone;
      this.savedName    = name;
      this.isRegistered = true;
    }
  }

  register(): void {
    this.regError = '';
    if (!this.regName.trim()) {
      this.regError = 'يرجى إدخال اسمك'; return;
    }
    const cleaned = this.regPhone.replace(/\D/g, '');
    if (cleaned.length < 7) {
      this.regError = 'يرجى إدخال رقم هاتف صحيح'; return;
    }
    const fullPhone = this.selectedCountryCode + cleaned;
    localStorage.setItem(LS_PHONE_KEY, fullPhone);
    localStorage.setItem(LS_NAME_KEY,  this.regName.trim());
    this.savedPhone   = fullPhone;
    this.savedName    = this.regName.trim();
    this.isRegistered = true;
    this.loadInitialData();
    this.cdr.detectChanges();
  }

  logout(): void {
    localStorage.removeItem(LS_PHONE_KEY);
    localStorage.removeItem(LS_NAME_KEY);
    this.isRegistered = false;
    this.savedPhone   = '';
    this.savedName    = '';
    this.currentView  = 'home';
    this.regPhone     = '';
    this.regName      = '';
    this.cdr.detectChanges();
  }

  // ─── Load Data ────────────────────────────────────────────
  loadInitialData(): void {
    forkJoin({
      chalets:  this.chaletService.getAll(),
      extras:   this.extrasService.getAll(),
      upcoming: this.bookingService.getUpcomingBookings(),
    }).subscribe({
      next: ({ chalets, extras, upcoming }) => {
        this.chalets          = chalets;
        this.extras           = extras.filter((e: any) => e.isActive);
        this.upcomingBookings = upcoming?.data ?? [];
        this.buildBookingStatusMap();
        this.loadChaletsCountForType(0);
        this.loadChaletsCountForType(1);
        this.cdr.detectChanges();
      },
      error: () => this.showNotification('حدث خطأ في تحميل البيانات', 'error'),
    });
  }

  loadChaletsCountForType(type: number): void {
    forkJoin([
      this.bookingService.getChaletsByTypePeriod(type, 0),
      this.bookingService.getChaletsByTypePeriod(type, 1),
      this.bookingService.getChaletsByTypePeriod(type, 2),
    ]).subscribe({
      next: ([p0, p1, p2]) => {
        this.chaletCountMap[`${type}_0`] = p0.length;
        this.chaletCountMap[`${type}_1`] = p1.length;
        this.chaletCountMap[`${type}_2`] = p2.length;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Booking Flow ──────────────────────────────────────────
  startBooking(): void {
    this.bookStep          = 1;
    this.selectedChaletType = 0;
    this.selectedPeriod    = -1;
    this.selectedDate      = '';
    this.calendarDate      = null;
    this.basePrice         = 0;
    this.priceLoaded       = false;
    this.numOfGuests       = 1;
    this.note              = '';
    this.addExtrasList     = [];
    this.submitSuccess     = false;
    this.submitError       = '';
    this.isSubmitting      = false;
    this.currentView       = 'book';
    this.onChaletTypeChange();
    this.cdr.detectChanges();
  }

  onChaletTypeChange(): void {
    this.selectedPeriod = -1;
    this.selectedDate   = '';
    this.calendarDate   = null;
    this.priceLoaded    = false;
    this.basePrice      = 0;
    this.loadingChaletsForType = true;

    forkJoin([
      this.bookingService.getChaletsByTypePeriod(this.selectedChaletType, 0),
      this.bookingService.getChaletsByTypePeriod(this.selectedChaletType, 1),
      this.bookingService.getChaletsByTypePeriod(this.selectedChaletType, 2),
    ]).subscribe({
      next: ([p0, p1, p2]) => {
        const t = this.selectedChaletType;
        this.chaletCountMap[`${t}_0`] = p0.length;
        this.chaletCountMap[`${t}_1`] = p1.length;
        this.chaletCountMap[`${t}_2`] = p2.length;
        this.loadingChaletsForType = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingChaletsForType = false; this.cdr.detectChanges(); },
    });
  }

  getChaletCount(type: number, period: number): number {
    return this.chaletCountMap[`${type}_${period}`] ?? 0;
  }

  isPeriodAvailable(period: number): boolean {
    return this.getChaletCount(this.selectedChaletType, period) > 0;
  }

  selectPeriod(period: number): void {
    if (!this.isPeriodAvailable(period)) return;
    this.selectedPeriod = period;
    this.selectedDate   = '';
    this.calendarDate   = null;
    this.priceLoaded    = false;
    this.basePrice      = 0;
    this.cdr.detectChanges();
  }

  goToStep(step: number): void {
    if (step === 2 && this.selectedPeriod < 0) {
      this.showNotification('يرجى اختيار الفترة أولاً', 'error'); return;
    }
    if (step === 4 && !this.selectedDate) {
      this.showNotification('يرجى اختيار التاريخ', 'error'); return;
    }
    this.bookStep = step;
    this.cdr.detectChanges();
  }

  // ─── Calendar ─────────────────────────────────────────────
  onDateSelected(date: Date): void {
    this.calendarDate   = date;
    this.selectedDate   = this.formatDateLocal(date);
    this.fetchBasePrice(date);
    if (this.getAvailableCount() <= 0) {
      this.waitingDateFormatted = this.formatDate(this.selectedDate);
      this.showWaitingConfirm   = true;
    }
    this.cdr.detectChanges();
  }

  confirmWaiting(): void  { this.showWaitingConfirm = false; this.cdr.detectChanges(); }
  cancelWaiting(): void {
    this.showWaitingConfirm = false;
    this.calendarDate       = null;
    this.selectedDate       = '';
    this.priceLoaded        = false;
    this.basePrice          = 0;
    this.cdr.detectChanges();
  }

  fetchBasePrice(date: Date): void {
    const dayType = [5, 6].includes(date.getDay()) ? 1 : 0;
    this.basePriceLoading = true;
    this.priceLoaded      = false;
    this.bookingService.getBasePrice(this.selectedChaletType, this.selectedPeriod, dayType).subscribe({
      next: (res: any) => {
        this.basePrice        = typeof res === 'number' ? res : (res?.price ?? 0);
        this.basePriceLoading = false;
        this.priceLoaded      = true;
        this.cdr.detectChanges();
      },
      error: () => { this.basePriceLoading = false; this.cdr.detectChanges(); },
    });
  }

  dateClass = (date: Date): string => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return 'past-day';

    const d      = this.formatDateLocal(date);
    const type   = this.selectedChaletType;
    const period = this.selectedPeriod < 0 ? 0 : this.selectedPeriod;
    const total  = this.getChaletCount(type, period);
    if (total === 0) return 'unavailable-day';

    const s         = this.bookingStatusMap[`${type}_${d}_${period}`];
    const confirmed = s?.confirmed ?? 0;
    const pending   = s?.pending   ?? 0;
    const booked    = confirmed + pending;
    const available = total - booked;

    if (available <= 0 && confirmed >= total) return 'unavailable-day';
    if (available <= 0)  return 'pending-day';
    if (booked > 0)      return 'partial-day';
    return 'available-day';
  };

  getAvailableCount(): number {
    if (!this.calendarDate || this.selectedPeriod < 0) return 0;
    const d      = this.formatDateLocal(this.calendarDate);
    const total  = this.getChaletCount(this.selectedChaletType, this.selectedPeriod);
    const s      = this.bookingStatusMap[`${this.selectedChaletType}_${d}_${this.selectedPeriod}`];
    const booked = (s?.confirmed ?? 0) + (s?.pending ?? 0);
    return Math.max(0, total - booked);
  }

  buildBookingStatusMap(): void {
    this.bookingStatusMap   = {};
    this.bookedChaletIdsMap = {};
    for (const raw of this.upcomingBookings as any[]) {
      if (raw.status === 'Cancelled') continue;
      const type   = normalizeChaletType(raw.chaletType);
      const period = normalizePeriod(raw.period);
      const d      = this.parseDateStringAsLocal(raw.date);
      const key    = `${type}_${d}_${period}`;
      if (!this.bookingStatusMap[key])   this.bookingStatusMap[key]   = { confirmed: 0, pending: 0 };
      if (!this.bookedChaletIdsMap[key]) this.bookedChaletIdsMap[key] = new Set();
      if (raw.status === 'Confirmed' || raw.status === 'Done')
        this.bookingStatusMap[key].confirmed++;
      else
        this.bookingStatusMap[key].pending++;
      if (raw.chaletId) this.bookedChaletIdsMap[key].add(raw.chaletId);
    }
  }

  // ─── Extras ───────────────────────────────────────────────
  addExtra(): void {
    if (!this.addSelectedExtraId) return;
    const extra = this.extras.find(e => e.id === +this.addSelectedExtraId);
    if (!extra) return;
    const existing = this.addExtrasList.find(e => e.extraId === +this.addSelectedExtraId);
    if (existing) existing.quantity += +this.addSelectedExtraQty;
    else this.addExtrasList.push({
      extraId: extra.id, name: extra.name,
      price: extra.price, quantity: +this.addSelectedExtraQty
    });
    this.addSelectedExtraId  = 0;
    this.addSelectedExtraQty = 1;
    this.cdr.detectChanges();
  }

  removeExtra(idx: number): void { this.addExtrasList.splice(idx, 1); this.cdr.detectChanges(); }

  get extrasTotal(): number { return this.addExtrasList.reduce((s, e) => s + e.price * e.quantity, 0); }
  get grandTotal():  number { return this.basePrice + this.extrasTotal; }

  // ─── Submit ───────────────────────────────────────────────
  openConfirmModal(): void {
    if (!this.selectedDate) { this.showNotification('يرجى اختيار التاريخ', 'error'); return; }
    this.showConfirmModal = true;
    this.cdr.detectChanges();
  }

  submitBooking(): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.submitError  = '';
    this.cdr.detectChanges();

    const dto: CreateBookingDto = {
      customerName: this.savedName,
      phone:        this.savedPhone,
      date:         this.selectedDate,
      period:       this.selectedPeriod,
      chaletType:   this.selectedChaletType,
      numOfGuests:  this.numOfGuests,
      note:         this.note,
      extras:       this.addExtrasList.map(e => ({ extraId: e.extraId, quantity: e.quantity })),
      additionalPhone: '',
    };

    this.bookingService.createBooking(dto).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        const success = res?.message?.success ?? res?.success ?? res?.isSuccess ?? true;
        if (success) {
          this.submitSuccess = true;
          this.showNotification('تم إرسال طلب الحجز بنجاح! 🎉', 'success');
          // refresh upcoming
          this.bookingService.getUpcomingBookings().subscribe({
            next: r => {
              this.upcomingBookings = r?.data ?? [];
              this.buildBookingStatusMap();
              this.cdr.detectChanges();
            }
          });
        } else {
          this.submitError = res?.message?.message ?? res?.message ?? 'حدث خطأ';
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.isSubmitting = false;
        this.submitError  = err?.error?.message ?? 'فشل إرسال الحجز، يرجى المحاولة مرة أخرى';
        this.cdr.detectChanges();
      },
    });
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    if (this.submitSuccess) {
      this.currentView   = 'home';
      this.submitSuccess = false;
    }
    this.cdr.detectChanges();
  }

  // ─── My Bookings ──────────────────────────────────────────
  openMyBookings(): void {
    this.showMyBookingsModal = true;
    this.loadingMyBookings   = true;
    this.myBookings          = [];
    this.cdr.detectChanges();

    // ابحث عن الحجوزات بالهاتف عبر search
    this.bookingService.getBookingsPaged({
      page: 1, pageSize: 50, search: this.savedPhone,
    }).subscribe({
      next: res => {
        this.myBookings       = (res.data ?? []).filter(
          (b: Bookings) => b.phone === this.savedPhone
        );
        this.loadingMyBookings = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingMyBookings = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeMyBookings(): void { this.showMyBookingsModal = false; }

  // ─── Helpers ──────────────────────────────────────────────
  getChaletImage(type: any): string {
    const chalet = this.chalets.find(c => c.type === type || normalizeChaletType(c.type) === type);
    return chalet?.images?.[0] ?? '';
  }

  getChaletsOfType(type: number): Chalet[] {
    return this.chalets.filter(c => normalizeChaletType(c.type) === type);
  }

  formatDateLocal(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  parseDateStringAsLocal(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  }

  formatDate(d: string): string {
    if (!d) return '-';
    const [year, month, day] = d.split('T')[0].split('-').map(Number);
    return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
  }

  getStatusLabel(s: string): string { return this.statusLabels[s]  ?? s; }
  getStatusClass(s: string): string { return this.statusClasses[s] ?? ''; }
  getPeriodLabel(p: number): string { return this.periodLabels[p]   ?? '-'; }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType    = type;
    this.showToast    = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3500);
  }

  get chaletTypeLabel(): string {
    return this.selectedChaletType === 1 ? '👑 رويال' : '🏠 عادي';
  }

  getTotalForType(type: number): number {
    return Math.max(
      this.getChaletCount(type, 0),
      this.getChaletCount(type, 1),
      this.getChaletCount(type, 2)
    );
  }
}
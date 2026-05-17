import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import {
  BookingExtra, Bookings, BookingService, Payment,
  CreateBookingDto, UpdateBookingDto, DoneBookingDto, AvailableChalet,
  ChaletByTypePeriod, UpcomingBooking,
  normalizeChaletType, normalizePeriod,
  DailyPaymentsResponse,
  DailyPaymentEntry
} from '../../service/booking-service';
import { ChaletService, Chalet } from '../../service/chalet-service';
import { ExtrasService, Extra } from '../../service/extras-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../service/Auth-service';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import html2canvas from 'html2canvas';
import { JordanDatePipe } from '../../adds/pipes/jordan-date-pipe';
import { BookingOverviewComponent, NewBookingRequest } from '../booking-overview/booking-overview';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [
    FormsModule, CommonModule,
    MatDatepickerModule, MatFormFieldModule, MatInputModule, MatNativeDateModule, JordanDatePipe,
    BookingOverviewComponent
  ],
  templateUrl: './booking.html',
  styleUrl: './booking.css',
})
export class Booking implements OnInit {

  bookings: Bookings[] = [];
  filteredBookings: Bookings[] = [];
  pagedBookings: Bookings[] = [];
  chalets: Chalet[] = [];
  extras: Extra[] = [];

  bookingPaymentsMap: Record<number, number> = {};
  selectedBooking: Bookings | null = null;

  showInvoiceModal = false;
  invoiceBooking: Bookings | null = null;

  // UI State
  showAddModal = false;
  showEditModal = false;
  showDepositModal = false;
  showCancelConfirm = false;
  showDetailSheet = false;
  showDetailPanel = false;
  showDoneConfirm = false;
  showPaymentsModal = false;
  showWaitingConfirm = false;
  showTodayRevenueModal = false;
  showTodayDepositsModal = false;

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;
  searchQuery = '';
  filterStatus = '';
  filterDateRange = 'today';
  filterDateFrom = '';
  filterDateTo = '';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 20, 50];

  // ══════════════════════════════════════════
  // ADD MODAL
  // ══════════════════════════════════════════
  addStep = 1;
  newBooking: CreateBookingDto = {
    customerName: '', phone: '', date: '',
    period: -1, chaletType: 0, numOfGuests: 1, extras: [], note: '', additionalPhone: ''
  };
  selectedCountryCode = '+962';
countryCodes = [
  // ── العربية ──────────────────────────────────────
  { flag: '🇯🇴', code: '+962', ar: 'الأردن' },
  { flag: '🇸🇦', code: '+966', ar: 'السعودية' },
  { flag: '🇦🇪', code: '+971', ar: 'الإمارات' },
  { flag: '🇪🇬', code: '+20',  ar: 'مصر' },
  { flag: '🇶🇦', code: '+974', ar: 'قطر' },
  { flag: '🇰🇼', code: '+965', ar: 'الكويت' },
  { flag: '🇧🇭', code: '+973', ar: 'البحرين' },
  { flag: '🇴🇲', code: '+968', ar: 'عُمان' },
  { flag: '🇮🇶', code: '+964', ar: 'العراق' },
  { flag: '🇸🇾', code: '+963', ar: 'سوريا' },
  { flag: '🇱🇧', code: '+961', ar: 'لبنان' },
  { flag: '🇵🇸', code: '+970', ar: 'فلسطين' },
  { flag: '🇾🇪', code: '+967', ar: 'اليمن' },
  { flag: '🇱🇾', code: '+218', ar: 'ليبيا' },
  { flag: '🇹🇳', code: '+216', ar: 'تونس' },
  { flag: '🇩🇿', code: '+213', ar: 'الجزائر' },
  { flag: '🇲🇦', code: '+212', ar: 'المغرب' },
  { flag: '🇸🇩', code: '+249', ar: 'السودان' },
  { flag: '🇸🇴', code: '+252', ar: 'الصومال' },
  { flag: '🇲🇷', code: '+222', ar: 'موريتانيا' },
  { flag: '🇩🇯', code: '+253', ar: 'جيبوتي' },
  { flag: '🇰🇲', code: '+269', ar: 'جزر القمر' },

  // ── أمريكا الشمالية ───────────────────────────────
  { flag: '🇺🇸', code: '+1',   ar: 'الولايات المتحدة' },
  { flag: '🇨🇦', code: '+1',   ar: 'كندا' },

  // ── أمريكا اللاتينية ──────────────────────────────
  { flag: '🇧🇷', code: '+55',  ar: 'البرازيل' },
  { flag: '🇲🇽', code: '+52',  ar: 'المكسيك' },

  // ── أوروبا ───────────────────────────────────────
  { flag: '🇬🇧', code: '+44',  ar: 'المملكة المتحدة' },
  { flag: '🇩🇪', code: '+49',  ar: 'ألمانيا' },
  { flag: '🇫🇷', code: '+33',  ar: 'فرنسا' },
  { flag: '🇮🇹', code: '+39',  ar: 'إيطاليا' },
  { flag: '🇪🇸', code: '+34',  ar: 'إسبانيا' },
  { flag: '🇳🇱', code: '+31',  ar: 'هولندا' },
  { flag: '🇧🇪', code: '+32',  ar: 'بلجيكا' },
  { flag: '🇨🇭', code: '+41',  ar: 'سويسرا' },
  { flag: '🇦🇹', code: '+43',  ar: 'النمسا' },
  { flag: '🇸🇪', code: '+46',  ar: 'السويد' },
  { flag: '🇳🇴', code: '+47',  ar: 'النرويج' },
  { flag: '🇩🇰', code: '+45',  ar: 'الدنمارك' },
  { flag: '🇫🇮', code: '+358', ar: 'فنلندا' },
  { flag: '🇮🇪', code: '+353', ar: 'أيرلندا' },
  { flag: '🇵🇹', code: '+351', ar: 'البرتغال' },
  { flag: '🇬🇷', code: '+30',  ar: 'اليونان' },
  { flag: '🇵🇱', code: '+48',  ar: 'بولندا' },
  { flag: '🇷🇴', code: '+40',  ar: 'رومانيا' },
  { flag: '🇨🇿', code: '+420', ar: 'التشيك' },
  { flag: '🇭🇺', code: '+36',  ar: 'المجر' },
  { flag: '🇸🇰', code: '+421', ar: 'سلوفاكيا' },
  { flag: '🇸🇮', code: '+386', ar: 'سلوفينيا' },
  { flag: '🇭🇷', code: '+385', ar: 'كرواتيا' },
  { flag: '🇷🇸', code: '+381', ar: 'صربيا' },
  { flag: '🇧🇬', code: '+359', ar: 'بلغاريا' },
  { flag: '🇺🇦', code: '+380', ar: 'أوكرانيا' },
  { flag: '🇷🇺', code: '+7',   ar: 'روسيا' },
  { flag: '🇨🇾', code: '+357', ar: 'قبرص' },
  { flag: '🇲🇹', code: '+356', ar: 'مالطا' },
  { flag: '🇮🇸', code: '+354', ar: 'آيسلندا' },
  { flag: '🇹🇷', code: '+90',  ar: 'تركيا' },

  // ── الشرق الأوسط (غير عربي) ───────────────────────
  { flag: '🇮🇱', code: '+972', ar: 'إسرائيل' },
  { flag: '🇮🇷', code: '+98',  ar: 'إيران' },

  // ── أوقيانوسيا ───────────────────────────────────
  { flag: '🇦🇺', code: '+61',  ar: 'أستراليا' },
  { flag: '🇳🇿', code: '+64',  ar: 'نيوزيلندا' },

  // ── آسيا ─────────────────────────────────────────
  { flag: '🇮🇳', code: '+91',  ar: 'الهند' },
  { flag: '🇵🇰', code: '+92',  ar: 'باكستان' },
  { flag: '🇧🇩', code: '+880', ar: 'بنغلاديش' },
  { flag: '🇱🇰', code: '+94',  ar: 'سريلانكا' },
  { flag: '🇳🇵', code: '+977', ar: 'نيبال' },
  { flag: '🇨🇳', code: '+86',  ar: 'الصين' },
  { flag: '🇯🇵', code: '+81',  ar: 'اليابان' },
  { flag: '🇰🇷', code: '+82',  ar: 'كوريا الجنوبية' },
  { flag: '🇸🇬', code: '+65',  ar: 'سنغافورة' },
  { flag: '🇲🇾', code: '+60',  ar: 'ماليزيا' },
  { flag: '🇮🇩', code: '+62',  ar: 'إندونيسيا' },
  { flag: '🇹🇭', code: '+66',  ar: 'تايلاند' },
  { flag: '🇵🇭', code: '+63',  ar: 'الفلبين' },
  { flag: '🇻🇳', code: '+84',  ar: 'فيتنام' },
  { flag: '🇭🇰', code: '+852', ar: 'هونغ كونغ' },
  { flag: '🇦🇫', code: '+93',  ar: 'أفغانستان' },
  { flag: '🇰🇿', code: '+7',   ar: 'كازاخستان' },
  { flag: '🇺🇿', code: '+998', ar: 'أوزبكستان' },
  { flag: '🇦🇿', code: '+994', ar: 'أذربيجان' },
  { flag: '🇬🇪', code: '+995', ar: 'جورجيا' },
  { flag: '🇦🇲', code: '+374', ar: 'أرمينيا' },

  // ── أفريقيا ───────────────────────────────────────
  { flag: '🇳🇬', code: '+234', ar: 'نيجيريا' },
  { flag: '🇿🇦', code: '+27',  ar: 'جنوب أفريقيا' },
  { flag: '🇰🇪', code: '+254', ar: 'كينيا' },
  { flag: '🇬🇭', code: '+233', ar: 'غانا' },
  { flag: '🇪🇹', code: '+251', ar: 'إثيوبيا' },
  { flag: '🇹🇿', code: '+255', ar: 'تنزانيا' },
  { flag: '🇺🇬', code: '+256', ar: 'أوغندا' },
  { flag: '🇸🇳', code: '+221', ar: 'السنغال' },
  { flag: '🇨🇲', code: '+237', ar: 'الكاميرون' },
];
countrySearch        = '';
countryDropdownOpen: Record<string, boolean> = {};
openCountryDropdown(field: string) {
  this.countryDropdownOpen = { [field]: true };
}

closeCountryDropdown(field: string) {
  this.countryDropdownOpen[field] = false;
}

isCountryDropdownOpen(field: string): boolean {
  return !!this.countryDropdownOpen[field];
}
// بدل selectedCountryCode واحد:
phoneCountryCode = '+962';
additionalPhoneCountryCode = '+962';
editPhoneCountryCode = '+962';
editAdditionalPhoneCountryCode = '+962';
getSelectedCountry(field: string) {
  const code = field === 'phone' ? this.phoneCountryCode :
               field === 'additionalPhone' ? this.additionalPhoneCountryCode :
               field === 'editPhone' ? this.editPhoneCountryCode :
               this.editAdditionalPhoneCountryCode;
  return this.countryCodes.find(c => c.code === code) ?? this.countryCodes[0];
}
get selectedCountry() {
  return this.countryCodes.find(c => c.code === this.selectedCountryCode)
      ?? this.countryCodes[0];
}

get filteredCountryCodes() {
  const s = this.countrySearch.trim();
  if (!s) return this.countryCodes;
  return this.countryCodes.filter(c =>
    c.ar.includes(s) || c.code.includes(s)
  );
}
  addSelectedExtraId = 0;
  addSelectedExtraQty = 1;
  addExtrasList: { extraId: number; name: string; price: number; quantity: number }[] = [];

  basePrice = 0;
  basePriceLoading = false;
  priceLoaded = false;
  calendarDate: Date | null = null;
  minDate = new Date();

  availableChaletsForType: ChaletByTypePeriod[] = [];
  loadingChaletsForType = false;

  upcomingBookings: UpcomingBooking[] = [];
  upcomingLoaded = false;

  bookingStatusMap: Record<string, { confirmed: number; pending: number }> = {};
  bookedChaletIdsMap: Record<string, Set<number>> = {};
  chaletCountMap: Record<string, number> = {};

  waitingDateFormatted = '';
  total = 0;
  totalPages = 0;
  isLoading = false;

  isSubmitting = false;

  // ─── Edit ────────────────────────────────────────────────────────────────
  editForm: UpdateBookingDto = {
    bookingId: 0, customerName: '', phone: '', payMoney: null, deposit: 0, removedExtraIds: []
  };
  editCountryCode = '+962';
  editAddExtraId = 0;
  editAddExtraQty = 1;
  editMessage = '';
  editSaving = false;
  editExtraAdding = false;

  // ─── Deposit ─────────────────────────────────────────────────────────────
  depositAmount: number | null = null;
  depositSaving = false;

  // ─── Cancel ──────────────────────────────────────────────────────────────
  cancelTargetId: number | null = null;
  cancelSaving = false;
  cancelReason = '';

  // ─── Done ────────────────────────────────────────────────────────────────
  doneTargetId: number | null = null;
  doneSaving = false;
  donePayAmount: number | null = null;
  doneSelectedChaletId = 0;
  availableChaletsForDone: AvailableChalet[] = [];
  loadingAvailableChalets = false;

  // ─── Payments ────────────────────────────────────────────────────────────
  paymentsList: Payment[] = [];
  paymentsLoading = false;
  paymentsBookingId: number | null = null;

  showComparison = false;

  // ─── Notes ───────────────────────────────────────────────────────────────
  showNotesModal = false;
  notesBooking: Bookings | null = null;
  newNoteText = '';
  noteSending = false;

  readonly periodLabels: Record<number, string> = { 0: 'صباحي', 1: 'مسائي', 2: 'يوم كامل' };
  readonly statusLabels: Record<string, string> = {
    Pending: 'قيد التأكيد', Confirmed: 'مؤكد',
    Cancelled: 'ملغي', WaitingList: 'قائمة الانتظار', Done: 'تم الاستلام',
  };
  readonly statusClasses: Record<string, string> = {
    Pending: 'badge-pending', Confirmed: 'badge-confirmed',
    Cancelled: 'badge-cancelled', WaitingList: 'badge-waiting', Done: 'badge-done',
  };

  private destroy$ = new Subject<void>();

  constructor(
    private bookingService: BookingService,
    private chaletService: ChaletService,
    private extrasService: ExtrasService,
    private cdr: ChangeDetectorRef,
    public auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  // ══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
      const openNew = this.router.url === '/booking/new'; // ← احفظ القيمة بس متفتحش

    // if (this.router.url === '/booking/new') this.showAddModal = true;

    // ✅ التحسين 1: كل الـ requests الأولية في forkJoin واحد
    forkJoin({
      chalets:  this.chaletService.getAll(),
      extras:   this.extrasService.getAll(),
      upcoming: this.bookingService.getUpcomingBookings(),
      daily:    this.bookingService.getDailyPaymentSummary(),
    }).subscribe({
      next: ({ chalets, extras, upcoming, daily }) => {
        this.chalets        = chalets;
        this.extras         = extras.filter((e: any) => e.isActive);
        this.upcomingBookings = upcoming?.data ?? [];
        this.dailyPayments  = daily;
        this.upcomingLoaded = true;
        this.buildBookingStatusMap();
        this.loadTodayBookings();
        this.loadBookings();
        this.cdr.detectChanges();
if (openNew) {
  this.openAddModal();
  this.router.navigate(['/booking'], { replaceUrl: true });
}

        this.route.queryParams
          .pipe(takeUntil(this.destroy$))
          .subscribe(params => {
            const bookingId = params['openBooking'];
            if (bookingId) {
              const id = +bookingId;
              this.bookingService.getBookingById(id).subscribe({
                next: full => {
                  this.selectedBooking = full;
                  this._buildPaymentsMapFromBooking(full);
                  window.innerWidth < 768
                    ? (this.showDetailSheet = true)
                    : (this.showDetailPanel = true);
                  this.cdr.detectChanges();
                }
              });
              this.router.navigate([], {
                relativeTo: this.route, queryParams: {}, replaceUrl: true
              });
            }
          });
      },
      error: () => this.showNotification('فشل تحميل البيانات', 'error'),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Data Loading
  // ══════════════════════════════════════════════════════════════════════════

  loadBookings(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.bookingService.getBookingsPaged({
      page:     this.currentPage,
      pageSize: this.pageSize,
      search:   this.searchQuery.trim() || undefined,
      status:   this.filterStatus || undefined,
      dateFrom: this.getDateFrom() || undefined,
      dateTo:   this.getDateTo() || undefined,
    }).subscribe({
      next: res => {
        this.bookings        = [...res.data];
        this.filteredBookings = [...res.data];
        this.pagedBookings   = [...res.data];
        this.total           = res.total;
        this.totalPages      = res.totalPages;
        this.isLoading       = false;
        this._buildPaymentsMapFromBookings();

        if (this.selectedBooking) {
          const updated = res.data.find(b => b.id === this.selectedBooking!.id);
          if (updated) this.selectedBooking = { ...updated };
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.showNotification('فشل تحميل الحجوزات', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  private getDateFrom(): string {
    const today = new Date();
    const fmt = (d: Date) => this.formatDateLocal(d);
    switch (this.filterDateRange) {
      case 'today':      return fmt(today);
      case 'yesterday':  { const y = new Date(today); y.setDate(y.getDate() - 1); return fmt(y); }
      case 'week':       { const w = new Date(today); w.setDate(w.getDate() - 7); return fmt(w); }
      case 'month':      { const m = new Date(today); m.setDate(m.getDate() - 30); return fmt(m); }
      case 'last_month': return fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      case 'custom':     return this.filterDateFrom;
      default:           return '';
    }
  }

  private getDateTo(): string {
    const today = new Date();
    const fmt = (d: Date) => this.formatDateLocal(d);
    switch (this.filterDateRange) {
      case 'today':      return fmt(today);
      case 'yesterday':  { const y = new Date(today); y.setDate(y.getDate() - 1); return fmt(y); }
      case 'week':
      case 'month':      return fmt(today);
      case 'last_month': return fmt(new Date(today.getFullYear(), today.getMonth(), 0));
      case 'custom':     return this.filterDateTo;
      default:           return '';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Payments Map Helpers
  // ══════════════════════════════════════════════════════════════════════════

  // ✅ التحسين 2: شيل detectChanges الزيادة — loadBookings هيعملها
  private _buildPaymentsMapFromBookings(): void {
    for (const b of this.bookings) this._buildPaymentsMapFromBooking(b);
  }

  private _buildPaymentsMapFromBooking(b: Bookings): void {
    this.bookingPaymentsMap[b.id] = (b.payments && b.payments.length > 0)
      ? b.payments.reduce((s, p) => s + p.amount, 0)
      : (b.deposit ?? 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Filter & Pagination
  // ══════════════════════════════════════════════════════════════════════════

  applyFilter(): void { this.currentPage = 1; this.loadBookings(); }
  applyPage(): void { this.loadBookings(); }

  get pageNumbers(): number[] {
    const total = this.totalPages, cur = this.currentPage, pages: number[] = [];
    if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); }
    else {
      pages.push(1);
      if (cur > 3) pages.push(-1);
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p; this.applyPage();
  }

  onPageSizeChange(): void { this.currentPage = 1; this.applyPage(); }

  // ══════════════════════════════════════════════════════════════════════════
  // Detail Panel / Sheet
  // ══════════════════════════════════════════════════════════════════════════

  openDetail(b: Bookings): void {
    this.bookingService.getBookingById(b.id).subscribe({
      next: full => {
        this.selectedBooking = full;
        this._buildPaymentsMapFromBooking(full);
        this.showDetailPanel = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.selectedBooking = { ...b };
        this.showDetailPanel = true;
        this.cdr.detectChanges();
      },
    });
  }

  openDetailSheet(b: Bookings): void {
    this.bookingService.getBookingById(b.id).subscribe({
      next: full => {
        this.selectedBooking = full;
        this._buildPaymentsMapFromBooking(full);
        this.showDetailSheet = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.selectedBooking = { ...b };
        this.showDetailSheet = true;
        this.cdr.detectChanges();
      },
    });
  }

  closeDetailSheet(): void { this.showDetailSheet = false; this.selectedBooking = null; }
  closeDetailPanel(): void { this.showDetailPanel = false; this.selectedBooking = null; }

  openWhatsApp(phone: string): void {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADD MODAL — Steps
  // ══════════════════════════════════════════════════════════════════════════

  openAddModal(): void {
    this.phoneCountryCode = '+962';
this.additionalPhoneCountryCode = '+962';
    this.addStep = 1;
    this.newBooking = {
      customerName: '', phone: '', additionalPhone: '', discountAmount: 0,
      date: '', period: -1, chaletType: 0, numOfGuests: 1, extras: [], note: ''
    };
    this.addExtrasList = [];
    this.basePrice = 0;
    this.priceLoaded = false;
    this.basePriceLoading = false;
    this.calendarDate = null;
    this.selectedCountryCode = '+962';
    this.addSelectedExtraId = 0;
    this.addSelectedExtraQty = 1;
    this.chaletCountMap = {};
    this.isSubmitting = false;
    this.showAddModal = true;
    this.loadChaletsForCurrentType();
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.isSubmitting = false;
  }

  loadChaletsForCurrentType(): void {
    this.loadingChaletsForType = true;
    this.cdr.detectChanges();
    const type = this.newBooking.chaletType;

    forkJoin([
      this.bookingService.getChaletsByTypePeriod(type, 0),
      this.bookingService.getChaletsByTypePeriod(type, 1),
      this.bookingService.getChaletsByTypePeriod(type, 2),
    ]).subscribe({
      next: ([p0, p1, p2]) => {
        this.chaletCountMap[`${type}_0`] = p0.length;
        this.chaletCountMap[`${type}_1`] = p1.length;
        this.chaletCountMap[`${type}_2`] = p2.length;
        this.loadingChaletsForType = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.chaletCountMap[`${type}_0`] = 0;
        this.chaletCountMap[`${type}_1`] = 0;
        this.chaletCountMap[`${type}_2`] = 0;
        this.loadingChaletsForType = false;
        this.cdr.detectChanges();
      },
    });
  }

  getChaletCountForTypePeriod(type: number, period: number): number {
    return this.chaletCountMap[`${type}_${period}`] ?? 0;
  }

  isPeriodAvailableForType(period: number): boolean {
    return this.getChaletCountForTypePeriod(this.newBooking.chaletType, period) > 0;
  }

  onChaletTypeChange(): void {
    this.newBooking.chaletType = +this.newBooking.chaletType;
    this.newBooking.date = '';
    this.calendarDate = null;
    this.priceLoaded = false;
    this.basePrice = 0;
    this.newBooking.period = -1;
    this.loadChaletsForCurrentType();
    this.cdr.detectChanges();
  }

  onPeriodChange(): void {
    this.newBooking.period = +this.newBooking.period;
    this.newBooking.date = '';
    this.calendarDate = null;
    this.priceLoaded = false;
    this.basePrice = 0;
    this.cdr.detectChanges();
  }

  goToStep2(): void {
    if (this.newBooking.period < 0 || !this.isPeriodAvailableForType(this.newBooking.period)) {
      this.showNotification('يرجى اختيار فترة متاحة', 'error'); return;
    }
    this.addStep = 2; this.cdr.detectChanges();
  }

  goToStep3(): void {
    if (!this.newBooking.date) {
      this.showNotification('يرجى اختيار التاريخ', 'error'); return;
    }
    this.addStep = 3; this.cdr.detectChanges();
  }

  onDateSelected(date: Date): void {
    this.calendarDate = date;
    this.newBooking.date = this.formatDateLocal(date);
    this.fetchBasePrice(date);

    if (this.getAvailableCountForSelectedDate() <= 0) {
      this.waitingDateFormatted = this.formatDate(date.toISOString());
      this.showWaitingConfirm = true;
    }
    this.cdr.detectChanges();
  }

  confirmProceedToWaiting(): void { this.showWaitingConfirm = false; this.cdr.detectChanges(); }

  cancelWaitingAndResetDate(): void {
    this.showWaitingConfirm = false;
    this.calendarDate = null;
    this.newBooking.date = '';
    this.priceLoaded = false;
    this.basePrice = 0;
    this.cdr.detectChanges();
  }

  fetchBasePrice(date?: Date): void {
    const type = this.newBooking.chaletType;
    const period = this.newBooking.period;
    const dayType = date ? ([5, 6].includes(date.getDay()) ? 1 : 0) : 0;

    this.basePriceLoading = true;
    this.priceLoaded = false;

    this.bookingService.getBasePrice(type, period, dayType).subscribe({
      next: (res: any) => {
        this.basePrice = typeof res === 'number' ? res : (res?.price ?? 0);
        this.basePriceLoading = false;
        this.priceLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.basePrice = 0;
        this.basePriceLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // buildBookingStatusMap
  // ══════════════════════════════════════════════════════════════════════════

  buildBookingStatusMap(): void {
    this.bookingStatusMap = {};
    this.bookedChaletIdsMap = {};

    const source = this.upcomingLoaded ? this.upcomingBookings : this.bookings;

    for (const raw of source as any[]) {
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

  dateClass = (date: Date): string => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return 'past-day';

    const d      = this.formatDateLocal(date);
    const type   = +this.newBooking.chaletType;
    const period = +this.newBooking.period;

    const totalSupporting = this.getChaletCountForTypePeriod(type, period < 0 ? 0 : period);
    if (totalSupporting === 0) return 'unavailable-day';

    const s         = this.bookingStatusMap[`${type}_${d}_${period < 0 ? 0 : period}`];
    const confirmed = s?.confirmed ?? 0;
    const pending   = s?.pending ?? 0;
    const total     = confirmed + pending;
    const available = totalSupporting - total;

    if (available <= 0 && confirmed >= totalSupporting) return 'unavailable-day';
    if (available <= 0) return 'pending-day';
    if (total > 0) return 'partial-day';
    return 'available-day';
  };

  getAvailableCountForSelectedDate(): number {
    if (!this.calendarDate || this.newBooking.period < 0) return 0;
    const d      = this.formatDateLocal(this.calendarDate);
    const type   = +this.newBooking.chaletType;
    const period = +this.newBooking.period;
    const total  = this.getChaletCountForTypePeriod(type, period);
    const s      = this.bookingStatusMap[`${type}_${d}_${period}`];
    const booked = (s?.confirmed ?? 0) + (s?.pending ?? 0);
    return Math.max(0, total - booked);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Extras helpers
  // ══════════════════════════════════════════════════════════════════════════

  addExtraToNewBooking(): void {
    if (!this.addSelectedExtraId) { this.showNotification('يرجى اختيار إضافة', 'error'); return; }
    const extra = this.extras.find(e => e.id === +this.addSelectedExtraId);
    if (!extra) return;
    const existing = this.addExtrasList.find(e => e.extraId === +this.addSelectedExtraId);
    if (existing) existing.quantity += +this.addSelectedExtraQty;
    else this.addExtrasList.push({
      extraId: extra.id, name: extra.name,
      price: extra.price, quantity: +this.addSelectedExtraQty
    });
    this.addSelectedExtraId = 0;
    this.addSelectedExtraQty = 1;
    this.cdr.detectChanges();
  }

  removeExtraFromNew(idx: number): void { this.addExtrasList.splice(idx, 1); this.cdr.detectChanges(); }

  get addExtrasTotal(): number { return this.addExtrasList.reduce((s, e) => s + e.price * e.quantity, 0); }
  get addGrandTotal(): number {
    return Math.max(0, this.basePrice + this.addExtrasTotal - (this.newBooking.discountAmount ?? 0));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Submit new booking
  // ══════════════════════════════════════════════════════════════════════════

  submitNewBooking(): void {
    if (this.isSubmitting) return;

    if (!this.newBooking.customerName?.trim()) {
      this.showNotification('يرجى إدخال اسم العميل', 'error'); return;
    }
    if (!this.newBooking.phone?.trim()) {
      this.showNotification('يرجى إدخال رقم الهاتف', 'error'); return;
    }
    if (!this.newBooking.date) {
      this.showNotification('يرجى اختيار التاريخ', 'error'); return;
    }

    this.isSubmitting = true;
    this.cdr.detectChanges();

    const dto: CreateBookingDto = {
      customerName: this.newBooking.customerName.trim(),
      date: this.newBooking.date,
      period: +this.newBooking.period,
      chaletType: +this.newBooking.chaletType,
      numOfGuests: this.newBooking.numOfGuests,
phone: this.phoneCountryCode + this.newBooking.phone.trim(),
additionalPhone: this.newBooking.additionalPhone?.trim()
  ? this.additionalPhoneCountryCode + this.newBooking.additionalPhone.trim()
  : '',
      discountAmount: this.newBooking.discountAmount ?? 0,
      note: this.newBooking.note,
      extras: this.addExtrasList.map(e => ({ extraId: e.extraId, quantity: e.quantity })),
    };

    this.bookingService.createBooking(dto).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        const success = this.extractSuccess(res);
        const msg = this.extractMessage(res);
        this.showNotification(msg || (success ? 'تم إضافة الحجز بنجاح ✓' : 'حدث خطأ'), success ? 'success' : 'error');

        if (success) {
          this.closeAddModal();
          this.loadBookings();
          this.refreshUpcoming(); // ✅ هو هيعمل dailyPayments + overview
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.isSubmitting = false;
        this.showNotification(err?.error?.message || 'فشل إنشاء الحجز', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Edit Modal
  // ══════════════════════════════════════════════════════════════════════════

openEditModal(booking: Bookings, fromPanel = false): void {
  this.selectedBooking = { ...booking, extras: booking.extras ? [...booking.extras] : [] };

  const match = this.countryCodes.find(c => booking.phone.startsWith(c.code));
  this.editPhoneCountryCode = match ? match.code : '+962';  // ← غير editCountryCode
  const cleanPhone = match ? booking.phone.slice(match.code.length) : booking.phone;

  let cleanAdditional = booking.additionalPhone ?? '';
  const matchAdditional = this.countryCodes.find(c => cleanAdditional.startsWith(c.code));
  this.editAdditionalPhoneCountryCode = matchAdditional ? matchAdditional.code : '+962';  // ← ضيف السطر ده
  if (matchAdditional) cleanAdditional = cleanAdditional.slice(matchAdditional.code.length);

  this.editForm = {
    bookingId: booking.id,
    customerName: booking.customerName,
    phone: cleanPhone,
    additionalPhone: cleanAdditional,
    discountAmount: booking.discountAmount || null,
    payMoney: null,
    deposit: booking.deposit ?? 0,
    removedExtraIds: [],
  };

  this.editAddExtraId = 0;
  this.editAddExtraQty = 1;
  this.editMessage = '';
  this.editSaving = false;
  this.editExtraAdding = false;
  this.countryDropdownOpen = {};  // ← ضيف عشان تتأكد مفيش dropdown مفتوح
  if (!fromPanel) { this.showDetailSheet = false; this.showDetailPanel = false; }
  this.showEditModal = true;
}
  closeEditModal(): void { this.showEditModal = false; }

  toggleRemoveExtra(extraId: number): void {
    const idx = this.editForm.removedExtraIds.indexOf(extraId);
    if (idx >= 0) this.editForm.removedExtraIds.splice(idx, 1);
    else this.editForm.removedExtraIds.push(extraId);
    this.cdr.detectChanges();
  }

  isMarkedForRemoval(extraId: number): boolean {
    return this.editForm.removedExtraIds.includes(extraId);
  }

  saveEdit(): void {
    if (!this.selectedBooking || this.editSaving) return;
    this.editSaving = true;
    const dto: UpdateBookingDto = {
      bookingId: this.editForm.bookingId,
      customerName: this.editForm.customerName,
      payMoney: this.editForm.payMoney ?? 0,
      deposit: this.editForm.deposit,
phone: this.editPhoneCountryCode + this.editForm.phone,
additionalPhone: this.editForm.additionalPhone?.trim()
  ? this.editAdditionalPhoneCountryCode + this.editForm.additionalPhone.trim()
  : '',
      discountAmount: this.editForm.discountAmount ?? 0,
      removedExtraIds: this.editForm.removedExtraIds,
    };
    this.bookingService.updateBooking(dto).subscribe({
      next: (res: any) => {
        this.editSaving = false;
        const msg = this.extractMessage(res) || 'تم حفظ التعديلات بنجاح ✓';
        this.editMessage = msg;
        this.editForm.payMoney = 0;
        this.showNotification(msg, 'success');
        this.loadBookings();
        this.refreshUpcoming(); // ✅ هو هيعمل dailyPayments
        this.cdr.detectChanges();
      },
      error: err => {
        this.editSaving = false;
        const msg = err?.error?.message || 'فشل حفظ التعديلات';
        this.editMessage = msg;
        this.showNotification(msg, 'error');
        this.cdr.detectChanges();
      },
    });
  }

  addExtraToEdit(): void {
    if (!this.selectedBooking || !this.editAddExtraId || this.editExtraAdding) return;
    this.editExtraAdding = true;
    this.bookingService.addBookingExtraViaBooking(
      this.selectedBooking.id, +this.editAddExtraId, +this.editAddExtraQty
    ).subscribe({
      next: (res: any) => {
        this.editExtraAdding = false;
        const isFail = typeof res === 'string'
          ? res.includes('فشل') || res.includes('خطأ')
          : (res?.success === false || res?.isSuccess === false);
        this.showNotification(
          this.extractMessage(res) || (isFail ? 'فشل الإضافة' : 'تمت الإضافة بنجاح ✓'),
          isFail ? 'error' : 'success'
        );
        if (!isFail) {
          this.editAddExtraId = 0;
          this.editAddExtraQty = 1;
          this.bookingService.getBookingById(this.selectedBooking!.id).subscribe({
            next: updated => {
              this.selectedBooking = updated;
              this._buildPaymentsMapFromBooking(updated);
              const idx = this.bookings.findIndex(b => b.id === updated.id);
              if (idx >= 0) this.bookings[idx] = updated;
              this.applyFilter();
              this.cdr.detectChanges();
            },
            error: () => this.loadBookings(),
          });
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.editExtraAdding = false;
        this.showNotification(err?.error?.message || 'فشل إضافة الخدمة', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Deposit Modal
  // ══════════════════════════════════════════════════════════════════════════

  openDepositModal(booking: Bookings, fromPanel = false): void {
    this.selectedBooking = booking;
    this.depositAmount = booking.deposit ?? null;
    this.depositSaving = false;
    if (!fromPanel) { this.showDetailSheet = false; this.showDetailPanel = false; }
    this.showDepositModal = true;
  }

  closeDepositModal(): void { this.showDepositModal = false; }

  confirmDeposit(): void {
    if (!this.selectedBooking || this.depositSaving) return;
    if (!this.depositAmount || this.depositAmount <= 0) {
      this.showNotification('يرجى إدخال مبلغ الديبوزت', 'error'); return;
    }
    this.depositSaving = true;
    this.bookingService.confirmBooking(this.selectedBooking.id, this.depositAmount).subscribe({
      next: (res: any) => {
        this.depositSaving = false;
        const success = this.extractSuccess(res);
        this.showNotification(this.extractMessage(res) || 'تم تأكيد الحجز بنجاح ✓', success ? 'success' : 'error');
        if (success) {
          this.closeDepositModal();
          this.showDetailPanel = false;
          this.loadBookings();
        }
        this.refreshUpcoming(); // ✅ هو هيعمل dailyPayments
        this.cdr.detectChanges();
      },
      error: err => {
        this.depositSaving = false;
        this.showNotification(err?.error?.message || 'فشل تأكيد الحجز', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Cancel
  // ══════════════════════════════════════════════════════════════════════════

  promptCancel(id: number, fromPanel = false): void {
    this.cancelTargetId = id;
    this.cancelSaving = false;
    this.cancelReason = '';
    if (!fromPanel) { this.showDetailSheet = false; this.showDetailPanel = false; }
    this.showCancelConfirm = true;
  }

  confirmCancel(): void {
    if (!this.cancelTargetId || this.cancelSaving) return;
    if (!this.cancelReason?.trim()) {
      this.showNotification('يرجى إدخال سبب الإلغاء', 'error'); return;
    }
    this.cancelSaving = true;
    this.bookingService.cancelBooking(this.cancelTargetId, this.cancelReason).subscribe({
      next: (res: any) => {
        this.cancelSaving = false;
        this.showCancelConfirm = false;
        this.showDetailPanel = false;
        this.cancelTargetId = null;
        this.cancelReason = '';
        this.showNotification(this.extractMessage(res) || 'تم إلغاء الحجز', 'success');
        this.loadBookings();
        this.refreshUpcoming();
        this.cdr.detectChanges();
      },
      error: err => {
        this.cancelSaving = false;
        this.showNotification(err?.error?.message || 'فشل إلغاء الحجز', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Mark As Done
  // ══════════════════════════════════════════════════════════════════════════

  isFutureDate(dateStr: string): boolean {
    const today = this.formatDateLocal(new Date());
    return this.parseDateStringAsLocal(dateStr) > today;
  }

  promptDone(id: number, fromPanel = false): void {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) return;

    const today = this.formatDateLocal(new Date());
    const bookingDate = this.parseDateStringAsLocal(booking.date);
    if (bookingDate > today) {
      this.showNotification('لا يمكن تسليم الكوخ قبل يوم الحجز', 'error'); return;
    }

    this.doneTargetId = id;
    this.doneSaving = false;
    this.donePayAmount = null;
    this.doneSelectedChaletId = 0;
    this.availableChaletsForDone = [];
    this.loadingAvailableChalets = true;

    if (!fromPanel) { this.showDetailSheet = false; this.showDetailPanel = false; }
    this.showDoneConfirm = true;
    this.cdr.detectChanges();

    const datePart = this.parseDateStringAsLocal(booking.date);
    const period   = +booking.period;
    const type     = +booking.chaletType;

    this.bookingService.getBookingsByTypeDatePeriod(type, datePart, period).subscribe({
      next: res => {
        const bookedIds = new Set(
          (res.data ?? [])
            .filter((b: any) => b.status !== 'Cancelled' && b.id !== id)
            .map((b: any) => b.chaletId)
            .filter(Boolean)
        );
        this.bookingService.getChaletsByTypePeriod(type, period).subscribe({
          next: allChalets => {
            this.availableChaletsForDone = allChalets
              .filter(c => !bookedIds.has(c.id))
              .map(c => ({ id: c.id, name: c.name, type }));
            this.loadingAvailableChalets = false;
            if (this.availableChaletsForDone.length === 1)
              this.doneSelectedChaletId = this.availableChaletsForDone[0].id;
            this.cdr.detectChanges();
          },
          error: () => { this.loadingAvailableChalets = false; this.cdr.detectChanges(); },
        });
      },
      error: () => {
        this.bookingService.getChaletsByTypePeriod(type, period).subscribe({
          next: all => {
            this.availableChaletsForDone = all.map(c => ({ id: c.id, name: c.name, type }));
            this.loadingAvailableChalets = false;
            this.cdr.detectChanges();
          },
          error: () => { this.loadingAvailableChalets = false; this.cdr.detectChanges(); },
        });
      },
    });
  }

  confirmDone(): void {
    if (!this.doneTargetId || this.doneSaving) return;
    if (!this.doneSelectedChaletId) {
      this.showNotification('يرجى اختيار الكوخ', 'error'); return;
    }
    this.doneSaving = true;
    this.bookingService.markAsDone(this.doneTargetId, {
      pay: this.donePayAmount || 0, chaletTd: this.doneSelectedChaletId
    }).subscribe({
      next: (res: any) => {
        this.doneSaving = false;
        this.showDoneConfirm = false;
        this.showDetailPanel = false;
        this.doneTargetId = null;
        this.showNotification(this.extractMessage(res) || 'تم تسجيل الاستلام بنجاح ✓', 'success');
        this.loadBookings();
        this.refreshUpcoming(); // ✅ هو هيعمل dailyPayments
        this.cdr.detectChanges();
      },
      error: err => {
        this.doneSaving = false;
        this.showNotification(err?.error?.message || 'فشل تسجيل الاستلام', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Payments Modal
  // ══════════════════════════════════════════════════════════════════════════

  openPaymentsModal(booking: Bookings, event?: Event): void {
    if (event) event.stopPropagation();
    this.paymentsBookingId = booking.id;
    this.paymentsLoading = false;
    this.paymentsList = booking.payments ?? [];
    this.bookingPaymentsMap[booking.id] = this.paymentsList.reduce((s, p) => s + p.amount, 0);
    this.showPaymentsModal = true;
    this.cdr.detectChanges();
  }

  closePaymentsModal(): void { this.showPaymentsModal = false; this.paymentsList = []; }

  openTodayRevenueModal(): void  { this.showTodayRevenueModal = true; this.cdr.detectChanges(); }
  closeTodayRevenueModal(): void { this.showTodayRevenueModal = false; }

  openTodayDepositsModal(): void {
    if (!this.auth.hasRole('Manager')) return;
    this.showTodayDepositsModal = true;
    this.cdr.detectChanges();
  }
  closeTodayDepositsModal(): void { this.showTodayDepositsModal = false; }

  getPaymentCustomerName(p: any): string { return p._customerName ?? '—'; }
  getPaymentBookingId(p: any): number    { return p._bookingId ?? 0; }

  get paymentsDeposit(): number    { return this.paymentsList.filter(p => p.paymentReson === 0).reduce((s, p) => s + p.amount, 0); }
  get paymentsPrice(): number      { return this.paymentsList.filter(p => p.paymentReson === 1).reduce((s, p) => s + p.amount, 0); }
  get paymentsTotalPaid(): number  { return this.paymentsList.reduce((s, p) => s + p.amount, 0); }

  // ══════════════════════════════════════════════════════════════════════════
  // Notes Modal
  // ══════════════════════════════════════════════════════════════════════════

  openNotesModal(booking: Bookings, event?: Event): void {
    if (event) event.stopPropagation();
    this.notesBooking = booking;
    this.newNoteText = '';
    this.showNotesModal = true;
    this.cdr.detectChanges();
  }

  closeNotesModal(): void {
    this.showNotesModal = false;
    this.notesBooking = null;
    this.newNoteText = '';
  }

  sendNote(): void {
    if (!this.notesBooking || !this.newNoteText.trim() || this.noteSending) return;
    this.noteSending = true;
    this.bookingService.addBookingNote(this.notesBooking.id, this.newNoteText.trim()).subscribe({
      next: () => {
        this.noteSending = false;
        const text = this.newNoteText.trim();
        this.newNoteText = '';
        if (this.notesBooking) {
          this.notesBooking.notes = [
            ...(this.notesBooking.notes ?? []),
            {
              id: Date.now(), bookingId: this.notesBooking.id,
              note: text, userName: 'أنت',
              createdAt: new Date().toISOString()
            }
          ];
          const idx = this.bookings.findIndex(b => b.id === this.notesBooking!.id);
          if (idx >= 0) this.bookings[idx] = { ...this.notesBooking };
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.noteSending = false;
        this.showNotification('فشل إرسال الملاحظة', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  getNotesCount(b: Bookings): number { return b.notes?.length ?? 0; }

  // ══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════════

  parseDateStringAsLocal(dateStr: string): string {
    if (!dateStr) return '';
    const part = dateStr.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : this.formatDateLocal(new Date(dateStr));
  }

  formatDateLocal(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  formatDateTime(date: any): string {
    if (!date) return '';
    const normalized = typeof date === 'string' && !date.endsWith('Z')
      ? date.replace(' ', 'T').split('.')[0] + 'Z'
      : date;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Amman',
    }).format(new Date(normalized));
  }

  formatDate(d: string): string {
    if (!d) return '-';
    const [year, month, day] = d.split('T')[0].split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }

  getStatusLabel(s: string): string  { return this.statusLabels[s] ?? s; }
  getStatusClass(s: string): string  { return this.statusClasses[s] ?? ''; }
  getPeriodLabel(p: number | undefined): string { return p != null ? (this.periodLabels[p] ?? '-') : '-'; }

  getChaletName(id: number | null): string {
    return id ? (this.chalets.find(c => c.id === id)?.name ?? `شاليه ${id}`) : '—';
  }

  getChaletTypeLabel(raw: any): string { return normalizeChaletType(raw) === 1 ? '👑 رويال' : '🏠 عادي'; }
  isRoyal(raw: any): boolean          { return normalizeChaletType(raw) === 1; }

  getRemaining(b: Bookings): number {
    const paid = this.bookingPaymentsMap[b.id];
    return Math.max(0, (b.totalPrice ?? 0) - (paid !== undefined ? paid : (b.deposit ?? 0)));
  }

  isDone(b: Bookings): boolean { return b.status === 'Done'; }

  private extractMessage(res: any): string {
    if (!res) return '';
    if (typeof res === 'string') return res.trim();
    return res?.message?.message ?? res?.message ?? res?.Message ?? '';
  }

  private extractSuccess(res: any): boolean {
    if (!res) return false;
    return res?.message?.success ?? res?.success ?? res?.isSuccess ?? true;
  }

  showNotification(message: string, type: 'success' | 'error'): void {
    this.toastMessage = message;
    this.toastType    = type;
    this.showToast    = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3500);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Today Stats
  // ══════════════════════════════════════════════════════════════════════════

  private getLocalDateStr(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Amman' });
  }

  private parseUTCDate(dateStr: string): Date {
    const normalized = dateStr.replace(' ', 'T').split('.')[0] + 'Z';
    return new Date(normalized);
  }

  todayBookings: Bookings[] = [];

  loadTodayBookings(): void {
    this.bookingService.getTodayBookings().subscribe({
      next: res => { this.todayBookings = res; this.cdr.detectChanges(); },
      error: err => console.error(err),
    });
  }

  get yesterdayBookings(): Bookings[] {
    const yesterday = this.getLocalDateStr(new Date(Date.now() - 86400000));
    return this.bookings.filter(b => this.getLocalDateStr(this.parseUTCDate(b.createdAt)) === yesterday);
  }

  dailyPayments!: DailyPaymentsResponse;

  get todayRevenue(): number {
    return this.dailyPayments?.today?.payments
      ?.filter(p => p.paymentReson === 1)
      ?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  }

  get todayDeposits(): number {
    return this.dailyPayments?.today?.payments
      ?.filter(p => p.paymentReson === 0)
      ?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  }

  get yesterdayDeposits(): number {
    return this.dailyPayments?.yesterday?.payments
      ?.filter(p => p.paymentReson === 0)
      ?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  }

  get todayRevenuePayments(): DailyPaymentEntry[] {
    return this.dailyPayments?.today?.payments?.filter(p => p.paymentReson === 1) ?? [];
  }

  get todayDepositPayments(): DailyPaymentEntry[] {
    return this.dailyPayments?.today?.payments?.filter(p => p.paymentReson === 0) ?? [];
  }

  get yesterdayDepositPayments(): DailyPaymentEntry[] {
    return this.dailyPayments?.yesterday?.payments?.filter(p => p.paymentReson === 0) ?? [];
  }

  get yesterdayRevenue(): number {
    return this.dailyPayments?.yesterday?.payments
      ?.filter(p => p.paymentReson === 1)
      ?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  }

  get todayTotal(): number     { return this.todayBookings.filter(b => b.status !== 'Cancelled').length; }
  get todayPending(): number   { return this.todayBookings.filter(b => b.status === 'Pending' || b.status === 'WaitingList').length; }
  get todayConfirmed(): number { return this.todayDepositPayments.length; }

  get yesterdayTotal(): number     { return this.yesterdayBookings.filter(b => b.status !== 'Cancelled').length; }
  get yesterdayPending(): number   { return this.yesterdayBookings.filter(b => b.status === 'Pending' || b.status === 'WaitingList').length; }
  get yesterdayConfirmed(): number { return this.yesterdayDepositPayments.length; }

  getDiff(t: number, y: number): number      { return t - y; }
  getDiffClass(t: number, y: number): string { const d = t - y; return d > 0 ? 'diff-up' : d < 0 ? 'diff-down' : 'diff-same'; }
  getDiffIcon(t: number, y: number): string  { const d = t - y; return d > 0 ? 'bi-arrow-up-short' : d < 0 ? 'bi-arrow-down-short' : 'bi-dash'; }

  get editExtrasTotal(): number {
    if (!this.selectedBooking?.extras) return 0;
    return this.selectedBooking.extras
      .filter(e => !this.isMarkedForRemoval(e.extraId))
      .reduce((s, e) => s + e.total, 0);
  }

  get startIndex(): number { return (this.currentPage - 1) * this.pageSize + 1; }
  get endIndex(): number   { return Math.min(this.currentPage * this.pageSize, this.total); }

  get doneBookingRemaining(): number {
    const b = this.bookings.find(x => x.id === this.doneTargetId);
    if (!b) return 0;
    const paid = this.bookingPaymentsMap[b.id];
    return Math.max(0, (b.totalPrice ?? 0) - (paid !== undefined ? paid : (b.deposit ?? 0)));
  }

// getTotalChaletsForType(type: number): number {
//   // صباحي أو مسائي بيمثلوا نفس الأكواخ تقريباً
//   // خد الأكبر بين صباحي ومسائي بس، مش يوم كامل
//   return Math.max(
//     this.chaletCountMap[`${type}_0`] ?? 0,
//     this.chaletCountMap[`${type}_1`] ?? 0
//   );
// }
  // ══════════════════════════════════════════════════════════════════════════
  // refreshUpcoming — ✅ التحسين 3: بيعمل dailyPayments جوّاه تلقائياً
  // ══════════════════════════════════════════════════════════════════════════

  @ViewChild(BookingOverviewComponent) overviewRef!: BookingOverviewComponent;

  private refreshUpcoming(): void {
    forkJoin({
      upcoming: this.bookingService.getUpcomingBookings(),
      daily:    this.bookingService.getDailyPaymentSummary(),
    }).subscribe({
      next: ({ upcoming, daily }) => {
        this.upcomingBookings = upcoming?.data ?? [];
        this.dailyPayments    = daily;
        this.buildBookingStatusMap();
        this.overviewRef?.loadData();
        this.cdr.detectChanges();
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Invoice
  // ══════════════════════════════════════════════════════════════════════════

  openInvoice(booking: Bookings): void {
    const chalet = this.chalets.find(c => c.id === booking.chaletId);
    this.invoiceBooking = { ...booking, chaletImageUrl: chalet?.images?.[0] ?? undefined };
    this.showInvoiceModal = true;
    this.shareBlob = null;
    this.shareBtn  = false;
    this.cdr.detectChanges();
    setTimeout(() => this.prepareShareImage(), 800);
  }

  closeInvoice(): void { this.showInvoiceModal = false; this.invoiceBooking = null; }

  printInvoice(): void {
    const printContents = document.getElementById('invoice-print-area')?.innerHTML;
    if (!printContents) return;
    const win = window.open('', '_blank', 'width=800,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
      <meta charset="UTF-8"/><title>سند قبض #${this.invoiceBooking?.id}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Cairo',sans-serif;background:#fff;color:#1a1a2e;direction:rtl;padding:32px;font-size:14px}</style>
      </head><body>${printContents}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }

  shareBtn  = false;
  shareBlob: Blob | null = null;

  private async captureFixedWidthCanvas(sourceEl: HTMLElement): Promise<HTMLCanvasElement> {
    const clone     = sourceEl.cloneNode(true) as HTMLElement;
    const container = document.createElement('div');
    container.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:800px;direction:rtl;font-family:'Cairo',sans-serif;background:#ffffff;z-index:-1;`;
    clone.style.width    = '800px';
    clone.style.maxWidth = '800px';
    clone.style.margin   = '0';
    container.appendChild(clone);
    document.body.appendChild(container);

    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 200));

    const heroBanner = container.querySelector('.inv-hero-banner') as HTMLElement | null;
    if (heroBanner && this.invoiceBooking?.chaletImageUrl) {
      const base64 = await this.toBase64Image(this.invoiceBooking.chaletImageUrl);
      heroBanner.style.backgroundImage    = base64 ? `url(${base64})` : 'linear-gradient(135deg,#1a1a2e 0%,#2d3748 100%)';
      heroBanner.style.backgroundSize     = 'cover';
      heroBanner.style.backgroundPosition = 'center';
    }

    for (const img of Array.from(container.querySelectorAll<HTMLImageElement>('img'))) {
      if (!img.src) continue;
      try { const b64 = await this.toBase64Image(img.src); if (b64) img.src = b64; }
      catch { img.style.display = 'none'; }
    }

    await Promise.all(Array.from(container.querySelectorAll('img')).map(img =>
      (img as HTMLImageElement).complete ? Promise.resolve() : new Promise(r => {
        (img as HTMLImageElement).onload = (img as HTMLImageElement).onerror = () => r(true);
      })
    ));

    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(clone, {
      scale: 2, useCORS: true, allowTaint: false,
      backgroundColor: '#ffffff', width: 800, windowWidth: 1200,
      imageTimeout: 20000, logging: false,
    });

    document.body.removeChild(container);
    return canvas;
  }

  async shareInvoice(): Promise<void> {
    if (!this.invoiceBooking || !this.shareBlob) {
      this.showNotification('الفاتورة لم تجهز بعد، انتظر لحظة', 'error'); return;
    }
    const file = new File([this.shareBlob], `فاتورة-${this.invoiceBooking.id}.png`, { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(this.shareBlob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `فاتورة-${this.invoiceBooking.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('تم تنزيل الفاتورة ✓', 'success');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') this.showNotification('فشل المشاركة', 'error');
    }
  }

  async prepareShareImage(): Promise<void> {
    const el = document.getElementById('invoice-print-area');
    if (!el) return;
    const canvas = await this.captureFixedWidthCanvas(el);
    canvas.toBlob(blob => { this.shareBlob = blob; this.shareBtn = true; this.cdr.detectChanges(); }, 'image/png');
  }

  private async toBase64Image(url: string): Promise<string> {
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
      const blob     = await response.blob();
      return await new Promise(resolve => {
        const reader      = new FileReader();
        reader.onloadend  = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { return ''; }
  }

  validateDiscount(): void {
    if (!this.auth.hasRole('Manager') && (this.editForm.discountAmount ?? 0) > 10)
      this.editForm.discountAmount = 10;
  }

  validateDiscountNewBooking(): void {
    if (!this.auth.hasRole('Manager') && (this.newBooking.discountAmount ?? 0) > 10)
      this.newBooking.discountAmount = 10;
  }

  onOverviewNewBooking(params: NewBookingRequest): void {
    const chaletType = +params.chaletType;
    const period     = +params.period;
    const date       = params.date as string;

    this.addExtrasList       = [];
    this.selectedCountryCode = '+962';
    this.addSelectedExtraId  = 0;
    this.addSelectedExtraQty = 1;
    this.priceLoaded         = false;
    this.basePrice           = 0;
    this.isSubmitting        = false;

    this.newBooking = {
      customerName: '', phone: '', additionalPhone: '',
      discountAmount: 0, date, period, chaletType, numOfGuests: 1, extras: [], note: ''
    };

    this.calendarDate = new Date(date + 'T00:00:00');

    forkJoin({
      upcoming: this.bookingService.getUpcomingBookings(),
      p0:    this.bookingService.getChaletsByTypePeriod(chaletType, 0),
      p1:    this.bookingService.getChaletsByTypePeriod(chaletType, 1),
      p2:    this.bookingService.getChaletsByTypePeriod(chaletType, 2),
      price: this.bookingService.getBasePrice(
        chaletType, period,
        ([5, 6].includes(this.calendarDate.getDay())) ? 1 : 0
      ),
    }).subscribe({
      next: ({ upcoming, p0, p1, p2, price }) => {
        this.upcomingBookings              = upcoming?.data ?? [];
        this.chaletCountMap[`${chaletType}_0`] = p0.length;
        this.chaletCountMap[`${chaletType}_1`] = p1.length;
        this.chaletCountMap[`${chaletType}_2`] = p2.length;
        this.buildBookingStatusMap();
        this.basePrice  = typeof price === 'number' ? price : (price?.price ?? 0);
        this.priceLoaded = true;
        this.addStep     = 3;
        this.showAddModal = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.buildBookingStatusMap();
        this.addStep      = 3;
        this.showAddModal = true;
        this.cdr.detectChanges();
      }
    });
  }

  onOverviewBookingDetail(bookingId: number): void {
    const found = this.bookings.find(b => b.id === bookingId);
    if (found) {
      window.innerWidth < 768 ? this.openDetailSheet(found) : this.openDetail(found);
    } else {
      this.bookingService.getBookingById(bookingId).subscribe({
        next: full => {
          this.selectedBooking = full;
          this._buildPaymentsMapFromBooking(full);
          window.innerWidth < 768
            ? (this.showDetailSheet = true)
            : (this.showDetailPanel = true);
          this.cdr.detectChanges();
        }
      });
    }
  }

  getBookingById_local(id: number): Bookings {
    return this.bookings.find(b => b.id === id) ?? {} as Bookings;
  }

  get discountDisplay(): number | any {
    return this.editForm.discountAmount === 0 ? null : this.editForm.discountAmount;
  }

  onDiscountChange(value: number | any): void {
    this.editForm.discountAmount = value ?? 0;
  }

  get discountNewDisplay(): number | any {
    return this.newBooking.discountAmount === 0 ? null : this.newBooking.discountAmount;
  }

  onDiscountNewChange(value: number | null): void {
    this.newBooking.discountAmount = value ?? 0;
  }
}
import { CommonModule, DecimalPipe, DatePipe, SlicePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Bookings, BookingService } from '../../service/booking-service';
import { Chalet, ChaletService } from '../../service/chalet-service';
import { AuthService } from '../../service/Auth-service';
// import { ChaletOwnerService, ChaletWithPartners } from '../../service/chalet-owner-service';
import * as XLSX from 'xlsx';
import { ChaletOwnerService, ChaletWithPartners } from '../../service/ChaletOwner-service';

// ── Types ──────────────────────────────────────
type FilterPeriod = '7' | '30' | '90' | '365' | 'month';

interface StatCard {
  label: string;
  value: number;
  unit?: string;
  icon: string;
  color: string;
  changePercent: number;
  changeText: string;
  trendUp: boolean;
  fillPct: number;
}

interface StatusRow {
  label: string;
  count: number;
  pct: number;
  color: string;
}

interface Comparison {
  period: string;
  current: number;
  previous: number;
  unit: string;
  diffPct: number;
  better: boolean;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, FormsModule, DecimalPipe, DatePipe, SlicePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  allBookings: Bookings[] = [];
  allChalets: Chalet[] = [];

  // ── Partner ownership data ───────────────────
  /** جميع الأكواخ مع ملّاكها — نجيبها مرة واحدة من الـ API */
  private chaletsWithPartners: ChaletWithPartners[] = [];

  /**
   * أسماء الأكواخ المملوكة للشريك الحالي.
   * إذا كان المستخدم مديراً أو موظفاً → مصفوفة فارغة (بمعنى: لا قيد).
   */
  private partnerOwnedChaletNames: string[] = [];

  private baseBookings: Bookings[] = [];
  filteredBookings: Bookings[] = [];
  searchTerm = '';

  activeFilter: FilterPeriod = '30';
  filters = [
    { label: 'الشهر الحالي', value: 'month' as FilterPeriod },
    { label: 'آخر أسبوع',    value: '7'     as FilterPeriod },
    { label: 'آخر شهر',      value: '30'    as FilterPeriod },
    { label: 'آخر 90 يوم',   value: '90'    as FilterPeriod },
    { label: 'آخر سنة',      value: '365'   as FilterPeriod },
  ];

  statsCards: StatCard[] = [];
  statusBreakdown: StatusRow[] = [];
  comparisons: Comparison[] = [];
  revenueBreakdown: { label: string; amount: number; pct: number; icon: string; bg: string }[] = [];
  chaletStatusList: { name: string; statusClass: string; statusLabel: string }[] = [];

  totalBookings = 0;
  totalRevenue = 0;
  totalChalets = 0;

  // ── Role helpers ─────────────────────────────
  get isManager(): boolean { return this.authService.isManager(); }
  get isPartner(): boolean { return this.authService.hasRole('Partner'); }

  // ── Period helpers ───────────────────────────
  private getPeriodMs(days: number) { return days * 24 * 60 * 60 * 1000; }
  private getDaysAgo(days: number)  { return new Date(Date.now() - this.getPeriodMs(days)); }

  private getStartOfCurrentMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private getStartOfPreviousMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  constructor(
    private bookingService: BookingService,
    private chaletService: ChaletService,
    private chaletOwnerService: ChaletOwnerService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // نجيب الحجوزات + الشاليهات + بيانات الرويالة دفعة واحدة
    forkJoin({
      bookings:            this.bookingService.getAllBookings(),
      chalets:             this.chaletService.getAll(),
      chaletsWithPartners: this.chaletOwnerService.getChaletsWithPartners(),
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ bookings, chalets, chaletsWithPartners }) => {
        this.allBookings            = bookings;
        this.allChalets             = chalets;
        this.chaletsWithPartners    = chaletsWithPartners;

        // نحسب الأكواخ المملوكة للشريك الحالي (مرة واحدة بعد التحميل)
        this.partnerOwnedChaletNames = this.resolvePartnerChaletNames();

        this.loading = false;
        this.compute();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Partner chalet resolution ────────────────
  /**
   * يرجع أسماء الأكواخ التي يملكها الشريك الحالي.
   * إذا لم يكن المستخدم شريكاً → مصفوفة فارغة (لا قيد على البيانات).
   */
  private resolvePartnerChaletNames(): string[] {
    if (!this.isPartner) return [];

    const session = this.authService.getSession();
    if (!session) return [];

    const currentUserId = session.userId;

    return this.chaletsWithPartners
      .filter(cwp =>
        cwp.partners.some(p => p.userId === currentUserId)
      )
      .map(cwp => cwp.chaletName);
  }

  /**
   * يفلتر مصفوفة الحجوزات حسب صلاحية المستخدم:
   * - مدير/موظف: كل الحجوزات بدون قيد
   * - شريك: الحجوزات المتعلقة بأكواخه فقط
   */
  private applyOwnershipFilter(bookings: Bookings[]): Bookings[] {
    if (!this.isPartner || this.partnerOwnedChaletNames.length === 0) {
      return bookings;
    }
    return bookings.filter(b =>
      this.partnerOwnedChaletNames.includes(b.chaletName ?? '')
    );
  }

  // ── Filter ──────────────────────────────────
  setFilter(val: FilterPeriod): void {
    this.activeFilter = val;
    this.searchTerm = '';
    this.compute();
  }

  // ── Core compute ────────────────────────────
  private compute(): void {
    const now = new Date();

    let cutCur:  Date;
    let cutPrev: Date;

    if (this.activeFilter === 'month') {
      cutCur  = this.getStartOfCurrentMonth();
      cutPrev = this.getStartOfPreviousMonth();
    } else {
      const days    = parseInt(this.activeFilter);
      const prevDays = days * 2;
      cutCur  = this.getDaysAgo(days);
      cutPrev = this.getDaysAgo(prevDays);
    }

    const inRange = (b: Bookings, from: Date, to: Date) => {
      const d = new Date(b.date);
      return d >= from && d <= to;
    };

    // ── تطبيق فلتر الرويالة قبل أي حساب ────────
    const visibleBookings = this.applyOwnershipFilter(this.allBookings);

    const currentPeriod  = visibleBookings.filter(b => inRange(b, cutCur, now));
    const previousPeriod = visibleBookings.filter(b => inRange(b, cutPrev, cutCur));

    const rev = (arr: Bookings[]) =>
      arr.filter(b => b.status === 'Confirmed' || b.status === 'Done')
         .reduce((s, b) => s + (b.totalPrice ?? 0), 0);

    const count = (arr: Bookings[], status: string) =>
      arr.filter(b => b.status === status).length;

    const curRev  = rev(currentPeriod);
    const prevRev = rev(previousPeriod);
    const pctDiff = (cur: number, prev: number) =>
      prev === 0 ? 100 : +((cur - prev) / prev * 100).toFixed(1);

    // ── Stats cards ──────────────────────────────
    const allCards: StatCard[] = [
      {
        label: 'إجمالي الإيرادات',
        value: curRev,
        unit: 'د.أ',
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
                 <path d="M10 6v8M7.5 8.5C7.5 7.4 8.6 7 10 7s2.5.7 2.5 1.5S11.3 10 10 10s-2.5.6-2.5 1.5S8.7 13 10 13s2.5-.4 2.5-1.5"
                       stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
               </svg>`,
        color: '#e8834a',
        changePercent: Math.abs(pctDiff(curRev, prevRev)),
        changeText: `مقارنةً بالفترة السابقة`,
        trendUp: curRev >= prevRev,
        fillPct: Math.min(100, curRev / Math.max(prevRev, 1) * 70),
      },
      {
        label: 'إجمالي الحجوزات',
        value: currentPeriod.length,
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
                 <path d="M7 2v4M13 2v4M3 9h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
               </svg>`,
        color: '#3b82f6',
        changePercent: Math.abs(pctDiff(currentPeriod.length, previousPeriod.length)),
        changeText: `مقارنةً بالفترة السابقة`,
        trendUp: currentPeriod.length >= previousPeriod.length,
        fillPct: Math.min(100, currentPeriod.length / Math.max(previousPeriod.length, 1) * 70),
      },
      {
        label: 'حجوزات مؤكدة',
        value: count(currentPeriod, 'Confirmed'),
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
                 <path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
               </svg>`,
        color: '#22c55e',
        changePercent: Math.abs(pctDiff(count(currentPeriod, 'Confirmed'), count(previousPeriod, 'Confirmed'))),
        changeText: `مقارنةً بالفترة السابقة`,
        trendUp: count(currentPeriod, 'Confirmed') >= count(previousPeriod, 'Confirmed'),
        fillPct: currentPeriod.length > 0
          ? (count(currentPeriod, 'Confirmed') / currentPeriod.length * 100)
          : 0,
      },
      {
        label: 'حجوزات منجزة',
        value: count(currentPeriod, 'Done'),
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
               </svg>`,
        color: '#8b5cf6',
        changePercent: Math.abs(pctDiff(count(currentPeriod, 'Done'), count(previousPeriod, 'Done'))),
        changeText: `مقارنةً بالفترة السابقة`,
        trendUp: count(currentPeriod, 'Done') >= count(previousPeriod, 'Done'),
        fillPct: currentPeriod.length > 0
          ? (count(currentPeriod, 'Done') / currentPeriod.length * 100)
          : 0,
      },
    ];

    // الموظف يشوف الحجوزات بس (بدون كارت الإيرادات)
    // المدير والشريك يشوفون كل شيء
    this.statsCards = this.isManager || this.isPartner ? allCards : allCards.slice(1);

    // ── Status breakdown ─────────────────────────
    const statuses: { key: string; label: string; color: string }[] = [
      { key: 'Confirmed', label: 'مؤكدة',        color: '#22c55e' },
      { key: 'Done',      label: 'منجزة',        color: '#8b5cf6' },
      { key: 'Pending',   label: 'قيد الانتظار', color: '#f59e0b' },
      { key: 'Cancelled', label: 'ملغية',        color: '#ef4444' },
    ];
    const total = currentPeriod.length || 1;
    this.totalBookings = currentPeriod.length;

    this.statusBreakdown = statuses.map(s => ({
      label: s.label,
      count: count(currentPeriod, s.key),
      pct:   count(currentPeriod, s.key) / total * 100,
      color: s.color,
    }));

    // ── Revenue breakdown ────────────────────────
    const chaletRev = currentPeriod
      .filter(b => b.status === 'Confirmed' || b.status === 'Done')
      .reduce((s, b) => s + (b.chaletPrice ?? 0), 0);
    const extrasRev = currentPeriod
      .filter(b => b.status === 'Confirmed' || b.status === 'Done')
      .reduce((s, b) => s + (b.extrasTotal ?? 0), 0);
    const depositSum = currentPeriod
      .filter(b => b.deposit != null)
      .reduce((s, b) => s + (b.deposit ?? 0), 0);
    this.totalRevenue = curRev;

    this.revenueBreakdown = [
      {
        label: 'إيرادات الشاليهات',
        amount: chaletRev,
        pct: curRev > 0 ? chaletRev / curRev * 100 : 0,
        icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="1" y="5" width="14" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/><path d="M8 1l-7 4h14L8 1z" stroke="currentColor" stroke-width="1.2"/></svg>`,
        bg: 'rgba(232,131,74,0.12)',
      },
      {
        label: 'الإضافات',
        amount: extrasRev,
        pct: curRev > 0 ? extrasRev / curRev * 100 : 0,
        icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
        bg: 'rgba(59,130,246,0.12)',
      },
      {
        label: 'الودائع المستلمة',
        amount: depositSum,
        pct: curRev > 0 ? depositSum / curRev * 100 : 0,
        icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8 5v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
        bg: 'rgba(34,197,94,0.12)',
      },
    ];

    // ── Comparisons ──────────────────────────────
    const allComparisons: Comparison[] = [
      {
        period: 'الإيرادات',
        current: curRev,
        previous: prevRev,
        unit: 'د.أ',
        diffPct: Math.abs(pctDiff(curRev, prevRev)),
        better: curRev >= prevRev,
      },
      {
        period: 'الحجوزات',
        current: currentPeriod.length,
        previous: previousPeriod.length,
        unit: 'حجز',
        diffPct: Math.abs(pctDiff(currentPeriod.length, previousPeriod.length)),
        better: currentPeriod.length >= previousPeriod.length,
      },
      {
        period: 'الإلغاءات',
        current: count(currentPeriod, 'Cancelled'),
        previous: count(previousPeriod, 'Cancelled'),
        unit: 'إلغاء',
        diffPct: Math.abs(pctDiff(count(currentPeriod, 'Cancelled'), count(previousPeriod, 'Cancelled'))),
        better: count(currentPeriod, 'Cancelled') <= count(previousPeriod, 'Cancelled'),
      },
    ];

    // الموظف يشوف الحجوزات والإلغاءات فقط
    this.comparisons = this.isManager || this.isPartner ? allComparisons : allComparisons.slice(1);

    // ── Chalets (الشريك يشوف أكواخه فقط) ────────
    const visibleChalets = this.isPartner
      ? this.allChalets.filter(c => this.partnerOwnedChaletNames.includes(c.name))
      : this.allChalets;

    this.totalChalets = visibleChalets.length;
    this.chaletStatusList = visibleChalets.map(c => ({
      name: c.name,
      statusClass: this.getChaletStatusClass(c.status),
      statusLabel: this.getChaletStatusLabel(c.status),
    }));

    // ── Table ────────────────────────────────────
    this.baseBookings = [...currentPeriod].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    this.filteredBookings = [...this.baseBookings];
  }

  // ── Table helpers ────────────────────────────
  filterBookings(): void {
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredBookings = term
      ? this.baseBookings.filter(b =>
          b.customerName.toLowerCase().includes(term) ||
          b.phone.includes(term) ||
          (b.chaletName ?? '').toLowerCase().includes(term)
        )
      : [...this.baseBookings];
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Confirmed: 'badge-confirmed',
      Done:      'badge-done',
      Pending:   'badge-pending',
      Cancelled: 'badge-cancelled',
    };
    return map[status] ?? 'badge-pending';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      Confirmed: 'مؤكدة',
      Done:      'منجزة',
      Pending:   'قيد الانتظار',
      Cancelled: 'ملغية',
    };
    return map[status] ?? status;
  }

  getPeriodLabel(period?: number): string {
    const map: Record<number, string> = { 0: 'صباحي', 1: 'مسائي', 2: 'كامل' };
    return period !== undefined ? (map[period] ?? '—') : '—';
  }

  private getChaletStatusClass(s: string): string {
    const m: Record<string, string> = {
      Available:   'dot-available',
      Booked:      'dot-booked',
      Maintenance: 'dot-maintenance',
    };
    return m[s] ?? 'dot-available';
  }

  private getChaletStatusLabel(s: string): string {
    const m: Record<string, string> = {
      Available:   'متاح',
      Booked:      'محجوز',
      Maintenance: 'صيانة',
    };
    return m[s] ?? s;
  }

  // ── Report Modal ─────────────────────────────
  showReportModal = false;
  reportYear  = new Date().getFullYear();
  reportMonth = new Date().getMonth() + 1;

  readonly monthNames = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];

  get availableYears(): number[] {
    const cur = new Date().getFullYear();
    return [cur - 2, cur - 1, cur];
  }

  openReportModal(): void  { this.showReportModal = true;  }
  closeReportModal(): void { this.showReportModal = false; }

  downloadMonthlyReport(): void {
    const year  = this.reportYear;
    const month = this.reportMonth;

    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    // ── الشريك يصدّر تقرير أكواخه فقط ──────────
    const sourceBookings = this.applyOwnershipFilter(this.allBookings);

    const monthBookings = sourceBookings.filter(b => {
      const d = new Date(b.date);
      return d >= from && d <= to;
    });

    const periodMap: Record<number, string> = { 0: 'صباحي', 1: 'مسائي', 2: 'كامل' };
    const statusMap: Record<string, string> = {
      Confirmed: 'مؤكدة', Done: 'منجزة',
      Pending: 'قيد الانتظار', Cancelled: 'ملغية'
    };

    // Sheet 1: تفاصيل الحجوزات
    const bookingRows = monthBookings.map((b, idx) => ({
      '#':             idx + 1,
      'رقم الحجز':    b.id,
      'اسم النزيل':   b.customerName,
      'الهاتف':       b.phone,
      'الشاليه':      b.chaletName ?? '—',
      'تاريخ الدخول': new Date(b.date).toLocaleDateString('ar-EG'),
      'الفترة':        periodMap[b.period ?? 2] ?? '—',
      'سعر الشاليه':  b.chaletPrice ?? 0,
      'الإضافات':     b.extrasTotal ?? 0,
      'العربون':       b.deposit ?? 0,
      'الإجمالي':     b.totalPrice ?? 0,
      'الحالة':        statusMap[b.status] ?? b.status,
    }));

    // Sheet 2: ملخص
    const confirmedDone = monthBookings.filter(
      b => b.status === 'Confirmed' || b.status === 'Done'
    );
    const totalRev   = confirmedDone.reduce((s, b) => s + (b.totalPrice  ?? 0), 0);
    const chaletRev  = confirmedDone.reduce((s, b) => s + (b.chaletPrice ?? 0), 0);
    const extrasRev  = confirmedDone.reduce((s, b) => s + (b.extrasTotal ?? 0), 0);
    const depositSum = monthBookings.filter(b => b.deposit != null)
                                    .reduce((s, b) => s + (b.deposit ?? 0), 0);

    const countByStatus = (st: string) =>
      monthBookings.filter(b => b.status === st).length;

    const summaryRows = [
      { 'البيان': 'إجمالي الحجوزات',          'القيمة': monthBookings.length,       'الوحدة': 'حجز'  },
      { 'البيان': 'حجوزات مؤكدة',             'القيمة': countByStatus('Confirmed'),  'الوحدة': 'حجز'  },
      { 'البيان': 'حجوزات منجزة',             'القيمة': countByStatus('Done'),       'الوحدة': 'حجز'  },
      { 'البيان': 'قيد الانتظار',             'القيمة': countByStatus('Pending'),    'الوحدة': 'حجز'  },
      { 'البيان': 'ملغية',                     'القيمة': countByStatus('Cancelled'),  'الوحدة': 'حجز'  },
      { 'البيان': '─────────────',             'القيمة': '',                          'الوحدة': ''     },
      { 'البيان': 'إيرادات الشاليهات',        'القيمة': chaletRev,                   'الوحدة': 'د.أ'  },
      { 'البيان': 'إيرادات الإضافات',         'القيمة': extrasRev,                   'الوحدة': 'د.أ'  },
      { 'البيان': 'إجمالي الإيرادات',         'القيمة': totalRev,                    'الوحدة': 'د.أ'  },
      { 'البيان': 'إجمالي العربونات المستلمة', 'القيمة': depositSum,                  'الوحدة': 'د.أ'  },
    ];

    // Sheet 3: الشاليهات (مع فلتر الرويالة)
    const visibleChalets = this.isPartner
      ? this.allChalets.filter(c => this.partnerOwnedChaletNames.includes(c.name))
      : this.allChalets;

    const chaletRows = visibleChalets.map(c => ({
      'اسم الشاليه': c.name,
      'الحالة':       this.getChaletStatusLabel(c.status),
      'عدد حجوزاته هذا الشهر':
        monthBookings.filter(b => b.chaletName === c.name).length,
      'إيراداته':
        monthBookings
          .filter(b => b.chaletName === c.name &&
                       (b.status === 'Confirmed' || b.status === 'Done'))
          .reduce((s, b) => s + (b.totalPrice ?? 0), 0),
    }));

    // Build workbook
    const wb = XLSX.utils.book_new();

    const addSheet = (data: object[], sheetName: string) => {
      const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false });
      ws['!dir'] = 'RTL';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(summaryRows, 'الملخص');
    addSheet(bookingRows, 'تفاصيل الحجوزات');
    addSheet(chaletRows,  'الشاليهات');

    const fileName = `تقرير_${this.monthNames[month - 1]}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);

    this.closeReportModal();
  }
}
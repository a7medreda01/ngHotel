import { CommonModule, DecimalPipe, DatePipe, SlicePipe } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Bookings, BookingService, DashboardData } from '../../service/booking-service';
import { AuthService } from '../../service/Auth-service';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────
type FilterPeriod = '7' | '30' | '90' | '365' | 'month' | 'custom';

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

  private baseBookings: Bookings[] = [];
  filteredBookings: Bookings[] = [];
  searchTerm = '';

  activeFilter: FilterPeriod = '30';
  customDateFrom = '';
  customDateTo = '';
  showDatePicker = false;
  filters = [
    { label: 'الشهر الحالي', value: 'month'  as FilterPeriod },
    { label: 'آخر أسبوع',    value: '7'      as FilterPeriod },
    { label: 'آخر شهر',      value: '30'     as FilterPeriod },
    { label: 'آخر 90 يوم',   value: '90'     as FilterPeriod },
    { label: 'آخر سنة',      value: '365'    as FilterPeriod },
    { label: 'تاريخ محدد',   value: 'custom' as FilterPeriod },
  ];

  statsCards: StatCard[] = [];
  statusBreakdown: StatusRow[] = [];
  comparisons: Comparison[] = [];
  revenueBreakdown: { label: string; amount: number; pct: number; icon: string; bg: string }[] = [];
  chaletStatusList: { name: string; statusClass: string; statusLabel: string }[] = [];

  totalBookings = 0;
  totalRevenue  = 0;
  totalChalets  = 0;

  // ── Role helpers ─────────────────────────────
  get isManager(): boolean { return this.authService.isManager(); }
  get isPartner(): boolean { return this.authService.hasRole('Partner'); }

  // ── Report Modal ─────────────────────────────
  showReportModal = false;
  reportYear  = new Date().getFullYear();
  reportMonth = new Date().getMonth() + 1;
  exportLoading = false;

  readonly monthNames = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
  ];

  get availableYears(): number[] {
    const cur = new Date().getFullYear();
    return [cur - 2, cur - 1, cur];
  }

  constructor(
    private bookingService: BookingService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void { this.loadDashboard(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Load
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * يحسب نطاق التاريخ للـ filter المختار ويبعته دايمًا كـ custom
   * لضمان حساب صحيح في الـ backend
   */
private getDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();

  // بداية اليوم
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  // نهاية اليوم
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);

  let from: Date;
  let to: Date = endToday;

  switch (this.activeFilter) {

    // ✅ الشهر الحالي (من 1 الشهر → آخر يوم في الشهر)
    case 'month': {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      from.setHours(0, 0, 0, 0);

      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      to.setHours(23, 59, 59, 999);
      break;
    }

    // ✅ آخر 7 أيام من النهاردة
    case '7': {
      from = new Date(now);
      from.setDate(now.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    }

    // ✅ آخر 30 يوم من النهاردة
    case '30': {
      from = new Date(now);
      from.setDate(now.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      break;
    }

    // ✅ آخر 90 يوم من النهاردة
    case '90': {
      from = new Date(now);
      from.setDate(now.getDate() - 89);
      from.setHours(0, 0, 0, 0);
      break;
    }

    // ✅ آخر سنة
    case '365': {
      from = new Date(now);
      from.setDate(now.getDate() - 364);
      from.setHours(0, 0, 0, 0);
      break;
    }

    // ✅ تاريخ مخصص
    case 'custom': {
      const customFrom = new Date(this.customDateFrom);
      customFrom.setHours(0, 0, 0, 0);

      const customTo = new Date(this.customDateTo);
      customTo.setHours(23, 59, 59, 999);

      return {
        dateFrom: this.toIsoDate(customFrom),
        dateTo: this.toIsoDate(customTo),
      };
    }

    default: {
      from = new Date(now);
      from.setDate(now.getDate() - 29);
      from.setHours(0, 0, 0, 0);
    }
  }

  console.log('Filter:', this.activeFilter);
  console.log('From:', from);
  console.log('To:', to);

  return {
    dateFrom: this.toIsoDate(from),
    dateTo: this.toIsoDate(to),
  };
}

  private toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');

  return `${y}-${m}-${day}T${h}:${min}:${s}`;
  }

  loadDashboard(): void {
    this.loading = true;
    const { dateFrom, dateTo } = this.getDateRange();

    this.bookingService.getDashboard({
      filter:   'custom',   // دايمًا custom لضمان صحة الحساب في الـ backend
      dateFrom,
      dateTo,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.loading = false;
          this.compute(data);
          this.cdr.detectChanges();
        },
        error: () => {
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Filter
  // ══════════════════════════════════════════════════════════════════════════

  setFilter(val: FilterPeriod): void {
    this.activeFilter = val;
    this.searchTerm   = '';
    if (val !== 'custom') { this.showDatePicker = false; this.loadDashboard(); }
    else                    this.showDatePicker = true;
  }

  applyCustomRange(): void {
    if (this.customDateFrom && this.customDateTo) this.loadDashboard();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Compute
  // ══════════════════════════════════════════════════════════════════════════

  private compute(data: DashboardData): void {
    const pctDiff = (cur: number, prev: number) =>
      prev === 0 ? 100 : +((cur - prev) / prev * 100).toFixed(1);

    this.totalBookings = data.totalBookings;
    this.totalRevenue  = data.totalRevenue;
    this.totalChalets  = data.chalets.length;

    // ── Stats Cards ───────────────────────────────
    const allCards: StatCard[] = [
      {
        label: 'إجمالي الإيرادات', value: data.totalRevenue, unit: 'د.أ',
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
                 <path d="M10 6v8M7.5 8.5C7.5 7.4 8.6 7 10 7s2.5.7 2.5 1.5S11.3 10 10 10s-2.5.6-2.5 1.5S8.7 13 10 13s2.5-.4 2.5-1.5"
                       stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
               </svg>`,
        color: '#e8834a',
        changePercent: Math.abs(pctDiff(data.totalRevenue, data.prevTotalRevenue)),
        changeText: 'مقارنةً بالفترة السابقة',
        trendUp: data.totalRevenue >= data.prevTotalRevenue,
        fillPct: Math.min(100, data.totalRevenue / Math.max(data.prevTotalRevenue, 1) * 70),
      },
      {
        label: 'إجمالي الحجوزات', value: data.totalBookings,
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
                 <path d="M7 2v4M13 2v4M3 9h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
               </svg>`,
        color: '#3b82f6',
        changePercent: Math.abs(pctDiff(data.totalBookings, data.prevTotalBookings)),
        changeText: 'مقارنةً بالفترة السابقة',
        trendUp: data.totalBookings >= data.prevTotalBookings,
        fillPct: Math.min(100, data.totalBookings / Math.max(data.prevTotalBookings, 1) * 70),
      },
      {
        label: 'حجوزات مؤكدة', value: data.confirmedBookings,
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
                 <path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
               </svg>`,
        color: '#22c55e',
        changePercent: Math.abs(pctDiff(data.confirmedBookings, data.prevConfirmedBookings ?? 0)),
        changeText: 'مقارنةً بالفترة السابقة',
        trendUp: data.confirmedBookings >= (data.prevConfirmedBookings ?? 0),
        fillPct: data.totalBookings > 0 ? data.confirmedBookings / data.totalBookings * 100 : 0,
      },
      {
        // ✅ تغيير "منجزة" → "مستلمة"
        label: 'حجوزات مستلمة', value: data.doneBookings,
        icon: `<svg viewBox="0 0 20 20" fill="none" width="20" height="20">
                 <path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
               </svg>`,
        color: '#8b5cf6',
        changePercent: Math.abs(pctDiff(data.doneBookings, data.prevDoneBookings ?? 0)),
        changeText: 'مقارنةً بالفترة السابقة',
        trendUp: data.doneBookings >= (data.prevDoneBookings ?? 0),
        fillPct: data.totalBookings > 0 ? data.doneBookings / data.totalBookings * 100 : 0,
      },
    ];

    this.statsCards = this.isManager || this.isPartner ? allCards : allCards.slice(1);

    // ── Status Breakdown ──────────────────────────
    const total = data.totalBookings || 1;
    this.statusBreakdown = [
      { label: 'مؤكدة',        count: data.confirmedBookings,  pct: data.confirmedBookings  / total * 100, color: '#22c55e' },
      { label: 'مستلمة',       count: data.doneBookings,       pct: data.doneBookings       / total * 100, color: '#8b5cf6' }, // ✅
      { label: 'قيد الانتظار', count: data.pendingBookings,    pct: data.pendingBookings    / total * 100, color: '#f59e0b' },
      { label: 'ملغية',        count: data.cancelledBookings,  pct: data.cancelledBookings  / total * 100, color: '#ef4444' },
    ];

    // ── Revenue Breakdown ─────────────────────────
    // ✅ حساب الإيرادات الفعلية من المدفوعات (payments) خلال الفترة
    const { dateFrom, dateTo } = this.getDateRange();
    const fromDate = dateFrom ? new Date(dateFrom) : null;
const toDate = dateTo ? (() => {
  const d = new Date(dateTo.split('T')[0] + 'T23:59:59');
  return d;
})() : null;
    const allPayments = (data.recentBookings ?? []).flatMap(b => b.payments ?? []);
    const paymentsInRange = allPayments.filter(p => {
      if (!fromDate || !toDate) return true;
      const pDate = new Date(p.createdAt);
      
      return pDate >= fromDate && pDate <= toDate;
    });

    // إجمالي المدفوعات الفعلية (deposit + price payments)
    const totalActualReceived = paymentsInRange.reduce((s, p) => s + (p.amount ?? 0), 0);
    const depositActual       = paymentsInRange.filter(p => p.paymentReson === 0).reduce((s, p) => s + p.amount, 0);
    const priceActual         = paymentsInRange.filter(p => p.paymentReson === 1).reduce((s, p) => s + p.amount, 0);

const calculatedTotal = data.chaletRevenue + data.extrasRevenue - (data.discountSum ?? 0);

// واستخدمه في كل مكان
this.totalRevenue = calculatedTotal;

const rev = Math.max(data.chaletRevenue + data.extrasRevenue, 1);
    this.revenueBreakdown = [
      {
        label: 'إيرادات الشاليهات', amount: data.chaletRevenue,
        pct: data.chaletRevenue / rev * 100,
        icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                 <rect x="1" y="5" width="14" height="9" rx="1" stroke="currentColor" stroke-width="1.3"/>
                 <path d="M8 1l-7 4h14L8 1z" stroke="currentColor" stroke-width="1.2"/>
               </svg>`,
        bg: 'rgba(232,131,74,0.12)',
      },
      {
        label: 'الإضافات', amount: data.extrasRevenue,
        pct: data.extrasRevenue / rev * 100,
        icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                 <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
               </svg>`,
        bg: 'rgba(59,130,246,0.12)',
      },
      {
        label: 'الخصومات', amount: data.discountSum ?? 0,
        pct: (data.discountSum ?? 0) / rev * 100,
        icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16">
                 <path d="M2 14L14 2M5 3a2 2 0 110 4 2 2 0 010-4zm6 6a2 2 0 110 4 2 2 0 010-4z"
                       stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
               </svg>`,
        bg: 'rgba(239,68,68,0.12)',
      },
      // {
      //   label: 'المستلم الفعلي (مدفوعات)', amount: totalActualReceived,
      //   pct: totalActualReceived / rev * 100,
      //   icon: `<svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      //            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>
      //            <path d="M8 5v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      //          </svg>`,
      //   bg: 'rgba(34,197,94,0.12)',
      // },
    ];

    // ── Comparisons ───────────────────────────────
    const allComparisons: Comparison[] = [
      {
        period: 'الإيرادات',
        current: data.totalRevenue, previous: data.prevTotalRevenue, unit: 'د.أ',
        diffPct: Math.abs(pctDiff(data.totalRevenue, data.prevTotalRevenue)),
        better: data.totalRevenue >= data.prevTotalRevenue,
      },
      {
        period: 'الحجوزات',
        current: data.totalBookings, previous: data.prevTotalBookings, unit: 'حجز',
        diffPct: Math.abs(pctDiff(data.totalBookings, data.prevTotalBookings)),
        better: data.totalBookings >= data.prevTotalBookings,
      },
      {
        period: 'الإلغاءات',
        current: data.cancelledBookings, previous: data.prevCancelledBookings, unit: 'إلغاء',
        diffPct: Math.abs(pctDiff(data.cancelledBookings, data.prevCancelledBookings)),
        better: data.cancelledBookings <= data.prevCancelledBookings,
      },
    ];

    this.comparisons = this.isManager || this.isPartner ? allComparisons : allComparisons.slice(1);

    // ── Chalets ───────────────────────────────────
    this.chaletStatusList = data.chalets.map(c => ({
      name:        c.name,
      statusClass: this.getChaletStatusClass(c.status),
      statusLabel: this.getChaletStatusLabel(c.status),
    }));

    // ── Recent Bookings Table ─────────────────────
    this.baseBookings     = data.recentBookings ?? [];
    this.filteredBookings = [...this.baseBookings];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Table helpers
  // ══════════════════════════════════════════════════════════════════════════

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
      Confirmed: 'badge-confirmed', Done: 'badge-done',
      Pending:   'badge-pending',   Cancelled: 'badge-cancelled',
    };
    return map[status] ?? 'badge-pending';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      Confirmed: 'مؤكدة', Done: 'مستلمة',   // ✅ تغيير منجزة → مستلمة
      Pending: 'قيد الانتظار', Cancelled: 'ملغية',
    };
    return map[status] ?? status;
  }

  getPeriodLabel(period?: number): string {
    const map: Record<number, string> = { 0: 'صباحي', 1: 'مسائي', 2: 'كامل' };
    return period !== undefined ? (map[period] ?? '—') : '—';
  }

  private getChaletStatusClass(s: string): string {
    const m: Record<string, string> = {
      Available: 'dot-available', Booked: 'dot-booked', Maintenance: 'dot-maintenance',
    };
    return m[s] ?? 'dot-available';
  }

  private getChaletStatusLabel(s: string): string {
    const m: Record<string, string> = { Available: 'متاح', Booked: 'محجوز', Maintenance: 'صيانة' };
    return m[s] ?? s;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Report Modal
  // ══════════════════════════════════════════════════════════════════════════

  openReportModal():  void { this.showReportModal = true;  }
  closeReportModal(): void { this.showReportModal = false; }

  // ══════════════════════════════════════════════════════════════════════════
  // Excel Export
  // ══════════════════════════════════════════════════════════════════════════

  downloadMonthlyReport(): void {
    const year  = this.reportYear;
    const month = this.reportMonth;

    this.exportLoading = true;
    this.cdr.detectChanges();

    this.bookingService.getBookingsForExport(year, month)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: bookings => {
          this.exportLoading = false;
          this.buildExcel(bookings, year, month);
          this.closeReportModal();
          this.cdr.detectChanges();
        },
        error: () => {
          this.exportLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  private buildExcel(monthBookings: Bookings[], year: number, month: number): void {
    const from = new Date(year, month - 1, 1);
    const to   = new Date(year, month, 0, 23, 59, 59);

    const periodMap: Record<number, string> = { 0: 'صباحي', 1: 'مسائي', 2: 'كامل' };
    const statusMap: Record<string, string> = {
      Confirmed: 'مؤكدة', Done: 'مستلمة',   // ✅ تغيير
      Pending: 'قيد الانتظار', Cancelled: 'ملغية',
    };

    const wb = XLSX.utils.book_new();

    const getInvoiceNumber = (b: Bookings) => {
      const y      = new Date(b.date).getFullYear();
      const prefix = b.chaletType === 1 ? 'R' : 'G';
      return `${prefix}-${y}-${b.id}`;
    };

    const addSheet = (data: object[], sheetName: string) => {
      if (data.length === 0) data = [{ 'ملاحظة': 'لا توجد بيانات لهذه الفترة' }];
      const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false });
      ws['!dir']  = 'RTL';
      ws['!cols'] = Object.keys(data[0] ?? {}).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    // ════════════════════════════════════════════════════════════════
    // ✅ SHEET 1 — الملخص العام
    // الحجوزات (مؤكدة/انتظار/ملغي/مستلمة) حسب createdAt
    // الحجوزات المستلمة (المستلم فعلياً في الشهر) حسب date
    // ════════════════════════════════════════════════════════════════

    // حجوزات أُنشئت خلال الشهر (حسب createdAt)
    const createdInMonth = monthBookings.filter(b => {
      const d = new Date(b.createdAt);
      return d >= from && d <= to;
    });

    // حجوزات تاريخ الاستلام (date) خلال الشهر — المستلمة فعلياً
    const receivedInMonth = monthBookings.filter(b => {
      const d = new Date(b.date);
      return d >= from && d <= to && (b.status === 'Done');
    });

    const confirmedDone  = monthBookings.filter(b => b.status === 'Confirmed' || b.status === 'Done');
    const totalRev       = confirmedDone.reduce((s, b) => s + (b.totalPrice  ?? 0), 0);
    const chaletRev      = confirmedDone.reduce((s, b) => s + (b.chaletPrice ?? 0), 0);
    const extrasRev      = confirmedDone.reduce((s, b) => s + (b.extrasTotal ?? 0), 0);
    const discountSum    = monthBookings.reduce((s, b) => s + (b.discountAmount ?? 0), 0);

    // ✅ الإيراد الفعلي من المدفوعات خلال الشهر (حسب createdAt للـ payment)
    const allPayments = monthBookings.flatMap(b => (b.payments ?? []).map(p => ({ ...p, bookingId: b.id })));
    const paymentsInMonth = allPayments.filter(p => {
      const d = new Date(p.createdAt);
      return d >= from && d <= to;
    });
    const depositInMonth  = paymentsInMonth.filter(p => p.paymentReson === 0).reduce((s, p) => s + p.amount, 0);
    const priceInMonth    = paymentsInMonth.filter(p => p.paymentReson === 1).reduce((s, p) => s + p.amount, 0);
    const totalReceived   = depositInMonth + priceInMonth;

    const countCreatedByStatus = (st: string) => createdInMonth.filter(b => b.status === st).length;

    addSheet([
      // ── حجوزات أُنشئت خلال الشهر (createdAt) ──
      { 'البيان': '═══ الحجوزات المُنشأة خلال الشهر (حسب تاريخ الإنشاء) ═══', 'القيمة': '', 'الوحدة': '' },
      { 'البيان': 'إجمالي الحجوزات المُنشأة',   'القيمة': createdInMonth.length,               'الوحدة': 'حجز' },
      { 'البيان': 'حجوزات مؤكدة',               'القيمة': countCreatedByStatus('Confirmed'),   'الوحدة': 'حجز' },
      { 'البيان': 'قيد الانتظار',               'القيمة': countCreatedByStatus('Pending'),     'الوحدة': 'حجز' },
      { 'البيان': 'ملغية',                      'القيمة': countCreatedByStatus('Cancelled'),   'الوحدة': 'حجز' },
      { 'البيان': 'مستلمة',                     'القيمة': countCreatedByStatus('Done'),        'الوحدة': 'حجز' },
      // ── حجوزات مستلمة في الشهر (date) ──
      { 'البيان': '═══ الحجوزات المُستلمة في الشهر (حسب تاريخ الحجز) ═══', 'القيمة': '', 'الوحدة': '' },
      { 'البيان': 'حجوزات مستلمة فعلياً',       'القيمة': receivedInMonth.length,              'الوحدة': 'حجز' },
      // ── الإيرادات ──
      { 'البيان': '═══ الإيرادات ═══', 'القيمة': '', 'الوحدة': '' },
      { 'البيان': 'إيرادات الشاليهات',           'القيمة': chaletRev,                           'الوحدة': 'د.أ' },
      { 'البيان': 'إيرادات الإضافات',            'القيمة': extrasRev,                           'الوحدة': 'د.أ' },
      { 'البيان': 'إجمالي الخصومات',             'القيمة': discountSum,                         'الوحدة': 'د.أ' },
      { 'البيان': 'إجمالي الإيرادات (بعد الخصم)','القيمة': totalRev,                            'الوحدة': 'د.أ' },
      // ── المدفوعات الفعلية خلال الشهر (حسب createdAt) ──
      { 'البيان': '═══ المدفوعات المُستلمة خلال الشهر (حسب تاريخ الدفع) ═══', 'القيمة': '', 'الوحدة': '' },
      { 'البيان': 'عربونات مستلمة',              'القيمة': depositInMonth,                      'الوحدة': 'د.أ' },
      { 'البيان': 'دفعات تسوية مستلمة',          'القيمة': priceInMonth,                        'الوحدة': 'د.أ' },
      { 'البيان': 'إجمالي المستلم الفعلي',       'القيمة': totalReceived,                       'الوحدة': 'د.أ' },
    ], 'الملخص العام');

    // ════════════════════════════════════════════════════════════════
    // ✅ SHEET 2 — تفاصيل الحجوزات (مع إجمالي المدفوع والمتبقي)
    // ════════════════════════════════════════════════════════════════
    addSheet(monthBookings.map((b, idx) => {
      const totalPaid      = (b.payments ?? []).reduce((s, p) => s + p.amount, 0);
      const remaining      = (b.totalPrice ?? 0) - totalPaid;

      return {
        '#':                     idx + 1,
        'رقم الفاتورة':          getInvoiceNumber(b),
        'رقم الحجز':             b.id,
        'اسم النزيل':            b.customerName,
        'الهاتف':                b.phone,
        'هاتف إضافي':            b.additionalPhone ?? '—',
        'الشاليه':               b.chaletName ?? '—',
        'تاريخ الحجز (الاستلام)':new Date(b.date).toLocaleDateString('ar-EG'),
        'تاريخ الإنشاء':         new Date(b.createdAt).toLocaleDateString('ar-EG'),
        'الفترة':                periodMap[b.period ?? 2] ?? '—',
        'عدد الضيوف':            b.numOfGuests ?? '—',
        'أنشئ بواسطة':           b.createdBy ?? '—',
        'سعر الشاليه':           b.chaletPrice ?? 0,
        'إجمالي الإضافات':       b.extrasTotal ?? 0,
        'الخصم':                 b.discountAmount ?? 0,
        'الإجمالي قبل الخصم':   b.price ?? 0,         // ✅ عنوان واضح
        'الإجمالي بعد الخصم':   b.totalPrice ?? 0,    // ✅ عنوان واضح
        'إجمالي المدفوع':        totalPaid,            // ✅ جديد
        'المتبقي':               remaining > 0 ? remaining : 0, // ✅ جديد
        'الحالة':                statusMap[b.status] ?? b.status,
        'الإضافات (تفصيل)':     (b.extras ?? []).map(e => `${e.extraName ?? '—'} × ${e.quantity} = ${e.total} د.أ`).join(' | ') || '—',
        'الملاحظات':             (b.notes  ?? []).map(n => `[${n.userName}]: ${n.note}`).join(' | ') || '—',
      };
    }), 'تفاصيل الحجوزات');

    // ════════════════════════════════════════════════════════════════
    // SHEET 3 — الإضافات التفصيلية
    // ════════════════════════════════════════════════════════════════
    const extrasRows: object[] = [];
    monthBookings.forEach(b => {
      (b.extras ?? []).forEach(e => {
        extrasRows.push({
          'رقم الفاتورة': getInvoiceNumber(b),
          'رقم الحجز':    b.id,
          'اسم النزيل':   b.customerName,
          'الشاليه':      b.chaletName ?? '—',
          'تاريخ الحجز':  new Date(b.date).toLocaleDateString('ar-EG'),
          'أنشئ بواسطة':  b.createdBy ?? '—',
          'اسم الإضافة':  e.extraName ?? '—',
          'الكمية':        e.quantity,
          'سعر الوحدة':   e.price,
          'الإجمالي':      e.total,
          'حالة الحجز':   statusMap[b.status] ?? b.status,
        });
      });
    });
    addSheet(extrasRows, 'الإضافات التفصيلية');

    // ════════════════════════════════════════════════════════════════
    // SHEET 4 — إحصائيات الأكواخ
    // ════════════════════════════════════════════════════════════════
    const chaletNamesSet = [...new Set(monthBookings.map(b => b.chaletName ?? '—'))];
    addSheet(chaletNamesSet.map(name => {
      const cb     = monthBookings.filter(b => (b.chaletName ?? '—') === name);
      const cbDone = cb.filter(b => b.status === 'Confirmed' || b.status === 'Done');
      const extrasSummary: Record<string, { qty: number; total: number }> = {};
      cb.forEach(b => {
        (b.extras ?? []).forEach(e => {
          const key = e.extraName ?? '—';
          if (!extrasSummary[key]) extrasSummary[key] = { qty: 0, total: 0 };
          extrasSummary[key].qty   += e.quantity;
          extrasSummary[key].total += e.total;
        });
      });
      return {
        'اسم الكوخ':        name,
        'إجمالي الحجوزات':  cb.length,
        'مؤكدة':            cb.filter(b => b.status === 'Confirmed').length,
        'مستلمة':           cb.filter(b => b.status === 'Done').length,       // ✅
        'قيد الانتظار':     cb.filter(b => b.status === 'Pending').length,
        'ملغية':            cb.filter(b => b.status === 'Cancelled').length,
        'إيرادات الشاليه':  cbDone.reduce((s, b) => s + (b.chaletPrice ?? 0), 0),
        'إيرادات الإضافات': cbDone.reduce((s, b) => s + (b.extrasTotal ?? 0), 0),
        'إجمالي الإيرادات': cbDone.reduce((s, b) => s + (b.totalPrice  ?? 0), 0),
        'إجمالي الخصومات':  cb.reduce((s, b) => s + (b.discountAmount ?? 0), 0),
        'تفصيل الإضافات':   Object.entries(extrasSummary).map(([n, v]) => `${n}: ${v.qty} وحدة = ${v.total} د.أ`).join(' | ') || '—',
      };
    }), 'إحصائيات الأكواخ');

    // ════════════════════════════════════════════════════════════════
    // ✅ SHEET 5 — إحصائيات الموظفين
    // إجمالي الحجوزات + مؤكدة: حسب createdAt
    // مستلمة: حسب date
    // + عدد الخصومات + قيد الانتظار
    // ════════════════════════════════════════════════════════════════
    const employeeMap: Record<string, {
      total: number;           // مُنشأة في الشهر (createdAt)
      confirmed: number;       // مؤكدة مُنشأة في الشهر (createdAt)
      done: number;            // مستلمة تاريخها في الشهر (date)
      pending: number;         // قيد الانتظار (createdAt)
      cancelled: number;       // ملغية
      revenue: number;         // إيرادات (مؤكدة + مستلمة)
      discountCount: number;   // ✅ عدد الحجوزات التي عليها خصم
      discountAmount: number;  // إجمالي الخصومات
    }> = {};

    monthBookings.forEach(b => {
      const emp = b.createdBy ?? 'غير محدد';
      if (!employeeMap[emp]) {
        employeeMap[emp] = {
          total: 0, confirmed: 0, done: 0, pending: 0,
          cancelled: 0, revenue: 0, discountCount: 0, discountAmount: 0,
        };
      }

      const createdAt = new Date(b.createdAt);
      const bookingDate = new Date(b.date);

      // إجمالي الحجوزات + مؤكدة + انتظار + ملغية: حسب createdAt
      if (createdAt >= from && createdAt <= to) {
        employeeMap[emp].total++;
        if (b.status === 'Confirmed') employeeMap[emp].confirmed++;
        if (b.status === 'Pending')   employeeMap[emp].pending++;
        if (b.status === 'Cancelled') employeeMap[emp].cancelled++;
        if ((b.discountAmount ?? 0) > 0) {
          employeeMap[emp].discountCount++;
          employeeMap[emp].discountAmount += b.discountAmount ?? 0;
        }
      }

      // مستلمة: حسب date
      if (bookingDate >= from && bookingDate <= to && b.status === 'Done') {
        employeeMap[emp].done++;
        employeeMap[emp].revenue += b.totalPrice ?? 0;
      }
    });

    addSheet(Object.entries(employeeMap).map(([name, v]) => ({
      'اسم الموظف':           name,
      'إجمالي الحجوزات (مُنشأة)': v.total,
      'مؤكدة':                v.confirmed,
      'مستلمة':               v.done,                // ✅
      'قيد الانتظار':         v.pending,             // ✅ جديد
      'ملغية':                v.cancelled,
      'عدد حجوزات بخصم':     v.discountCount,       // ✅ جديد
      'إجمالي الخصومات':      v.discountAmount,
      'الإيرادات المحققة':    v.revenue,
    })), 'إحصائيات الموظفين');

    // ════════════════════════════════════════════════════════════════
    // SHEET 6 — ملخص الإضافات
    // ════════════════════════════════════════════════════════════════
    const allExtrasMap: Record<string, { qty: number; revenue: number; bookings: number }> = {};
    monthBookings.forEach(b => {
      (b.extras ?? []).forEach(e => {
        const key = e.extraName ?? '—';
        if (!allExtrasMap[key]) allExtrasMap[key] = { qty: 0, revenue: 0, bookings: 0 };
        allExtrasMap[key].qty      += e.quantity;
        allExtrasMap[key].revenue  += e.total;
        allExtrasMap[key].bookings += 1;
      });
    });
    addSheet(
      Object.entries(allExtrasMap)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([name, v]) => ({
          'اسم الإضافة':      name,
          'إجمالي الكميات':   v.qty,
          'عدد مرات الطلب':   v.bookings,
          'إجمالي الإيرادات': v.revenue,
        })),
      'ملخص الإضافات'
    );

    // ════════════════════════════════════════════════════════════════
    // ✅ SHEET 7 — تقرير المدفوعات خلال الشهر (حسب createdAt)
    // ════════════════════════════════════════════════════════════════
    const paymentRows: object[] = [];
    monthBookings.forEach(b => {
      (b.payments ?? []).forEach(p => {
        const pDate = new Date(p.createdAt);
        if (pDate < from || pDate > to) return;   // ✅ فلتر حسب createdAt
        paymentRows.push({
          'رقم الفاتورة':   getInvoiceNumber(b),
          'رقم الحجز':      b.id,
          'اسم النزيل':     b.customerName,
          'الهاتف':         b.phone,
          'الشاليه':        b.chaletName ?? '—',
          'تاريخ الحجز':    new Date(b.date).toLocaleDateString('ar-EG'),
          'تاريخ الدفع':    pDate.toLocaleDateString('ar-EG'),
          'وقت الدفع':      pDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          'نوع الدفعة':     p.paymentReson === 0 ? 'عربون' : 'دفعة تسوية',
          'مبلغ الدفعة':    p.amount,
          'طريقة الدفع':    p.method ?? '—',
          'رقم المعاملة':   p.transactionId ?? '—',
          'حالة الدفع':     p.status ?? '—',
          'حالة الحجز':     statusMap[b.status] ?? b.status,
          'إجمالي الحجز':   b.totalPrice ?? 0,
        });
      });
    });

    // إضافة صف الإجمالي
    if (paymentRows.length > 0) {
      const totalDepositsRow   = (paymentRows as any[]).filter(r => r['نوع الدفعة'] === 'عربون').reduce((s, r) => s + (r['مبلغ الدفعة'] ?? 0), 0);
      const totalPricePayments = (paymentRows as any[]).filter(r => r['نوع الدفعة'] === 'دفعة تسوية').reduce((s, r) => s + (r['مبلغ الدفعة'] ?? 0), 0);
      const grandTotal         = (paymentRows as any[]).reduce((s, r) => s + (r['مبلغ الدفعة'] ?? 0), 0);
      paymentRows.push(
        { 'رقم الفاتورة': '───', 'رقم الحجز': '', 'اسم النزيل': 'إجمالي العربونات',      'الهاتف': '', 'الشاليه': '', 'تاريخ الحجز': '', 'تاريخ الدفع': '', 'وقت الدفع': '', 'نوع الدفعة': 'عربون',          'مبلغ الدفعة': totalDepositsRow,   'طريقة الدفع': '', 'رقم المعاملة': '', 'حالة الدفع': '', 'حالة الحجز': '', 'إجمالي الحجز': '' },
        { 'رقم الفاتورة': '───', 'رقم الحجز': '', 'اسم النزيل': 'إجمالي دفعات التسوية', 'الهاتف': '', 'الشاليه': '', 'تاريخ الحجز': '', 'تاريخ الدفع': '', 'وقت الدفع': '', 'نوع الدفعة': 'دفعة تسوية',    'مبلغ الدفعة': totalPricePayments, 'طريقة الدفع': '', 'رقم المعاملة': '', 'حالة الدفع': '', 'حالة الحجز': '', 'إجمالي الحجز': '' },
        { 'رقم الفاتورة': '═══', 'رقم الحجز': '', 'اسم النزيل': 'الإجمالي الكلي',        'الهاتف': '', 'الشاليه': '', 'تاريخ الحجز': '', 'تاريخ الدفع': '', 'وقت الدفع': '', 'نوع الدفعة': '',               'مبلغ الدفعة': grandTotal,          'طريقة الدفع': '', 'رقم المعاملة': '', 'حالة الدفع': '', 'حالة الحجز': '', 'إجمالي الحجز': '' },
      );
    }
    addSheet(paymentRows, 'تقرير المدفوعات');

    // ════════════════════════════════════════════════════════════════
    // SHEET 8 — تقرير الديبوزتات (للمدير فقط)
    // ════════════════════════════════════════════════════════════════
    if (this.isManager) {
      const depositRows: object[] = [];
      monthBookings.forEach(b => {
        (b.payments ?? []).forEach(p => {
          const pDate = new Date(p.createdAt);
          if (pDate < from || pDate > to) return;
          if (p.paymentReson !== 0) return;
          depositRows.push({
            'رقم الفاتورة':         getInvoiceNumber(b),
            'رقم الحجز':            b.id,
            'اسم النزيل':           b.customerName,
            'الهاتف':               b.phone,
            'الشاليه':              b.chaletName ?? '—',
            'تاريخ الحجز':          new Date(b.date).toLocaleDateString('ar-EG'),
            'تاريخ الديبوزت':       pDate.toLocaleDateString('ar-EG'),
            'وقت الديبوزت':         pDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            'مبلغ الديبوزت':        p.amount,
            'طريقة الدفع':          p.method ?? '—',
            'رقم المعاملة':         p.transactionId ?? '—',
            'حالة الدفع':           p.status ?? '—',
            'حالة الحجز':           statusMap[b.status] ?? b.status,
            'إجمالي الحجز':         b.totalPrice ?? 0,
            'المتبقي بعد الديبوزت': (b.totalPrice ?? 0) - p.amount,
          });
        });
      });

      if (depositRows.length > 0) {
        const totalDeposits = (depositRows as any[]).reduce((s, r) => s + (r['مبلغ الديبوزت'] ?? 0), 0);
        depositRows.push({
          'رقم الفاتورة': '───', 'رقم الحجز': '───', 'اسم النزيل': 'الإجمالي',
          'الهاتف': '', 'الشاليه': '', 'تاريخ الحجز': '', 'تاريخ الديبوزت': '',
          'وقت الديبوزت': '', 'مبلغ الديبوزت': totalDeposits, 'طريقة الدفع': '',
          'رقم المعاملة': '', 'حالة الدفع': '', 'حالة الحجز': '',
          'إجمالي الحجز': '', 'المتبقي بعد الديبوزت': '',
        });
      }
      addSheet(depositRows, 'تقرير الديبوزتات');
    }

    XLSX.writeFile(wb, `تقرير_${this.monthNames[month - 1]}_${year}.xlsx`);
  }
}
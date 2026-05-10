import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { UpcomingBooking, BookingService } from '../../service/booking-service';
import { FilterStatusPipe } from '../../adds/pipes/status.pipe';
import { CommonModule, DatePipe } from '@angular/common';


export interface DayStatus {
  date: string;          // YYYY-MM-DD
  day: number;
  isPast: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;

  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  done: number;
  available: number;     // 0 = no availability info without full chalet count

  colorClass: 'full' | 'partial' | 'pending' | 'available' | 'empty';
}

export interface PeriodLabel {
  value: number;
  label: string;
  icon: string;
}

export const PERIOD_LABELS: PeriodLabel[] = [
  { value: 0, label: 'صباحي',   icon: '🌅' },
  { value: 1, label: 'مسائي',   icon: '🌇' },
  { value: 2, label: 'يوم كامل', icon: '🌞' },
];

export const CHALET_TYPE_LABELS: Record<number, string> = {
  0: 'عادي',
  1: 'رويال',
};

export const STATUS_LABELS: Record<string, string> = {
  Pending:   'قيد الانتظار',
  Confirmed: 'مؤكد',
  Cancelled: 'ملغي',
  Done:      'منتهي',
};

export const STATUS_COLORS: Record<string, string> = {
  Pending:   'pending',
  Confirmed: 'confirmed',
  Cancelled: 'cancelled',
  Done:      'done',
};

@Component({
  selector: 'app-booking-overview',
  templateUrl: './booking-overview.html',
  imports:[FilterStatusPipe,DatePipe,CommonModule],
  styleUrls: ['./booking-overview.scss'],
})
export class BookingOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ── Calendar State ─────────────────────────────────────────────────────────
  today = new Date();
  viewDate = new Date();          // first day of displayed month
  weeks: DayStatus[][] = [];
  upcomingBookings: UpcomingBooking[] = [];
  loading = false;

  // ── Day Detail State ─────────────── ────────────────────────────────────────
  selectedDay: DayStatus | null = null;
  dayBookings: UpcomingBooking[] = [];

  // ── Drilldown State ────────────────────────────────────────────────────────
  drilldownType: number | null = null;   // chaletType 0|1
  drilldownPeriod: number | null = null; // period 0|1|2
  drilldownStatus: string | null = null; // Pending|Confirmed|...
  drilldownBookings: UpcomingBooking[] = [];

  // ── View Mode ──────────────────────────────────────────────────────────────
  viewMode: 'calendar' | 'day' | 'drilldown' = 'calendar';

  readonly PERIOD_LABELS = PERIOD_LABELS;
  readonly CHALET_TYPE_LABELS = CHALET_TYPE_LABELS;
  readonly STATUS_LABELS = STATUS_LABELS;
  readonly STATUS_COLORS = STATUS_COLORS;

  WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  constructor(
    private bookingService: BookingService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.viewDate = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    this.loadUpcoming();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data Loading ───────────────────────────────────────────────────────────

  loadUpcoming(): void {
    this.loading = true;
    this.bookingService.getUpcomingBookings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.upcomingBookings = res.data ?? [];
          this.buildCalendar();
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  // ── Calendar Building ──────────────────────────────────────────────────────

  buildCalendar(): void {
    const year  = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();   // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // group bookings by date string
    const byDate = this.groupByDate(this.upcomingBookings);

    const allDays: DayStatus[] = [];

    // fill leading blank days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      allDays.push(this.buildDayStatus(d, byDate, false));
    }

    // current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      allDays.push(this.buildDayStatus(date, byDate, true));
    }

    // trailing days
    const remaining = (7 - allDays.length % 7) % 7;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      allDays.push(this.buildDayStatus(date, byDate, false));
    }

    // chunk into weeks
    this.weeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      this.weeks.push(allDays.slice(i, i + 7));
    }
  }

  private groupByDate(bookings: UpcomingBooking[]): Record<string, UpcomingBooking[]> {
    const map: Record<string, UpcomingBooking[]> = {};
    for (const b of bookings) {
      const key = b.date?.split('T')[0];
      if (!key) continue;
      map[key] = map[key] ?? [];
      map[key].push(b);
    }
    return map;
  }

  private buildDayStatus(
    date: Date,
    byDate: Record<string, UpcomingBooking[]>,
    isCurrentMonth: boolean,
  ): DayStatus {
    const key = this.toDateKey(date);
    const todayKey = this.toDateKey(this.today);
    const list = byDate[key] ?? [];

    const confirmed  = list.filter(b => b.status === 'Confirmed').length;
    const pending    = list.filter(b => b.status === 'Pending').length;
    const cancelled  = list.filter(b => b.status === 'Cancelled').length;
    const done       = list.filter(b => b.status === 'Done').length;
    const total      = list.length;
    const active     = confirmed + pending;

    let colorClass: DayStatus['colorClass'] = 'empty';
    if (total > 0) {
      if (pending > 0 && confirmed === 0) colorClass = 'pending';
      else if (active >= 4)               colorClass = 'full';
      else if (active > 0)               colorClass = 'partial';
      else                               colorClass = 'available';
    }

    return {
      date: key,
      day: date.getDate(),
      isPast: key < todayKey,
      isToday: key === todayKey,
      isCurrentMonth,
      total, confirmed, pending, cancelled, done,
      available: 0,
      colorClass,
    };
  }

  private toDateKey(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  prevMonth(): void {
    const d = new Date(this.viewDate);
    d.setMonth(d.getMonth() - 1);
    this.viewDate = d;
    this.buildCalendar();
  }

  nextMonth(): void {
    const d = new Date(this.viewDate);
    d.setMonth(d.getMonth() + 1);
    this.viewDate = d;
    this.buildCalendar();
  }

  get monthYearLabel(): string {
    const months = [
      'يناير','فبراير','مارس','أبريل','مايو','يونيو',
      'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
    ];
    return `${months[this.viewDate.getMonth()]} ${this.viewDate.getFullYear()}`;
  }

  // ── Day Selection ──────────────────────────────────────────────────────────

  selectDay(day: DayStatus): void {
    if (!day.isCurrentMonth) return;
    this.selectedDay = day;
    const byDate = this.groupByDate(this.upcomingBookings);
    this.dayBookings = byDate[day.date] ?? [];
    this.viewMode = 'day';
    this.drilldownType = null;
    this.drilldownPeriod = null;
    this.drilldownStatus = null;
    this.drilldownBookings = [];
  }

  backToCalendar(): void {
    this.viewMode = 'calendar';
    this.selectedDay = null;
  }

  backToDay(): void {
    this.viewMode = 'day';
    this.drilldownType = null;
    this.drilldownPeriod = null;
    this.drilldownStatus = null;
    this.drilldownBookings = [];
  }

  // ── Day Detail Helpers ─────────────────────────────────────────────────────

  /** Returns unique (chaletType, period) combos present in day bookings */
  get dayGroups(): Array<{ type: number; period: number; bookings: UpcomingBooking[] }> {
    const map = new Map<string, UpcomingBooking[]>();
    for (const b of this.dayBookings) {
      const key = `${b.chaletType}-${b.period}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    const result: Array<{ type: number; period: number; bookings: UpcomingBooking[] }> = [];
    map.forEach((bookings, key) => {
      const [type, period] = key.split('-').map(Number);
      result.push({ type, period, bookings });
    });
    result.sort((a, b) => a.type - b.type || a.period - b.period);
    return result;
  }

  statusCount(bookings: UpcomingBooking[], status: string): number {
    return bookings.filter(b => b.status === status).length;
  }

  // ── Drilldown ──────────────────────────────────────────────────────────────

  openDrilldown(type: number, period: number, status: string | null): void {
    this.drilldownType = type;
    this.drilldownPeriod = period;
    this.drilldownStatus = status;
    this.drilldownBookings = this.dayBookings.filter(b =>
      b.chaletType === type &&
      b.period === period &&
      (status === null || b.status === status)
    );
    this.viewMode = 'drilldown';
  }

  /** Navigate to new booking pre-filled */
  openNewBooking(): void {
    if (!this.selectedDay) return;
    const params: any = { date: this.selectedDay.date };
    if (this.drilldownType !== null)   params.chaletType = this.drilldownType;
    if (this.drilldownPeriod !== null) params.period     = this.drilldownPeriod;
    this.router.navigate(['/bookings/new'], { queryParams: params });
  }

  openNewBookingFromDay(type: number, period: number): void {
    if (!this.selectedDay) return;
    this.router.navigate(['/bookings/new'], {
      queryParams: { date: this.selectedDay.date, chaletType: type, period }
    });
  }

  openBookingDetail(id: number): void {
    this.router.navigate(['/bookings', id]);
  }

  getPeriodLabel(period: number): PeriodLabel {
    return PERIOD_LABELS[period] ?? PERIOD_LABELS[0];
  }

  getChaletTypeLabel(type: number): string {
    return CHALET_TYPE_LABELS[type] ?? 'غير معروف';
  }

  getStatusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  getStatusColor(status: string): string {
    return STATUS_COLORS[status] ?? 'pending';
  }

  get selectedDayLabel(): string {
    if (!this.selectedDay) return '';
    const d = new Date(this.selectedDay.date);
    const weekday = this.WEEKDAY_NAMES[d.getDay()];
    return `${weekday} ${this.selectedDay.day}`;
  }

  get drilldownLabel(): string {
    if (this.drilldownType === null || this.drilldownPeriod === null) return '';
    const pl = this.getPeriodLabel(this.drilldownPeriod);
    return `${this.getChaletTypeLabel(this.drilldownType)} - ${pl.icon} ${pl.label}`;
  }

  trackByDate(index: number, day: DayStatus): string { return day.date; }
  trackById(index: number, b: UpcomingBooking): number { return b.id; }
}
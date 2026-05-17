import {
  ChangeDetectorRef, Component, EventEmitter,
  Input, OnChanges, OnInit, Output, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BookingService, Bookings, UpcomingBooking,
  normalizeChaletType, normalizePeriod
} from '../../service/booking-service';
import { ChaletService, Chalet } from '../../service/chalet-service';
import { forkJoin } from 'rxjs';
import { WaitingListItem, WaitingListService } from '../../service/waitinglist-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewBookingRequest {
  chaletType: number;
  period: number;
  date: string;
}

export interface DayCell {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  slots: SlotSummary[];
  totalChalets: number;
  totalConfirmed: number;
  totalPending: number;
  totalAvailable: number;
  status: 'empty' | 'available' | 'partial' | 'pending' | 'full';
}

export interface SlotSummary {
  chaletType: number;
  period: number;
  totalChalets: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  available: number;
  bookings: UpcomingBooking[];
}

export interface DayDetail {
  dateStr: string;
  slots: SlotDetailItem[];
}

export interface SlotDetailItem extends SlotSummary {
  bookingsList: Bookings[];
  loadingBookings: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-booking-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-overview.html',
  styleUrl: './booking-overview.css',
})
export class BookingOverviewComponent implements OnInit, OnChanges {

  @Input() allBookings: Bookings[] = [];
  @Output() newBookingRequested    = new EventEmitter<NewBookingRequest>();
  @Output() bookingDetailRequested = new EventEmitter<number>();

  // ─── State ────────────────────────────────────────────────────────────────
  showModal = false;
  currentYear  = new Date().getFullYear();
  currentMonth = new Date().getMonth();

  weeks: DayCell[][] = [];
  upcomingBookings: UpcomingBooking[] = [];
  chalets: Chalet[] = [];
  chaletCountMap: Record<string, number> = {};

  // ✅ flag: هل الـ chaletCountMap اتحمل قبل كده؟
  private chaletCountLoaded = false;

  selectedDay: DayCell | null = null;
  dayDetail: DayDetail | null = null;
  loadingDetail = false;
  expandedSlotKey = '';
  waitingListItems: WaitingListItem[] = [];

  loading   = true;
  refreshing = false;

  readonly periodLabels: Record<number, string> = { 0: '🌅 صباحي', 1: '🌇 مسائي', 2: '🌞 يوم كامل' };
  readonly periodShort:  Record<number, string> = { 0: 'ص', 1: 'م', 2: 'ك' };
  readonly typeLabels:   Record<number, string> = { 0: '🏠 عادي', 1: '👑 رويال' };
  readonly monthNames = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];
  readonly dayNames = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  constructor(
    private bookingService: BookingService,
    private chaletService: ChaletService,
    private waitingListService: WaitingListService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allBookings'] && !changes['allBookings'].firstChange) {
      this.buildCalendar();
    }
  }

  open(): void {
    this.showModal = true;
    this.selectedDay = null;
    this.dayDetail = null;
    this.expandedSlotKey = '';
    this.loadData();
    this.cdr.markForCheck();
  }

  close(): void {
    this.showModal = false;
    this.selectedDay = null;
    this.dayDetail = null;
  }

  // ─── Data Loading ─────────────────────────────────────────────────────────

  /**
   * ✅ Full load — يُستدعى مرة واحدة عند ngOnInit فقط
   * يجيب: upcoming + chalets (للـ cache) + waiting
   */
  loadData(): void {
    this.loading = true;

    const prevDate    = this.selectedDay?.dateStr ?? null;
    const prevSlotKey = this.expandedSlotKey;

    // ✅ لو الـ chaletCountMap محملة بالفعل، مش محتاج نجيب الـ chalets تاني
    const chalets$ = this.chaletCountLoaded
      ? null
      : this.chaletService.getAll();

    const base$ = forkJoin({
      upcoming: this.bookingService.getUpcomingBookings(),
      waiting:  this.waitingListService.getAll(),
      ...(chalets$ ? { chalets: chalets$ } : {}),
    });

    base$.subscribe({
      next: (res: any) => {
        this.upcomingBookings = res.upcoming?.data ?? [];
        this.waitingListItems = res.waiting ?? [];

        if (res.chalets) {
          this.chalets = res.chalets;
        }

        this.loading = false;

        if (!this.chaletCountLoaded) {
          // أول مرة — جيب الـ counts وابن الـ calendar
          this.buildChaletCountMap();
        } else {
          // مش أول مرة — ابن الـ calendar مباشرةً بدون API calls
          this.buildCalendar();
        }

        this._restoreSelectedDay(prevDate, prevSlotKey);
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.buildCalendar();
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * ✅ Lightweight refresh — يُستدعى من الـ parent بعد cancel/edit/done
   * يجيب: upcoming + waiting فقط (بدون chalets — لأنها ثابتة)
   * 2 API calls بدل 9
   */
  refreshData(): void {
    const prevDate    = this.selectedDay?.dateStr ?? null;
    const prevSlotKey = this.expandedSlotKey;

    forkJoin({
      upcoming: this.bookingService.getUpcomingBookings(),
      waiting:  this.waitingListService.getAll(),
    }).subscribe({
      next: ({ upcoming, waiting }) => {
        this.upcomingBookings = upcoming?.data ?? [];
        this.waitingListItems = waiting ?? [];

        // ✅ بناء الـ calendar مباشرةً — الـ chaletCountMap موجود من قبل
        this.buildCalendar();

        this._restoreSelectedDay(prevDate, prevSlotKey);
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  /**
   * ✅ Helper: يعيد تحديد اليوم المختار بعد أي refresh
   */
  private _restoreSelectedDay(prevDate: string | null, prevSlotKey: string): void {
    if (!prevDate) return;

    setTimeout(() => {
      const flat  = this.weeks.flat();
      const found = flat.find(d => d.dateStr === prevDate);
      if (!found) return;

      this.selectedDay = found;
      this.buildDayDetail(found);

      if (prevSlotKey && this.dayDetail) {
        const slot = this.dayDetail.slots.find(
          s => `${s.chaletType}_${s.period}` === prevSlotKey
        );
        if (slot) {
          this.expandedSlotKey = prevSlotKey;
          slot.loadingBookings = true;
          this.cdr.markForCheck();

          this.bookingService.getBookingsByTypeDatePeriod(
            slot.chaletType, prevDate, slot.period
          ).subscribe({
            next: res => {
              slot.bookingsList = (res.data ?? []).filter((b: any) => b.status !== 'Cancelled');
              slot.loadingBookings = false;
              this.cdr.markForCheck();
            },
            error: () => {
              slot.bookingsList = [];
              slot.loadingBookings = false;
              this.cdr.markForCheck();
            }
          });
        }
      }

      this.cdr.markForCheck();
    }, 50);
  }

  /**
   * ✅ يُستدعى مرة واحدة فقط — يحمل الـ chalets counts ويعمل cache
   */
  buildChaletCountMap(): void {
    this.chaletCountMap = {};
    const combos = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]];

    // ✅ forkJoin بدل 6 subscribes منفصلة — request واحد لكل combo لكن كلهم مع بعض
    forkJoin(
      combos.map(([type, period]) =>
        this.bookingService.getChaletsByTypePeriod(type, period)
      )
    ).subscribe({
      next: results => {
        combos.forEach(([type, period], i) => {
          this.chaletCountMap[`${type}_${period}`] = results[i].length;
        });
        this.chaletCountLoaded = true; // ✅ cache flag
        this.buildCalendar();
        this.cdr.markForCheck();
      },
      error: () => {
        combos.forEach(([type, period]) => {
          this.chaletCountMap[`${type}_${period}`] = 0;
        });
        this.chaletCountLoaded = true;
        this.buildCalendar();
        this.cdr.markForCheck();
      }
    });
  }

  // ─── Calendar Building ────────────────────────────────────────────────────

  buildCalendar(): void {
    const year  = this.currentYear;
    const month = this.currentMonth;
    const today = new Date(); today.setHours(0,0,0,0);

    const allSource = this.mergeBookingSources();

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const cells: DayCell[] = [];

    for (let i = startPad - 1; i >= 0; i--) {
      cells.push(this.buildDayCell(new Date(year, month, -i), false, today, allSource));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(this.buildDayCell(new Date(year, month, d), true, today, allSource));
    }
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push(this.buildDayCell(new Date(year, month + 1, i), false, today, allSource));
    }

    this.weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      this.weeks.push(cells.slice(i, i + 7));
    }

    this.cdr.markForCheck();
  }

  private mergeBookingSources(): any[] {
    const map = new Map<number, any>();
    for (const b of this.allBookings)      map.set(b.id, b);
    for (const b of this.upcomingBookings) { if (!map.has(b.id)) map.set(b.id, b); }
    return Array.from(map.values());
  }

  private buildDayCell(
    date: Date,
    isCurrentMonth: boolean,
    today: Date,
    allSource: any[]
  ): DayCell {
    const dateStr = this.fmt(date);
    const isPast  = date < today;
    const isToday = date.getTime() === today.getTime();

    const dayBookings = allSource.filter(b =>
      b.status !== 'Cancelled' && this.parseDate(b.date) === dateStr
    );

    const slots: SlotSummary[] = [];
    const combos: [number,number][] = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]];

    for (const [type, period] of combos) {
      const total = this.chaletCountMap[`${type}_${period}`] ?? 0;
      if (total === 0) continue;

      const slotBookings = dayBookings.filter(b =>
        normalizeChaletType(b.chaletType) === type &&
        normalizePeriod(b.period) === period
      );

      const confirmed = slotBookings.filter(b => b.status === 'Confirmed' || b.status === 'Done').length;
      const pending   = slotBookings.filter(b => b.status === 'Pending' || b.status === 'WaitingList').length;
      const cancelled = slotBookings.filter(b => b.status === 'Cancelled').length;
      const available = Math.max(0, total - confirmed - pending);

      slots.push({ chaletType: type, period, totalChalets: total, confirmed, pending, cancelled, available, bookings: slotBookings });
    }

    const totalChalets   = slots.reduce((s, sl) => s + sl.totalChalets, 0);
    const totalConfirmed = slots.reduce((s, sl) => s + sl.confirmed, 0);
    const totalPending   = slots.reduce((s, sl) => s + sl.pending, 0);
    const totalAvailable = slots.reduce((s, sl) => s + sl.available, 0);

    let status: DayCell['status'] = 'empty';
    if (slots.length > 0) {
      if      (totalAvailable === totalChalets)                  status = 'available';
      else if (totalAvailable === 0 && totalPending > 0)         status = 'pending';
      else if (totalAvailable === 0)                             status = 'full';
      else                                                       status = 'partial';
    }

    return { date, dateStr, isCurrentMonth, isPast, isToday, slots, totalChalets, totalConfirmed, totalPending, totalAvailable, status };
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  prevMonth(): void {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else this.currentMonth--;
    this.buildCalendar();
    this.selectedDay = null;
    this.dayDetail = null;
  }

  nextMonth(): void {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else this.currentMonth++;
    this.buildCalendar();
    this.selectedDay = null;
    this.dayDetail = null;
  }

  goToToday(): void {
    this.currentYear  = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
    this.buildCalendar();
    this.selectedDay = null;
    this.dayDetail = null;
  }

  // ─── Day Selection ────────────────────────────────────────────────────────

  selectDay(day: DayCell): void {
    if (!day.isCurrentMonth) return;
    this.selectedDay = day;
    this.expandedSlotKey = '';
    this.buildDayDetail(day);
  }

  buildDayDetail(day: DayCell): void {
    this.dayDetail = {
      dateStr: day.dateStr,
      slots: day.slots.map(sl => ({ ...sl, bookingsList: [], loadingBookings: false }))
    };
    this.cdr.markForCheck();
  }

  toggleSlot(slot: SlotDetailItem): void {
    const key = `${slot.chaletType}_${slot.period}`;
    if (this.expandedSlotKey === key) { this.expandedSlotKey = ''; return; }
    this.expandedSlotKey = key;

    if (slot.bookingsList.length === 0 && (slot.confirmed + slot.pending) > 0) {
      slot.loadingBookings = true;
      this.cdr.markForCheck();

      this.bookingService.getBookingsByTypeDatePeriod(
        slot.chaletType, this.selectedDay!.dateStr, slot.period
      ).subscribe({
        next: res => {
          slot.bookingsList = (res.data ?? []).filter((b: any) => b.status !== 'Cancelled');
          slot.loadingBookings = false;
          this.cdr.markForCheck();
        },
        error: () => {
          slot.bookingsList = this.allBookings.filter(b =>
            normalizeChaletType(b.chaletType) === slot.chaletType &&
            normalizePeriod(b.period) === slot.period &&
            this.parseDate(b.date) === this.selectedDay!.dateStr &&
            b.status !== 'Cancelled'
          );
          slot.loadingBookings = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  isSlotExpanded(slot: SlotSummary): boolean {
    return this.expandedSlotKey === `${slot.chaletType}_${slot.period}`;
  }

  refreshDay(): void {
    if (!this.selectedDay || this.refreshing) return;
    this.refreshing = true;
    this.expandedSlotKey = '';
    const selectedDate = this.selectedDay.dateStr;

    // ✅ refreshDay أيضاً خفيف — بدون chalets
    forkJoin({
      upcoming: this.bookingService.getUpcomingBookings(),
      waiting:  this.waitingListService.getAll(),
    }).subscribe({
      next: ({ upcoming, waiting }) => {
        this.upcomingBookings = upcoming?.data ?? [];
        this.waitingListItems = waiting ?? [];
        this.buildCalendar();

        const found = this.weeks.flat().find(d => d.dateStr === selectedDate);
        if (found) { this.selectedDay = found; this.buildDayDetail(found); }

        this.refreshing = false;
        this.cdr.markForCheck();
      },
      error: () => { this.refreshing = false; this.cdr.markForCheck(); }
    });
  }

  // ─── New Booking ──────────────────────────────────────────────────────────

  requestNewBooking(chaletType: number, period: number): void {
    if (!this.selectedDay) return;
    this.newBookingRequested.emit({ chaletType, period, date: this.selectedDay.dateStr });
    setTimeout(() => this.close(), 50);
  }

  openBookingDetail(bookingId: number): void {
    this.bookingDetailRequested.emit(bookingId);
  }

  // ─── Day Navigation ───────────────────────────────────────────────────────

  get prevDayCell(): DayCell | null {
    if (!this.selectedDay) return null;
    const flat = this.weeks.flat();
    const idx  = flat.findIndex(d => d.dateStr === this.selectedDay!.dateStr);
    return idx > 0 ? flat[idx - 1] : null;
  }

  get nextDayCell(): DayCell | null {
    if (!this.selectedDay) return null;
    const flat = this.weeks.flat();
    const idx  = flat.findIndex(d => d.dateStr === this.selectedDay!.dateStr);
    return idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  }

  navigateDay(dir: 'prev' | 'next'): void {
    const target = dir === 'prev' ? this.prevDayCell : this.nextDayCell;
    if (!target) return;
    if (!target.isCurrentMonth) {
      if (dir === 'prev') this.prevMonth(); else this.nextMonth();
      setTimeout(() => {
        const found = this.weeks.flat().find(d => d.dateStr === target.dateStr);
        if (found) this.selectDay(found);
      }, 50);
      return;
    }
    this.selectDay(target);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  parseDate(s: string): string { return s ? s.split('T')[0] : ''; }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m-1, d);
    return `${this.dayNames[date.getDay()]} ${d} ${this.monthNames[m-1]} ${y}`;
  }

  getStatusLabel(s: string): string {
    const map: Record<string,string> = {
      Pending: 'قيد التأكيد', Confirmed: 'مؤكد',
      Cancelled: 'ملغي', WaitingList: 'قائمة الانتظار', Done: 'تم الاستلام'
    };
    return map[s] ?? s;
  }

  getStatusClass(s: string): string {
    const map: Record<string,string> = {
      Pending: 'badge-pending', Confirmed: 'badge-confirmed',
      Cancelled: 'badge-cancelled', WaitingList: 'badge-waiting', Done: 'badge-done'
    };
    return map[s] ?? '';
  }

  get headerLabel(): string { return `${this.currentMonth + 1} / ${this.currentYear}`; }

  trackByWeek(i: number, week: DayCell[]): number    { return i; }
  trackByDate(i: number, cell: DayCell):  string     { return cell.dateStr; }
  trackBySlot(i: number, sl: SlotSummary): string    { return `${sl.chaletType}_${sl.period}`; }

  getMonthStat(type: 'confirmed' | 'pending' | 'available'): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cells = this.weeks.flat().filter(c => {
      const cellDate = new Date(c.date); cellDate.setHours(0, 0, 0, 0);
      return c.isCurrentMonth && cellDate >= today;
    });
    if (type === 'confirmed') return cells.reduce((s, c) => s + c.totalConfirmed, 0);
    if (type === 'pending')   return cells.reduce((s, c) => s + c.totalPending, 0);
    return cells.reduce((s, c) => s + c.totalAvailable, 0);
  }

  getWaitingCount(chaletType: number, period: number): number {
    if (!this.selectedDay) return 0;
    const dateStr = this.selectedDay.dateStr;
    const periodStrMap: Record<number, string[]> = {
      0: ['morning', '0'], 1: ['evening', '1'], 2: ['full', '2'],
    };
    const periodStrs = periodStrMap[period] ?? [];
    return this.waitingListItems.filter(w => {
      const wDate   = w.date?.split('T')[0] ?? '';
      const wPeriod = (w.period ?? '').toString().toLowerCase();
      return wDate === dateStr && periodStrs.includes(wPeriod) &&
             (w.status === 'Pending' || w.status === 'Contacted');
    }).length;
  }
}
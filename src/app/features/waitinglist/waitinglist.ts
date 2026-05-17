import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  WaitingListItem,
  WaitingStatus,
  WaitingListService,
  WaitingStatusArabic,
  WaitingStatusEnum,
} from '../../service/waitinglist-service';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { normalizeChaletType } from '../../service/booking-service';

@Component({
  selector: 'app-waitinglist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waitinglist.html',
  styleUrl: './waitinglist.css',
})
export class Waitinglist implements OnInit {

  // ─── expose to template ───────────────────────────────────────────────────
  readonly WaitingStatusArabic = WaitingStatusArabic;

  // ─── data (صفحة حالية من الـ API) ────────────────────────────────────────
  items: WaitingListItem[] = [];          // كل البيانات — للـ stats
  pagedItems: WaitingListItem[] = [];     // الصفحة الحالية من السيرفر

  // ─── API pagination ───────────────────────────────────────────────────────
  currentPage = 1;
  pageSize    = 10;
  totalPages  = 1;
  totalCount  = 0;
dateFrom = '';
dateTo   = '';
  // ─── search (API-side) ────────────────────────────────────────────────────
  searchQuery = '';
  private searchTimer: any;

  // ─── status filter (client-side على الصفحة الحالية) ─────────────────────
  selectedStatusFilter: WaitingStatus | '' = '';

  filterOptions: { label: string; value: WaitingStatus | '' }[] = [
    { label: 'كل الحالات',   value: '' },
    { label: ' قائمة الانتظار', value: 'Pending' },
    { label: 'تم التواصل',   value: 'Contacted' },
    { label: 'محجوز',        value: 'Booked' },
    { label: 'ملغي',         value: 'Cancelled' },
  ];

  // ─── UI state ─────────────────────────────────────────────────────────────
  isLoadingData = true;
  errorMsg      = '';

  // ─── modals ───────────────────────────────────────────────────────────────
  showDetailsModal  = false;
  selectedItem: WaitingListItem | null = null;
  newStatusIndex    = 0;

  showConvertModal  = false;
  convertItem: WaitingListItem | null = null;

  // ─── toast ────────────────────────────────────────────────────────────────
  toast: { show: boolean; success: boolean; message: string } =
    { show: false, success: true, message: '' };
  private toastTimer: any;

  // ─── status options ───────────────────────────────────────────────────────
  readonly statusOptions: { label: string; value: number }[] = [
    { label: ' قائمة الانتظار', value: 0 },
    { label: 'تم التواصل',   value: 1 },
    { label: 'محجوز',        value: 2 },
    { label: 'ملغي',         value: 3 },
  ];

  constructor(
    private svc: WaitingListService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadStats();   // كل البيانات مرة واحدة للـ stats
    this.loadWaiting(); // الصفحة الأولى
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Data Loading
  // ══════════════════════════════════════════════════════════════════════════

  /** يجيب كل البيانات مرة واحدة للـ stats فقط */
  loadStats(): void {
    this.svc.getAll().subscribe({
      next: data => { this.items = data; this.cdr.detectChanges(); },
      error: () => {},
    });
  }

  /** يجيب الصفحة الحالية من الـ API */


  // alias للـ HTML القديم (زر التحديث بيستدعي loadData)
  loadData(): void {
    this.loadStats();
    this.loadWaiting();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Search & Filter
  // ══════════════════════════════════════════════════════════════════════════

onSearchChange(): void {
  clearTimeout(this.searchTimer);
  this.searchTimer = setTimeout(() => {
    this.currentPage = 1;
    this.loadWaiting();
  }, 400);
}

onDateChange(): void {       // ← جديد
  this.currentPage = 1;
  this.loadWaiting();
}

clearDateFilter(): void {    // ← جديد
  this.dateFrom = '';
  this.dateTo   = '';
  this.currentPage = 1;
  this.loadWaiting();
}

loadWaiting(): void {
  this.isLoadingData = true;
  this.errorMsg      = '';
  this.cdr.detectChanges();

  this.svc.getPaged({
    page:     this.currentPage,
    pageSize: this.pageSize,
    search:   this.searchQuery.trim() || undefined,
    dateFrom: this.dateFrom || undefined,   // ← جديد
    dateTo:   this.dateTo   || undefined,   // ← جديد
  })
  .pipe(finalize(() => { this.isLoadingData = false; this.cdr.detectChanges(); }))
  .subscribe({
    next: res => {
      this.pagedItems = res.data;
      this.totalCount = res.total;
      this.totalPages = res.totalPages;
    },
    error: () => {
      this.errorMsg = 'تعذّر تحميل البيانات. تحقق من الاتصال بالخادم.';
    },
  });
}

  onFilterChange(): void {
    // فلتر الحالة محلي فقط — مش محتاج reload
    this.cdr.detectChanges();
  }

  /** الـ items اللي بتتعرض في الجدول — فلتر الحالة محلي */
  get filteredItems(): WaitingListItem[] {
    if (!this.selectedStatusFilter) return this.pagedItems;
    return this.pagedItems.filter(i => i.status === this.selectedStatusFilter);
  }

  // للتوافق مع الـ HTML القديم اللي بيستخدم paginatedItems
  get paginatedItems(): WaitingListItem[] {
    return this.filteredItems;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Pagination
  // ══════════════════════════════════════════════════════════════════════════

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadWaiting();
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (cur > 3) pages.push(-1);
      for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
      if (cur < total - 2) pages.push(-1);
      pages.push(total);
    }
    return pages;
  }

  get startIndex(): number {
    return this.totalCount === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }
  get endIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalCount);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Stats — من items (كل البيانات)
  // ══════════════════════════════════════════════════════════════════════════

  get pendingCount():   number { return this.items.filter(i => i.status === 'Pending').length;   }
  get contactedCount(): number { return this.items.filter(i => i.status === 'Contacted').length; }
  get bookedCount():    number { return this.items.filter(i => i.status === 'Booked').length;    }
  get cancelledCount(): number { return this.items.filter(i => i.status === 'Cancelled').length; }

  // ══════════════════════════════════════════════════════════════════════════
  // Details / Status Modal
  // ══════════════════════════════════════════════════════════════════════════

  openDetails(item: WaitingListItem): void {
    this.selectedItem   = { ...item };
    this.newStatusIndex = this.statusToIndex(item.status);
    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedItem     = null;
  }

  saveStatus(): void {
    if (!this.selectedItem) return;

    const itemId      = this.selectedItem.id;
    const statusIndex = this.newStatusIndex;
    const newStatus   = WaitingStatusEnum[statusIndex];

    this.closeDetailsModal();
    this.cdr.detectChanges();

    this.svc.updateStatus(itemId, statusIndex)
      .pipe(finalize(() => this.cdr.detectChanges()))
      .subscribe({
        next: res => {
          // تحديث محلي فوري في الصفحة الحالية
          const pi = this.pagedItems.findIndex(i => i.id === itemId);
          if (pi >= 0) this.pagedItems[pi] = { ...this.pagedItems[pi], status: newStatus };

          // تحديث في الـ stats
          const si = this.items.findIndex(i => i.id === itemId);
          if (si >= 0) this.items[si] = { ...this.items[si], status: newStatus };

          const text = (typeof res === 'string' ? res : null)
            ?? (res as any)?.message
            ?? 'تم التحديث بنجاح';
          this.showToast(true, text);
        },
        error: err => {
          this.showToast(false,
            err?.error?.message || err?.error?.title || err?.message || 'حدث خطأ أثناء تحديث الحالة'
          );
        },
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Convert Modal
  // ══════════════════════════════════════════════════════════════════════════

  openConvert(item: WaitingListItem, event: Event): void {
    event.stopPropagation();
    this.convertItem     = item;
    this.showConvertModal = true;
  }

  closeConvertModal(): void {
    this.showConvertModal = false;
    this.convertItem      = null;
  }

  confirmConvert(): void {
    if (!this.convertItem) return;

    const itemId = this.convertItem.id;

    this.closeConvertModal();
    this.cdr.detectChanges();

    this.svc.convertToBooking(itemId)
      .pipe(finalize(() => this.cdr.detectChanges()))
      .subscribe({
        next: res => {
          const msg     = res?.message;
          const success = msg?.success ?? false;
          const text    = msg?.message ?? (success ? 'تم التحويل بنجاح' : 'تعذّر التحويل');

          this.showToast(success, text);

          if (success) {
            // حذف من القوائم المحلية
            this.pagedItems = this.pagedItems.filter(i => i.id !== itemId);
            this.items      = this.items.filter(i => i.id !== itemId);
            this.totalCount = Math.max(0, this.totalCount - 1);
            // لو الصفحة فضت انتقل للسابقة
            if (this.pagedItems.length === 0 && this.currentPage > 1) {
              this.currentPage--;
              this.loadWaiting();
            }
          }
        },
        error: err => {
          const body = err?.error;
          this.showToast(false,
            body?.message?.message || err?.error?.title || err?.message || 'حدث خطأ أثناء التحويل'
          );
        },
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════════

  openWhatsApp(phone: string | null | undefined): void {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-EG', { year: 'numeric', month: '2-digit', day: 'numeric' });
  }

  formatDateTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Asia/Amman',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(d);
  }

  timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '—';
    const diffMs  = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr  = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMs  < 0)   return 'الآن';
    if (diffMin < 1)   return 'الآن';
    if (diffMin < 60)  return `منذ ${diffMin} دقيقة`;
    if (diffHr  < 24)  return `منذ ${diffHr} ساعة`;
    if (diffDay < 7)   return `منذ ${diffDay} أيام`;
    if (diffDay < 30)  return `منذ ${Math.floor(diffDay / 7)} أسابيع`;
    return `منذ ${Math.floor(diffDay / 30)} شهر`;
  }

  getTimeAgoClass(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '';
    const diffHr = (Date.now() - d.getTime()) / 3_600_000;
    if (diffHr < 1)  return 'time-fresh';
    if (diffHr < 3)  return 'time-medium';
    if (diffHr < 24) return 'time-old';
    return 'time-urgent';
  }

  periodArabic(period: string): string {
    const map: Record<string, string> = {
      '0': 'صباحي', 'morning': 'صباحي',
      '1': 'مسائي', 'evening': 'مسائي',
      '2': 'يوم كامل', 'full': 'يوم كامل',
      'Morning': 'صباحي', 'Evening': 'مسائي', 'Full': 'يوم كامل',
    };
    return map[period] ?? period;
  }

  statusClass(status: WaitingStatus): string {
    const map: Record<WaitingStatus, string> = {
      Pending:   'badge-pending',
      Contacted: 'badge-contacted',
      Booked:    'badge-booked',
      Cancelled: 'badge-cancelled',
    };
    return map[status] ?? '';
  }

  private statusToIndex(status: WaitingStatus): number {
    const map: Record<WaitingStatus, number> = {
      Pending: 0, Contacted: 1, Booked: 2, Cancelled: 3,
    };
    return map[status] ?? 0;
  }

  private showToast(success: boolean, message: string): void {
    clearTimeout(this.toastTimer);
    this.toast = { show: true, success, message };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => {
      this.toast.show = false;
      this.cdr.detectChanges();
    }, 4500);
  }
    getChaletTypeLabel(raw: any): string { return normalizeChaletType(raw) === 1 ? '👑 رويال' : '🏠 عادي'; }
    isRoyal(raw: any): boolean { return normalizeChaletType(raw) === 1; }
  
}
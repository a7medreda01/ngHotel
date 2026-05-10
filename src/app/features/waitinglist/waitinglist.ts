import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WaitingListItem, WaitingStatus, WaitingListService, WaitingStatusArabic } from '../../service/waitinglist-service';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-waitinglist',
  imports: [CommonModule, FormsModule],
  templateUrl: './waitinglist.html',
  styleUrl: './waitinglist.css',
})
export class Waitinglist implements OnInit {
  items: WaitingListItem[] = [];
  filteredItems: WaitingListItem[] = [];
  paginatedItems: WaitingListItem[] = [];
 
  isLoadingData = true;
  errorMsg = '';
 
  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalPages = 1;
 
  // Search & Filter
  searchQuery = '';
  selectedStatusFilter: WaitingStatus | '' = '';
 
  // Modal: Details / Status update
  showDetailsModal = false;
  selectedItem: WaitingListItem | null = null;
  newStatusIndex: number = 0;
 
  statusOptions: { label: string; value: number }[] = [
    { label: 'قيد الانتظار', value: 0 },
    { label: 'تم التواصل',   value: 1 },
    { label: 'محجوز',        value: 2 },
    { label: 'ملغي',         value: 3 },
  ];
 
  // Modal: Convert to Booking
  showConvertModal = false;
  convertItem: WaitingListItem | null = null;
 
  // Toast
  toast: { show: boolean; success: boolean; message: string } = {
    show: false, success: true, message: '',
  };
  toastTimer: any;
 
  readonly WaitingStatusArabic = WaitingStatusArabic;
 
  filterOptions: { label: string; value: WaitingStatus | '' }[] = [
    { label: 'كل الحالات',   value: '' },
    { label: 'قيد الانتظار', value: 'Pending' },
    { label: 'تم التواصل',   value: 'Contacted' },
    { label: 'محجوز',        value: 'Booked' },
    { label: 'ملغي',         value: 'Cancelled' },
  ];
 
  constructor(
    private svc: WaitingListService,
    private cdr: ChangeDetectorRef
  ) {}
 
  ngOnInit(): void {
    this.loadData();
  }
 
  // ══════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════
  loadData(): void {
    this.isLoadingData = true;
    this.errorMsg = '';
    this.svc.getAll()
      .pipe(finalize(() => {
        this.isLoadingData = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.items = data;
          this.applyFilters();
        },
        error: () => {
          this.errorMsg = 'تعذّر تحميل البيانات. تحقق من الاتصال بالخادم.';
        },
      });
  }
 
  // ══════════════════════════════════════
  // FILTER & PAGINATION
  // ══════════════════════════════════════
  applyFilters(): void {
    let result = [...this.items];
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.customerName.toLowerCase().includes(q) ||
          i.phone.includes(q) ||
          i.chaletName.toLowerCase().includes(q)
      );
    }
    if (this.selectedStatusFilter) {
      result = result.filter((i) => i.status === this.selectedStatusFilter);
    }
    result = result.sort((a, b) =>
  +new Date(b.date) - +new Date(a.date)
);
    this.filteredItems = result;
    this.totalPages = Math.max(1, Math.ceil(result.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = 1;
    this.paginate();
  }
 
  paginate(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedItems = this.filteredItems.slice(start, start + this.pageSize);
  }
 
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.paginate();
  }
 
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }
 
  onSearchChange(): void { this.currentPage = 1; this.applyFilters(); }
  onFilterChange(): void  { this.currentPage = 1; this.applyFilters(); }
 
  // ══════════════════════════════════════
  // DETAILS / STATUS MODAL
  // ══════════════════════════════════════
  openDetails(item: WaitingListItem): void {
    this.selectedItem = { ...item };
    const statusKeys: WaitingStatus[] = ['Pending', 'Contacted', 'Booked', 'Cancelled'];
    const idx = statusKeys.indexOf(item.status);
    this.newStatusIndex = idx >= 0 ? idx : 0;
    this.showDetailsModal = true;
  }
 
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedItem = null;
  }
 
  saveStatus(): void {
    if (!this.selectedItem) return;
 
    const itemId      = this.selectedItem.id;
    const statusIndex = this.newStatusIndex;
    const statusKeys: WaitingStatus[] = ['Pending', 'Contacted', 'Booked', 'Cancelled'];
 
    // ✅ أغلق المودال فوراً — بدون انتظار الـ API
    this.closeDetailsModal();
    this.cdr.detectChanges();
 
    this.svc.updateStatus(itemId, statusIndex)
      .pipe(finalize(() => this.cdr.detectChanges()))
      .subscribe({
        next: (res) => {
          // تحديث الحالة في البيانات المحلية
          const idx = this.items.findIndex((i) => i.id === itemId);
          if (idx > -1) {
            this.items[idx] = { ...this.items[idx], status: statusKeys[statusIndex] };
          }
          this.applyFilters();
          // عرض رسالة الـ API مباشرةً
          const text =
            (typeof res === 'string' ? res : null) ??
            (res as any)?.message ??
            'تم التحديث بنجاح';
          this.showToast(true, text);
        },
        error: (err) => {
          const errMsg =
            err?.error?.message ||
            err?.error?.title  ||
            err?.message       ||
            'حدث خطأ أثناء تحديث الحالة';
          this.showToast(false, errMsg);
        },
      });
  }
 
  // ══════════════════════════════════════
  // CONVERT TO BOOKING MODAL
  // ══════════════════════════════════════
  openConvert(item: WaitingListItem, event: Event): void {
    event.stopPropagation();
    this.convertItem = item;
    this.showConvertModal = true;
  }
 
  closeConvertModal(): void {
    this.showConvertModal = false;
    this.convertItem = null;
  }
 
  confirmConvert(): void {
    if (!this.convertItem) return;
 
    const itemId = this.convertItem.id;
 
    // ✅ أغلق المودال فوراً — بدون انتظار الـ API
    this.closeConvertModal();
    this.cdr.detectChanges();
 
    this.svc.convertToBooking(itemId)
      .pipe(finalize(() => this.cdr.detectChanges()))
      .subscribe({
        next: (res) => {
          const msg     = res?.message;
          const success = msg?.success ?? false;
          const text    = msg?.message ?? (success ? 'تم التحويل بنجاح' : 'تعذّر التحويل');
 
          this.showToast(success, text);
 
          if (success) {
            const idx = this.items.findIndex((i) => i.id === itemId);
            if (idx > -1) {
              this.items[idx] = { ...this.items[idx], status: 'Booked' };
            }
            this.applyFilters();
          }
        },
        error: (err) => {
          // بعض الـ APIs بترجع body حتى مع HTTP error
          const body = err?.error;
          if (body?.message?.message) {
            this.showToast(false, body.message.message);
          } else {
            const errMsg =
              err?.error?.title ||
              err?.message      ||
              'حدث خطأ أثناء التحويل';
            this.showToast(false, errMsg);
          }
        },
      });
  }
 
  // ══════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════
  showToast(success: boolean, message: string): void {
    clearTimeout(this.toastTimer);
    this.toast = { show: true, success, message };
    this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => {
      this.toast.show = false;
      this.cdr.detectChanges();
    }, 4500);
  }
 
  // ══════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════
  statusClass(status: WaitingStatus): string {
    const map: Record<WaitingStatus, string> = {
      Pending:   'badge-pending',
      Contacted: 'badge-contacted',
      Booked:    'badge-booked',
      Cancelled: 'badge-cancelled',
    };
    return map[status] ?? '';
  }
 
  periodArabic(period: string): string {
    return period === 'Morning' ? 'صباحي' : 'مسائي';
  }
 
  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }
 // ══════════════════════════════════════════════════════════
// أضف الـ functions دي في waitinglist.component.ts
// ══════════════════════════════════════════════════════════

timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';

  // ✅ normalize لـ UTC
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '—';

  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMs  < 0)    return 'الآن';
  if (diffMin < 1)    return 'الآن';
  if (diffMin === 1)  return 'منذ دقيقة';
  if (diffMin < 60)   return `منذ ${diffMin} دقيقة`;
  if (diffHr  === 1)  return 'منذ ساعة';
  if (diffHr  < 24)   return `منذ ${diffHr} ساعة`;
  if (diffDay === 1)  return 'منذ يوم';
  if (diffDay < 7)    return `منذ ${diffDay} أيام`;
  if (diffDay < 30)   return `منذ ${Math.floor(diffDay / 7)} أسابيع`;
  if (diffDay < 365)  return `منذ ${Math.floor(diffDay / 30)} شهر`;
  return `منذ ${Math.floor(diffDay / 365)} سنة`;
}

getTimeAgoClass(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  // ✅ normalize لـ UTC
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';

  const diffHr = (Date.now() - date.getTime()) / 3_600_000;

  if (diffHr < 1)  return 'time-fresh';
  if (diffHr < 3)  return 'time-medium';
  if (diffHr < 24) return 'time-old';
  return 'time-urgent';
}

formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  // ✅ normalize لـ UTC
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Asia/Amman',  // ✅ توقيت الأردن
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}


openWhatsApp(phone: string | null | undefined): void {
  if (!phone) return;
  // شيل كل حاجة غير أرقام
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}`, '_blank');
}
  get pendingCount():   number { return this.items.filter((i) => i.status === 'Pending').length;   }
  get contactedCount(): number { return this.items.filter((i) => i.status === 'Contacted').length; }
  get bookedCount():    number { return this.items.filter((i) => i.status === 'Booked').length;    }
  get cancelledCount(): number { return this.items.filter((i) => i.status === 'Cancelled').length; }
}
 
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookingService, Bookings } from '../../service/booking-service';
interface CustomerEntry {
  name: string;
  phone: string;
  bookingsCount: number;
  lastDate: string;
}
@Component({
  selector: 'app-customers-component',
  imports: [CommonModule, FormsModule],

  templateUrl: './customers-component.html',
  styleUrl: './customers-component.css',
})
export class CustomersComponent  implements OnInit {
  customers: CustomerEntry[] = [];
  filtered:  CustomerEntry[] = [];
  loading    = false;
  searchQuery = '';
  toast = '';
  toastType: 'success' | 'error' = 'success';
  showToast  = false;
  exporting  = false;
 
  constructor(
    private bookingService: BookingService,
    private cdr: ChangeDetectorRef
  ) {}
 
  ngOnInit(): void {
    this.load();
  }
 
  load(): void {
    this.loading = true;
    this.bookingService.getAllBookings().subscribe({
      next: (bookings) => {
        this.customers = this.extractCustomers(bookings);
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notify('فشل تحميل بيانات العملاء', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
 
  /**
   * استخراج عملاء فريدين من الحجوزات — بناءً على رقم الهاتف
   * نجمع عدد الحجوزات وآخر تاريخ لكل عميل
   */
  extractCustomers(bookings: Bookings[]): CustomerEntry[] {
    const map = new Map<string, CustomerEntry>();
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue; // نتجاهل الملغيات
      const key = b.phone.trim();
      if (map.has(key)) {
        const entry = map.get(key)!;
        entry.bookingsCount++;
        if (b.date > entry.lastDate) entry.lastDate = b.date;
      } else {
        map.set(key, {
          name:          b.customerName,
          phone:         b.phone,
          bookingsCount: 1,
          lastDate:      b.date,
        });
      }
    }
    // ترتيب تنازلي بعدد الحجوزات
    return Array.from(map.values()).sort((a, b) => b.bookingsCount - a.bookingsCount);
  }
 
  applyFilter(): void {
    if (!this.searchQuery.trim()) {
      this.filtered = [...this.customers];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.customers.filter(
      c => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }
 
  /** تصدير CSV بـ الاسم + رقم الموبايل فقط */
  exportCSV(): void {
    this.exporting = true;
    const rows = [
      ['الاسم', 'رقم الهاتف'],
      ...this.filtered.map(c => [c.name, c.phone])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    // BOM للعربية في Excel
    const bom  = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.exporting = false;
    this.notify(`تم تصدير ${this.filtered.length} عميل بنجاح ✓`, 'success');
    this.cdr.detectChanges();
  }
 
  openWhatsApp(phone: string): void {
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
  }
 
  formatDate(d: string): string {
    if (!d) return '-';
    const part = d.split('T')[0];
    const [y, m, day] = part.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }
 
  notify(msg: string, type: 'success' | 'error'): void {
    this.toast     = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3500);
  }
}
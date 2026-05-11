import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../service/booking-service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

interface CustomerEntry {
  name:          string;
  phone:         string;
  bookingsCount: number;
  lastDate:      string;
}

@Component({
  selector: 'app-customers-component',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './customers-component.html',
  styleUrl: './customers-component.css',
})
export class CustomersComponent implements OnInit {
  customers: CustomerEntry[] = [];
  filtered:  CustomerEntry[] = [];
  loading     = false;
  searchQuery = '';
  toast       = '';
  toastType: 'success' | 'error' = 'success';
  showToast   = false;
  exporting   = false;

  constructor(
    private bookingService: BookingService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.bookingService.getCustomers().subscribe({
      next: (data) => {
        // map من CustomerDto لـ CustomerEntry
        this.customers = data.map(d => ({
          name:          d.customerName,
          phone:         d.phone,
          bookingsCount: d.bookingsCount,
          lastDate:      d.lastBookingDate,
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notify(this.translate.instant('features.customers.loadFail'), 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
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

  exportCSV(): void {
    this.exporting = true;
    const rows = [
      [
        this.translate.instant('features.customers.csvName'),
        this.translate.instant('features.customers.csvPhone'),
      ],
      ...this.filtered.map(c => [c.name, c.phone])
    ];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.exporting = false;
    this.notify(this.translate.instant('features.customers.exportOk', { n: this.filtered.length }), 'success');
    this.cdr.detectChanges();
  }

  openWhatsApp(phone: string): void {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
  }

  formatDate(d: string): string {
    if (!d) return '-';
    const [y, m, day] = d.split('T')[0].split('-').map(Number);
    const lang = this.translate.currentLang || 'ar';
    const loc = lang === 'ar' ? 'ar-EG' : lang === 'fr' ? 'fr-FR' : 'en-GB';
    return new Date(y, m - 1, day).toLocaleDateString(loc, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  notify(msg: string, type: 'success' | 'error'): void {
    this.toast = msg; this.toastType = type; this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3500);
  }
}
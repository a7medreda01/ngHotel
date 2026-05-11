/**
 * One-off: replace hardcoded Arabic in booking.html with ngx-translate keys.
 * Run: node scripts/patch-booking-html-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '../src/app/features/booking/booking.html');
let h = fs.readFileSync(file, 'utf8');

h = h.replace('<div class="bookings-page" dir="rtl">', '<div class="bookings-page">');

/** @type {Array<[string|string, string]>} From → To. Use RegExp with g for patterns. */
const rules = [
  ['<h1>إدارة الحجوزات</h1>', '<h1>{{ \'booking.pageTitle\' | translate }}</h1>'],
  ['<p class="header-sub">نظام متكامل لإدارة حجوزات الأكواخ</p>', '<p class="header-sub">{{ \'booking.pageSubtitle\' | translate }}</p>'],
  ['<i class="bi bi-plus-lg"></i> حجز جديد\n      </button>', '<i class="bi bi-plus-lg"></i> {{ \'nav.newBooking\' | translate }}\n      </button>'],
  ['<span class="today-label"><i class="bi bi-calendar-day-fill"></i> إحصاءيات اليوم</span>', '<span class="today-label"><i class="bi bi-calendar-day-fill"></i> {{ \'misc.todayStats\' | translate }}</span>'],
  ['{{ showComparison ? \'إخفاء المقارنة\' : \'مقارنة بالأمس\' }}', '{{ showComparison ? (\'misc.hideComparison\' | translate) : (\'misc.compareYesterday\' | translate) }}'],
  ['<span class="stat-label">حجوزات اليوم</span>', '<span class="stat-label">{{ \'misc.bookingsToday\' | translate }}</span>'],
  ['}} عن الأمس\n            ({{ yesterdayTotal }})', '}} {{ \'misc.versusYesterday\' | translate }}\n            ({{ yesterdayTotal }})'],
  ['عن الأمس ({{ yesterdayPending }})', '{{ \'misc.versusYesterday\' | translate }} ({{ yesterdayPending }})'],
  ['}} عن الأمس ({{ yesterdayConfirmed }})', '}} {{ \'misc.versusYesterday\' | translate }} ({{ yesterdayConfirmed }})'],
  ['}} عن الأمس ({{ yesterdayRevenue }})', '}} {{ \'misc.versusYesterday\' | translate }} ({{ yesterdayRevenue }})'],
  ['<span class="stat-label">قيد الانتظار اليوم</span>', '<span class="stat-label">{{ \'misc.pendingToday\' | translate }}</span>'],
  ['<span class="stat-label">مؤكدة اليوم</span>', '<span class="stat-label">{{ \'misc.confirmedToday\' | translate }}</span>'],
  ['<span class="stat-label">إيرادات اليوم (د.أ)</span>', '<span class="stat-label">{{ \'misc.revenueToday\' | translate }}</span>'],
  ['placeholder="بحث بالاسم، الهاتف، أو الكوخ..."', '[placeholder]="\'misc.searchBookingsPlaceholder\' | translate"'],
  ['<option value="">كل الحالات</option>', '<option value="">{{ \'misc.allStatuses\' | translate }}</option>'],
  ['<option value="Pending">قيد الانتظار</option>', '<option value="Pending">{{ \'status.Pending\' | translate }}</option>'],
  ['<option value="Confirmed">مؤكد</option>', '<option value="Confirmed">{{ \'status.Confirmed\' | translate }}</option>'],
  ['<option value="WaitingList">قائمة الانتظار</option>', '<option value="WaitingList">{{ \'status.WaitingList\' | translate }}</option>'],
  ['<option value="Cancelled">ملغي</option>', '<option value="Cancelled">{{ \'status.Cancelled\' | translate }}</option>'],
  ['<option value="Done">تم الاستلام</option>', '<option value="Done">{{ \'status.Done\' | translate }}</option>'],
  ['<option value="">كل الفترات</option>', '<option value="">{{ \'misc.allRanges\' | translate }}</option>'],
  ['<option value="today">اليوم</option>', '<option value="today">{{ \'misc.today\' | translate }}</option>'],
  ['<option value="yesterday">أمس</option>', '<option value="yesterday">{{ \'misc.yesterday\' | translate }}</option>'],
  ['<option value="week">آخر أسبوع</option>', '<option value="week">{{ \'misc.lastWeek\' | translate }}</option>'],
  ['<option value="month">آخر شهر</option>', '<option value="month">{{ \'misc.lastMonth\' | translate }}</option>'],
  ['<option value="last_month">الشهر الماضي</option>', '<option value="last_month">{{ \'misc.prevMonth\' | translate }}</option>'],
  ['<option value="custom">فترة مخصصة</option>', '<option value="custom">{{ \'misc.customRange\' | translate }}</option>'],
  ['placeholder="من"', '[placeholder]="\'misc.from\' | translate"'],
  ['placeholder="إلى"', '[placeholder]="\'misc.to\' | translate"'],
  ['<option *ngFor="let s of pageSizeOptions" [value]="s">{{ s }} لكل صفحة</option>', '<option *ngFor="let s of pageSizeOptions" [value]="s">{{ \'misc.perPage\' | translate: { n: s } }}</option>'],
  ['<h3><i class="bi bi-list-ul"></i> قائمة الحجوزات</h3>', '<h3><i class="bi bi-list-ul"></i> {{ \'misc.bookingList\' | translate }}</h3>'],
  ['<span class="results-count">{{ total }} حجز</span>', '<span class="results-count">{{ total }} {{ \'misc.bookingsWord\' | translate }}</span>'],
  ['<th>اسم العميل</th>', '<th>{{ \'misc.customerName\' | translate }}</th>'],
  ['<th>النوع / الكوخ</th>', '<th>{{ \'misc.typeChaletCol\' | translate }}</th>'],
  ['<th>وقت الحجز</th>', '<th>{{ \'misc.bookingCreatedAt\' | translate }}</th>'],
  ['<th>يوم الحجز</th>', '<th>{{ \'misc.bookingDay\' | translate }}</th>'],
  ['<th>الفترة</th>', '<th>{{ \'misc.period\' | translate }}</th>'],
  ['<th>الحالة</th>', '<th>{{ \'misc.status\' | translate }}</th>'],
  ['<th>سعر</th>', '<th>{{ \'misc.price\' | translate }}</th>'],
  ['<th>الإضافات</th>', '<th>{{ \'misc.extras\' | translate }}</th>'],
  ['<th>خصم</th>', '<th>{{ \'misc.discount\' | translate }}</th>'],
  ['<th>الإجمالي</th>', '<th>{{ \'misc.total\' | translate }}</th>'],
  ['<th>مدفوع</th>', '<th>{{ \'misc.paid\' | translate }}</th>'],
  ['<th>الباقي</th>', '<th>{{ \'misc.remainingCol\' | translate }}</th>'],
  ['<th>إجراءات</th>', '<th>{{ \'misc.actions\' | translate }}</th>'],
  ['{{ b.chaletType === 1 ? \'👑 رويال\' : \'🏠 عادي\' }}', '{{ (b.chaletType === 1 ? \'misc.royal\' : \'misc.normal\') | translate }}'],
  ['<span class="no-val" *ngIf="!b.chaletName">غير محدد</span>', '<span class="no-val" *ngIf="!b.chaletName">{{ \'misc.notSpecified\' | translate }}</span>'],
  ['<small>د.أ</small>', '<small>{{ \'misc.currency\' | translate }}</small>'],
  ['<i class="bi bi-check-all"></i> مدفوع\n                  </span>', '<i class="bi bi-check-all"></i> {{ \'misc.paid\' | translate }}\n                  </span>'],
  ['title="سجل الدفعات"', '[attr.title]="\'misc.paymentLog\' | translate"'],
  ['title="تعديل"', '[attr.title]="\'misc.edit\' | translate"'],
  ['title="ديبوزت"', '[attr.title]="\'misc.deposit\' | translate"'],
  ['title="تم الاستلام"', '[attr.title]="\'misc.received\' | translate"'],
  ['title="ملاحظات"', '[attr.title]="\'misc.notes\' | translate"'],
  ['title="إلغاء"', '[attr.title]="\'misc.cancel\' | translate"'],
  ['<p>لا توجد حجوزات مطابقة</p>', '<p>{{ \'misc.noMatchingBookings\' | translate }}</p>'],
  ['<div class="pag-info">عرض {{ startIndex }}–{{ endIndex }} من {{ total }}</div>', '<div class="pag-info">{{ \'misc.showRange\' | translate: { start: startIndex, end: endIndex, total: total } }}</div>'],
];

for (const [from, to] of rules) {
  if (from instanceof RegExp) {
    h = h.replace(from, to);
  } else if (!h.includes(from)) {
    console.warn('Missing fragment (skipped):', from.slice(0, 60) + '…');
  } else {
    h = h.split(from).join(to);
  }
}

fs.writeFileSync(file, h, 'utf8');
console.log('Patched', file, 'length', h.length);

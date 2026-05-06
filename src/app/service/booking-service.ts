import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface BookingExtra {
  extraId:   number;
  extraName: string;
  quantity:  number;
  price:     number;
  total:     number;
}

export interface Bookings {
  id:              number;
  customerName:    string;
  phone:           string;
  additionalPhone: string | null;   // ✅ جديد
  discountAmount:  number;          // ✅ جديد
  date:            string;
  createdAt:       string;
  period:          number;
  chaletType:      number;
  chaletId:        number | null;
  chaletName:      string | null;
  status:          string;
  chaletPrice:     number | null;
  extrasTotal:     number | null;
  totalPrice:      number;
  price:           number;          // ✅ جديد (قبل الخصم)
  deposit:         number | null;
  numOfGuests:     number;
  notes:           BookingNote[];   // ✅ جديد (بدل string | null)
  createdBy:       string;
  extras:          BookingExtra[];
  payments:        Payment[];
  chaletImageUrl?: string;
}

export interface CreateBookingDto {
  customerName:    string;
  phone:           string;
  additionalPhone?: string;   // ✅ جديد
  discountAmount?:  number;   // ✅ جديد
  date:            string;
  period:          number;
  chaletType:      number;
  numOfGuests:     number;
  extras:          { extraId: number; quantity: number }[];
}

export interface UpdateBookingDto {
  bookingId:       number;
  customerName:    string;
  phone:           string;
  additionalPhone?: string;   // ✅ جديد
  discountAmount?:  number;   // ✅ جديد
  payMoney:        number;
  deposit:         number;
  removedExtraIds: number[];
}

export interface DoneBookingDto {
  pay:      number;
  chaletTd: number;
}

export interface AvailableChalet {
  id:   number;
  name: string;
  type: number;
}

export interface ChaletByTypePeriod {
  id:   number;
  name: string;
  type: string;
}

export interface UpcomingBooking {
  id:         number;
  chaletId:   number | null;
  chaletType: number;
  date:       string;
  period:     number;
  status:     string;
}

export interface Payment {
  id:           number;
  bookingId:    number;
  amount:       number;
  method:       string;
  status:       string;
  paymentReson: number;
  createdAt:    string;
  transactionId: string;
}

// ─── Daily Payments Response ─────────────────────────────────────────────────
export interface DailyPaymentEntry {
  id:            number;
  bookingId:     number;
  booking:       null;
  amount:        number;
  paymentReson:  number; // 0=Deposit, 1=Price
  method:        number;
  status:        number;
  transactionId: string;
  createdAt:     string;
}

export interface DailyPaymentSummary {
  count:       number;
  totalAmount: number;
  payments:    DailyPaymentEntry[];
}

export interface DailyPaymentsResponse {
  today:     DailyPaymentSummary;
  yesterday: DailyPaymentSummary;
}
export interface BookingNote {
  id:        number;
  bookingId: number;
  note:      string;
  userName:  string;
  createdAt: string;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
export function normalizeChaletType(raw: any): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw === 1 ? 1 : 0;
  const s = String(raw).trim().toLowerCase();
  if (s === '1' || s === 'royal') return 1;
  return 0;
}

export function normalizePeriod(raw: any): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === 'morning'  || s === '0') return 0;
  if (s === 'evening'  || s === '1') return 1;
  if (s === 'full'     || s === '2') return 2;
  return 0;
}

// ─── Service ──────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class BookingService {

  private readonly base = 'https://localhost:7262/api';

  constructor(private http: HttpClient) {}

  private normalizeBooking(b: any): Bookings {
    return {
      ...b,
      chaletType: normalizeChaletType(b.chaletType),
      period:     normalizePeriod(b.period),
    };
  }

  private normalizeBookings(list: any[]): Bookings[] {
    return (list ?? []).map(b => this.normalizeBooking(b));
  }

  // ══ Bookings ══════════════════════════════════════════════════════════════

  getAllBookings(): Observable<Bookings[]> {
    return this.http.get<any[]>(`${this.base}/Booking`)
      .pipe(map(list => this.normalizeBookings(list)));
  }

  getBookingById(id: number): Observable<Bookings> {
    return this.http.get<any>(`${this.base}/Booking/${id}`)
      .pipe(map(b => this.normalizeBooking(b)));
  }

  createBooking(dto: CreateBookingDto): Observable<any> {
    return this.http.post(`${this.base}/Booking`, dto);
  }

  updateBooking(dto: UpdateBookingDto): Observable<any> {
    return this.http.put(`${this.base}/Booking/update`, dto);
  }

  confirmBooking(id: number, deposit: number): Observable<any> {
    return this.http.post(`${this.base}/Booking/${id}/confirm?deposit=${deposit}`, {});
  }

  cancelBooking(id: number, reason: string): Observable<any> {
    return this.http.post(`${this.base}/Booking/${id}/cancel`, { reason });
  }

  markAsDone(id: number, dto: DoneBookingDto): Observable<any> {
    return this.http.put(
      `${this.base}/Booking/${id}/done?PayMoney=${dto.pay}&chaletId=${dto.chaletTd}`, {}
    );
  }

  addBookingExtraViaBooking(bookingId: number, extraId: number, quantity: number): Observable<any> {
    return this.http.post(`${this.base}/Booking/${bookingId}/extras`, {
      bookingId, extraId, quantity
    });
  }

  getUpcomingBookings(): Observable<{ success: boolean; data: UpcomingBooking[] }> {
    return this.http.get<any>(`${this.base}/Booking/upcoming`).pipe(
      map(res => ({
        success: res?.success ?? true,
        data: (res?.data ?? []).map((b: any) => ({
          ...b,
          chaletType: normalizeChaletType(b.chaletType),
          period:     normalizePeriod(b.period),
        })) as UpcomingBooking[],
      }))
    );
  }

  getBookingsByTypeDatePeriod(
    chaletType: number,
    date:       string,
    period:     number
  ): Observable<{ success: boolean; count: number; data: any[] }> {
    const params = new HttpParams()
      .set('chaletType', chaletType)
      .set('date', date)
      .set('period', period);
    return this.http.get<any>(`${this.base}/Booking/by-type-date-period`, { params }).pipe(
      map(res => ({
        success: res?.success ?? true,
        count:   res?.count   ?? 0,
        data: (res?.data ?? []).map((b: any) => ({
          ...b,
          chaletType: normalizeChaletType(b.chaletType),
          period:     normalizePeriod(b.period),
        })),
      }))
    );
  }

  // ══ Chalets ═══════════════════════════════════════════════════════════════

  getChaletsByTypePeriod(type: number, period: number): Observable<ChaletByTypePeriod[]> {
    const params = new HttpParams()
      .set('type', type)
      .set('period', period);
    return this.http.get<ChaletByTypePeriod[]>(`${this.base}/Chalet/by-type-period`, { params });
  }

  // ══ Pricing ═══════════════════════════════════════════════════════════════

  getBasePrice(chaletType: number, period: number, dayType: number): Observable<any> {
    const params = new HttpParams()
      .set('type', chaletType)
      .set('period', period)
      .set('dayType', dayType);
    return this.http.get<any>(`${this.base}/Pricing/calculate`, { params });
  }

  // ══ Payments ══════════════════════════════════════════════════════════════

  getPaymentsByBooking(bookingId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/Payment/by-booking/${bookingId}`);
  }

  // ✅ جديد: جلب مدفوعات اليوم والأمس
  getDailyPayments(): Observable<DailyPaymentsResponse> {
    return this.http.get<DailyPaymentsResponse>(`${this.base}/Payment/daily`);
  }
  addBookingNote(bookingId: number, note: string): Observable<any> {
  return this.http.post(`${this.base}/booking-notes`, {
    bookingId,
    note,
    createdAt: new Date().toISOString()
  });
}
}
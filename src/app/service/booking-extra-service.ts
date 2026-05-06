import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface Bookings {
  id: number;
  customerName: string;
  phone: string;
  chaletId: number;
  chaletName?: string;
  date: string;
  status: string;
  chaletPrice: number;       // ← new
  extrasTotal: number | null; // ← new
  totalPrice: number;
  deposit: number | null;
  period?: number;
  extras?: BookingExtra[];
}

export interface BookingExtra {
  id: number;
  bookingId: number;
  extraId: number;
  extraName: string | null;
  price: number;
  quantity: number;
  total: number;
}

export interface CreateBookingDto {
  customerName: string;
  phone: string;
  chaletId: number;
  date: string;
  period: number;
  extras: { extraId: number; quantity: number }[];
}

export interface UpdateBookingDto {
  bookingId: number;
  customerName: string;
  phone: string;
  deposit: number;
  removedExtraIds: number[];
}

export interface CreateBookingExtraDto {
  bookingId: number;
  extraId: number;
  quantity: number;
}

export interface PricingResult {
  id: number;
  chaletType: number;
  period: number;
  price: number;
  dayType: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private baseUrl = 'https://localhost:7262/api';

  constructor(private http: HttpClient) {}

  getAllBookings(): Observable<Bookings[]> {
    return this.http.get<Bookings[]>(`${this.baseUrl}/Booking`);
  }

  getBookingById(id: number): Observable<Bookings> {
    return this.http.get<Bookings>(`${this.baseUrl}/Booking/${id}`);
  }

  createBooking(dto: CreateBookingDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/Booking`, dto);
  }

  updateBooking(dto: UpdateBookingDto): Observable<any> {
    return this.http.put(`${this.baseUrl}/Booking/update`, dto);
  }

  confirmBooking(id: number, deposit: number): Observable<any> {
    const params = new HttpParams().set('deposit', deposit.toString());
    return this.http.post(`${this.baseUrl}/Booking/${id}/confirm`, {}, { params });
  }

  cancelBooking(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/Booking/${id}/cancel`, {});
  }

  checkBookingAvailability(
    chaletId: number, date: string, period: number
  ): Observable<{ available: boolean; message: string }> {
    return this.http.get<any>(`${this.baseUrl}/Booking/check`, {
      params: { chaletId, date, period }
    });
  }

  /**
   * GET /api/Pricing/calculate?type=0&period=1&dayType=1
   * Returns: { id, chaletType, period, price, dayType }
   */
  getBasePrice(type: number, period: number, dayType: number = 0): Observable<PricingResult> {
    const params = new HttpParams()
      .set('type',    type.toString())
      .set('period',  period.toString())
      .set('dayType', dayType.toString());
    return this.http.get<PricingResult>(`${this.baseUrl}/Pricing/calculate`, { params });
  }

  /**
   * POST /api/Booking/{id}/extras
   * Returns plain text string on success e.g. "تمت إضافة الإضافة بنجاح"
   */
  addBookingExtraViaBooking(bookingId: number, extraId: number, quantity: number): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/Booking/${bookingId}/extras`,
      { bookingId, extraId, quantity },
      { responseType: 'text' }   // ← KEY FIX: API returns plain text, not JSON
    );
  }

  getBookingExtras(bookingId: number): Observable<BookingExtra[]> {
    return this.http.get<BookingExtra[]>(`${this.baseUrl}/BookingExtra/booking/${bookingId}`);
  }

  addBookingExtra(dto: CreateBookingExtraDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/BookingExtra`, dto);
  }

  deleteBookingExtra(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/BookingExtra/${id}`);
  }
}
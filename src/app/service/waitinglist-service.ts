import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type WaitingStatus = 'Pending' | 'Contacted' | 'Booked' | 'Cancelled';

export const WaitingStatusEnum: Record<number, WaitingStatus> = {
  0: 'Pending',
  1: 'Contacted',
  2: 'Booked',
  3: 'Cancelled',
};

export const WaitingStatusArabic: Record<WaitingStatus, string> = {
  Pending: 'قيد الانتظار',
  Contacted: 'تم التواصل',
  Booked: 'محجوز',
  Cancelled: 'ملغي',
};

export interface WaitingListItem {
  id: number;
  customerName: string;
  phone: string;
  chaletId: number;
  chaletName: string;
  date: string;
  period: string;
  status: WaitingStatus;
  notes: string;
  createdAt:any
}

export interface ConvertToBookingResponse {
  message: {
    success: boolean;
    message: string;
    bookingId: number | null;
    totalPrice: number | null;
    expireAt: string | null;
    status: string | null;
  };
}

export interface UpdateStatusResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class WaitingListService {
  private baseUrl = 'https://localhost:7262/api/WaitingList';

  constructor(private http: HttpClient) {}

  getAll(): Observable<WaitingListItem[]> {
    return this.http.get<WaitingListItem[]>(this.baseUrl);
  }

  updateStatus(id: number, status: number): Observable<UpdateStatusResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.put<UpdateStatusResponse>(
      `${this.baseUrl}/${id}`,
      { status },
      { headers }
    );
  }

  convertToBooking(id: number): Observable<ConvertToBookingResponse> {
    return this.http.post<ConvertToBookingResponse>(
      `${this.baseUrl}/convert-to-booking/${id}`,
      null
    );
  }
}
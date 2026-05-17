import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';
export interface PagedResult<T> {
  data:       T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
}
export type WaitingStatus = 'Pending' | 'Contacted' | 'Booked' | 'Cancelled';

export const WaitingStatusEnum: Record<number, WaitingStatus> = {
  0: 'Pending',
  1: 'Contacted',
  2: 'Booked',
  3: 'Cancelled',
};

export const WaitingStatusArabic: Record<WaitingStatus, string> = {
  Pending: 'قائمة الانتظار',
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
  chaletType: string;
  date: string;
  period: string;
  status: WaitingStatus;
  note: string;
  createdAt:any
    additionalPhone?: string;  // ← أضف السطر ده

}
export interface WaitingPagedResult {
  data:       WaitingListItem[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
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
  private baseUrl = `${environment.baseUrl}/WaitingList`;

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
getPaged(params: {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;   // ← جديد
  dateTo?: string;     // ← جديد
}): Observable<PagedResult<WaitingListItem>> {
  let httpParams = new HttpParams()
    .set('page',     params.page.toString())
    .set('pageSize', params.pageSize.toString());

  if (params.search)   httpParams = httpParams.set('search',   params.search);
  if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
  if (params.dateTo)   httpParams = httpParams.set('dateTo',   params.dateTo);

  return this.http.get<PagedResult<WaitingListItem>>(
    `${this.baseUrl}/paged`, { params: httpParams });
}
}
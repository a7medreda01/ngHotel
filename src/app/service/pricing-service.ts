import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// يتوافق مع الـ enums في الباك
// ChaletType: 0=Normal, 1=Royal
// BookingPeriod: 0=Morning, 1=Evening, 2=Full
// DayType: 0=Weekday, 1=Weekend, 2=Holiday

export interface Pricing {
  id: number;
  chaletType: string;  // 'Normal' | 'Royal'
  period: string;      // 'Morning' | 'Evening' | 'Full'
  price: number;
  dayType: string;     // 'Weekday' | 'Weekend' | 'Holiday'
}

export interface CreatePricingDto {
  chaletType: number; // 0=Normal, 1=Royal
  period: number;     // 0=Morning, 1=Evening, 2=Full
  price: number;
  dayType: number;    // 0=Weekday, 1=Weekend, 2=Holiday
}

export interface PricingCalculateResult {
  id: number;
  chaletType: number;
  period: number;
  price: number;
  dayType: number;
}

@Injectable({ providedIn: 'root' })
export class PricingService {
  private apiUrl = 'https://localhost:7262/api/Pricing';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Pricing[]> {
    return this.http.get<Pricing[]>(this.apiUrl);
  }

  getById(id: number): Observable<Pricing> {
    return this.http.get<Pricing>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreatePricingDto): Observable<any> {
    return this.http.post(this.apiUrl, dto);
  }

  update(id: number, dto: CreatePricingDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  calculate(type: number, period: number, dayType: number): Observable<PricingCalculateResult> {
    const params = new HttpParams()
      .set('type', type.toString())
      .set('period', period.toString())
      .set('dayType', dayType.toString());
    return this.http.get<PricingCalculateResult>(`${this.apiUrl}/calculate`, { params });
  }
}
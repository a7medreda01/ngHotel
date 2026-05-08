import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment.prod';

export interface ChaletImage {
  id: number;
  url: string;
}

export interface Chalet {
  id: number;
  name: string;
  type: 'Normal' | 'Royal';
  status: 'Available' | 'Booked' | 'Maintenance';
  images: string[];
  imageObjects?: ChaletImage[];
  partnerId?: number;
  sharePercentage?: number;
  hasMorning?: boolean;
  hasEvening?: boolean;
  hasFullDay?: boolean;
}

// ══════════════════════════════════════════════════════
// normalizeChalet — خارج الكلاس حتى يمكن import منها
// تحل مشكلة الباك اللي بيرجع 'True'/'False' كـ string
// ══════════════════════════════════════════════════════
export function normalizeChalet(c: any): Chalet {
  const parseBool = (val: any): boolean =>
    val === true || val === 1 || 
    (typeof val === 'string' && val.toLowerCase() === 'true');

  // استخرج الصور سواء كانت strings أو objects
  const rawImages = Array.isArray(c.images) ? c.images : [];
  const images = rawImages.map((img: any) =>
    typeof img === 'string' ? img : img?.url ?? ''
  ).filter(Boolean);

  const imageObjects = rawImages.map((img: any, i: number) =>
    typeof img === 'string' ? { id: i, url: img } : { id: img?.id ?? i, url: img?.url ?? '' }
  );

  return {
    id:              c.id,
    name:            c.name,
    type:            c.type,
    status:          c.status,
    partnerId:       c.partnerId,
    sharePercentage: c.sharePercentage,
    // ✅ نكتبهم صريح بدل الـ spread عشان نضمن مش بيتوورَّث قيمة غلط
    hasMorning: parseBool(c.hasMorning),
    hasEvening: parseBool(c.hasEvening),
    hasFullDay: parseBool(c.hasFullDay),
    images,
    imageObjects,
  };
}
/**
 * تحويل الـ Chalet response لـ array من أرقام BookingPeriod المتاحة
 *   BookingPeriod: Morning=0, Evening=1, Full=2
 */
export function getAvailablePeriodsArray(chalet: Chalet): number[] {
  const periods: number[] = [];
  const hasBooleanFields =
    chalet.hasMorning !== undefined ||
    chalet.hasEvening !== undefined ||
    chalet.hasFullDay !== undefined;

  if (hasBooleanFields) {
    if (chalet.hasMorning === true) periods.push(0);
    if (chalet.hasEvening === true) periods.push(1);
    if (chalet.hasFullDay === true) periods.push(2);
    return periods.length > 0 ? periods : [0, 1, 2];
  }

  return [0, 1, 2];
}

/** label عربي للفترات المتاحة */
export function getAvailablePeriodsLabel(chalet: Chalet): string {
  const periods = getAvailablePeriodsArray(chalet);
  const labels: Record<number, string> = {
    0: '🌅 صباحي',
    1: '🌇 مسائي',
    2: '🌞 كامل'
  };
  if (periods.length === 3) return '🌅🌇🌞 كل الفترات';
  return periods.map(p => labels[p]).join(' + ');
}

/** تحويل array الفترات لـ boolean fields للـ FormData */
export function periodsArrayToBooleans(periods: number[]): {
  hasMorning: boolean;
  hasEvening: boolean;
  hasFullDay: boolean;
} {
  return {
    hasMorning: periods.includes(0),
    hasEvening: periods.includes(1),
    hasFullDay: periods.includes(2),
  };
}

/** للتوافق مع الكود القديم */
export function periodsArrayToBitmask(periods: number[]): number {
  let mask = 0;
  if (periods.includes(0)) mask |= 1;
  if (periods.includes(1)) mask |= 2;
  if (periods.includes(2)) mask |= 4;
  return mask;
}

@Injectable({ providedIn: 'root' })
export class ChaletService {
  private apiUrl = `${environment.baseUrl}/Chalet`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Chalet[]> {
    return this.http.get<any[]>(this.apiUrl).pipe(
      map(data => data.map(normalizeChalet))
    );
  }

  getById(id: number): Observable<Chalet> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(normalizeChalet)
    );
  }

  /**
   * POST /api/Chalet
   * Fields: Name, Type, Status, HasMorning, HasEvening, HasFullDay, Images, PartnerId
   */
  create(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }

  /**
   * PUT /api/Chalet
   * Id جوا الـ FormData — مش في الـ URL
   * Fields: Id, Name, Status, HasMorning, HasEvening, HasFullDay, NewImages, RemovedImageIds
   */
  update(formData: FormData): Observable<any> {
    // console.log(formData);
    return this.http.put(this.apiUrl, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * GET /api/Chalet/by-type-period?type=0&period=2
   * الأكواخ اللي بتدعم نوع وفترة معينة
   */
  getByTypePeriod(type: number, period: number): Observable<Chalet[]> {
    const params = new HttpParams()
      .set('type', type.toString())
      .set('period', period.toString());
    return this.http.get<any[]>(`${this.apiUrl}/by-type-period`, { params }).pipe(
      map(data => data.map(normalizeChalet))
    );
  }
}
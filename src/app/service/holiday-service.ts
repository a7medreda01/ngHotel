import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';

export interface Holiday {
  id: number;
  name: string;
  date: string; // ISO string
}

export interface CreateHolidayDto {
  name: string;
  date: string; // 'YYYY-MM-DD'
}


@Injectable({ providedIn: 'root' })
export class HolidayService {
  private apiUrl = `${environment.baseUrl}/Holiday`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Holiday[]> {
    return this.http.get<Holiday[]>(this.apiUrl);
  }

  create(dto: CreateHolidayDto): Observable<any> {
    return this.http.post(this.apiUrl, dto);
  }

  update(id: number, dto: CreateHolidayDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
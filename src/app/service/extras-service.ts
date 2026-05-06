import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Extra {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
}

export interface ExtraCreateDto {
  name: string;
  price: number;
}

export interface ExtraUpdateDto {
  name: string;
  price: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExtrasService {
  private apiUrl = 'https://localhost:7262/api/Extra';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Extra[]> {
    return this.http.get<Extra[]>(this.apiUrl);
  }

  getById(id: number): Observable<Extra> {
    return this.http.get<Extra>(`${this.apiUrl}/${id}`);
  }

  create(dto: ExtraCreateDto): Observable<Extra> {
    return this.http.post<Extra>(this.apiUrl, dto);
  }

  update(id: number, dto: ExtraUpdateDto): Observable<Extra> {
    return this.http.put<Extra>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
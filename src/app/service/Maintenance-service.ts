import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export enum MaintenanceStatus {
  Open = 0,
  InProgress = 1,
  Closed = 2
}

export interface MaintenanceRequest {
  id?: number;
  chaletId: number;
  chaletName?: string | null;
  description: string;
  status?: string;
  createdAt?: string | null;
}

export interface CreateMaintenanceDto {
  chaletId: number;
  description: string;
}

export interface UpdateMaintenanceDto {
  description: string;
  status: MaintenanceStatus;
}

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private baseUrl = 'https://localhost:7262/api/Maintenance';

  constructor(private http: HttpClient) {}

  getAll(): Observable<MaintenanceRequest[]> {
    return this.http.get<MaintenanceRequest[]>(this.baseUrl);
  }

  getById(id: number): Observable<MaintenanceRequest> {
    return this.http.get<MaintenanceRequest>(`${this.baseUrl}/${id}`);
  }

  create(dto: CreateMaintenanceDto): Observable<MaintenanceRequest> {
    return this.http.post<MaintenanceRequest>(this.baseUrl, dto);
  }

  update(id: number, dto: UpdateMaintenanceDto): Observable<MaintenanceRequest> {
    return this.http.put<MaintenanceRequest>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
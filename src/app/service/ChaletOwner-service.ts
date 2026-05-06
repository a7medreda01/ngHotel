import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChaletPartner {
  userId: number;
  userName: string;
  sharePercentage: number;
}

export interface ChaletWithPartners {
  chaletId: number;
  chaletName: string;
  partners: ChaletPartner[];
}

@Injectable({ providedIn: 'root' })
export class ChaletOwnerService {
  private apiUrl = 'https://localhost:7262/api/ChaletOwner';

  constructor(private http: HttpClient) {}

  getChaletsWithPartners(): Observable<ChaletWithPartners[]> {
    return this.http.get<ChaletWithPartners[]>(`${this.apiUrl}/chalets-with-partners`);
  }
}
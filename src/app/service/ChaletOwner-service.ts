import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.prod';

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
  private apiUrl = `${environment.baseUrl}/ChaletOwner`;

  constructor(private http: HttpClient) {}

  getChaletsWithPartners(): Observable<ChaletWithPartners[]> {
    return this.http.get<ChaletWithPartners[]>(`${this.apiUrl}/chalets-with-partners`);
  }
}
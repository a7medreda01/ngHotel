import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChaletWithPartners, ChaletOwnerService, ChaletPartner } from '../../service/ChaletOwner-service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';



interface PartnerSummary {
  userId: number;
  userName: string;
  role: string; // نستنتجه من اسم المستخدم أو الـ index
  chalets: { chaletId: number; chaletName: string; share: number }[];
  totalChalets: number;
  avgShare: number;
}

@Component({
  selector: 'app-partners-component',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './partners-component.html',
  styleUrl: './partners-component.css',
})
export class PartnersComponent  implements OnInit {
  chaletsWithPartners: ChaletWithPartners[] = [];
  partnerSummaries: PartnerSummary[]        = [];
  loading = false;

  // التبويب: عرض حسب الشريك أو حسب الكوخ
  viewMode: 'byPartner' | 'byChalet' = 'byPartner';

  // الشريك المفتوح في الـ expand
  expandedPartnerId: number | null = null;
  expandedChaletId:  number | null = null;

  toast = '';
  toastType: 'success' | 'error' = 'success';
  showToast = false;

  constructor(
    private chaletOwnerService: ChaletOwnerService,
    private cdr: ChangeDetectorRef,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.chaletOwnerService.getChaletsWithPartners().subscribe({
      next: (data) => {
        this.chaletsWithPartners = data;
        this.buildPartnerSummaries(data);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.notify(this.translate.instant('features.partners.loadFail'), 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * نبني ملخص لكل شريك — نجمع كل الأكواخ المرتبط بيها
   * ونستنتج الدور: لو userId=1 أو userName يحتوي admin → مدير، غيره → شريك
   */
  buildPartnerSummaries(data: ChaletWithPartners[]): void {
    const map = new Map<number, PartnerSummary>();

    for (const chalet of data) {
      for (const p of chalet.partners) {
        if (!map.has(p.userId)) {
          map.set(p.userId, {
            userId:       p.userId,
            userName:     p.userName,
            role:         this.inferRole(p),
            chalets:      [],
            totalChalets: 0,
            avgShare:     0,
          });
        }
        const entry = map.get(p.userId)!;
        entry.chalets.push({
          chaletId:   chalet.chaletId,
          chaletName: chalet.chaletName,
          share:      p.sharePercentage,
        });
      }
    }

    // احسب المتوسطات
    for (const s of map.values()) {
      s.totalChalets = s.chalets.length;
      s.avgShare     = s.chalets.reduce((sum, c) => sum + c.share, 0) / s.chalets.length;
    }

    // رتب: المديرين أولاً ثم الشركاء
    this.partnerSummaries = Array.from(map.values()).sort((a, b) => {
      if (a.role === b.role) return a.userId - b.userId;
      return a.role === 'Manager' ? -1 : 1;
    });
  }

  inferRole(p: ChaletPartner): string {
    const name = p.userName.toLowerCase();
    if (name.includes('admin') || name.includes('manager')) return 'Manager';
    return 'Partner';
  }

  getRoleLabel(role: string): string {
    return role === 'Manager'
      ? this.translate.instant('features.partners.roleManager')
      : this.translate.instant('features.partners.rolePartner');
  }

  getRoleClass(role: string): string {
    return role === 'Manager' ? 'role-manager' : 'role-partner';
  }

  getRoleIcon(role: string): string {
    return role === 'Manager' ? 'bi-star-fill' : 'bi-briefcase-fill';
  }

  togglePartner(id: number): void {
    this.expandedPartnerId = this.expandedPartnerId === id ? null : id;
  }

  toggleChalet(id: number): void {
    this.expandedChaletId = this.expandedChaletId === id ? null : id;
  }

  /** إجمالي الشركاء الفريدين (بدون المدير) */
  get partnersOnlyCount(): number {
    return this.partnerSummaries.filter(p => p.role === 'Partner').length;
  }

  /** إجمالي الأكواخ */
  get totalChalets(): number {
    return this.chaletsWithPartners.length;
  }

  notify(msg: string, type: 'success' | 'error'): void {
    this.toast     = msg;
    this.toastType = type;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 3000);
  }
}
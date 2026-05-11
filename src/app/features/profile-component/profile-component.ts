import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoginResponse, AuthService } from '../../service/Auth-service';
import { RouterLink } from '@angular/router';
import { HolidayCopmonent } from '../holiday-copmonent/holiday-copmonent';
import { CustomersComponent } from '../customers-component/customers-component';
import { PricingComponent } from '../pricing-component/pricing-component';
import { PartnersComponent } from '../partners-component/partners-component';
import { CreateUserComponent } from '../create-user-component/create-user-component';
import { Chalet } from '../chalet/chalet';
import { ExtrasComponent } from '../extras-component/extras-component';
import { Maintenance } from '../maintenance/maintenance';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../service/language.service';


type Tab = 'profile' | 'pricing' | 'holidays' | 'partners' | 'customers'|'users' |'Maintenance'|'addons'|'chalet';

@Component({
  selector: 'app-profile-component',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, HolidayCopmonent, PricingComponent,
    PartnersComponent, CustomersComponent, CreateUserComponent, Chalet, ExtrasComponent, Maintenance],
  templateUrl: './profile-component.html',
  styleUrl: './profile-component.css',
})
export class ProfileComponent implements OnInit {
  user: LoginResponse | null = null;
  activeTab: Tab = 'profile';

  // Change password form
  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  showCurrent     = false;
  showNew         = false;
  showConfirm     = false;
  isChangingPw    = false;
  pwSuccess       = '';
  pwError         = '';

  get initials(): string {
    if (!this.user?.fullName) return '?';
    return this.user.fullName
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  get roleLabel(): string {
    const r = this.user?.role;
    if (r === 'Manager') return this.translate.instant('features.profile.roleManager');
    if (r === 'Partner') return this.translate.instant('features.profile.rolePartner');
    return this.translate.instant('features.profile.roleEmployee');
  }
  get isPartner(): boolean { return this.auth.hasRole('Partner'); }
  get isManager(): boolean { return this.auth.hasRole('Manager'); }

  get roleClass(): string {
    const r = this.user?.role;
    if (r === 'Manager') return 'role-manager';
    if (r === 'Partner') return 'role-partner';
    return 'role-employee';
  }

  get roleIcon(): string {
    const r = this.user?.role;
    if (r === 'Manager') return 'bi-star-fill';
    if (r === 'Partner') return 'bi-briefcase-fill';
    return 'bi-person-fill';
  }

  get passwordsMatch(): boolean { return this.newPassword === this.confirmPassword; }

  get isValid(): boolean {
    return !!this.currentPassword && this.newPassword.length >= 6 && this.passwordsMatch && !this.isChangingPw;
  }

  /** الـ tabs المتاحة حسب الصلاحية */
  get tabs(): { id: Tab; labelKey: string; icon: string; managerOnly?: boolean; partnerOnly?: boolean }[] {
    const all = [
      { id: 'profile' as Tab, labelKey: 'features.profile.tabAccount', icon: 'bi-person-circle' },
      { id: 'pricing' as Tab, labelKey: 'features.profile.tabPricing', icon: 'bi-currency-dollar', managerOnly: true },
      { id: 'holidays' as Tab, labelKey: 'features.profile.tabHolidays', icon: 'bi-calendar-heart-fill', managerOnly: true },
      { id: 'partners' as Tab, labelKey: 'features.profile.tabPartners', icon: 'bi-briefcase-fill', managerOnly: true },
      { id: 'customers' as Tab, labelKey: 'features.profile.tabCustomers', icon: 'bi-people-fill', managerOnly: true },
      { id: 'users' as Tab, labelKey: 'features.profile.tabUsers', icon: 'bi-people', managerOnly: true },
      { id: 'chalet' as Tab, labelKey: 'features.profile.tabChalet', icon: 'bi-house', managerOnly: true, partnerOnly: true },
      { id: 'addons' as Tab, labelKey: 'features.profile.tabAddons', icon: 'bi-plus', managerOnly: true },
      { id: 'Maintenance' as Tab, labelKey: 'features.profile.tabMaintenance', icon: 'bi-hammer', managerOnly: true },
    ];
    return all.filter(t => !t.managerOnly || this.user?.role === 'Manager' || t.partnerOnly);
  }

  setTab(tab: Tab): void { this.activeTab = tab; }

  constructor(
    private auth: AuthService,
    private translate: TranslateService,
      readonly language: LanguageService  // ← أضفده

  ) {}

  ngOnInit(): void {
    this.user = this.auth.getSession();
  }

  onChangePassword(): void {
    if (!this.isValid) return;
    this.isChangingPw = true;
    this.pwSuccess    = '';
    this.pwError      = '';
    this.auth.forgetPassword({ email: this.user?.email ?? '' }).subscribe({
      next: () => {
        this.isChangingPw   = false;
        this.pwSuccess      = this.translate.instant('features.profile.pwSuccess');
        this.currentPassword = '';
        this.newPassword     = '';
        this.confirmPassword = '';
      },
      error: () => {
        this.isChangingPw = false;
        this.pwError      = this.translate.instant('features.profile.pwError');
      }
    });
  }

  logout(): void { this.auth.logout(); }
  get langOptions() { return this.language.options; }
setLang(code: string) { this.language.setLanguage(code); }
}
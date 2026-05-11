import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NotificationComponent } from '../../features/notification-component/notification-component';
import { AppNotification, NotificationService } from '../../service/NotificationService';
import { AuthService } from '../../service/Auth-service';
import { LanguageService } from '../../service/language.service';
import { ProjectBrandService } from '../../service/project-brand.service';

interface NavItem {
  labelKey: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, RouterModule, NotificationComponent, TranslatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit, OnDestroy {
  isScrolled = false;
  unreadCount = 0;
  showMobileNotif = false;
  mobileNotifications: AppNotification[] = [];

  private subs: Subscription[] = [];

  private baseNavItems: NavItem[] = [
    { labelKey: 'nav.home', route: '/dashboard', icon: 'bi bi-house-door' },
    { labelKey: 'nav.bookings', route: '/booking', icon: 'bi bi-calendar-check' },
    { labelKey: 'nav.waitingList', route: '/waitinglist', icon: 'bi bi-hourglass-split' },
    { labelKey: 'nav.settings', route: '/profile', icon: 'bi bi-gear' },
  ];

  private managerNavItems: NavItem[] = [
    { labelKey: 'nav.chalets', route: '/chalet', icon: 'bi bi-building' },
    { labelKey: 'nav.extras', route: '/extras', icon: 'bi bi-plus-circle' },
    { labelKey: 'nav.maintenance', route: '/maintenance', icon: 'bi bi-tools' },
  ];

  navItems: NavItem[] = [];
  mobileNavItems: NavItem[] = [];

  get langOptions(): { code: string; labelKey: string }[] {
    return this.language.options;
  }

  readonly projectBrand = inject(ProjectBrandService);

  constructor(
    private router: Router,
    private notifService: NotificationService,
    private authService: AuthService,
    private translate: TranslateService,
    readonly language: LanguageService,
  ) {}

  ngOnInit(): void {
    this.buildNavItems();
    this.subs.push(
      this.notifService.unreadCount$.subscribe((c) => (this.unreadCount = c)),
      this.notifService.notifications$.subscribe((n) => (this.mobileNotifications = n)),
      this.translate.onLangChange.subscribe(() => this.buildNavItems()),
    );
  }

  private buildNavItems(): void {
    const isManager = this.authService.isManager();

    if (isManager) {
      this.navItems = [
        ...this.baseNavItems.slice(0, 3),
        ...this.managerNavItems,
        this.baseNavItems[3],
      ];
    } else {
      this.navItems = [...this.baseNavItems];
    }

    this.mobileNavItems = [
      this.navItems[0],
      this.navItems[1],
      this.navItems[2],
      this.navItems[this.navItems.length - 1],
    ];
  }

  setLang(code: string): void {
    this.language.setLanguage(code);
  }

  toggleMobileNotif(): void {
    this.showMobileNotif = !this.showMobileNotif;
    if (this.showMobileNotif) {
      this.notifService.loadNotifications();
    }
  }

  onMobileNotifClick(n: AppNotification): void {
    if (n.bookingId) {
      this.notifService.navigateToBooking(n);
      this.showMobileNotif = false;
    } else if (!n.isRead) {
      this.notifService.markAsRead(n.id).subscribe();
      this.notifService.markAsReadLocally(n.id);
    }
  }

  markAllRead(): void {
    this.notifService.markAllAsRead();
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return this.translate.instant('misc.agoNow');
    if (diffMin < 60)
      return this.translate.instant('misc.agoMinutes', { n: diffMin });
    if (diffHr < 24) return this.translate.instant('misc.agoHours', { n: diffHr });
    return date.toLocaleDateString(this.translate.currentLang === 'ar' ? 'ar-EG' : this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
  }

  get isManager(): boolean {
    return this.authService.isManager();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled = window.scrollY > 20;
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}

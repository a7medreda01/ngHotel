import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationComponent } from '../../features/notification-component/notification-component';
import { AppNotification, NotificationService } from '../../service/NotificationService';
import { AuthService } from '../../service/Auth-service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, RouterModule, NotificationComponent],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit, OnDestroy {
  isScrolled = false;
  unreadCount = 0;
  showMobileNotif = false;
  mobileNotifications: AppNotification[] = [];

  private subs: Subscription[] = [];

  // ─── Items مشتركة بين الكل ────────────────────────────
  private baseNavItems: NavItem[] = [
    { label: 'الرئيسية',       route: '/dashboard',   icon: 'bi bi-house-door' },
    { label: 'الحجوزات',       route: '/booking',     icon: 'bi bi-calendar-check' },
    { label: 'قائمة الانتظار', route: '/waitinglist', icon: 'bi bi-hourglass-split' },
    { label: 'الإعدادات',      route: '/profile',     icon: 'bi bi-gear' },
  ];

  // ─── Items خاصة بالـ Manager فقط ─────────────────────
  private managerNavItems: NavItem[] = [
    { label: 'الأكواخ',  route: '/chalet',      icon: 'bi bi-building' },
    { label: 'الإضافات', route: '/extras',      icon: 'bi bi-plus-circle' },
    { label: 'الصيانة',  route: '/maintenance', icon: 'bi bi-tools' },
  ];

  navItems: NavItem[] = [];
  mobileNavItems: NavItem[] = [];

  constructor(
    private router: Router,
    private notifService: NotificationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.buildNavItems();

    this.subs.push(
      this.notifService.unreadCount$.subscribe(c => this.unreadCount = c),
      this.notifService.notifications$.subscribe(n => this.mobileNotifications = n)
    );
  }

  private buildNavItems(): void {
    const isManager = this.authService.isManager();

    if (isManager) {
      // للمدير: الأساسيات + items الإدارة (بدون الإعدادات في النص)، ثم الإعدادات آخراً
      this.navItems = [
        ...this.baseNavItems.slice(0, 3),   // الرئيسية، الحجوزات، الانتظار
        ...this.managerNavItems,             // الأكواخ، الإضافات، الصيانة
        this.baseNavItems[3],               // الإعدادات
      ];
    } else {
      // للموظف والباقين: بدون items الإدارة
      this.navItems = [...this.baseNavItems];
    }

    // Mobile bottom nav — أول 3 + الإعدادات دايماً
    this.mobileNavItems = [
      this.navItems[0], // الرئيسية
      this.navItems[1], // الحجوزات
      this.navItems[2], // الانتظار
      this.navItems[this.navItems.length - 1], // الإعدادات
    ];
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
    if (diffMin < 1)  return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHr < 24)  return `منذ ${diffHr} ساعة`;
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  }

  isActive(route: string): boolean {
    return this.router.isActive(route, {
      paths: 'subset', queryParams: 'ignored',
      fragment: 'ignored', matrixParams: 'ignored'
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
    this.subs.forEach(s => s.unsubscribe());
  }
}
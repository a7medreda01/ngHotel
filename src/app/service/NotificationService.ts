import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment.prod';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  bookingId: number | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private BASE = `${environment.baseUrl}/notifications`;

  private _notifications$ = new BehaviorSubject<AppNotification[]>([]);
  notifications$ = this._notifications$.asObservable();

  private _unreadCount$ = new BehaviorSubject<number>(0);
  unreadCount$ = this._unreadCount$.asObservable();

  // صوت الإشعار
  private audio: HTMLAudioElement | null = null;

  // Polling كل 15 ثانية كـ fallback لو SignalR مش شغال
  private pollSub: Subscription | null = null;
  private lastKnownIds = new Set<number>();
  private isFirstLoad = true;

  constructor(private http: HttpClient, private router: Router) {
    this.initAudio();
    this.loadNotifications();
    this.startPolling();
  }

  // ══════════════════════════════════
  // AUDIO
  // ══════════════════════════════════
  private initAudio(): void {
    try {
      // صوت بسيط مولود من Web Audio API — مش محتاج ملف خارجي
      this.audio = null; // هنعمله عند أول تفاعل من المستخدم
    } catch {}
  }

  playNotificationSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  // ══════════════════════════════════
  // LOAD & POLL
  // ══════════════════════════════════
  loadNotifications(): void {
    this.http.get<AppNotification[]>(this.BASE).subscribe({
      next: (data) => {
        const sorted = data.sort((a, b) => b.id - a.id);
        this.detectNewAndNotify(sorted);
        this._notifications$.next(sorted);
        this._unreadCount$.next(sorted.filter(n => !n.isRead).length);
      },
      error: () => {}
    });
  }

  private detectNewAndNotify(fresh: AppNotification[]): void {
    if (this.isFirstLoad) {
      fresh.forEach(n => this.lastKnownIds.add(n.id));
      this.isFirstLoad = false;
      return;
    }
    const newOnes = fresh.filter(n => !this.lastKnownIds.has(n.id));
    if (newOnes.length > 0) {
      this.playNotificationSound();
      newOnes.forEach(n => this.lastKnownIds.add(n.id));
    }
  }

  private startPolling(): void {
    this.pollSub = interval(15000).subscribe(() => this.loadNotifications());
  }

  // ══════════════════════════════════
  // MARK AS READ
  // ══════════════════════════════════
  markAsRead(id: number): Observable<void> {
    return this.http.post<void>(`${this.BASE}/read/${id}`, {});
  }

  markAsReadLocally(id: number): void {
    const current = this._notifications$.value.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this._notifications$.next(current);
    this._unreadCount$.next(current.filter(n => !n.isRead).length);
  }

  markAllAsRead(): void {
    const unread = this._notifications$.value.filter(n => !n.isRead);
    unread.forEach(n => {
      this.markAsRead(n.id).subscribe();
      this.markAsReadLocally(n.id);
    });
  }

  // ══════════════════════════════════
  // NAVIGATE TO BOOKING
  // ══════════════════════════════════
  navigateToBooking(notification: AppNotification): void {
    this.markAsRead(notification.id).subscribe();
    this.markAsReadLocally(notification.id);
    if (notification.bookingId) {
      this.router.navigate(['/booking'], {
        queryParams: { openBooking: notification.bookingId }
      });
    }
  }

  get notifications(): AppNotification[] {
    return this._notifications$.value;
  }

  get unreadCount(): number {
    return this._unreadCount$.value;
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  
}
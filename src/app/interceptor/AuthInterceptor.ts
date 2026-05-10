// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest, HttpHandler, HttpEvent,
  HttpInterceptor, HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../service/Auth-service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(private auth: AuthService) {}

 intercept(
  req: HttpRequest<any>,
  next: HttpHandler
): Observable<HttpEvent<any>> {

  const token = this.auth.getToken();
  const authReq =
    token ? this.addToken(req, token) : req;

  return next.handle(authReq).pipe(
    catchError((err: HttpErrorResponse) => {

      // تجاهل auth endpoints
      const isAuthRequest =
        req.url.includes('/login') ||
        req.url.includes('/refresh-token');

      if (
        err.status === 401 &&
        !isAuthRequest
      ) {
        return this.handle401(req, next);
      }

      return throwError(() => err);
    })
  );
}
  private addToken(req: HttpRequest<any>, token: string) {
    return req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  private handle401(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const session = this.auth.getSession();
    if (!session?.refreshToken) {
      this.auth.logout();
      return throwError(() => new Error('Session expired'));
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.auth.refreshToken(session.refreshToken).pipe(
        switchMap(res => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(res.token);
          return next.handle(this.addToken(req, res.token));
        }),
        catchError(err => {
          this.isRefreshing = false;
          this.auth.logout(); // فشل الـ refresh → logout
          return throwError(() => err);
        })
      );
    }

    // لو في refresh جاري — انتظر لحد ما يخلص
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(token => next.handle(this.addToken(req, token!)))
    );
  }
}
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import localeAr from '@angular/common/locales/ar';
import localeEn from '@angular/common/locales/en';
import localeFr from '@angular/common/locales/fr';

import { routes } from './app.routes';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { AuthInterceptor } from './interceptor/AuthInterceptor';
import { registerLocaleData } from '@angular/common';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { LANG_STORAGE_KEY } from './service/language.service';

registerLocaleData(localeAr, 'ar-EG');
registerLocaleData(localeEn, 'en-US');
registerLocaleData(localeFr, 'fr');

export function httpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export function localeIdFactory(): string {
  if (typeof localStorage === 'undefined') return 'ar-EG';
  const lang = localStorage.getItem(LANG_STORAGE_KEY) || 'ar';
  if (lang === 'fr') return 'fr';
  if (lang === 'en') return 'en-US';
  return 'ar-EG';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideTranslateService({
      defaultLanguage: 'ar',
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
    }),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    { provide: LOCALE_ID, useFactory: localeIdFactory },
  ],
};

import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export const LANG_STORAGE_KEY = 'ngHotel_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly options: { code: string; labelKey: string }[] = [
    { code: 'ar', labelKey: 'lang.ar' },
    { code: 'en', labelKey: 'lang.en' },
    { code: 'fr', labelKey: 'lang.fr' },
  ];

  init(): void {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    const code = stored && ['ar', 'en', 'fr'].includes(stored) ? stored : 'ar';
    this.translate.setDefaultLang('ar');
    this.translate.addLangs(['ar', 'en', 'fr']);
    this.translate.use(code).subscribe({
      next: () => this.applyDocumentLang(code),
      error: () => {
        this.translate.use('ar').subscribe(() => this.applyDocumentLang('ar'));
      },
    });
    this.translate.onLangChange.subscribe((e) => this.applyDocumentLang(e.lang));
  }

  currentCode(): string {
    return this.translate.currentLang || localStorage.getItem(LANG_STORAGE_KEY) || 'ar';
  }

  isRtl(): boolean {
    return this.currentCode() === 'ar';
  }

  setLanguage(code: string): void {
    if (!['ar', 'en', 'fr'].includes(code)) return;
    localStorage.setItem(LANG_STORAGE_KEY, code);
    this.translate.use(code).subscribe(() => this.applyDocumentLang(code));
  }

  private applyDocumentLang(lang: string): void {
    const rtl = lang === 'ar';
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute(
      'lang',
      lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr' : 'en',
    );
  }
}

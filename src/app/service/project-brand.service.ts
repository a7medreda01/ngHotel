import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { PROJECT_BRAND } from '../config/project-brand';

@Injectable({ providedIn: 'root' })
export class ProjectBrandService {
  readonly brand = PROJECT_BRAND;

  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);

  constructor() {
    this.applyToDocument();
  }

  /** Re-run if you ever change brand at runtime */
  applyToDocument(): void {
    const th = PROJECT_BRAND.theme;
    const root = this.doc.documentElement;
    const set = (name: string, value: string) => root.style.setProperty(name, value);

    set('--brand-accent', th.accent);
    set('--brand-accent-rgb', th.accentRgb);
    set('--brand-primary', th.primary);
    set('--brand-primary-rgb', th.primaryRgb);
    set('--brand-primary-dark', th.primaryDark);

    set('--nav-bg', th.navbarBg);
    set('--nav-bg-rgb', th.navbarBgRgb);
    set('--nav-bg-scrolled', th.navbarBgScrolled);
    set('--nav-drawer-bg', th.navDrawerBg);
    set('--bottom-nav-bg', th.navbarBg);

    set('--page-bg', th.bodyBg);

    set('--profile-sidebar-bg', th.profileSidebarBg);
    set('--profile-sidebar-border', th.profileSidebarBorder);
    set('--profile-page-bg', th.profilePageBg);
    set('--profile-card-bg', th.profileCardBg);
    set('--profile-card-border', th.profileCardBorder);
    set('--profile-input-bg', th.profileInputBg);

    set('--primary-color', th.primary);
    set('--sidebar-bg', th.profileSidebarBg);

    this.title.setTitle(PROJECT_BRAND.documentTitle);

    const link =
      this.doc.querySelector<HTMLLinkElement>("link[rel~='icon']") ??
      this.doc.querySelector<HTMLLinkElement>("link[rel='shortcut icon']");
    if (link) {
      link.href = PROJECT_BRAND.faviconHref;
    }
  }
}

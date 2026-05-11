/**
 * Central project branding — edit this file to change name, icon, favicon, and theme colors.
 * After changes, rebuild the app. Colors are applied as CSS variables on <html>.
 */
export const PROJECT_BRAND = {
  /** Browser tab title */
  documentTitle: ' Chalets Management System',

  /** Shown next to the logo in the top navbar */
  appName: 'Chalets Management System',

  /**
   * Favicon URL (served from project root or /assets/...).
   * Example: 'assets/brand/app-icon.svg' or 'favicon.ico'
   */
  faviconHref: 'assets/brand/app-icon.svg',

  /**
   * Optional image logo in navbar (path under assets or absolute URL).
   * If null, `navbarIconClass` is used instead.
   */
  logoUrl: null as string | null,

  /** Bootstrap Icons class when `logoUrl` is null */
  navbarIconClass: 'bi bi-building',

theme: {
  accent: '#16a34a',
  accentRgb: '22, 163, 74',

  primary: '#15803d',
  primaryRgb: '21, 128, 61',
  primaryDark: '#14532d',

  navbarBg: '#0f1f17',
  navbarBgRgb: '15, 31, 23',
  navbarBgScrolled: 'rgba(15, 31, 23, 0.92)',
  navDrawerBg: '#13281f',

  bodyBg: '#f3f7f4',

  profileSidebarBg: '#0b1510',
  profileSidebarBorder: '#1f3a2b',
  profilePageBg: '#0f1f17',
  profileCardBg: '#14261d',
  profileCardBorder: '#234232',
  profileInputBg: '#0c1a14',
}
} as const;

export type ProjectBrand = typeof PROJECT_BRAND;

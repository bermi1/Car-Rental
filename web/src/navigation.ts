import type { IconName } from '@rental/shared';
import type { TranslationKey } from './i18n';

export interface NavItem {
  to: string;
  labelKey: TranslationKey;
  icon: IconName;
  end?: boolean;
  /** Hidden from staff, and its route is blocked. */
  adminOnly?: boolean;
  /** Platform operator only — managing the companies themselves. */
  superAdminOnly?: boolean;
}

export interface NavSection {
  titleKey: TranslationKey;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar and for route guarding — a page can't
 * drift out of sync with the navigation because both read from here.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'nav.operations',
    items: [
      { to: '/', labelKey: 'nav.overview', icon: 'dashboard', end: true },
      { to: '/bookings', labelKey: 'nav.bookings', icon: 'calendar' },
      { to: '/check-in-out', labelKey: 'nav.checkInOut', icon: 'clipboard' },
      { to: '/documents', labelKey: 'nav.documents', icon: 'shield' },
      { to: '/tracking', labelKey: 'nav.tracking', icon: 'activity' },
    ],
  },
  {
    titleKey: 'nav.records',
    items: [
      { to: '/payments', labelKey: 'nav.payments', icon: 'wallet' },
      { to: '/damages', labelKey: 'nav.damages', icon: 'alert' },
      { to: '/deposits', labelKey: 'nav.deposits', icon: 'wallet' },
      { to: '/fleet', labelKey: 'nav.fleet', icon: 'car' },
      { to: '/clients', labelKey: 'nav.clients', icon: 'users' },
      { to: '/my-activity', labelKey: 'nav.myActivity', icon: 'clock' },
    ],
  },
  {
    titleKey: 'nav.administration',
    items: [
      { to: '/assistant', labelKey: 'nav.assistant', icon: 'search' },
      { to: '/reports', labelKey: 'nav.reports', icon: 'chart', adminOnly: true },
      { to: '/staff', labelKey: 'nav.staff', icon: 'shield', adminOnly: true },
      { to: '/settings', labelKey: 'nav.settings', icon: 'settings', adminOnly: true },
    ],
  },
  {
    titleKey: 'nav.platform',
    items: [{ to: '/companies', labelKey: 'nav.companies', icon: 'external', superAdminOnly: true }],
  },
];

export function visibleSections(opts: { isAdmin: boolean; isSuperAdmin: boolean }): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.superAdminOnly) return opts.isSuperAdmin;
      if (item.adminOnly) return opts.isAdmin;
      return true;
    }),
  })).filter((section) => section.items.length > 0);
}

import type { IconName } from '@rental/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  /** Admin-only entries are hidden from staff and their routes are blocked. */
  adminOnly?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar and for route guarding — a page can't
 * drift out of sync with the navigation because both read from here.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { to: '/', label: 'Overview', icon: 'dashboard', end: true },
      { to: '/bookings', label: 'Bookings', icon: 'calendar' },
      { to: '/check-in-out', label: 'Check-In / Out', icon: 'clipboard' },
      { to: '/documents', label: 'Documents', icon: 'shield' },
      { to: '/deposits', label: 'Deposits', icon: 'wallet' },
    ],
  },
  {
    title: 'Records',
    items: [
      // Both roles may read fleet and clients (the API allows it, and staff
      // need client lookup to raise a booking); only admins get write actions,
      // which the pages gate individually.
      { to: '/fleet', label: 'Fleet', icon: 'car' },
      { to: '/clients', label: 'Clients', icon: 'users' },
      { to: '/my-activity', label: 'My Activity', icon: 'activity' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/reports', label: 'Reports', icon: 'chart', adminOnly: true },
      { to: '/staff', label: 'Staff', icon: 'shield', adminOnly: true },
      { to: '/settings', label: 'Settings', icon: 'settings', adminOnly: true },
    ],
  },
];

export function visibleSections(isAdmin: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isAdmin || !item.adminOnly),
  })).filter((section) => section.items.length > 0);
}

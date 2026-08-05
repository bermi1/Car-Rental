import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn, Icon, IconButton, initials, Select } from '@rental/shared';
import { useAuth, type Company } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { visibleSections } from '../navigation';
import { api } from '../api/client';

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
        <Icon name="car" size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-fg">Rental Console</span>
        <span className="block text-[11px] leading-tight text-fg-subtle">Tanzania</span>
      </span>
    </div>
  );
}

/** Lets a super admin choose which tenant they're working inside. */
function CompanySwitcher() {
  const { isSuperAdmin, company, switchCompany } = useAuth();
  const { t } = useI18n();
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get<Company[]>('/companies').then(setCompanies).catch(() => setCompanies([]));
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return company ? (
      <div className="px-4 pb-3">
        <p className="text-[11px] uppercase tracking-wider text-fg-subtle">{t('common.company')}</p>
        <p className="truncate text-[13px] font-medium text-fg">{company.name}</p>
      </div>
    ) : null;
  }

  return (
    <div className="px-3 pb-3">
      <Select
        label={t('companies.switcher')}
        value={company?.id ?? ''}
        onChange={(e) => {
          const next = companies.find((c) => c.id === e.target.value) ?? null;
          switchCompany(next);
        }}
      >
        <option value="">{t('companies.allCompanies')}</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const { t } = useI18n();
  const sections = visibleSections({ isAdmin, isSuperAdmin });

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Brand />
      </div>

      <CompanySwitcher />

      <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.titleKey} className="mb-5">
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-accent-soft text-accent-softFg'
                          : 'text-fg-muted hover:bg-surface-sunken hover:text-fg'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          size={17}
                          className={cn('shrink-0', isActive ? 'text-accent' : 'text-fg-subtle')}
                        />
                        <span className="truncate">{t(item.labelKey)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[11px] font-semibold text-fg-muted">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">{user?.name}</p>
            <p className="truncate text-[11px] capitalize text-fg-subtle">
              {String(user?.role ?? '').replace('_', ' ')}
            </p>
          </div>
          <IconButton icon="logout" label={t('common.signOut')} size="sm" onClick={logout} />
        </div>
      </div>
    </div>
  );
}

/** English / Kiswahili toggle. */
function LanguageToggle() {
  const { language, setLanguage } = useI18n();
  return (
    <div className="flex items-center rounded-lg bg-surface-sunken p-0.5">
      {(['en', 'sw'] as const).map((code) => (
        <button
          key={code}
          onClick={() => setLanguage(code)}
          aria-label={code === 'en' ? 'English' : 'Kiswahili'}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] font-semibold uppercase transition-all',
            language === code ? 'bg-surface text-fg shadow-xs' : 'text-fg-subtle hover:text-fg'
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

export function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-slide-up border-r border-line bg-surface">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <IconButton icon="menu" label="Open navigation" size="sm" onClick={() => setMobileOpen(true)} />
            <Brand />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <IconButton
              icon={theme === 'dark' ? 'sun' : 'moon'}
              label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              size="sm"
              onClick={toggle}
            />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

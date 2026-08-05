import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn, Icon, IconButton, initials } from '@rental/shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { visibleSections } from '../navigation';

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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, isAdmin } = useAuth();
  const sections = visibleSections(isAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Brand />
      </div>

      <nav className="scrollbar-slim flex-1 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {section.title}
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
                        <span className="truncate">{item.label}</span>
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
            <p className="truncate text-[11px] capitalize text-fg-subtle">{user?.role}</p>
          </div>
          <IconButton icon="logout" label="Log out" size="sm" onClick={logout} />
        </div>
      </div>
    </div>
  );
}

export function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  // A route change should always dismiss the mobile drawer.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
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
          <IconButton
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            size="sm"
            onClick={toggle}
          />
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

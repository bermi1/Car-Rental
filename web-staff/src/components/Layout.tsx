import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@rental/shared';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/bookings', label: 'Bookings' },
  { to: '/documents', label: 'Documents' },
  { to: '/check-in-out', label: 'Check-In / Check-Out' },
  { to: '/deposits', label: 'Deposits' },
  { to: '/my-activity', label: 'My Activity' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-100 bg-white px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-lg font-semibold text-neutral-900">Rental Staff</p>
          <p className="text-xs text-neutral-400">Daily Operations</p>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-neutral-600 hover:bg-neutral-50'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 border-t border-neutral-100 pt-4">
          <p className="truncate px-2 text-sm font-medium text-neutral-800">{user?.name}</p>
          <p className="truncate px-2 text-xs text-neutral-400">{user?.email}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-500 hover:bg-neutral-50"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

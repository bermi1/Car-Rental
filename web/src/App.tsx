import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { RequireAuth, RequireAdmin } from './components/guards';
import { Shell } from './components/Shell';

import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { BookingsList } from './pages/Bookings/BookingsList';
import { BookingCreate } from './pages/Bookings/BookingCreate';
import { BookingDetail } from './pages/Bookings/BookingDetail';
import { CheckInOut } from './pages/CheckInOut';
import { DocumentsQueue } from './pages/DocumentsQueue';
import { DepositsList } from './pages/DepositsList';
import { MyActivity } from './pages/MyActivity';
import { FleetList } from './pages/Fleet/FleetList';
import { FleetDetail } from './pages/Fleet/FleetDetail';
import { ClientsList } from './pages/Clients/ClientsList';
import { ClientDetail } from './pages/Clients/ClientDetail';
import { Reports } from './pages/Reports';
import { StaffList } from './pages/StaffList';
import { Settings } from './pages/Settings';

/** Admin-only route element. */
const admin = (element: React.ReactNode) => <RequireAdmin>{element}</RequireAdmin>;

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAuth>
                  <Shell />
                </RequireAuth>
              }
            >
              <Route path="/" element={<Overview />} />
              <Route path="/bookings" element={<BookingsList />} />
              <Route path="/bookings/new" element={<BookingCreate />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/check-in-out" element={<CheckInOut />} />
              <Route path="/documents" element={<DocumentsQueue />} />
              <Route path="/deposits" element={<DepositsList />} />
              <Route path="/my-activity" element={<MyActivity />} />

              <Route path="/fleet" element={<FleetList />} />
              <Route path="/fleet/:id" element={<FleetDetail />} />
              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/reports" element={admin(<Reports />)} />
              <Route path="/staff" element={admin(<StaffList />)} />
              <Route path="/settings" element={admin(<Settings />)} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

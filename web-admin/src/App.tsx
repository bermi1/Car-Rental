import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { FleetList } from './pages/Fleet/FleetList';
import { FleetDetail } from './pages/Fleet/FleetDetail';
import { BookingsList } from './pages/Bookings/BookingsList';
import { BookingDetail } from './pages/Bookings/BookingDetail';
import { ClientsList } from './pages/Clients/ClientsList';
import { ClientDetail } from './pages/Clients/ClientDetail';
import { StaffList } from './pages/Staff/StaffList';
import { DocumentsQueue } from './pages/Documents/DocumentsQueue';
import { DepositsList } from './pages/Deposits/DepositsList';
import { Reports } from './pages/Reports/Reports';
import { Settings } from './pages/Settings/Settings';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Overview />} />
            <Route path="/fleet" element={<FleetList />} />
            <Route path="/fleet/:id" element={<FleetDetail />} />
            <Route path="/bookings" element={<BookingsList />} />
            <Route path="/bookings/:id" element={<BookingDetail />} />
            <Route path="/clients" element={<ClientsList />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/staff" element={<StaffList />} />
            <Route path="/documents" element={<DocumentsQueue />} />
            <Route path="/deposits" element={<DepositsList />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { BookingsList } from './pages/Bookings/BookingsList';
import { BookingCreate } from './pages/Bookings/BookingCreate';
import { BookingDetail } from './pages/Bookings/BookingDetail';
import { DocumentsQueue } from './pages/Documents/DocumentsQueue';
import { CheckInOut } from './pages/CheckInOut/CheckInOut';
import { DepositsList } from './pages/Deposits/DepositsList';
import { MyActivity } from './pages/MyActivity/MyActivity';

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
            <Route path="/bookings" element={<BookingsList />} />
            <Route path="/bookings/new" element={<BookingCreate />} />
            <Route path="/bookings/:id" element={<BookingDetail />} />
            <Route path="/documents" element={<DocumentsQueue />} />
            <Route path="/check-in-out" element={<CheckInOut />} />
            <Route path="/deposits" element={<DepositsList />} />
            <Route path="/my-activity" element={<MyActivity />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

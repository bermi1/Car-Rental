import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './i18n';
import { RequireAuth, RequireAdmin, RequireStaff, RequireSuperAdmin } from './components/guards';
import { Shell } from './components/Shell';

import { Landing } from './pages/Landing';
import { Catalogue } from './pages/Catalogue';
import { RentalLink } from './pages/RentalLink';
import { Expenses } from './pages/Expenses';
import { Repairs } from './pages/Repairs';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { MyRentals } from './pages/MyRentals';
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
import { CustomerCreate } from './pages/Clients/CustomerCreate';
import { ClientDetail } from './pages/Clients/ClientDetail';
import { Reports } from './pages/Reports';
import { StaffList } from './pages/StaffList';
import { Settings } from './pages/Settings';
import { Payments } from './pages/Payments';
import { Damages } from './pages/Damages';
import { Tracking } from './pages/Tracking';
import { Assistant } from './pages/Assistant';
import { Companies } from './pages/Companies';

const admin = (element: React.ReactNode) => <RequireAdmin>{element}</RequireAdmin>;
const platform = (element: React.ReactNode) => <RequireSuperAdmin>{element}</RequireSuperAdmin>;

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public marketing page. Signed-in users are bounced to /dashboard. */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              {/* Anyone may open a customer account — no invitation needed. */}
              <Route path="/signup" element={<Signup />} />
              {/* A customer's own rentals. Outside the staff shell: they get
                  their cars, not a console they have no business in. */}
              <Route
                path="/my-rentals"
                element={
                  <RequireAuth>
                    <MyRentals />
                  </RequireAuth>
                }
              />
              {/* Public: what a company's QR code points at. No sign-in. */}
              <Route path="/c/:slug" element={<Catalogue />} />
              {/* Public: one customer's own rental, opened from the link staff send. */}
              <Route path="/r/:token" element={<RentalLink />} />
              <Route
                element={
                  <RequireAuth>
                    <RequireStaff>
                      <Shell />
                    </RequireStaff>
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<Overview />} />
                <Route path="/bookings" element={<BookingsList />} />
                <Route path="/bookings/new" element={<BookingCreate />} />
                <Route path="/bookings/:id" element={<BookingDetail />} />
                <Route path="/check-in-out" element={<CheckInOut />} />
                <Route path="/documents" element={<DocumentsQueue />} />
                <Route path="/tracking" element={<Tracking />} />

                <Route path="/payments" element={<Payments />} />
                <Route path="/damages" element={<Damages />} />
                <Route path="/deposits" element={<DepositsList />} />
                <Route path="/fleet" element={<FleetList />} />
                <Route path="/repairs" element={<Repairs />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/fleet/:id" element={<FleetDetail />} />
                <Route path="/clients" element={<ClientsList />} />
                <Route path="/clients/new" element={<CustomerCreate />} />
                <Route path="/clients/:id" element={<ClientDetail />} />
                <Route path="/my-activity" element={<MyActivity />} />

                <Route path="/assistant" element={<Assistant />} />
                <Route path="/reports" element={admin(<Reports />)} />
                <Route path="/staff" element={admin(<StaffList />)} />
                <Route path="/settings" element={admin(<Settings />)} />

                <Route path="/companies" element={platform(<Companies />)} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

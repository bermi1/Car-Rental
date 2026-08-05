import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { uploadsRoot } from './services/storage';

import authRoutes from './routes/auth.routes';
import vehicleRoutes from './routes/vehicles.routes';
import clientRoutes from './routes/clients.routes';
import bookingRoutes from './routes/bookings.routes';
import documentRoutes from './routes/documents.routes';
import conditionReportRoutes from './routes/conditionReports.routes';
import contractRoutes from './routes/contracts.routes';
import depositRoutes from './routes/deposits.routes';
import staffRoutes from './routes/staff.routes';
import reportRoutes from './routes/reports.routes';
import settingsRoutes from './routes/settings.routes';
import deviceRoutes from './routes/devices.routes';
import overviewRoutes from './routes/overview.routes';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/condition-reports', conditionReportRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/overview', overviewRoutes);

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

export default app;

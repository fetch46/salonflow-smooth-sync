import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import productRoutes from './routes/products';
import locationRoutes from './routes/locations';
import journalRoutes from './routes/journal';
import transactionRoutes from './routes/transactions';
import reportRoutes from './routes/reports';
import bankRoutes from './routes/bank';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/products', productRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bank', bankRoutes);

import notificationsRoutes from './routes/notifications';
app.use('/api/notifications', notificationsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

// Every 10 minutes, find appointments in the next 24 hours without reminder sent, and send reminders
cron.schedule('*/10 * * * *', async () => {
  try {
    if (!supabase) return;
    const now = new Date();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // naive filter by date; time concatenation may vary by schema
    const today = now.toISOString().slice(0, 10);
    const tomorrow = in24h.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_date', today)
      .lte('appointment_date', tomorrow)
      .in('status', ['confirmed', 'scheduled'])
      .is('reminder_email_sent_at', null);
    if (error) {
      console.warn('Reminder cron query failed', error);
      return;
    }
    const list = (data || []) as any[];
    for (const appt of list) {
      try {
        await fetch(`http://localhost:${PORT}/api/notifications/appointment/reminder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointment_id: appt.id })
        });
      } catch (e) {
        console.warn('Failed to trigger reminder for appt', appt.id, e);
      }
    }
  } catch (e) {
    console.warn('Reminder cron error', e);
  }
});
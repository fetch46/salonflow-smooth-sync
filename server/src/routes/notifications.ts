import { Router } from 'express';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Supabase service client (server-side)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

// Nodemailer transporter (optional, if env set)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'no-reply@example.com';

const hasSmtp = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// Twilio WhatsApp (optional)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
const hasTwilio = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM);
const twilioClient = hasTwilio ? twilio(TWILIO_ACCOUNT_SID as string, TWILIO_AUTH_TOKEN as string) : null;

function normalizePhoneToWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = String(phone).trim();
  if (!p) return null;
  // Basic normalization: ensure it starts with +; caller must store E.164 ideally
  if (!p.startsWith('+')) {
    // naive: strip non-digits and assume country code missing; refuse to send
    return null;
  }
  return `whatsapp:${p}`;
}

function buildAppointmentText(appointment: any, type: 'confirmation' | 'reminder') {
  const name = appointment?.customer_name || 'Customer';
  const service = appointment?.service_name || 'your service';
  const date = appointment?.appointment_date || '';
  const time = appointment?.appointment_time || '';
  const apptWhen = [date, time].filter(Boolean).join(' ');
  const heading = type === 'confirmation' ? 'Appointment Confirmation' : 'Appointment Reminder';
  const intro = type === 'confirmation'
    ? `Hi ${name}, your appointment has been booked.`
    : `Hi ${name}, this is a reminder for your upcoming appointment.`;
  const body = `${intro}\n\nService: ${service}\nWhen: ${apptWhen}\n\nIf you need to make changes, please contact us.`;
  const subject = `${heading}: ${service} on ${apptWhen}`.slice(0, 120);
  return { subject, text: body };
}

async function fetchAppointment(appointment_id: string) {
  if (!supabase) throw new Error('Supabase client not configured');
  const { data, error } = await supabase.from('appointments').select('*').eq('id', appointment_id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Appointment not found');
  return data;
}

async function markSent(appointment_id: string, fields: Record<string, string | null>) {
  if (!supabase) return;
  const { error } = await supabase
    .from('appointments')
    .update({ ...fields })
    .eq('id', appointment_id);
  if (error) console.warn('Failed to mark appointment notifications sent', error);
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!hasSmtp || !transporter) {
    console.log('[EMAIL Fallback]', { to, subject, text });
    return { ok: true, fallback: true } as const;
  }
  await transporter.sendMail({ from: SMTP_FROM, to, subject, text });
  return { ok: true } as const;
}

async function sendWhatsApp(toPhone: string, text: string) {
  if (!hasTwilio || !twilioClient) {
    console.log('[WHATSAPP Fallback]', { toPhone, text });
    return { ok: true, fallback: true } as const;
  }
  const to = normalizePhoneToWhatsApp(toPhone);
  if (!to) throw new Error('Invalid phone number for WhatsApp (must be E.164 with country code)');
  await twilioClient.messages.create({ from: TWILIO_WHATSAPP_FROM as string, to, body: text });
  return { ok: true } as const;
}

router.post('/appointment/confirmation', async (req, res) => {
  try {
    const { appointment_id } = req.body ?? {};
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });
    const appt = await fetchAppointment(appointment_id);
    const { subject, text } = buildAppointmentText(appt, 'confirmation');

    const results: any = {};
    if (appt.customer_email) {
      try {
        const r = await sendEmail(appt.customer_email, subject, text);
        results.email = r;
        await markSent(appt.id, { confirmation_email_sent_at: new Date().toISOString() });
      } catch (e: any) {
        results.email_error = e?.message || String(e);
      }
    }
    if (appt.customer_phone) {
      try {
        const r = await sendWhatsApp(appt.customer_phone, text);
        results.whatsapp = r;
        await markSent(appt.id, { confirmation_whatsapp_sent_at: new Date().toISOString() });
      } catch (e: any) {
        results.whatsapp_error = e?.message || String(e);
      }
    }

    res.json({ ok: true, results });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

router.post('/appointment/reminder', async (req, res) => {
  try {
    const { appointment_id } = req.body ?? {};
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });
    const appt = await fetchAppointment(appointment_id);
    const { subject, text } = buildAppointmentText(appt, 'reminder');

    const results: any = {};
    if (appt.customer_email) {
      try {
        const r = await sendEmail(appt.customer_email, subject, text);
        results.email = r;
        await markSent(appt.id, { reminder_email_sent_at: new Date().toISOString() });
      } catch (e: any) {
        results.email_error = e?.message || String(e);
      }
    }
    if (appt.customer_phone) {
      try {
        const r = await sendWhatsApp(appt.customer_phone, text);
        results.whatsapp = r;
        await markSent(appt.id, { reminder_whatsapp_sent_at: new Date().toISOString() });
      } catch (e: any) {
        results.whatsapp_error = e?.message || String(e);
      }
    }

    res.json({ ok: true, results });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
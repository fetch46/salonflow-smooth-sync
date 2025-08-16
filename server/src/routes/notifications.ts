import { Router } from 'express';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Supabase service client (server-side)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

if (!supabase) {
	console.warn('[notifications] Supabase not configured; notification endpoints will return errors for data access.');
}

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';
function assertInternal(req: any) {
	if (!INTERNAL_API_TOKEN) return true;
	const provided = req.header('X-Internal-Token') || '';
	return provided && provided === INTERNAL_API_TOKEN;
}

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
  const p = String(phone).trim();
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
    if (!assertInternal(req)) return res.status(403).json({ error: 'Forbidden' });
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
    if (!assertInternal(req)) return res.status(403).json({ error: 'Forbidden' });
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

router.get('/feed', async (req, res) => {
  try {
    if (!supabase) return res.json({ items: [] });
    const orgId = String(req.query.orgId || '') || null;

    const nowIso = new Date().toISOString().slice(0, 10);
    const { data: appts, error: apptErr } = await supabase
      .from('appointments')
      .select('id, customer_name, service_name, appointment_date, appointment_time, created_at, organization_id, status')
      .gte('appointment_date', nowIso)
      .order('appointment_date', { ascending: true })
      .limit(20);
    if (apptErr) throw apptErr;

    const appointmentNotifications = (appts || [])
      .filter((a: any) => (orgId ? a.organization_id === orgId : true))
      .slice(0, 10)
      .map((a: any) => {
        const when = [a.appointment_date, a.appointment_time].filter(Boolean).join(' ');
        return {
          id: `appt:${a.id}`,
          title: a.status === 'confirmed' ? 'Appointment confirmed' : 'Upcoming appointment',
          description: `${a.customer_name || 'Customer'} • ${a.service_name || ''} • ${when}`,
          created_at: a.created_at,
        };
      });

    const { data: lowStock, error: lowErr } = await supabase
      .from('inventory_items')
      .select('id, name, reorder_point, updated_at, organization_id')
      .order('updated_at', { ascending: false })
      .limit(20);
    if (lowErr) {
      // ignore if inventory not present in schema/project
    }

    const lowStockNotifications = ((lowStock || []) as any[])
      .filter((it) => (orgId ? it.organization_id === orgId : true))
      .filter((it) => typeof it.reorder_point === 'number' && it.reorder_point > 0)
      .slice(0, 5)
      .map((it) => ({
        id: `low:${it.id}`,
        title: 'Stock low',
        description: `${it.name} below reorder point`,
        created_at: it.updated_at,
      }));

    const items = [...appointmentNotifications, ...lowStockNotifications]
      .sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      .slice(0, 20);

    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

export default router;
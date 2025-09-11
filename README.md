# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/bb6d0789-2c32-48f5-b56a-11b42b79556c

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/bb6d0789-2c32-48f5-b56a-11b42b79556c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Theming: Light theme and Quick Themes

The app uses CSS variables with Tailwind to drive themes. Key tokens live in `src/index.css` under `:root` (light) and `.dark` (dark).

- Primary tokens: `--primary`, `--primary-foreground`, `--primary-light`
- Surfaces: `--background`, `--card`, `--popover`, `--secondary`, `--accent`
- Text: `--foreground`, `--muted-foreground`
- Borders/rings: `--border`, `--input`, `--ring`
- Sidebar: `--sidebar-*` variables

Quick Themes (Settings → Branding) updates these tokens at runtime:

- Presets set HSL values for primary/secondary/accent and compute a lighter primary for hover/disabled states.
- Selections persist via `localStorage` keys: `theme-primary`, `theme-primary-foreground`, `theme-primary-light`, etc.

To brand your app:

1. Go to Branding → Quick Themes and pick a preset.
2. Optionally fine-tune in the Manual section by overriding sidebar, topbar, footer, tabs tokens.

Developer notes:

- Use semantic classes (e.g., `bg-background`, `text-foreground`, `bg-secondary`) instead of hardcoded colors.
- For primary actions, prefer `btn-theme-primary` or `<Button>` default variant.
- The default theme is light; `next-themes` controls `light/dark/system` via class on `html`.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/bb6d0789-2c32-48f5-b56a-11b42b79556c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Database: Ensuring Primary/Foreign Keys

If you are using Supabase, make sure to apply the full schema and the constraint enforcement migration:

1. In Supabase SQL Editor, run `setup_database.sql` from the repo root. It includes all migrations and the constraint enforcement file.
2. Or expand includes locally and copy the result:

```bash
node scripts/expand-sql-includes.mjs -i setup_database.sql -o dist/setup_database_expanded.sql
```

Then copy the contents of `dist/setup_database_expanded.sql` into the Supabase SQL Editor and run it.

The migration `supabase/migrations/20250822000000_enforce_pks_fks.sql` adds/repairs primary keys, foreign keys, unique constraints, and indexes used by the app for lookups and references.

## Notifications for Appointments (Email + WhatsApp)

The app can send appointment confirmations and reminders via Email (SMTP) and WhatsApp (Twilio) from the backend server.

Configure these environment variables for the server (`/workspace/server`):

- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. `whatsapp:+14155238886`)

Usage:
- From the Appointments page, open the action menu for a booking and choose "Send Confirmation" or "Send Reminder".
- On create, the app automatically triggers a confirmation send.
- A background job runs every 10 minutes to send reminders for appointments in the next 24 hours that haven't been reminded.

Dev setup:
- Start backend: `cd server && npm i && npm run dev`
- Start frontend: from repo root `npm i && npm run dev` (Vite dev server proxies `/api` to `http://localhost:4000`).

Notes:
- If SMTP/Twilio env vars are not set, the server logs the message payload as a fallback (no real send).
- WhatsApp via Twilio may require pre-approved message templates and verified senders. Ensure client phone numbers are E.164 formatted (e.g., `+15551234567`).

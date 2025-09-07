# shadcn UI setup scaffold

This folder contains a generic, framework-agnostic scaffold to add shadcn/ui + Tailwind to this repository. It includes Tailwind/PostCSS config, basic UI components (Button, Input, Card) following shadcn patterns, and small demo pages for Next.js and Vite React. The files are intended to be copied into your app (or used as a reference) and adapted to your framework-specific layout.

Quick steps (manual):

1. Install dependencies (one of the following depending on your project):

- Next.js / Vite / CRA (npm):
  npm install -D tailwindcss postcss autoprefixer
  npm install classnames

2. Initialize Tailwind (optional if you prefer automatic):
  npx tailwindcss init -p

3. Copy the tailwind.config.cjs and postcss.config.cjs from this folder to your project root.

4. Copy styles/globals.css (or src/index.css) into your project and import it in your root (e.g., _app.tsx, index.tsx).

5. Copy the components from shadcn-setup/components/ui into your project's components/ui folder.

6. Optionally use the demo pages in shadcn-setup/demo for a quick visual check. Pick the demo matching your framework:
   - Next.js: copy files under demo/nextjs to your pages/ or app/ folder and open /demo
   - Vite React: copy demo/vite/src/App.tsx into your src and run dev server

7. Run your dev server and verify the demo UI renders.

Notes:
- This scaffold does not run npx shadcn-ui init automatically (cannot run commands in CI from this migration). If you prefer to use the shadcn CLI, run:
  npx shadcn-ui init
  npx shadcn-ui add button input card

- The Tailwind config here aims to be compatible with Next.js, Vite, CRA, and Remix content globs. Adjust the `content` globs if your project uses different folders.

---
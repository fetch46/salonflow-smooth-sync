import { Link } from "react-router-dom";
import { useSaas } from "@/lib/saas";

export default function AppFooter() {
  const { systemSettings } = useSaas();
  const appName = (systemSettings as any)?.app_name || 'AURA OS';
  return (
    <footer className="fixed bottom-0 inset-x-0 z-20 border-t backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs sm:text-sm"
        style={{ backgroundColor: `hsl(var(--footer-bg))`, color: `hsl(var(--footer-foreground))` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium truncate">{appName}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline truncate">Make better business decisions, faster</span>
        </div>
        <nav className="flex items-center gap-4" style={{ color: `hsl(var(--nav-link-color))` }}>
          <Link to="/help" className="hover:text-foreground">Help</Link>
          <Link to="/reports" className="hover:text-foreground">Reports</Link>
          <a
            href="https://status.aura.example.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground hidden sm:inline"
          >
            Status
          </a>
        </nav>
      </div>
    </footer>
  );
}
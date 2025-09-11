import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  iconClassName,
  actions,
  breadcrumbs,
  className,
}) => {
  return (
    <div className={cn("flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 p-6 bg-gradient-to-r from-background via-muted/20 to-background rounded-2xl border border-border/50 shadow-sm", className)}>
      <div className="space-y-3 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              {breadcrumbs.map((bc, idx) => (
                <li key={`${bc.label}-${idx}`} className="flex items-center gap-2">
                  {idx > 0 && <span className="text-muted-foreground/60">•</span>}
                  {bc.href ? (
                    <a href={bc.href} className="hover:text-primary transition-colors duration-200 font-medium">
                      {bc.label}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{bc.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex items-center gap-4 min-w-0">
          {icon && (
            <div className={cn("p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110", iconClassName)}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight truncate text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-base truncate mt-1 font-medium">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex w-full lg:w-auto flex-wrap items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;


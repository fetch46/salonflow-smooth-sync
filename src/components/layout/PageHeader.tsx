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
    <div className={cn("flex flex-col lg:flex-row lg:items-center lg:justify-between gap-responsive-sm", className)}>
      <div className="space-y-responsive-xs min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="text-responsive-xs text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1">
              {breadcrumbs.map((bc, idx) => (
                <li key={`${bc.label}-${idx}`} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-muted-foreground">/</span>}
                  {bc.href ? (
                    <a href={bc.href} className="hover:text-foreground transition-colors">
                      {bc.label}
                    </a>
                  ) : (
                    <span>{bc.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex items-center gap-responsive-sm min-w-0">
          {icon && (
            <div className={cn("p-2 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm", iconClassName)}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-responsive-2xl font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-responsive-sm truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex w-full lg:w-auto flex-wrap items-center gap-responsive-xs">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;


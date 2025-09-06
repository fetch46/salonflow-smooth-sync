import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Calendar,
  Users,
  Scissors,
  Package,
  Receipt,
  DollarSign,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Building,
  ShoppingCart,
  Calculator,
  TrendingUp,
  LayoutDashboard,
  CreditCard,
  Sliders,
  Crown,
  Lock,
  Sparkles,
  User,
  HelpCircle,
  ArrowLeftRight,
  Truck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useFeatureGating, usePermissions } from "@/lib/saas/hooks";
import { useSaas } from "@/lib/saas";
import { useModuleAccess } from "@/hooks/useModuleAccess";

interface MenuSubItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  feature: string;
}

interface MenuItem {
  title: string;
  url?: string;
  icon: React.ComponentType<{ className?: string }>;
  feature: string;
  subItems?: MenuSubItem[];
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    feature: "reports",
  },
  {
    title: "Appointments",
    url: "/appointments",
    icon: Calendar,
    feature: "appointments",
  },
  {
    title: "Sales",
    icon: CreditCard,
    feature: "accounting",
    subItems: [
      {
        title: "Clients",
        url: "/clients",
        icon: Users,
        feature: "clients",
      },

      {
        title: "Invoices",
        url: "/invoices",
        icon: FileText,
        feature: "accounting",
      },
      {
        title: "Payments Received",
        url: "/payments-received",
        icon: DollarSign,
        feature: "accounting",
      },
      {
        title: "Job Cards",
        url: "/job-cards",
        icon: FileText,
        feature: "job_cards",
      },
    ],
  },
    {
    title: "Purchases",
    icon: ShoppingCart,
    feature: "purchases",
    subItems: [
      {
        title: "Suppliers",
        url: "/suppliers",
        icon: Building,
        feature: "suppliers",
      },
      {
        title: "Purchases",
        url: "/purchases",
        icon: ShoppingCart,
        feature: "purchases",
      },
      {
        title: "Goods Received",
        url: "/goods-received",
        icon: Truck,
        feature: "purchases",
      },
      {
        title: "Expenses",
        url: "/expenses",
        icon: Receipt,
        feature: "expenses",
      },
      {
        title: "Payments Made",
        url: "/payments-made",
        icon: CreditCard,
        feature: "expenses",
      },
    ],
  },
  {
    title: "Services",
    url: "/services",
    icon: Scissors,
    feature: "services",
  },
  {
    title: "Inventory",
    icon: Package,
    feature: "inventory",
    subItems: [
      {
        title: "Products",
        url: "/inventory",
        icon: Package,
        feature: "inventory",
      },
      {
        title: "Adjustments",
        url: "/inventory-adjustments",
        icon: Sliders,
        feature: "inventory_adjustments",
      },
      {
        title: "Transfers",
        url: "/inventory-transfers",
        icon: ArrowLeftRight,
        feature: "inventory",
      },
    ],
  },
        {
        title: "Accountant",
        icon: DollarSign,
        feature: "expenses", // section header only; individual items gated below
        subItems: [
          {
            title: "Chart of Accounts",
            url: "/accounts",
            icon: Calculator,
            feature: "accounting",
          },
          {
            title: "Journal",
            url: "/journal",
            icon: FileText,
            feature: "accounting",
          },
          {
            title: "Banking",
            url: "/banking",
            icon: CreditCard,
            feature: "accounting",
          },
        ],
      },
  {
    title: "Reports",
    icon: TrendingUp,
    feature: "reports", // Visibility will be additionally gated by role (accountant/owner)
    subItems: [
      { title: "Overview", url: "/reports?tab=overview", icon: TrendingUp, feature: "reports" },
      { title: "Revenue", url: "/reports?tab=revenue", icon: DollarSign, feature: "reports" },
      { title: "Clients", url: "/reports?tab=clients", icon: Users, feature: "reports" },
      { title: "Expenses", url: "/reports?tab=expenses", icon: Receipt, feature: "reports" },
      { title: "Purchases", url: "/reports?tab=purchases", icon: ShoppingCart, feature: "reports" },
      { title: "P&L", url: "/reports?tab=pnl", icon: Calculator, feature: "reports" },
      { title: "Balance Sheet", url: "/reports?tab=balancesheet", icon: Calculator, feature: "reports" },
      { title: "Trial Balance", url: "/reports?tab=trialbalance", icon: Calculator, feature: "reports" },
      { title: "Commissions", url: "/reports?tab=commissions", icon: DollarSign, feature: "reports" },
      { title: "Product Usage", url: "/reports?tab=product_usage", icon: Package, feature: "reports" },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    feature: "reports",
    subItems: [
      {
        title: "General",
        url: "/settings",
        icon: Settings,
        feature: "reports",
      },
      {
        title: "Users",
        url: "/staff",
        icon: Users,
        feature: "staff",
      },
      {
        title: "Help & Support",
        url: "/help",
        icon: HelpCircle,
        feature: "reports",
      },
    ],
  },
];

// Super Admin menu item (separate from main menu since it's system-wide)
const superAdminMenuItem: MenuItem = {
  title: "Super Admin",
  url: "/admin",
  icon: Crown,
  feature: "system", // This will always be false for regular features, we'll handle it separately
};

export function AppSidebar() {
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const { hasFeature, getFeatureAccess } = useFeatureGating();
  const { userRole: organizationRole } = usePermissions();
  const { subscriptionPlan, isSuperAdmin, systemSettings } = useSaas();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { canAccessModule, isModuleEnabled } = useModuleAccess();

  // Get trial info from system settings
  const isTrialing = systemSettings?.subscription_status === 'trial';
  const daysLeftInTrial = systemSettings?.trial_days_remaining || null;

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus((prev) =>
      prev.includes(title)
        ? []
        : [title]
    );
  };

  const handleNavClick = () => {
    // Close the sheet on mobile after navigation
    if (isMobile) setOpenMobile(false);
  };

  const getUsageBadge = (_feature: string) => null;

  const getIconColorForTitle = (title: string) => {
    switch (title) {
      case 'Dashboard': return 'text-blue-600';
      case 'Appointments': return 'text-amber-600';
      case 'Sales': return 'text-rose-600';
      case 'Clients': return 'text-cyan-600';
      case 'Invoices': return 'text-amber-600';
      case 'Payments Received': return 'text-emerald-600';
      case 'Payments Made': return 'text-red-600';
      case 'Job Cards': return 'text-indigo-600';
      case 'Purchases': return 'text-orange-600';
      case 'Suppliers': return 'text-sky-600';
      case 'Goods Received': return 'text-lime-600';
      case 'Expenses': return 'text-rose-600';
      case 'Services': return 'text-pink-600';
      case 'Inventory': return 'text-yellow-600';
      case 'Products': return 'text-yellow-600';
      case 'Adjustments': return 'text-purple-600';
      case 'Transfers': return 'text-cyan-600';
      case 'Accountant': return 'text-emerald-600';
      case 'Chart of Accounts': return 'text-fuchsia-600';
      case 'Journal': return 'text-indigo-600';
      case 'Banking': return 'text-blue-600';
      case 'Reports': return 'text-sky-600';
      case 'Overview': return 'text-sky-600';
      case 'Revenue': return 'text-emerald-600';
      case 'P&L': return 'text-amber-600';
      case 'Balance Sheet': return 'text-amber-700';
      case 'Trial Balance': return 'text-amber-700';
      case 'Commissions': return 'text-emerald-700';
      case 'Product Usage': return 'text-yellow-600';
      case 'Settings': return 'text-slate-600';
      case 'General': return 'text-slate-600';
      case 'Regional': return 'text-purple-600';
      case 'Profile': return 'text-rose-600';
      case 'Users': return 'text-indigo-600';
      case 'Help & Support': return 'text-cyan-600';
      case 'Super Admin': return 'text-amber-700';
      case 'Landing CMS': return 'text-fuchsia-600';
      default: return 'text-slate-600';
    }
  };

  const isMenuItemAvailable = (item: MenuItem) => {
    // Map menu items to module IDs
    const moduleMap: Record<string, string> = {
      'Appointments': 'appointments',
      'Sales': 'sales',
      'Purchases': 'purchases',
      'Services': 'services',
      'Inventory': 'inventory',
      'Accountant': 'accountant'
    };

    const moduleId = moduleMap[item.title];
    
    // If it's a module-based item, check module access
    if (moduleId) {
      return canAccessModule(moduleId);
    }

    // Special cases for non-module items
    if (item.title === 'Dashboard' || item.title === 'Settings') {
      return true;
    }

    if (item.title === 'Reports') {
      // Reports are part of accountant module
      return canAccessModule('accountant');
    }

    // Default permission check for other items
    if (item.subItems) {
      return item.subItems.some(subItem => {
        const subModuleId = moduleMap[subItem.title];
        return subModuleId ? canAccessModule(subModuleId) : hasFeature(subItem.feature);
      });
    }
    
    return hasFeature(item.feature);
  };

  useEffect(() => {
    // Keep the parent of the active route expanded
    const searchParams = new URLSearchParams(location.search);
    const currentReportsTab = searchParams.get('tab') || 'overview';
    const activeParent = menuItems.find((item) =>
      item.subItems?.some((subItem) => {
        if (item.title === 'Reports') {
          return (
            location.pathname === '/reports' &&
            subItem.url.includes(`tab=${currentReportsTab}`)
          );
        }
        return location.pathname === subItem.url;
      })
    );

    if (activeParent) {
      setOpenSubmenus([activeParent.title]);
    }
  }, [location.pathname, location.search]);

  return (
    <Sidebar role="navigation" aria-label="Primary" variant="inset" collapsible="icon" className="border-r border-sidebar-border bg-sidebar-background min-w-[240px] max-w-[240px] data-[collapsible=icon]:min-w-[52px] data-[collapsible=icon]:max-w-[52px]">
      <SidebarContent className="px-0">
        <SidebarHeader className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-accent flex-shrink-0" />
              <span className="font-medium text-responsive-sm group-data-[collapsible=icon]:hidden text-sidebar-foreground truncate">SalonFlow</span>
            </div>
            <SidebarTrigger className="h-6 w-6 hidden md:inline-flex" />
          </div>
        </SidebarHeader>
        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="flex items-center justify-between px-1 py-1 text-responsive-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide">
            <span>Navigation</span>
            {(isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 7) && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200">
                <Crown className="w-2 h-2 mr-0.5" />
                {daysLeftInTrial}d
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {menuItems.map((item) => {
                const isAvailable = isMenuItemAvailable(item);
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isOpen = openSubmenus.includes(item.title);
                const usageBadge = getUsageBadge(item.feature);

                if (hasSubItems) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => toggleSubmenu(item.title)}
                        aria-expanded={isOpen}
                        aria-controls={`submenu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        aria-disabled={!isAvailable || undefined}
                        className={`h-9 text-responsive-base font-medium px-3 hover:bg-sidebar-accent/50 data-[active=true]:bg-sidebar-accent ${!isAvailable ? 'opacity-50' : ''}`}
                        tooltip={state === 'collapsed' ? item.title : undefined}
                      >
                        <item.icon className="icon-responsive-md flex-shrink-0 text-sidebar-primary/70" />
                        <span className="flex-1 text-left truncate">{item.title}</span>
                        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden flex-shrink-0">
                          {!isAvailable && <Lock className="w-3 h-3 text-sidebar-primary/40" />}
                          {isOpen ? (
                            <ChevronDown className="w-3 h-3 text-sidebar-primary/60" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-sidebar-primary/60" />
                          )}
                        </div>
                      </SidebarMenuButton>
                      {isOpen && (
                        <SidebarMenuSub id={`submenu-${item.title.toLowerCase().replace(/\s+/g, '-')}`} className="gap-0.5 ml-2 pl-2 border-l border-sidebar-border/50">
                          {item.subItems?.map((subItem) => {
                            // Owner and Admin roles have access to all sub-items
                            const subItemAvailable = ['owner', 'admin'].includes(organizationRole || '') || hasFeature(subItem.feature);
                            const subItemUsageBadge = getUsageBadge(subItem.feature);
                            
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton 
                                  asChild
                                  className={`h-8 text-responsive-sm px-3 hover:bg-sidebar-accent/30 ${!subItemAvailable ? 'opacity-50 pointer-events-none' : ''}`}
                                  isActive={(item.title === 'Reports') ? (location.pathname === '/reports' && subItem.url.includes(`tab=${new URLSearchParams(location.search).get('tab') || 'overview'}`)) : (location.pathname === subItem.url)}
                                >
                                  <NavLink
                                    to={subItem.url}
                                    className={({ isActive }) =>
                                      `flex items-center gap-2 w-full ${
                                        isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/80"
                                      }`
                                    }
                                    onClick={handleNavClick}
                                  >
                                    <subItem.icon className="icon-responsive-sm flex-shrink-0 text-sidebar-primary/60" />
                                    <span className="flex-1 text-left truncate">{subItem.title}</span>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {!subItemAvailable && <Lock className="w-2.5 h-2.5 text-sidebar-primary/40" />}
                                    </div>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                     <SidebarMenuButton 
                       asChild
                       className={`h-9 text-responsive-base font-medium px-3 hover:bg-sidebar-accent/50 ${(!isAvailable && item.title !== 'Services') ? 'opacity-50 pointer-events-none' : ''}`}
                                   tooltip={state === 'collapsed' ? item.title : undefined}
                                   isActive={location.pathname === item.url}
                                 >
                      <NavLink
                        to={item.url!}
                        className={({ isActive }) =>
                          `flex items-center gap-2 w-full ${
                            isActive ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground"
                          }`
                        }
                        onClick={handleNavClick}
                      >
                        <item.icon className="icon-responsive-md flex-shrink-0 text-sidebar-primary/70" />
                        <span className="flex-1 text-left truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup className="px-2 py-1">
            <SidebarGroupLabel className="px-1 py-1 text-responsive-xs font-medium text-accent/80 uppercase tracking-wide">System Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === superAdminMenuItem.url}
                    className="h-9 text-responsive-base font-medium px-3 hover:bg-accent/30 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                    tooltip={state === 'collapsed' ? superAdminMenuItem.title : undefined}
                  >
                    <NavLink to={superAdminMenuItem.url} className={({ isActive }) => `flex items-center gap-2 w-full ${isActive ? 'text-accent-foreground' : 'text-sidebar-foreground'}`} onClick={handleNavClick}>
                      <superAdminMenuItem.icon className="icon-responsive-md flex-shrink-0 text-accent/70" />
                      <span className="flex-1 text-left truncate">{superAdminMenuItem.title}</span>
                      <Badge 
                        variant="outline" 
                        className="h-4 px-1 text-[10px] bg-accent/10 text-accent border-accent/20 flex-shrink-0"
                      >
                        <Crown className="w-2 h-2 mr-0.5" />
                        Admin
                      </Badge>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/admin/cms'}
                    className="h-9 text-responsive-base font-medium px-3 hover:bg-accent/30 data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                    tooltip={state === 'collapsed' ? 'Landing CMS' : undefined}
                  >
                    <NavLink to="/admin/cms" className={({ isActive }) => `flex items-center gap-2 w-full ${isActive ? 'text-accent-foreground' : 'text-sidebar-foreground'}`} onClick={handleNavClick}>
                      <Sparkles className="icon-responsive-md flex-shrink-0 text-accent/70" />
                      <span className="flex-1 text-left truncate">Landing CMS</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="px-2 py-1 mt-auto">
          <SidebarGroupLabel className="px-1 py-1 text-responsive-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide">Subscription</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-1 py-2 space-y-1.5">
              {subscriptionPlan && (
                <div className="flex items-center justify-between">
                  <span className="text-responsive-xs text-sidebar-foreground/70">Plan</span>
                  <Badge 
                    className={`text-[10px] h-4 px-1 ${
                      subscriptionPlan.slug === 'enterprise' 
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : subscriptionPlan.slug === 'professional'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}
                  >
                    {subscriptionPlan.name}
                  </Badge>
                </div>
              )}
              
              {isTrialing && daysLeftInTrial !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-responsive-xs text-sidebar-foreground/70">Trial</span>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] h-4 px-1 ${
                      daysLeftInTrial <= 3 
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-warning/10 text-warning border-warning/20'
                    }`}
                  >
                    {daysLeftInTrial}d left
                  </Badge>
                </div>
              )}

              {/* Quick usage overview */}
              <div className="space-y-1 pt-1.5 border-t border-sidebar-border/50">
                {['clients', 'staff', 'services'].map((feature) => {
                  const access = getFeatureAccess(feature);
                  if (!access.enabled || access.unlimited) return null;
                  
                  const percentage = access.limit ? (access.usage! / access.limit) * 100 : 0;
                  const isNearLimit = percentage >= 80;
                  
                  if (isNearLimit) {
                    return (
                      <div key={feature} className="flex items-center justify-between text-[10px]">
                        <span className="text-sidebar-foreground/60 capitalize">{feature}</span>
                        <span className={`${percentage >= 100 ? 'text-destructive' : 'text-warning'}`}>
                          {access.usage}/{access.limit}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="p-2 border-t border-sidebar-border/50">
          <div className="text-[10px] text-sidebar-foreground/50 px-1">v1.0.0</div>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}


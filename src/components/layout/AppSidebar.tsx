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
  Wrench,
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
  Palette,
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
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
        title: "Job Cards",
        url: "/job-cards",
        icon: Scissors,
        feature: "job_cards",
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
    ],
  },
  {
    title: "Purchasing",
    icon: ShoppingCart,
    feature: "purchases",
    subItems: [
      {
        title: "Purchases",
        url: "/purchases",
        icon: ShoppingCart,
        feature: "purchases",
      },
      {
        title: "Suppliers",
        url: "/suppliers",
        icon: Building,
        feature: "purchases",
      },
      {
        title: "Payments Made",
        url: "/payments-made",
        icon: ArrowLeftRight,
        feature: "accounting",
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
        feature: "accounting",
      },
    ],
  },
  {
    title: "Services",
    url: "/services",
    icon: Sparkles,
    feature: "services",
  },
  {
    title: "Inventory",
    icon: Package,
    feature: "inventory",
    subItems: [
      {
        title: "Items",
        url: "/inventory",
        icon: Package,
        feature: "inventory",
      },
      {
        title: "Adjustments",
        url: "/inventory-adjustments",
        icon: Sliders,
        feature: "inventory",
      },
      {
        title: "Transfers",
        url: "/inventory-transfers",
        icon: ArrowLeftRight,
        feature: "inventory",
      },
      {
        title: "Warehouses",
        url: "/warehouses",
        icon: Building,
        feature: "inventory",
      },
    ],
  },
  {
    title: "Accounting",
    icon: Calculator,
    feature: "accounting",
    subItems: [
      {
        title: "Chart of Accounts",
        url: "/accounts",
        icon: FileText,
        feature: "accounting",
      },
      {
        title: "Banking",
        url: "/banking",
        icon: CreditCard,
        feature: "accounting",
      },
      {
        title: "Journal",
        url: "/journal",
        icon: FileText,
        feature: "accounting",
      },
    ],
  },
  {
    title: "Reports",
    icon: TrendingUp,
    feature: "reports",
    subItems: [
      {
        title: "Financial Reports",
        url: "/reports",
        icon: TrendingUp,
        feature: "reports",
      },
      {
        title: "Profit and Loss",
        url: "/reports?type=profit-loss",
        icon: Calculator,
        feature: "reports",
      },
      {
        title: "Balance Sheet",
        url: "/reports?type=balance-sheet",
        icon: FileText,
        feature: "reports",
      },
      {
        title: "Expense Report",
        url: "/reports?type=expenses",
        icon: CreditCard,
        feature: "reports",
      },
      {
        title: "Sales Reports",
        url: "/reports?type=sales",
        icon: DollarSign,
        feature: "reports",
      },
      {
        title: "Inventory Reports",
        url: "/reports?type=inventory",
        icon: Package,
        feature: "reports",
      },
      {
        title: "Customer Reports",
        url: "/reports?type=customers",
        icon: Users,
        feature: "reports",
      },
      {
        title: "Payments Report",
        url: "/payments",
        icon: DollarSign,
        feature: "reports",
      },
    ],
  },
  {
    title: "Settings",
    icon: Settings,
    feature: "settings",
    subItems: [
      {
        title: "General Settings",
        url: "/settings",
        icon: Settings,
        feature: "settings",
      },
      {
        title: "Staff",
        url: "/staff",
        icon: User,
        feature: "staff",
      },
      {
        title: "Modules",
        url: "/settings/modules",
        icon: Wrench,
        feature: "settings",
      },
      {
        title: "Branding",
        url: "/settings/branding",
        icon: Palette,
        feature: "settings",
      },
    ],
  },
  {
    title: "Help",
    url: "/help",
    icon: HelpCircle,
    feature: "help",
  },
];

const superAdminMenuItem: MenuItem = {
  title: "Super Admin",
  url: "/admin",
  icon: Crown,
  feature: "system",
};

export function AppSidebar() {
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  
  const { hasFeature } = useFeatureGating();
  const { userRole: organizationRole } = usePermissions();
  const { subscriptionPlan, isSuperAdmin, systemSettings } = useSaas();
  const { canAccessModule, isModuleEnabled } = useModuleAccess();

  const isTrialing = systemSettings?.subscription_status === 'trial';
  const daysLeftInTrial = systemSettings?.trial_days_remaining || null;

  // Auto-expand parent menu if current page is a submenu item
  useEffect(() => {
    const activeParent = getActiveParentItem();
    if (activeParent) {
      setExpandedItem(activeParent.title);
    }
  }, [location.pathname]);

  const isMenuItemAvailable = (item: MenuItem) => {
    if (['owner', 'admin'].includes(organizationRole || '')) return true;
    if (item.feature === 'system') return false;
    if (item.feature === 'services') return true;
    return hasFeature(item.feature) && canAccessModule(item.feature) && isModuleEnabled(item.feature);
  };

  const handleNavClick = () => {
    setHoveredItem(null);
  };

  const handleItemClick = (itemTitle: string, hasSubItems: boolean) => {
    if (hasSubItems) {
      setExpandedItem(expandedItem === itemTitle ? null : itemTitle);
    }
  };

  

  

  

  

  const getActiveParentItem = () => {
    return menuItems.find(item => 
      item.subItems?.some(subItem => 
        location.pathname === subItem.url || 
        (subItem.url === '/' && location.pathname === '/')
      )
    );
  };

  const isItemActive = (item: MenuItem) => {
    if (item.url) {
      return location.pathname === item.url || (item.url === '/' && location.pathname === '/');
    }
    return getActiveParentItem()?.title === item.title;
  };

  const isSubItemActive = (subItem: MenuSubItem) => {
    return location.pathname === subItem.url || (subItem.url === '/' && location.pathname === '/');
  };

  // Collapse disabled

  return (
    <Sidebar 
      role="navigation" 
      aria-label="Primary" 
      collapsible="none" 
      className={cn(
        "border-r border-sidebar-border bg-sidebar-background",
        "min-w-[260px] max-w-[260px]",
        "shadow-lg"
      )}
    >
      <SidebarContent className="px-0">
        <SidebarHeader className="px-4 py-4 border-b border-sidebar-border bg-gradient-to-r from-sidebar-background to-sidebar-accent/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 border border-primary/20 flex-shrink-0 shadow-md flex items-center justify-center">
                <div className="w-4 h-4 bg-white/90 rounded-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-sidebar-foreground">Your App</span>
                <span className="text-xs text-sidebar-foreground/60">Dashboard</span>
              </div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarGroup className="px-2 py-2">
          <SidebarGroupLabel className="flex items-center justify-between px-2 py-2 text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide">
            <span>Navigation</span>
            {isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 7 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200">
                <Crown className="w-2 h-2 mr-0.5" />
                {daysLeftInTrial}d
              </Badge>
            )}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {menuItems.map((item) => {
                const isAvailable = isMenuItemAvailable(item);
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isActive = isItemActive(item);
                const showExpandedSubmenu = hasSubItems && (expandedItem === item.title || isActive);

                return (
                  <div 
                    key={item.title} 
                    className="relative"
                    data-menu-item={item.title}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild={!!item.url}
                        onClick={() => handleItemClick(item.title, hasSubItems)}
                        className={cn(
                          "h-11 text-sm font-medium px-4 mx-2 rounded-xl transition-all duration-300 text-sidebar-foreground",
                          "hover:bg-sidebar-accent hover:scale-[1.02] hover:shadow-sm hover:translate-x-1",
                          isActive && "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md scale-[1.02]",
                          !isAvailable && "opacity-50 pointer-events-none",
                          hasSubItems && "cursor-pointer"
                        )}
                      >
                        {item.url ? (
                          <NavLink 
                            to={item.url} 
                            onClick={handleNavClick}
                            className="flex items-center gap-3 w-full text-current font-medium"
                          >
                            <item.icon className={cn(
                              "h-5 w-5 flex-shrink-0 transition-colors",
                              isActive ? "text-current" : "text-sidebar-foreground/70"
                            )} />
                            <span className="flex-1 text-left truncate animate-fade-in">
                              {item.title}
                            </span>
                          </NavLink>
                        ) : (
                          <div className="flex items-center gap-3 w-full text-current font-medium">
                            <item.icon className="h-5 w-5 flex-shrink-0 text-current opacity-70" />
                            <span className="flex-1 text-left truncate animate-fade-in">
                              {item.title}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!isAvailable && <Lock className="w-3 h-3 text-current opacity-40" />}
                              <ChevronDown className={cn(
                                "w-3 h-3 text-current opacity-60 transition-transform duration-300",
                                showExpandedSubmenu && "rotate-180"
                              )} />
                            </div>
                          </div>
                        )}
                      </SidebarMenuButton>

                      {/* Submenu for expanded state */}
                      {showExpandedSubmenu && (
                        <div className="ml-6 mt-2 space-y-1 animate-fade-in border-l-2 border-sidebar-border/30 pl-4">
                          {item.subItems?.map((subItem) => {
                            const subItemAvailable = ['owner', 'admin'].includes(organizationRole || '') || hasFeature(subItem.feature);
                            const subItemActive = isSubItemActive(subItem);
                            
                            return (
                              <SidebarMenuButton
                                key={subItem.title}
                                asChild
                                className={cn(
                                  "h-9 text-sm px-3 rounded-lg transition-all duration-300 text-sidebar-foreground",
                                  "hover:bg-sidebar-accent/50 hover:translate-x-1 hover:shadow-sm",
                                  subItemActive && "bg-primary/10 text-primary font-medium border border-primary/20",
                                  !subItemAvailable && "opacity-50 pointer-events-none"
                                )}
                              >
                                <NavLink 
                                  to={subItem.url} 
                                  onClick={handleNavClick}
                                  className="flex items-center gap-3 w-full text-current font-medium"
                                >
                                  <subItem.icon className={cn(
                                    "h-4 w-4 flex-shrink-0",
                                    subItemActive ? "text-current" : "text-sidebar-foreground/60"
                                  )} />
                                  <span className="truncate">{subItem.title}</span>
                                  {!subItemAvailable && <Lock className="w-2.5 h-2.5 text-current opacity-40" />}
                                </NavLink>
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>
                  </div>
                );
              })}

              {/* Super Admin Section */}
              {isSuperAdmin && (
                <div className="mt-6 pt-4 mx-2 border-t border-sidebar-border/50">
                  <SidebarGroupLabel className="px-2 py-2 text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-2">
                    <Crown className="w-3 h-3" />
                    System Admin
                  </SidebarGroupLabel>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "h-11 text-sm font-medium px-4 rounded-xl transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-amber-50 hover:to-amber-100 hover:text-amber-700 hover:scale-[1.02] hover:shadow-sm",
                        location.pathname.startsWith("/admin") && "bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 shadow-md scale-[1.02]"
                      )}
                    >
                      <NavLink 
                        to={superAdminMenuItem.url} 
                        onClick={handleNavClick}
                        className="flex items-center gap-3 w-full text-current"
                      >
                        <Crown className="h-5 w-5 flex-shrink-0 text-amber-600" />
                        <span className="flex-1 text-left truncate animate-fade-in font-medium">
                          {superAdminMenuItem.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border bg-gradient-to-r from-sidebar-background to-sidebar-accent/20">
        <div className="space-y-3">
          {subscriptionPlan && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/30">
              <span className="text-xs font-medium text-sidebar-foreground/70">Current Plan</span>
              <Badge variant="outline" className="text-[10px] font-semibold border-primary/20 text-primary">
                {subscriptionPlan.name}
              </Badge>
            </div>
          )}
          {isTrialing && daysLeftInTrial !== null && (
            <div className="text-xs text-amber-700 bg-gradient-to-r from-amber-50 to-amber-100 px-3 py-2 rounded-lg border border-amber-200 shadow-sm">
              <div className="flex items-center gap-2">
                <Crown className="w-3 h-3" />
                <span className="font-medium">Trial: {daysLeftInTrial} days left</span>
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
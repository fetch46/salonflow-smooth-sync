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
  Menu,
  X,
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
  SidebarTrigger,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        title: "Payments Made",
        url: "/payments-made",
        icon: ArrowLeftRight,
        feature: "accounting",
      },
      {
        title: "Job Cards",
        url: "/job-cards",
        icon: Scissors,
        feature: "job_cards",
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
        url: "/stock-transfers",
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
    title: "Staff",
    url: "/staff",
    icon: User,
    feature: "staff",
  },
  {
    title: "Reports",
    url: "/reports",
    icon: TrendingUp,
    feature: "reports",
  },
  {
    title: "Accounting",
    url: "/banking",
    icon: Calculator,
    feature: "accounting",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    feature: "settings",
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
  const [submenuTimeout, setSubmenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const { hasFeature } = useFeatureGating();
  const { userRole: organizationRole } = usePermissions();
  const { subscriptionPlan, isSuperAdmin, systemSettings } = useSaas();
  const { state, isMobile, setOpenMobile, open, setOpen } = useSidebar();
  const { canAccessModule, isModuleEnabled } = useModuleAccess();

  const isTrialing = systemSettings?.subscription_status === 'trial';
  const daysLeftInTrial = systemSettings?.trial_days_remaining || null;
  const isCollapsed = state === 'collapsed';

  const isMenuItemAvailable = (item: MenuItem) => {
    if (['owner', 'admin'].includes(organizationRole || '')) return true;
    if (item.feature === 'system') return false;
    if (item.feature === 'services') return true;
    return hasFeature(item.feature) && canAccessModule(item.feature) && isModuleEnabled(item.feature);
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleMouseEnter = (itemTitle: string) => {
    if (submenuTimeout) clearTimeout(submenuTimeout);
    setHoveredItem(itemTitle);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setHoveredItem(null);
    }, 100);
    setSubmenuTimeout(timeout);
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

  // Custom toggle button component
  const CustomSidebarToggle = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setOpen(!open)}
      className="h-8 w-8 p-0 hover:bg-sidebar-accent/50 transition-colors"
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
    >
      {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
    </Button>
  );

  return (
    <Sidebar 
      role="navigation" 
      aria-label="Primary" 
      variant="inset" 
      collapsible="icon" 
      className={cn(
        "border-r border-sidebar-border bg-sidebar-background transition-all duration-300 ease-in-out",
        "min-w-[240px] max-w-[240px]",
        "data-[collapsible=icon]:min-w-[60px] data-[collapsible=icon]:max-w-[60px]",
        "shadow-sm"
      )}
    >
      <SidebarContent className="px-0">
        <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex-shrink-0 shadow-sm" />
              {!isCollapsed && (
                <span className="font-semibold text-sm text-sidebar-foreground truncate animate-fade-in">
                  SalonFlow
                </span>
              )}
            </div>
            <CustomSidebarToggle />
          </div>
        </SidebarHeader>

        <SidebarGroup className="px-2 py-2">
          <SidebarGroupLabel className="flex items-center justify-between px-2 py-2 text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wide">
            {!isCollapsed && <span>Navigation</span>}
            {!isCollapsed && isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 7 && (
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
                const showSubmenu = hasSubItems && (hoveredItem === item.title || isActive) && isCollapsed;

                return (
                  <div 
                    key={item.title} 
                    className="relative"
                    onMouseEnter={() => hasSubItems && isCollapsed && handleMouseEnter(item.title)}
                    onMouseLeave={() => hasSubItems && isCollapsed && handleMouseLeave()}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild={!!item.url}
                        className={cn(
                          "h-10 text-sm font-medium px-3 transition-all duration-200",
                          "hover:bg-sidebar-accent/60 hover:scale-[1.02]",
                          isActive && "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
                          !isAvailable && "opacity-50 pointer-events-none"
                        )}
                        tooltip={isCollapsed ? item.title : undefined}
                      >
                        {item.url ? (
                          <NavLink 
                            to={item.url} 
                            onClick={handleNavClick}
                            className="flex items-center gap-3 w-full"
                          >
                            <item.icon className={cn(
                              "h-5 w-5 flex-shrink-0 transition-colors",
                              isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
                            )} />
                            {!isCollapsed && (
                              <span className="flex-1 text-left truncate animate-fade-in">
                                {item.title}
                              </span>
                            )}
                          </NavLink>
                        ) : (
                          <div className="flex items-center gap-3 w-full">
                            <item.icon className="h-5 w-5 flex-shrink-0 text-sidebar-foreground/70" />
                            {!isCollapsed && (
                              <>
                                <span className="flex-1 text-left truncate animate-fade-in">
                                  {item.title}
                                </span>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!isAvailable && <Lock className="w-3 h-3 text-sidebar-foreground/40" />}
                                  <ChevronRight className="w-3 h-3 text-sidebar-foreground/60" />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>

                      {/* Submenu for non-collapsed state */}
                      {!isCollapsed && hasSubItems && isActive && (
                        <div className="ml-4 mt-1 space-y-1 animate-fade-in">
                          {item.subItems?.map((subItem) => {
                            const subItemAvailable = ['owner', 'admin'].includes(organizationRole || '') || hasFeature(subItem.feature);
                            const subItemActive = isSubItemActive(subItem);
                            
                            return (
                              <SidebarMenuButton
                                key={subItem.title}
                                asChild
                                className={cn(
                                  "h-8 text-xs px-3 ml-2 transition-all duration-200",
                                  "hover:bg-sidebar-accent/40 hover:translate-x-1",
                                  subItemActive && "bg-sidebar-accent/60 text-sidebar-accent-foreground",
                                  !subItemAvailable && "opacity-50 pointer-events-none"
                                )}
                              >
                                <NavLink 
                                  to={subItem.url} 
                                  onClick={handleNavClick}
                                  className="flex items-center gap-2 w-full"
                                >
                                  <subItem.icon className={cn(
                                    "h-4 w-4 flex-shrink-0",
                                    subItemActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60"
                                  )} />
                                  <span className="truncate">{subItem.title}</span>
                                  {!subItemAvailable && <Lock className="w-2.5 h-2.5 text-sidebar-foreground/40" />}
                                </NavLink>
                              </SidebarMenuButton>
                            );
                          })}
                        </div>
                      )}
                    </SidebarMenuItem>

                    {/* Popout submenu for collapsed state */}
                    {showSubmenu && (
                      <div 
                        className={cn(
                          "absolute left-full top-0 ml-2 z-50 animate-scale-in",
                          "bg-popover border border-border rounded-lg shadow-lg",
                          "min-w-[200px] p-2"
                        )}
                        onMouseEnter={() => handleMouseEnter(item.title)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <div className="text-xs font-semibold text-foreground/70 px-2 py-1 border-b border-border/50 mb-2">
                          {item.title}
                        </div>
                        <div className="space-y-1">
                          {item.subItems?.map((subItem) => {
                            const subItemAvailable = ['owner', 'admin'].includes(organizationRole || '') || hasFeature(subItem.feature);
                            const subItemActive = isSubItemActive(subItem);
                            
                            return (
                              <NavLink
                                key={subItem.title}
                                to={subItem.url}
                                onClick={handleNavClick}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-all duration-200",
                                  "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02]",
                                  subItemActive && "bg-accent text-accent-foreground",
                                  !subItemAvailable && "opacity-50 pointer-events-none"
                                )}
                              >
                                <subItem.icon className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate">{subItem.title}</span>
                                {!subItemAvailable && <Lock className="w-3 h-3 text-muted-foreground" />}
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Super Admin Section */}
              {isSuperAdmin && (
                <div className="mt-4 pt-4 border-t border-sidebar-border/50">
                  {!isCollapsed && (
                    <SidebarGroupLabel className="px-2 py-1 text-xs font-medium text-amber-600/80 uppercase tracking-wide">
                      System Admin
                    </SidebarGroupLabel>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "h-10 text-sm font-medium px-3 transition-all duration-200",
                        "hover:bg-amber-50 hover:text-amber-700 hover:scale-[1.02]",
                        location.pathname.startsWith("/admin") && "bg-amber-100 text-amber-800"
                      )}
                      tooltip={isCollapsed ? superAdminMenuItem.title : undefined}
                    >
                      <NavLink 
                        to={superAdminMenuItem.url} 
                        onClick={handleNavClick}
                        className="flex items-center gap-3 w-full"
                      >
                        <Crown className="h-5 w-5 flex-shrink-0 text-amber-600" />
                        {!isCollapsed && (
                          <span className="flex-1 text-left truncate animate-fade-in">
                            {superAdminMenuItem.title}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!isCollapsed ? (
          <div className="space-y-2">
            {subscriptionPlan && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-sidebar-foreground/60">Plan:</span>
                <Badge variant="outline" className="text-[10px]">
                  {subscriptionPlan.name}
                </Badge>
              </div>
            )}
            {isTrialing && daysLeftInTrial !== null && (
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                <Crown className="w-3 h-3 inline mr-1" />
                Trial: {daysLeftInTrial} days left
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            {isTrialing && (
              <Badge variant="outline" className="w-8 h-8 p-0 rounded-full bg-amber-50 border-amber-200">
                <Crown className="w-3 h-3 text-amber-600" />
              </Badge>
            )}
          </div>
        )}
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
}
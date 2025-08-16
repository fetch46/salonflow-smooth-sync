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
import { useFeatureGating } from "@/hooks/useFeatureGating";
import { useSaas } from "@/lib/saas";

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
    icon: TrendingUp,
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
        title: "Payments",
        url: "/payments",
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
        feature: "expenses",
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
    feature: "reports",
    subItems: [
      { title: "Overview", url: "/reports?tab=overview", icon: TrendingUp, feature: "reports" },
      { title: "Revenue", url: "/reports?tab=revenue", icon: DollarSign, feature: "reports" },
      { title: "Services", url: "/reports?tab=services", icon: Scissors, feature: "reports" },
      { title: "Clients", url: "/reports?tab=clients", icon: Users, feature: "reports" },
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
        title: "Regional",
        url: "/settings?tab=regional",
        icon: Sliders,
        feature: "reports",
      },
      {
        title: "Profile",
        url: "/profile",
        icon: User,
        feature: "reports",
      },
      {
        title: "Staff",
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
  url: "/super-admin",
  icon: Crown,
  feature: "system", // This will always be false for regular features, we'll handle it separately
};

export function AppSidebar() {
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const { hasFeature, getFeatureAccess, usageData } = useFeatureGating();
  const { subscriptionPlan, isTrialing, daysLeftInTrial, isSuperAdmin } = useSaas();
  const { state, isMobile, setOpenMobile } = useSidebar();

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

  const isMenuItemAvailable = (item: MenuItem) => {
    if (item.title === 'Services') {
      return true;
    }
    if (item.subItems) {
      return item.subItems.some(subItem => hasFeature(subItem.feature));
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
    <Sidebar role="navigation" aria-label="Primary" variant="inset" collapsible="icon" className="border-r max-w-[260px] md:max-w-[280px]">
      <SidebarContent>
        <SidebarHeader className="px-2 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-blue-500 to-violet-600" />
              <span className="font-semibold group-data-[collapsible=icon]:hidden text-sidebar-foreground">SalonFlow</span>
            </div>
            <SidebarTrigger className="hidden md:inline-flex" />
          </div>
        </SidebarHeader>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Menu</span>
            {(isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 7) && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <Crown className="w-2 h-2 mr-1" />
                {daysLeftInTrial}d trial
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
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
                        className={`text-base ${!isAvailable ? 'opacity-50' : ''}`}
                        tooltip={state === 'collapsed' ? item.title : undefined}
                        size="lg"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="flex-1">{item.title}</span>
                        <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
                          {!isAvailable && <Lock className="w-3 h-3 text-slate-400" />}
                          {isOpen ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                      </SidebarMenuButton>
                      {isOpen && (
                        <SidebarMenuSub id={`submenu-${item.title.toLowerCase().replace(/\s+/g, '-')}`} className="gap-2">
                          {item.subItems?.map((subItem) => {
                            const subItemAvailable = hasFeature(subItem.feature);
                            const subItemUsageBadge = getUsageBadge(subItem.feature);
                            
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton 
                                  asChild
                                  className={`h-9 text-[15px] ${!subItemAvailable ? 'opacity-50 pointer-events-none' : ''}`}
                                  isActive={(item.title === 'Reports') ? (location.pathname === '/reports' && subItem.url.includes(`tab=${new URLSearchParams(location.search).get('tab') || 'overview'}`)) : (location.pathname === subItem.url)}
                                >
                                  <NavLink
                                    to={subItem.url}
                                    className={({ isActive }) =>
                                      `flex items-center gap-2 ${
                                        isActive ? "bg-accent text-accent-foreground" : ""
                                      }`
                                    }
                                    onClick={handleNavClick}
                                  >
                                    <subItem.icon className="w-5 h-5" />
                                    <span className="flex-1">{subItem.title}</span>
                                    <div className="flex items-center gap-1">
                                      {!subItemAvailable && <Lock className="w-3 h-3 text-slate-400" />}
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
                                                         className={`text-base ${(!isAvailable && item.title !== 'Services') ? 'opacity-50 pointer-events-none' : ''}`}
                                   tooltip={state === 'collapsed' ? item.title : undefined}
                                   isActive={location.pathname === item.url}
                                   size="lg"
                                 >
                      <NavLink
                        to={item.url!}
                        className={({ isActive }) =>
                          `flex items-center gap-2 ${
                            isActive ? "bg-accent text-accent-foreground" : ""
                          }`
                        }
                        onClick={handleNavClick}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="flex-1">{item.title}</span>
                        <div className="flex items-center gap-1"></div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-violet-700">System Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-2">
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === superAdminMenuItem.url}
                    className="hover:bg-violet-50 data-[active=true]:bg-violet-100 data-[active=true]:text-violet-900 text-base"
                    tooltip={state === 'collapsed' ? superAdminMenuItem.title : undefined}
                    size="lg"
                  >
                    <NavLink to={superAdminMenuItem.url} className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'bg-accent text-accent-foreground' : ''}`} onClick={handleNavClick}>
                      <superAdminMenuItem.icon className="h-5 w-5" />
                      <span>{superAdminMenuItem.title}</span>
                      <Badge 
                        variant="outline" 
                        className="ml-auto bg-violet-50 text-violet-700 border-violet-200"
                      >
                        <Crown className="w-2 h-2 mr-1" />
                        Admin
                      </Badge>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === '/super-admin/cms'}
                    className="hover:bg-violet-50 data-[active=true]:bg-violet-100 data-[active=true]:text-violet-900 text-base"
                    tooltip={state === 'collapsed' ? 'Landing CMS' : undefined}
                    size="lg"
                  >
                    <NavLink to="/super-admin/cms" className={({ isActive }) => `flex items-center gap-2 ${isActive ? 'bg-accent text-accent-foreground' : ''}`} onClick={handleNavClick}>
                      <Sparkles className="h-5 w-5" />
                      <span>Landing CMS</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Subscription</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-3 space-y-2">
              {subscriptionPlan && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Current Plan</span>
                  <Badge 
                    className={`text-xs ${
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
                  <span className="text-sm text-slate-600">Trial</span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      daysLeftInTrial <= 3 
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {daysLeftInTrial} days left
                  </Badge>
                </div>
              )}

              {/* Quick usage overview */}
              <div className="space-y-1 pt-2 border-t">
                {['clients', 'staff', 'services'].map((feature) => {
                  const access = getFeatureAccess(feature);
                  if (!access.enabled || access.unlimited) return null;
                  
                  const percentage = access.limit ? (access.usage! / access.limit) * 100 : 0;
                  const isNearLimit = percentage >= 80;
                  
                  if (isNearLimit) {
                    return (
                      <div key={feature} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 capitalize">{feature}</span>
                        <span className={`${percentage >= 100 ? 'text-red-600' : 'text-amber-600'}`}>
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

        <SidebarFooter className="mt-auto">
          <div className="text-xs text-muted-foreground px-2 py-2">v1.0.0</div>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

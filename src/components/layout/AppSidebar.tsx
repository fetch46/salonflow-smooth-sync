import { useState } from "react";
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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useFeatureGating } from "@/hooks/useFeatureGating";
import { useSaas } from "@/contexts/SaasContext";

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
    feature: "reports", // Basic dashboard is part of reports
  },
  {
    title: "Appointments",
    url: "/appointments",
    icon: Calendar,
    feature: "appointments",
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    feature: "clients",
  },
  {
    title: "Staff",
    url: "/staff",
    icon: Users,
    feature: "staff",
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
        title: "Inventory",
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
    ],
  },
  {
    title: "Financial",
    icon: DollarSign,
    feature: "expenses", // At least one financial feature
    subItems: [
      {
        title: "Expenses",
        url: "/expenses",
        icon: Receipt,
        feature: "expenses",
      },
      {
        title: "Accounts",
        url: "/accounts",
        icon: Calculator,
        feature: "accounting",
      },
    ],
  },
  {
    title: "Purchases",
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
        feature: "suppliers",
      },
    ],
  },
  {
    title: "Operations",
    icon: FileText,
    feature: "job_cards",
    subItems: [
      {
        title: "Job Cards",
        url: "/job-cards",
        icon: FileText,
        feature: "job_cards",
      },
      {
        title: "POS",
        url: "/pos",
        icon: CreditCard,
        feature: "pos",
      },
    ],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    feature: "reports", // Settings always available
  },
];

export function AppSidebar() {
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const { hasFeature, getFeatureAccess, usageData } = useFeatureGating();
  const { subscriptionPlan, isTrialing, daysLeftInTrial } = useSaas();

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const getUsageBadge = (feature: string) => {
    const access = getFeatureAccess(feature);
    
    if (!access.enabled) {
      return (
        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-300">
          <Lock className="w-2 h-2 mr-1" />
          Locked
        </Badge>
      );
    }

    if (access.unlimited) {
      return (
        <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
          <Sparkles className="w-2 h-2 mr-1" />
          ∞
        </Badge>
      );
    }

    if (access.usage !== undefined && access.limit) {
      const percentage = (access.usage / access.limit) * 100;
      const isNearLimit = percentage >= 80;
      const isAtLimit = percentage >= 100;

      if (isAtLimit || isNearLimit) {
        return (
          <Badge 
            variant="outline" 
            className={`text-xs ${
              isAtLimit 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {access.usage}/{access.limit}
          </Badge>
        );
      }
    }

    return null;
  };

  const isMenuItemAvailable = (item: MenuItem) => {
    // Check if at least one feature is available
    if (item.subItems) {
      return item.subItems.some(subItem => hasFeature(subItem.feature));
    }
    return hasFeature(item.feature);
  };

  return (
    <Sidebar variant="inset">
      <SidebarContent>
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
            <SidebarMenu>
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
                        className={`${!isAvailable ? 'opacity-50' : ''}`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1">{item.title}</span>
                        <div className="flex items-center gap-1">
                          {usageBadge}
                          {!isAvailable && <Lock className="w-3 h-3 text-slate-400" />}
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>
                      </SidebarMenuButton>
                      {isOpen && (
                        <SidebarMenuSub>
                          {item.subItems?.map((subItem) => {
                            const subItemAvailable = hasFeature(subItem.feature);
                            const subItemUsageBadge = getUsageBadge(subItem.feature);
                            
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton 
                                  asChild
                                  className={`${!subItemAvailable ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                  <NavLink
                                    to={subItem.url}
                                    className={({ isActive }) =>
                                      `flex items-center gap-2 ${
                                        isActive ? "bg-accent text-accent-foreground" : ""
                                      }`
                                    }
                                  >
                                    <subItem.icon className="w-4 h-4" />
                                    <span className="flex-1">{subItem.title}</span>
                                    <div className="flex items-center gap-1">
                                      {subItemUsageBadge}
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
                      className={`${!isAvailable ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <NavLink
                        to={item.url!}
                        className={({ isActive }) =>
                          `flex items-center gap-2 ${
                            isActive ? "bg-accent text-accent-foreground" : ""
                          }`
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1">{item.title}</span>
                        <div className="flex items-center gap-1">
                          {usageBadge}
                          {!isAvailable && <Lock className="w-3 h-3 text-slate-400" />}
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Plan Information */}
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
      </SidebarContent>
    </Sidebar>
  );
}

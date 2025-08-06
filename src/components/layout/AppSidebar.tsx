import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Calendar,
  Users,
  CreditCard,
  Package,
  BarChart3,
  Settings,
  ClipboardList,
  Home,
  UserCheck,
  Receipt,
  Scissors,
  ChevronDown,
  ChevronRight,
  Building,
  ShoppingCart,
  Calculator,
  TrendingUp
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
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Appointments", url: "/appointments", icon: Calendar },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Staff", url: "/staff", icon: UserCheck },
  { title: "Services", url: "/services", icon: Scissors },
  { 
    title: "Inventory", 
    url: "/inventory", 
    icon: Package,
    subItems: [
      { title: "Inventory", url: "/inventory", icon: Package },
      { title: "Adjustments", url: "/inventory-adjustments", icon: TrendingUp }
    ]
  },
  { title: "Job Cards", url: "/job-cards", icon: ClipboardList },
  { title: "Invoices", url: "/invoices", icon: Receipt },
  { title: "Expenses", url: "/expenses", icon: CreditCard },
  { 
    title: "Purchases", 
    url: "/purchases", 
    icon: ShoppingCart,
    subItems: [
      { title: "Purchases", url: "/purchases", icon: ShoppingCart },
      { title: "Suppliers", url: "/suppliers", icon: Building }
    ]
  },
  { title: "Accounts", url: "/accounts", icon: Calculator },
  { title: "POS", url: "/pos", icon: CreditCard },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "hover:bg-sidebar-accent/50";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-xl font-bold text-sidebar-foreground">SalonSync</span>
          )}
        </div>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.subItems ? (
                    <>
                      <SidebarMenuButton
                        onClick={() => toggleSubmenu(item.title)}
                        className="w-full justify-between"
                      >
                        <div className="flex items-center">
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </div>
                        {!collapsed && (
                          openSubmenus.includes(item.title) 
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />
                        )}
                      </SidebarMenuButton>
                      {!collapsed && openSubmenus.includes(item.title) && (
                        <SidebarMenuSub>
                          {item.subItems.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton asChild>
                                <NavLink to={subItem.url} className={getNavCls} end>
                                  <subItem.icon className="mr-2 h-4 w-4" />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </>
                  ) : (
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls} end>
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Collapsed trigger */}
      {collapsed && (
        <div className="p-2">
          <SidebarTrigger className="w-full" />
        </div>
      )}
    </Sidebar>
  );
}

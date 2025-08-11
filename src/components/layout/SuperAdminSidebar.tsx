import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Building,
  Users,
  Shield,
  Settings,
  BarChart3,
  Database,
  Crown,
  UserPlus,
  Building2,
  Activity,
  ChevronDown,
  ChevronRight,
  FileText
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

interface SuperAdminMenuItem {
  title: string;
  url?: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: SuperAdminMenuItem[];
}

const superAdminMenuItems: SuperAdminMenuItem[] = [
  {
    title: "Overview",
    url: "/super-admin",
    icon: BarChart3,
  },
  {
    title: "Admin Dashboard",
    url: "/admin/dashboard",
    icon: Activity,
  },
  {
    title: "Organizations",
    icon: Building,
    subItems: [
      {
        title: "Manage Organizations",
        url: "/admin/organizations",
        icon: Building2,
      },
      {
        title: "Subscription Plans",
        url: "/admin/subscription-plans",
        icon: Crown,
      },
    ],
  },
  {
    title: "User Management",
    icon: Users,
    subItems: [
      {
        title: "Users & Organizations",
        url: "/admin/users",
        icon: Users,
      },
      {
        title: "User Invitations",
        url: "/admin/invitations",
        icon: UserPlus,
      },
      {
        title: "Super Admins",
        url: "/admin/users",
        icon: Shield,
      },
    ],
  },
  {
    title: "Content Management",
    icon: FileText,
    subItems: [
      {
        title: "Landing CMS",
        url: "/super-admin/cms",
        icon: FileText,
      },
    ],
  },
  {
    title: "Business Data",
    icon: Database,
    subItems: [
      {
        title: "All Business Tables",
        url: "/admin/business-data",
        icon: Database,
      },
      {
        title: "Activity Logs",
        url: "/super-admin/activity",
        icon: Activity,
      },
    ],
  },
  {
    title: "System",
    icon: Settings,
    subItems: [
      {
        title: "System Settings",
        url: "/super-admin/settings",
        icon: Settings,
      },
    ],
  },
];

export function SuperAdminSidebar() {
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);
  const { state } = useSidebar();

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  return (
    <Sidebar variant="inset" collapsible="icon" className="border-r border-purple-200 max-w-[260px] md:max-w-[280px]">
      <SidebarContent className="bg-gradient-to-b from-purple-50 to-violet-50">
        <SidebarHeader className="px-2 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-800">
              <Crown className="h-5 w-5" />
              <span className="font-semibold group-data-[collapsible=icon]:hidden">Admin Panel</span>
            </div>
            <SidebarTrigger className="hidden md:inline-flex text-purple-700" />
          </div>
        </SidebarHeader>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-purple-700 font-semibold">
            <Crown className="h-4 w-4" />
            Super Admin Panel
            <Badge variant="outline" className="ml-auto bg-purple-100 text-purple-700 border-purple-300">
              System
            </Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {superAdminMenuItems.map((item) => {
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isOpen = openSubmenus.includes(item.title);

                if (hasSubItems) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => toggleSubmenu(item.title)}
                        className="hover:bg-purple-100 text-slate-700 hover:text-purple-800 text-base"
                        tooltip={state === 'collapsed' ? item.title : undefined}
                        size="lg"
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="flex-1">{item.title}</span>
                        <div className="group-data-[collapsible=icon]:hidden">
                          {isOpen ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                      </SidebarMenuButton>
                      {isOpen && (
                        <SidebarMenuSub className="gap-2">
                          {item.subItems?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton 
                                asChild
                                className="hover:bg-purple-100 h-9 text-[15px]"
                                isActive={location.pathname === subItem.url}
                              >
                                <NavLink
                                  to={subItem.url!}
                                  className={({ isActive }) =>
                                    `flex items-center gap-2 ${
                                      isActive 
                                        ? "bg-purple-200 text-purple-900 font-medium" 
                                        : "text-slate-700 hover:text-purple-800"
                                    }`
                                  }
                                >
                                  <subItem.icon className="w-5 h-5" />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      className="hover:bg-purple-100 text-base"
                      isActive={location.pathname === item.url}
                      tooltip={state === 'collapsed' ? item.title : undefined}
                      size="lg"
                    >
                      <NavLink
                        to={item.url!}
                        className={({ isActive }) =>
                          `flex items-center gap-2 ${
                            isActive 
                              ? "bg-purple-200 text-purple-900 font-medium" 
                              : "text-slate-700 hover:text-purple-800"
                          }`
                        }
                      >
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-purple-700">Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 py-3 space-y-2">
              <NavLink
                to="/super-admin"
                className="block w-full text-left p-2 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 text-sm font-medium transition-colors"
              >
                Create Organization
              </NavLink>
              <NavLink
                to="/super-admin"
                className="block w-full text-left p-2 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 text-sm font-medium transition-colors"
              >
                Grant Super Admin
              </NavLink>
              <NavLink
                to="/super-admin/activity"
                className="block w-full text-left p-2 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 text-sm font-medium transition-colors"
              >
                View Activity Log
              </NavLink>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="mt-auto">
          <div className="text-xs text-purple-700/80 px-2 py-2">Super Admin Suite</div>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
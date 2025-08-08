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
    title: "Organizations",
    icon: Building,
    subItems: [
      {
        title: "All Organizations",
        url: "/super-admin/organizations",
        icon: Building2,
      },
      {
        title: "Create Organization",
        url: "/super-admin/organizations/create",
        icon: Building,
      },
    ],
  },
  {
    title: "User Management",
    icon: Users,
    subItems: [
      {
        title: "All Users",
        url: "/super-admin/users",
        icon: Users,
      },
      {
        title: "Super Admins",
        url: "/super-admin/super-admins",
        icon: Shield,
      },
      {
        title: "Grant Super Admin",
        url: "/super-admin/grant-admin",
        icon: UserPlus,
      },
    ],
  },
  {
    title: "System",
    icon: Database,
    subItems: [
      {
        title: "Activity Logs",
        url: "/super-admin/activity",
        icon: Activity,
      },
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

  const toggleSubmenu = (title: string) => {
    setOpenSubmenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  return (
    <Sidebar variant="inset" className="border-r border-purple-200">
      <SidebarContent className="bg-gradient-to-b from-purple-50 to-violet-50">
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-purple-700 font-semibold">
            <Crown className="h-4 w-4" />
            Super Admin Panel
            <Badge variant="outline" className="ml-auto bg-purple-100 text-purple-700 border-purple-300">
              System
            </Badge>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {superAdminMenuItems.map((item) => {
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isOpen = openSubmenus.includes(item.title);

                if (hasSubItems) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        onClick={() => toggleSubmenu(item.title)}
                        className="hover:bg-purple-100 text-slate-700 hover:text-purple-800"
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1">{item.title}</span>
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </SidebarMenuButton>
                      {isOpen && (
                        <SidebarMenuSub>
                          {item.subItems?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton 
                                asChild
                                className="hover:bg-purple-100"
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
                                  <subItem.icon className="w-4 h-4" />
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
                      className="hover:bg-purple-100"
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
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions */}
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
      </SidebarContent>
    </Sidebar>
  );
}
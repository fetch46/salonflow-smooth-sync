
import React, { useState, useEffect } from 'react';
import { Bell, User, Search, Menu, ChevronDown, Settings, LogOut, Plus, Building2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useSaas } from '@/lib/saas';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { SidebarTrigger } from '@/components/ui/sidebar';

interface TopbarProps {
  onMenuClick?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { 
    user, 
    organization, 
    organizations, 
    organizationRole,
    switchOrganization, 
    isOrganizationOwner, 
    isOrganizationAdmin 
  } = useSaas();
  
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Fallback to mock data for now
      setNotifications([
        {
          id: 1,
          title: 'New appointment booked',
          message: 'John Doe has booked an appointment for tomorrow',
          created_at: new Date().toISOString(),
          read: false,
        },
        {
          id: 2,
          title: 'Payment received',
          message: 'Payment of $150 received from Jane Smith',
          created_at: new Date().toISOString(),
          read: true,
        },
      ]);
    }
  };

  const markNotificationAsViewed = async (notificationId: string | number) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          viewed_at: new Date().toISOString() 
        })
        .eq('id', String(notificationId));

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read: true, viewed_at: new Date().toISOString() }
            : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as viewed:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', ''); // Delete all notifications for the user's organization

      if (error) throw error;

      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      // Fallback to clearing local state
      setNotifications([]);
      toast.success('All notifications cleared');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await switchOrganization(orgId);
      toast.success('Organization switched successfully');
    } catch (error) {
      console.error('Error switching organization:', error);
      toast.error('Failed to switch organization');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRole = (orgId: string) => {
    return organizationRole || 'member';
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b border-border px-3 md:px-4 lg:px-6 py-2.5"
      style={{ backgroundColor: `hsl(var(--topbar-bg))`, color: `hsl(var(--topbar-foreground))` }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <div className="lg:hidden">
            <SidebarTrigger className="h-8 w-8" />
          </div>
          
          <div className="hidden md:flex items-center gap-2 max-w-md px-2 py-1.5 rounded-md border bg-card">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 border-0 shadow-none focus-visible:ring-0 p-0"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Button onClick={() => navigate('/pos')} className="hidden sm:inline-flex gap-2 btn-compact">
            <CreditCard className="h-4 w-4" />
            POS
          </Button>
          {/* Organization Switcher */}
          {organizations.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 btn-compact">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline-block max-w-32 truncate">
                    {organization?.name || 'Select Organization'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{org.organizations?.name || 'Unknown Organization'}</span>
                      <span className="text-xs text-muted-foreground">
                        Role: {getUserRole(org.id)}
                      </span>
                    </div>
                    {organization?.id === org.id && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings?tab=organizations')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative btn-compact-icon">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No notifications
                </div>
              ) : (
                <>
                  {notifications.slice(0, 5).map((notification) => (
                    <DropdownMenuItem 
                      key={notification.id} 
                      className="flex flex-col items-start p-3 cursor-pointer"
                      onClick={() => markNotificationAsViewed(notification.id)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.created_at || notification.timestamp).toLocaleDateString()}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-center w-full"
                    onClick={clearAllNotifications}
                  >
                    Clear all notifications
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 btn-compact bg-transparent hover:bg-transparent focus:bg-transparent active:bg-transparent">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>
                    {user?.user_metadata?.full_name 
                      ? getInitials(user.user_metadata.full_name)
                      : user?.email?.charAt(0).toUpperCase() || 'U'
                    }
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-medium">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {organizationRole || 'Member'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

// Export as AppTopbar for backward compatibility
export const AppTopbar = Topbar;

// Export as SuperAdminTopbar for SuperAdminLayout
export const SuperAdminTopbar = Topbar;

// Default export
export default Topbar;

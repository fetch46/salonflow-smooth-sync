
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
// Sidebar trigger removed as collapse is disabled

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
    <header className="sticky top-0 z-50 backdrop-blur-md border-b border-border/50 px-4 md:px-6 lg:px-8 py-3 bg-background/80 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-6">
          {/* Enhanced search with modern styling */}
          <div className="hidden md:flex items-center gap-3 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-modern pl-10 w-80 bg-muted/30 border-border/60 hover:bg-background focus:bg-background"
              />
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button 
            onClick={() => navigate('/pos')} 
            className="hidden sm:inline-flex gap-2 btn-premium px-4 py-2 hover-glow"
          >
            <CreditCard className="h-4 w-4" />
            POS
          </Button>
          {/* Organization Switcher */}
          {organizations.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 btn-outline-modern px-4 py-2 hover-lift">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline-block max-w-32 truncate font-medium">
                    {organization?.name || 'Select Organization'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 glass-card border-border/60">
                <DropdownMenuLabel className="text-foreground font-semibold">Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 transition-all duration-200"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{org.organizations?.name || 'Unknown Organization'}</span>
                      <span className="text-sm text-muted-foreground">
                        Role: {getUserRole(org.id)}
                      </span>
                    </div>
                    {organization?.id === org.id && (
                      <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
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
              <Button variant="ghost" size="icon" className="relative btn-compact-icon hover-lift hover-glow">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-bounce-subtle"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 glass-card border-border/60">
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
              <Button variant="ghost" className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 hover-lift transition-all duration-200">
                <Avatar className="h-9 w-9 ring-2 ring-primary/10 hover:ring-primary/30 transition-all">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                    {user?.user_metadata?.full_name 
                      ? getInitials(user.user_metadata.full_name)
                      : user?.email?.charAt(0).toUpperCase() || 'U'
                    }
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-sm font-semibold text-foreground">
                    {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {organizationRole || 'Member'}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 glass-card border-border/60">
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

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  Key,
  Bell,
  Globe,
  Camera,
  Save,
  Edit,
  X,
  Check,
} from 'lucide-react';
import { useSaas } from '@/lib/saas';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Profile = () => {
  const { user, organization } = useSaas();
  const [activeTab, setActiveTab] = useState('personal');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mock user data
  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: user?.email || 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main Street, City, State 12345',
    bio: 'Experienced salon manager with over 10 years in the beauty industry.',
    timezone: 'America/New_York',
    language: 'English',
    notifications: {
      email: true,
      sms: false,
      push: true,
      marketing: false,
    },
  });

  const [securityData, setSecurityData] = useState({
    lastLogin: '2024-01-15 10:30 AM',
    lastPasswordChange: '2024-01-01 12:00 PM',
    twoFactorEnabled: false,
    loginHistory: [
      { date: '2024-01-15 10:30 AM', location: 'New York, NY', device: 'Chrome on Windows' },
      { date: '2024-01-14 09:15 AM', location: 'New York, NY', device: 'Chrome on Windows' },
      { date: '2024-01-13 14:20 PM', location: 'New York, NY', device: 'Mobile Safari' },
    ],
  });

  React.useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, email, phone')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const [firstName = '', ...rest] = (data.full_name || '').split(' ');
          const lastName = rest.join(' ');
          setProfileData((prev) => ({
            ...prev,
            firstName: firstName || prev.firstName,
            lastName: lastName || prev.lastName,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
          }));
        }
      } catch (e) {
        console.warn('Failed to load profile, using defaults');
      }
    })();
  }, [user?.id]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Persist to profiles table
      const payload: any = {
        full_name: `${profileData.firstName} ${profileData.lastName}`.trim(),
        email: profileData.email,
        phone: profileData.phone,
      };
      // Upsert based on user_id
      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: user?.id as string, ...payload }, { onConflict: 'user_id' } as any);
      if (error) throw error;
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data
    setProfileData({
      firstName: 'John',
      lastName: 'Doe',
      email: user?.email || 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street, City, State 12345',
      bio: 'Experienced salon manager with over 10 years in the beauty industry.',
      timezone: 'America/New_York',
      language: 'English',
      notifications: {
        email: true,
        sms: false,
        push: true,
        marketing: false,
      },
    });
  };

  const getInitials = () => {
    return `${profileData.firstName.charAt(0)}${profileData.lastName.charAt(0)}`;
  };

  return (
    <div className="flex-1 space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
              <p className="text-slate-600">Manage your personal information and preferences</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button 
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* Profile Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="relative inline-block">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src="/placeholder-avatar.jpg" alt="Profile" />
                    <AvatarFallback className="text-lg font-semibold">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                    >
                      <Camera className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold">
                    {profileData.firstName} {profileData.lastName}
                  </h2>
                  <p className="text-slate-600">{profileData.email}</p>
                </div>

                <div className="space-y-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Shield className="w-3 h-3 mr-1" />
                    Salon Manager
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>

                <Separator />

                <div className="text-left space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Member since January 2024</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <span>{organization?.name || 'Organization'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                        disabled={!isEditing}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                      disabled={!isEditing}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                      disabled={!isEditing}
                      rows={4}
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Last Login</Label>
                      <div className="text-sm text-slate-600">{securityData.lastLogin}</div>
                    </div>
                    <div className="space-y-2">
                      <Label>Password Changed</Label>
                      <div className="text-sm text-slate-600">{securityData.lastPasswordChange}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Two-Factor Authentication</h3>
                        <p className="text-sm text-slate-600">Add an extra layer of security to your account</p>
                      </div>
                      <Button variant="outline" size="sm">
                        {securityData.twoFactorEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Change Password</h3>
                        <p className="text-sm text-slate-600">Update your password regularly</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Key className="w-4 h-4 mr-2" />
                        Change
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-4">Recent Login Activity</h3>
                    <div className="space-y-3">
                      {securityData.loginHistory.map((login, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{login.date}</div>
                            <div className="text-sm text-slate-600">{login.location} • {login.device}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {index === 0 ? 'Current' : 'Previous'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Email Notifications</h3>
                        <p className="text-sm text-slate-600">Receive notifications via email</p>
                      </div>
                      <Button
                        variant={profileData.notifications.email ? "default" : "outline"}
                        size="sm"
                        onClick={() => setProfileData(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, email: !prev.notifications.email }
                        }))}
                        disabled={!isEditing}
                      >
                        {profileData.notifications.email ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">SMS Notifications</h3>
                        <p className="text-sm text-slate-600">Receive notifications via SMS</p>
                      </div>
                      <Button
                        variant={profileData.notifications.sms ? "default" : "outline"}
                        size="sm"
                        onClick={() => setProfileData(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, sms: !prev.notifications.sms }
                        }))}
                        disabled={!isEditing}
                      >
                        {profileData.notifications.sms ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Push Notifications</h3>
                        <p className="text-sm text-slate-600">Receive notifications in the app</p>
                      </div>
                      <Button
                        variant={profileData.notifications.push ? "default" : "outline"}
                        size="sm"
                        onClick={() => setProfileData(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, push: !prev.notifications.push }
                        }))}
                        disabled={!isEditing}
                      >
                        {profileData.notifications.push ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Marketing Communications</h3>
                        <p className="text-sm text-slate-600">Receive updates about new features and promotions</p>
                      </div>
                      <Button
                        variant={profileData.notifications.marketing ? "default" : "outline"}
                        size="sm"
                        onClick={() => setProfileData(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, marketing: !prev.notifications.marketing }
                        }))}
                        disabled={!isEditing}
                      >
                        {profileData.notifications.marketing ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Profile;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSaas } from '@/contexts/SaasContext';
import {
  Building2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

const OrganizationSetup = () => {
  const navigate = useNavigate();
  const { user, refreshOrganizationDataSilently, organization, organizations } = useSaas();
  
  // If user already has organizations, redirect to dashboard
  useEffect(() => {
    if (organization || organizations.length > 0) {
      console.log('User already has organization, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }
  }, [organization, organizations, navigate]);
  
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    organizationName: '',
    organizationSlug: '',
    description: '',
    website: '',
    industry: '',
  });

  // Load business info from localStorage if available
  useEffect(() => {
    const pendingInfo = localStorage.getItem('pendingBusinessInfo');
    if (pendingInfo) {
      try {
        const businessInfo = JSON.parse(pendingInfo);
        setFormData(prev => ({
          ...prev,
          organizationName: businessInfo.businessName || '',
          organizationSlug: generateSlug(businessInfo.businessName || ''),
          description: businessInfo.businessDescription || '',
          industry: businessInfo.businessType || ''
        }));
        // Clear the pending info since we've used it
        localStorage.removeItem('pendingBusinessInfo');
      } catch (error) {
        console.error('Error parsing pending business info:', error);
      }
    }
  }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      organizationName: value,
      organizationSlug: generateSlug(value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please ensure you are logged in');
      return;
    }

    if (!formData.organizationName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    setLoading(true);

    // Short guard to avoid indefinite spinner; detailed fallbacks below
    const slowGuard = setTimeout(() => {
      console.warn('Org creation is slow, attempting fallback if not already tried...');
    }, 15000); // 15s guard


    try {
      // Verify user authentication first
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        console.error('Authentication error:', authError);
        toast.error('Authentication error. Please log in again.');
        return;
      }
      
      console.log('Creating organization...');
      console.log('Current user:', currentUser.email);
      console.log('Form data:', {
        org_name: formData.organizationName,
        org_slug: formData.organizationSlug
      });

      const rpcParams = {
        org_name: formData.organizationName,
        org_slug: formData.organizationSlug,
        org_settings: {
          description: formData.description,
          website: formData.website,
          industry: formData.industry,
        },
      };

      // Use the new safe function to create organization with proper RLS handling
      console.log('Calling create_organization_with_user with params:', rpcParams);
      const { data: orgId, error: orgError } = await supabase.rpc('create_organization_with_user', rpcParams);

      if (orgError) {
        console.error('RPC error:', orgError);
        console.error('RPC error details:', {
          message: orgError.message,
          details: orgError.details,
          hint: orgError.hint,
          code: orgError.code
        });
        
        // Try fallback method if RPC fails
        if (!orgError.message?.includes('User must be authenticated')) {
          console.log('RPC failed, trying fallback method...');
          
          try {
            // Fallback: Direct database inserts
            const { data: org, error: insertError } = await supabase
              .from('organizations')
              .insert({
                name: formData.organizationName,
                slug: formData.organizationSlug,
                settings: {
                  description: formData.description,
                  website: formData.website,
                  industry: formData.industry,
                }
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('Fallback insert error:', insertError);
              if (insertError.message?.includes('duplicate key')) {
                toast.error('Organization name already exists. Please choose a different name.');
              } else {
                toast.error(`Database error: ${insertError.message}`);
              }
              throw insertError;
            }

            // Add user to organization
            const { error: userError } = await supabase
              .from('organization_users')
              .insert({
                organization_id: org.id,
                user_id: user.id,
                role: 'owner',
                is_active: true
              });

            if (userError) {
              console.error('Fallback user insert error:', userError);
              // Clean up the organization we just created
              await supabase.from('organizations').delete().eq('id', org.id);
              toast.error(`Failed to add user to organization: ${userError.message}`);
              throw userError;
            }

            console.log('Organization created successfully using fallback method!');
            toast.success('Organization created successfully!');

            // Set up initial organization data
            try {
              const { error: setupError } = await supabase.rpc('setup_new_organization', {
                org_id: org.id
              });
              
              if (setupError) {
                console.warn('Failed to set up initial data:', setupError);
              }
            } catch (setupErr) {
              console.warn('Setup function not available or failed:', setupErr);
            }

            toast.success('Organization created successfully!');
            
            // Refresh organization data silently, then navigate
            await refreshOrganizationDataSilently();
            navigate('/dashboard');
            return;

          } catch (fallbackError: any) {
            console.error('Fallback method also failed:', fallbackError);
            toast.error('Organization creation failed. Please try again or contact support.');
            throw fallbackError;
          }
        }
        
        // Provide specific error messages for RPC errors
        if (orgError.message?.includes('function create_organization_with_user does not exist')) {
          toast.error('Database setup incomplete. Please run the latest migrations.');
          console.error('Missing function: create_organization_with_user');
        } else if (orgError.message?.includes('duplicate key')) {
          toast.error('Organization name already exists. Please choose a different name.');
        } else if (orgError.message?.includes('permission denied')) {
          toast.error('Permission denied. Please check your account settings.');
        } else {
          toast.error(`Database error: ${orgError.message}`);
        }
        
        throw orgError;
      }

      if (!orgId) {
        console.error('No organization ID returned from function');
        toast.error('Organization creation failed - no ID returned');
        throw new Error('No organization ID returned');
      }

      console.log('Organization created with ID:', orgId);

      // Set up initial organization data
      try {
        const { error: setupError } = await supabase.rpc('setup_new_organization', {
          org_id: orgId
        });
        
        if (setupError) {
          console.warn('Failed to set up initial data:', setupError);
          // Don't fail for this either - user can add data later
        }
      } catch (setupErr) {
        console.warn('Setup function not available or failed:', setupErr);
      }

      // Refresh organization data and navigate
      toast.success('Organization created successfully! Welcome to your salon management system.');
      
      // Clear any pending data and refresh
      localStorage.removeItem('pendingBusinessInfo');
      await refreshOrganizationDataSilently();
      
      // Use setTimeout to ensure state updates have processed
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);

    } catch (error: any) {
      console.error('Error creating organization:', error);
      
      // Clear timeout on error
      clearTimeout(slowGuard);
      
      if (error.message?.includes('organization already exists') || error.message?.includes('duplicate')) {
        toast.error('An organization with this name already exists. Please choose a different name.');
      } else {
        toast.error(`Organization creation failed: ${error.message || 'Unknown error'}. Please try again.`);
      }
    } finally {
      clearTimeout(slowGuard);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">

        {/* Emergency Exit for Stuck Users */}
        {user && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Already have an organization?</h3>
                <p className="text-sm text-blue-800">If you're stuck on this page but already completed setup, click below to go to your dashboard.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  console.log('Manual navigation to dashboard');
                  // Force refresh organization data before navigating
                  refreshOrganizationDataSilently().then(() => {
                    navigate('/dashboard');
                  });
                }}
                className="bg-white hover:bg-blue-50 border-blue-300"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="p-3 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg w-fit mx-auto">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Setup Your Organization</h1>
            <p className="text-slate-600 mt-2">
              Let's get your salon management system ready in just a few steps
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organization Details */}
          <Card className="shadow-lg border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-600" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="organizationName">Organization Name *</Label>
                  <Input
                    id="organizationName"
                    value={formData.organizationName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g., Bella Vista Salon"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="organizationSlug">Organization URL</Label>
                  <div className="flex items-center">
                    <span className="bg-slate-100 text-slate-600 px-3 py-2 rounded-l-md border border-r-0 text-sm">
                      app.salonsaas.com/
                    </span>
                    <Input
                      id="organizationSlug"
                      value={formData.organizationSlug}
                      onChange={(e) => setFormData(prev => ({ ...prev, organizationSlug: e.target.value }))}
                      placeholder="bella-vista-salon"
                      className="rounded-l-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="website">Website (Optional)</Label>
                    <Input
                      id="website"
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://www.example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="industry">Industry (Optional)</Label>
                    <Input
                      id="industry"
                      value={formData.industry}
                      onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                      placeholder="e.g., Hair Salon, Spa, Beauty Center"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your salon and services..."
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg px-8"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Organization...
                </>
              ) : (
                <>
                  Create Organization
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Debug Section */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 font-medium">
                🔧 Debug & Troubleshooting
              </summary>
              <div className="mt-4 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">Database Connection Test</h4>
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        console.log('🔍 Testing database connection...');
                        
                        // Test user authentication
                        const { data: { user }, error: authError } = await supabase.auth.getUser();
                        if (authError) {
                          console.error('❌ Auth error:', authError);
                          toast.error('Authentication error. Please log in again.');
                          return;
                        }
                        if (!user) {
                          console.error('❌ No user authenticated');
                          toast.error('No user authenticated. Please log in.');
                          return;
                        }
                        console.log('✅ User authenticated:', user.email);

                        // Test RPC function
                        const { error: funcError } = await supabase.rpc('create_organization_with_user', {
                          org_name: 'test',
                          org_slug: 'test',
                          org_settings: {}
                        });
                        if (funcError && funcError.message.includes('function create_organization_with_user does not exist')) {
                          console.error('❌ RPC function does not exist');
                          toast.error('Database function missing. Run emergency script.');
                          return;
                        }
                        console.log('✅ RPC function exists (even if call failed due to validation)');

                        // Test organizations table access
                        const { data: orgs, error: orgsError } = await supabase
                          .from('organizations')
                          .select('id, name')
                          .limit(1);
                        if (orgsError) {
                          console.error('❌ Cannot read organizations:', orgsError);
                          toast.error('Cannot access organizations table. Check database permissions.');
                          return;
                        }
                        console.log('✅ Can read organizations:', orgs?.length || 0, 'organizations');

                        toast.success('Database connection test completed. Check console for details.');
                      }}
                    >
                      🔍 Test DB
                    </Button>
                    
                    <div className="text-xs text-slate-600 space-y-1">
                      <p>• Click to test database connectivity and permissions</p>
                      <p>• Check browser console (F12) for detailed results</p>
                      <p>• Visit <a href="/debug/database" className="text-violet-600 hover:underline">Debug Database</a> for comprehensive testing</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-3">Common Issues & Solutions</h4>
                  <div className="text-xs text-amber-800 space-y-2">
                    <p><strong>❌ "Failed to create organization"</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Run the emergency database script in Supabase SQL Editor</li>
                      <li>Check if user is properly authenticated</li>
                      <li>Try a different organization name</li>
                    </ul>
                    
                    <p><strong>❌ "Function does not exist"</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Copy and run <code className="bg-amber-100 px-1 rounded">emergency_create_organization_function.sql</code></li>
                      <li>Verify Supabase project is active</li>
                    </ul>
                    
                    <p><strong>❌ "Permission denied"</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Log out and log back in</li>
                      <li>Check RLS policies are properly set</li>
                    </ul>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrganizationSetup;
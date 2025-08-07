import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function CreateSuperAdmin() {
  const [email, setEmail] = useState("hello@stratus.africa");
  const [password, setPassword] = useState("Noel@2018");
  const [loading, setLoading] = useState(false);

  const handleCreateSuperAdmin = async () => {
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-super-admin', {
        body: { email, password }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Super admin account created successfully!');
        setEmail('');
        setPassword('');
      } else {
        toast.error(data.error || 'Failed to create super admin account');
      }
    } catch (error) {
      console.error('Error creating super admin:', error);
      toast.error('Failed to create super admin account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Create Super Admin
          </h1>
          <p className="text-muted-foreground">
            Create a new super administrator account
          </p>
        </div>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Super Admin Account
          </CardTitle>
          <CardDescription>
            Enter the details for the new super admin account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a secure password"
            />
          </div>
          <Button 
            onClick={handleCreateSuperAdmin} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating...' : 'Create Super Admin Account'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle } from "lucide-react";

export default function Suppliers() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">
            Manage supplier information and relationships
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Suppliers Management</CardTitle>
          </div>
          <CardDescription>
            Feature not available - database schema configuration required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-medium">Suppliers Not Configured</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                The suppliers feature requires additional database tables that haven't been created yet. 
                Contact your system administrator to set up the required schema.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
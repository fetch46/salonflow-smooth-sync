import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// This page is temporarily disabled as the accounts tables don't exist in the database yet
// TODO: Create accounts and account_transactions tables in database

export default function Accounts() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Accounting Module</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The accounting module is under development. The required database tables will be created in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
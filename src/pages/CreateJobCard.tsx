import React from "react";
import { useNavigate } from "react-router-dom";
import { JobCardForm } from "@/components/forms/JobCardForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CreateJobCard() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/job-cards')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Job Card</h1>
          <p className="text-muted-foreground">Fill in the details to create a new service job card</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Job Card Information</CardTitle>
        </CardHeader>
        <CardContent>
          <JobCardForm
            onSuccess={() => {
              navigate('/job-cards');
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
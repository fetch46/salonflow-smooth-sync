import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";

export default function WhatsAppSettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Integration</h1>
          <p className="text-muted-foreground">
            Configure WhatsApp messaging for your organization
          </p>
        </div>
      </div>

      <WhatsAppSettings />
    </div>
  );
}
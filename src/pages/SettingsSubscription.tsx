import { SubscriptionBilling } from "@/components/settings/SubscriptionBilling";

export default function SettingsSubscription() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
          <p className="text-muted-foreground">Manage your subscription, plans, and billing history</p>
        </div>
      </div>

      <div className="space-y-6">
        <SubscriptionBilling />
      </div>
    </div>
  );
}


import { ModuleManagement } from "@/components/settings/ModuleManagement";

export default function ModulesSettings() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modules</h1>
          <p className="text-muted-foreground">
            Enable or disable application modules
          </p>
        </div>
      </div>

      <ModuleManagement />
    </div>
  );
}


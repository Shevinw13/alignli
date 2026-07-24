import { SettingsPageContent } from "@/features/settings/components/settings-page-content";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization, team, and billing settings.
        </p>
      </div>

      <SettingsPageContent />
    </div>
  );
}

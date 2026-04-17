import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { SettingsForm } from "../components/SettingsForm";
import type { SettingsModel } from "../types/app";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: apiClient.getSettings,
  });
  const settingsStatusQuery = useQuery({
    queryKey: ["settings-status"],
    queryFn: apiClient.getSettingsStatus,
  });

  const updateMutation = useMutation({
    mutationFn: (value: SettingsModel) => apiClient.updateSettings(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["settings-status"] });
    },
  });

  if (settingsQuery.isLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <section className="panel">
      <h2>Settings</h2>
      <p className="muted">Configure AI and GitHub integration for repository chat.</p>
      <SettingsForm
        initialValue={settingsQuery.data}
        aiStatus={settingsStatusQuery.data}
        onSubmit={(value) => updateMutation.mutateAsync(value).then(() => undefined)}
      />
    </section>
  );
}

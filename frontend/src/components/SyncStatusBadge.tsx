import { ProjectStatus } from "@repo-intel/shared";

type Props = {
  status: ProjectStatus;
};

export function SyncStatusBadge({ status }: Props) {
  const map: Record<ProjectStatus, string> = {
    [ProjectStatus.DRAFT]: "status-draft",
    [ProjectStatus.SYNCING]: "status-syncing",
    [ProjectStatus.READY]: "status-ready",
    [ProjectStatus.REFRESHING]: "status-refreshing",
    [ProjectStatus.ERROR]: "status-error",
  };
  const labelMap: Record<ProjectStatus, string> = {
    [ProjectStatus.DRAFT]: "queued",
    [ProjectStatus.SYNCING]: "syncing",
    [ProjectStatus.READY]: "ready",
    [ProjectStatus.REFRESHING]: "refreshing",
    [ProjectStatus.ERROR]: "error",
  };

  return <span className={`badge ${map[status]}`}>{labelMap[status]}</span>;
}

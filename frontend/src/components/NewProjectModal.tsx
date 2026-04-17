import { RepoInputForm } from "./RepoInputForm";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    repoUrl: string;
    branch?: string;
    description?: string;
  }) => Promise<unknown>;
};

export function NewProjectModal({ open, onClose, onCreate }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="row-between">
          <h3>New Project</h3>
          <button onClick={onClose}>Close</button>
        </div>
        <RepoInputForm
          onSubmit={async (payload) => {
            await onCreate(payload);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

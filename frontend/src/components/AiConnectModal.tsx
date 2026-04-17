import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AiConnectModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card ai-modal">
        <h3>Connect AI to continue</h3>
        <p className="muted">
          Chat requires an AI provider. Open Settings and configure your model and API details first.
        </p>
        <div className="ai-modal-actions">
          <button className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              onClose();
              navigate("/settings");
            }}
          >
            Go to Settings
          </button>
        </div>
      </div>
    </div>
  );
}

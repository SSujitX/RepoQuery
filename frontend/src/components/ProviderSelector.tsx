type Props = {
  value: "openai" | "openai_compatible" | "ollama";
  onChange: (value: "openai" | "openai_compatible" | "ollama") => void;
};

export function ProviderSelector({ value, onChange }: Props) {
  return (
    <label className="field">
      Provider
      <select value={value} onChange={(event) => onChange(event.target.value as Props["value"])}>
        <option value="openai">OpenAI</option>
        <option value="openai_compatible">OpenAI-compatible</option>
        <option value="ollama">Ollama (local)</option>
      </select>
    </label>
  );
}

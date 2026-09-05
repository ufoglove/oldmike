"use client";

import {
  enabledModelModesForOperation,
  modelModeLabels,
  type ModelModeProfile,
  type ModelRoutingOperation,
} from "@/lib/model-mode-contract";

export default function ModelModePicker({ operation, value, onChange, testId }: { operation: ModelRoutingOperation; value: ModelModeProfile; onChange: (value: ModelModeProfile) => void; testId: string }) {
  const options = enabledModelModesForOperation(operation);
  if (options.length === 0) return null;
  return <label className="model-mode-picker">
    <span>老麥模式</span>
    <select aria-label="老麥模式" data-testid={testId} value={options.includes(value) ? value : options[0]} onChange={(event) => onChange(event.target.value as ModelModeProfile)}>
      {options.map((profile) => <option key={profile} value={profile}>{modelModeLabels[profile]}</option>)}
    </select>
    <small>由伺服器依固定操作契約選路；瀏覽器不接收模型或憑證資訊。</small>
  </label>;
}

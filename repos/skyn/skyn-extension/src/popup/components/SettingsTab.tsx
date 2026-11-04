import type { Plan } from '../../shared/types';

interface SettingsTabProps {
  enabled: boolean;
  plan: Plan;
  unlockedCount: number;
  userEmail: string;
  onEmailChange: (email: string) => void;
  onToggle: (enabled: boolean) => void;
  onValidate: () => void;
  onReset: () => void;
}

export default function SettingsTab({ enabled, plan, unlockedCount, userEmail, onEmailChange, onToggle, onValidate, onReset }: SettingsTabProps) {
  return (
    <section className="settings-panel">
      <label className="toggle-row">
        <span>Skyn on supported sites</span>
        <input checked={enabled} type="checkbox" onChange={(event) => onToggle(event.target.checked)} />
      </label>
      <label className="field">
        <span>Checkout email</span>
        <input
          value={userEmail}
          placeholder="you@example.com"
          type="email"
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </label>
      <div className="status-list">
        <div><span>Plan</span><strong>{plan.replace('_', ' ')}</strong></div>
        <div><span>Unlocked</span><strong>{unlockedCount}</strong></div>
      </div>
      <button className="secondary-button" type="button" onClick={onValidate}>
        Validate license
      </button>
      <button className="danger-button" type="button" onClick={onReset}>
        Reset defaults
      </button>
    </section>
  );
}

import { api } from '../api';
import { Field, Input, Link, MergeHint, Select, useLoad } from '../ui';
import { NAMES } from './shared';

interface Action {
  plugin: string;
  plugin_name: string;
  action: string;
  label: string;
  fields: { key: string; label?: string; type?: string }[];
}

/** Workflow step „Plugin-Aktion“: runs an automation step that a plugin (on for the whole sub-account) provides. */
export function PluginActionStep({ step, set }: { step: any; set: (p: any) => void }) {
  const l = useLoad(() => api.get<Action[]>('/api/plugins/actions').catch(() => [] as Action[]), []);
  const actions = l.data ?? [];
  const cur = actions.find((a) => a.plugin === step.plugin && a.action === step.action);
  const input: Record<string, string> = step.input && typeof step.input === 'object' ? step.input : {};
  const key = step.plugin && step.action ? `${step.plugin}::${step.action}` : '';
  return (
    <>
      {l.data && !actions.length && (
        <p className="muted small">
          No plugin with an automation step is active for the whole sub-account yet. You can find some in the <Link to="werkstatt">{NAMES.werkstatt}</Link> or the <Link to="marktplatz">{NAMES.marktplatz}</Link>.
        </p>
      )}
      <Field label="Plugin-Aktion" hint="Only plugins set up for the whole sub-account run – never private ones.">
        <Select
          value={key}
          onChange={(v) => {
            const [plugin, action] = v.split('::');
            set({ plugin, action, input: {} });
          }}
          options={actions.map((a) => [`${a.plugin}::${a.action}`, `${a.plugin_name}: ${a.label}`] as [string, string])}
          placeholder="Choose action"
        />
      </Field>
      {cur?.fields.map((f) => (
        <Field key={f.key} label={f.label ?? f.key}>
          <Input value={input[f.key] ?? ''} onChange={(v) => set({ input: { ...input, [f.key]: v } })} />
        </Field>
      ))}
      {cur && <MergeHint />}
    </>
  );
}

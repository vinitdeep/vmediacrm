import { useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { act, Badge, Check, confirmAsk, Empty, Field, Input, Link, Modal, navigate, PageHead, pressable, Select, Spinner, Tabs, Textarea, useLoad } from '../ui';
import { TYPE_LABELS, objIcon, refreshAssocTypes, useAssocTypes } from './ObjectKit';
import { useT } from '../i18n';

/**
 * Eigenschaften (like HubSpot's property settings): custom properties of contacts (the existing
 * custom fields), companies, deals and custom objects in one place, with groups and the
 * association labels of each object.
 */

function PropertyModal({ object, prop, groups, contact, onClose, onSaved }: { object: string; prop?: any; groups: any[]; contact: boolean; onClose: () => void; onSaved: () => void }) {
  const tx = useT('b6objects');
  const [p, setP] = useState<any>(
    prop
      ? { ...prop, options: (prop.options ?? []).join('\n') }
      : { label: '', key: '', type: 'text', options: '', group_key: '', description: '', required: false, unique: false },
  );
  const types = contact ? ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'email', 'phone', 'url'] : Object.keys(TYPE_LABELS);
  const save = async () => {
    const body = { object, label: p.label, ...(prop ? {} : { key: p.key || undefined }), type: p.type, options: String(p.options).split(/\n|,/).map((o: string) => o.trim()).filter(Boolean), group_key: p.group_key, description: p.description, required: p.required, unique: p.unique };
    const r = await act(() => (prop ? api.patch(`/api/properties/${prop.id}`, body) : api.post('/api/properties', body)), tx('Gespeichert'));
    if (r) onSaved();
  };
  return (
    <Modal title={prop ? tx('Eigenschaft „{label}“', { label: prop.label }) : tx('Neue Eigenschaft')} onClose={onClose} footer={<button className="btn" disabled={!p.label.trim()} onClick={save}>{tx('Speichern')}</button>}>
      <div className="grid2">
        <Field label={tx('Bezeichnung *')} tour="prop-label">
          <Input value={p.label} onChange={(v) => setP({ ...p, label: v })} autoFocus placeholder={tx('z. B. Vertragsende')} />
        </Field>
        <Field label={tx('Interner Name')} hint={prop ? tx('Lässt sich nicht mehr ändern') : tx('Leer = aus der Bezeichnung')}>
          <Input value={p.key} onChange={(v) => setP({ ...p, key: v })} disabled={!!prop} placeholder="vertragsende" className="mono" />
        </Field>
        <Field label={tx('Typ')} tour="prop-type">
          <Select value={p.type} onChange={(v) => setP({ ...p, type: v })} options={types.map((t) => [t, tx(TYPE_LABELS[t])] as [string, string])} />
        </Field>
        <Field label={tx('Gruppe')} tour="prop-group">
          <Select value={p.group_key} onChange={(v) => setP({ ...p, group_key: v })} placeholder={tx('ohne Gruppe')} options={groups.map((g) => [g.key, g.label] as [string, string])} />
        </Field>
      </div>
      {(p.type === 'select' || p.type === 'multiselect') && (
        <Field label={tx('Optionen (eine pro Zeile)')}>
          <Textarea value={p.options} onChange={(v) => setP({ ...p, options: v })} rows={4} placeholder={tx('Bronze\nSilber\nGold')} />
        </Field>
      )}
      <Field label={tx('Beschreibung')} hint={tx('Erscheint als Hilfe unter dem Feld')}>
        <Input value={p.description} onChange={(v) => setP({ ...p, description: v })} />
      </Field>
      {!contact && (
        <div className="row">
          <Check checked={p.required} onChange={(v) => setP({ ...p, required: v })} label={tx('Pflichtfeld')} />
          {!['checkbox', 'multiselect', 'textarea', 'file'].includes(p.type) && <Check checked={p.unique} onChange={(v) => setP({ ...p, unique: v })} label={tx('Eindeutig (keine zwei Datensätze mit gleichem Wert)')} />}
        </div>
      )}
      {contact && <p className="muted small">{tx('Kontakt-Eigenschaften sind die eigenen Felder der Kontakte – Platzhalter')} {'{{contact.custom.<interner name>}}'}.</p>}
    </Modal>
  );
}

function GroupModal({ object, group, onClose, onSaved }: { object: string; group?: any; onClose: () => void; onSaved: () => void }) {
  const tx = useT('b6objects');
  const [label, setLabel] = useState(group?.label ?? '');
  return (
    <Modal
      title={group ? tx('Gruppe umbenennen') : tx('Neue Gruppe')}
      onClose={onClose}
      footer={
        <button
          className="btn"
          disabled={!label.trim()}
          onClick={async () => (await act(() => (group ? api.patch(`/api/property-groups/${group.id}`, { label }) : api.post('/api/property-groups', { object, label })), tx('Gespeichert'))) && onSaved()}
        >
          {tx('Speichern')}
        </button>
      }
    >
      <Field label="Name">
        <Input value={label} onChange={setLabel} autoFocus placeholder={tx('z. B. Vertrieb')} />
      </Field>
    </Modal>
  );
}

function AssocLabels({ object, objects }: { object: string; objects: any[] }) {
  const tx = useT('b6objects');
  const types = useAssocTypes();
  const all = useLoad(() => api.get<any[]>('/api/association-labels'), [object]);
  const mine = (all.data ?? []).filter((l) => l.a_type === object || l.b_type === object);
  const [other, setOther] = useState('');
  const [name, setName] = useState('');
  const label = (t: string) => types.find((x) => x.type === t)?.label ?? objects.find((o) => o.key === t)?.label ?? t;
  return (
    <div className="card" data-tour="props-labels">
      <h2>
        <Icon name="link" /> {tx('Verknüpfungs-Labels')}
      </h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        {tx('Beschreiben, wie Datensätze zusammenhängen – z. B. Kontakt ↔ Firma: „Entscheider“, „Rechnungsempfänger“.')}
      </p>
      {mine.map((l) => {
        const o = l.a_type === object ? l.b_type : l.a_type;
        return (
          <div key={l.id} className="assoc-row">
            <div className="grow">
              <Badge tone="purple">{l.name}</Badge> <span className="muted small">{tx('mit {label}', { label: label(o) })}</span>
            </div>
            <button className="icon-btn" aria-label={tx('Label {name} löschen', { name: l.name })} onClick={() => confirmAsk(tx('Label „{name}“ löschen? Es verschwindet von allen Verknüpfungen.', { name: l.name })) && act(() => api.del(`/api/association-labels/${l.id}`)).then(all.reload)}>
              ✕
            </button>
          </div>
        );
      })}
      {!mine.length && <p className="muted small">{tx('Noch keine Labels.')}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <div style={{ width: 130 }}>
          <Select value={other} onChange={setOther} placeholder="mit…" options={types.filter((t) => t.type !== 'task').map((t) => [t.type, t.label] as [string, string])} />
        </div>
        <div className="grow">
          <Input value={name} onChange={setName} placeholder={tx('Label, z. B. Entscheider')} />
        </div>
        <button className="btn" disabled={!other || !name.trim()} aria-label={tx('Label anlegen')} onClick={() => act(() => api.post('/api/association-labels', { a_type: object, b_type: other, name }), tx('Label angelegt')).then((r) => r && (setName(''), all.reload()))}>
          +
        </button>
      </div>
    </div>
  );
}

export function Properties({ object: initial }: { object?: string }) {
  const tx = useT('b6objects');
  const meta = useLoad(() => api.get<any>('/api/properties'), []);
  const [object, setObject] = useState(initial || 'contact');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<any>(null);
  const [showStd, setShowStd] = useState(false);
  if (!meta.data) return <Spinner />;
  const objects: any[] = meta.data.objects;
  const obj = objects.find((o) => o.key === object) ?? objects[0];
  const props = meta.data.properties.filter((p: any) => p.object_key === obj.key && (!q || `${p.label} ${p.key}`.toLowerCase().includes(q.toLowerCase())));
  const groups = meta.data.groups.filter((g: any) => g.object_key === obj.key);
  const standard: any[] = meta.data.standard[obj.key] ?? [];
  const reload = () => (meta.reload(), refreshAssocTypes());
  const sections: [any | null, any[]][] = [[null, props.filter((p: any) => !p.group_key || !groups.some((g: any) => g.key === p.group_key))], ...groups.map((g: any) => [g, props.filter((p: any) => p.group_key === g.key)] as [any, any[]])];
  const contact = obj.key === 'contact';
  return (
    <>
      <PageHead title={tx('Eigenschaften')} sub={tx('Eigene Felder für Kontakte, Firmen, Deals und eigene Objekte – mit Gruppen und Verknüpfungs-Labels')}>
        <Link to="objects" className="btn secondary">
          <Icon name="objects" /> {tx('Objekte')}
        </Link>
      </PageHead>
      <Tabs tabs={objects.map((o) => [o.key, o.plural] as [string, string])} value={obj.key} onChange={(k) => (setObject(k), navigate(`properties/${k}`))} />
      <div className="row props-layout">
        <div className="grow" style={{ flex: '3 1 520px' }}>
          <div className="row list-tools" data-tour="props-tools">
            <div className="grow">
              <Input value={q} onChange={setQ} placeholder={tx('Eigenschaft suchen…')} />
            </div>
            <button className="btn secondary" data-tour="props-new-group" onClick={() => setModal({ kind: 'group' })}>
              {tx('+ Gruppe')}
            </button>
            <button className="btn" data-tour="props-new" onClick={() => setModal({ kind: 'prop' })}>
              {tx('+ Eigenschaft')}
            </button>
          </div>
          <div className="table-wrap" data-tour="props-table">
            <table className="t props-table">
              <thead>
                <tr>
                  <th>{tx('Bezeichnung')}</th>
                  <th>{tx('Interner Name')}</th>
                  <th>{tx('Typ')}</th>
                  <th></th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {sections.map(([g, list]) =>
                  g || list.length ? (
                    <PropSection key={g?.id ?? '_'} group={g} list={list} contact={contact} onEdit={(p) => setModal({ kind: 'prop', prop: p })} onEditGroup={(gr) => setModal({ kind: 'group', group: gr })} reload={reload} />
                  ) : null,
                )}
                {!props.length && !groups.length && (
                  <tr>
                    <td colSpan={5}>
                      <Empty>{tx('Noch keine eigenen Eigenschaften für {plural}.', { plural: obj.plural })}</Empty>
                    </td>
                  </tr>
                )}
                <tr className="group-row">
                  <td colSpan={5}>
                    <button className="th-sort" onClick={() => setShowStd(!showStd)} aria-expanded={showStd}>
                      {showStd ? '▾' : '▸'} {tx('Standard-Eigenschaften ({length})', { length: standard.length })}
                    </button>
                  </td>
                </tr>
                {showStd &&
                  standard.map((s) => (
                    <tr key={s.key} className="std-row">
                      <td>{s.label}</td>
                      <td className="mono muted">{s.key}</td>
                      <td>{tx(TYPE_LABELS[s.type] ?? s.type)}</td>
                      <td>
                        <Badge>{tx('Standard')}</Badge>
                      </td>
                      <td></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="card obj-info" data-tour="props-object">
            <h2>
              <Icon name={objIcon(obj.icon)} /> {obj.plural}
            </h2>
            <p className="muted small" style={{ marginTop: 0 }}>
              {obj.builtin ? tx('Standard-Objekt') : tx('Eigenes Objekt · interner Name {key}', { key: obj.key })}
              <br />
              {tx('{length} eigene Eigenschaften · {length2} Gruppen', { length: props.length, length2: groups.length })}
            </p>
            {obj.key === 'contact' && <p className="small">{tx('Werte stehen auf der Kontaktseite und in Platzhaltern')} {'{{contact.custom.…}}'}.</p>}
            {obj.key === 'opportunity' && <p className="small">{tx('Werte bearbeitest du im Deal-Dialog der Pipeline.')}</p>}
            {!obj.builtin && <Link to={`objects/${obj.key}`}>{tx('Zu den {plural} →', { plural: obj.plural })}</Link>}
            {obj.key === 'company' && <Link to="companies">{tx('Zu den Firmen →')}</Link>}
          </div>
          <AssocLabels object={obj.key} objects={objects} />
        </div>
      </div>
      {modal?.kind === 'prop' && <PropertyModal object={obj.key} prop={modal.prop} groups={groups} contact={contact} onClose={() => setModal(null)} onSaved={() => (setModal(null), reload())} />}
      {modal?.kind === 'group' && <GroupModal object={obj.key} group={modal.group} onClose={() => setModal(null)} onSaved={() => (setModal(null), reload())} />}
    </>
  );
}

function PropSection({ group, list, contact, onEdit, onEditGroup, reload }: { group: any | null; list: any[]; contact: boolean; onEdit: (p: any) => void; onEditGroup: (g: any) => void; reload: () => void }) {
  const tx = useT('b6objects');
  return (
    <>
      {group && (
        <tr className="group-row">
          <td colSpan={4}>
            <strong>{group.label}</strong> <span className="muted small">({list.length})</span>
          </td>
          <td className="actions-cell">
            <button className="icon-btn" aria-label={tx('Gruppe {label} umbenennen', { label: group.label })} onClick={() => onEditGroup(group)}>
              <Icon name="edit" size={14} />
            </button>
            <button className="icon-btn" aria-label={tx('Gruppe {label} löschen', { label: group.label })} onClick={() => confirmAsk(tx('Gruppe „{label}“ löschen? Die Eigenschaften bleiben (ohne Gruppe).', { label: group.label })) && act(() => api.del(`/api/property-groups/${group.id}`)).then(reload)}>
              ✕
            </button>
          </td>
        </tr>
      )}
      {list.map((p) => (
        <tr key={p.id} className="click" {...pressable(() => onEdit(p))}>
          <td>
            <strong>{p.label}</strong>
            {p.description && <div className="muted small">{p.description}</div>}
          </td>
          <td className="mono muted">{p.key}</td>
          <td>
            {tx(TYPE_LABELS[p.type] ?? p.type)}
            {p.options?.length ? <span className="muted small"> {tx('· {length} Optionen', { length: p.options.length })}</span> : null}
          </td>
          <td>
            {p.required && <Badge tone="yellow">{tx('Pflicht')}</Badge>} {p.unique && <Badge tone="purple">{tx('eindeutig')}</Badge>}
          </td>
          <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" aria-label={tx('{label} bearbeiten', { label: p.label })} onClick={() => onEdit(p)}>
              <Icon name="edit" size={14} />
            </button>
            <button
              className="icon-btn"
              aria-label={tx('{label} löschen', { label: p.label })}
              onClick={() => confirmAsk(contact ? tx('„{label}“ löschen? Die Werte bleiben am Kontakt gespeichert.', { label: p.label }) : tx('„{label}“ löschen? Die gespeicherten Werte werden entfernt.', { label: p.label })) && act(() => api.del(`/api/properties/${p.id}`)).then(reload)}
            >
              ✕
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

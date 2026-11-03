import { useEffect, useState } from 'react';
import { api, dt } from '../api';
import { Badge, Check, Empty, Field, Input, Select, Spinner, act, useLoad } from '../ui';
import { LegalNotice } from './ConsentKit';
import { useT } from '../i18n';
import { trData } from '../i18n/data';

/** Settings → Einwilligung & Recht → Checkout: the German rules for the buy page (button, AGB box, Widerruf, waiver) and the stored proof. */

const TYPES: [string, string][] = trData('b5consent', [
  ['none', 'Kein Widerrufs-Hinweis (z. B. B2B oder kostenlos)'],
  ['digital', 'Digitale Inhalte – Verzicht auf Widerruf per Checkbox'],
  ['service', 'Dienstleistung – Verlangen der sofortigen Ausführung per Checkbox'],
  ['physical', 'Ware mit Versand – 14 Tage Widerruf, keine Checkbox'],
]);
const KIND: Record<string, string> = trData('b5consent', { digital: 'Digitale Inhalte', service: 'Dienstleistung' });

export function CheckoutLaw() {
  const t = useT('b5consent');
  const { data, reload } = useLoad(() => api.get('/api/checkout-law/settings'), []);
  const list = useLoad(() => api.get<any[]>('/api/checkout-law/acceptances?limit=100'), []);
  const [s, setS] = useState<any>();
  useEffect(() => {
    if (data) setS(data.settings);
  }, [data]);
  if (!s) return <Spinner />;
  const set = (patch: any) => setS({ ...s, ...patch });
  const save = async () => {
    const r = await act(() => api.put('/api/checkout-law/settings', s), t('Gespeichert'));
    if (r) (setS(r.settings), void reload());
  };
  const productType = (id: string) => s.products[id] ?? '';
  const setProduct = (id: string, v: string) => {
    const next = { ...s.products };
    if (v) next[id] = v;
    else delete next[id];
    set({ products: next });
  };
  return (
    <>
      <LegalNotice />
      <div className="card" data-tour="law-settings">
        <h2>{t('Bestellseite nach deutschem Recht')}</h2>
        <p className="muted">{t('Für Kaufseiten (/buy) und Zahlungslinks: Der Bestell-Button nennt die Zahlungspflicht (§ 312j Abs. 3 BGB), die AGB werden per Pflicht-Checkbox akzeptiert, bei digitalen Inhalten und Dienstleistungen wird der Beginn vor Ablauf der Widerrufsfrist ausdrücklich bestätigt. Beides wird mit Zeitpunkt, Textversion und gekürzter IP zur Bestellung gespeichert.')}</p>
        <Check checked={s.enabled} onChange={(v) => set({ enabled: v })} label={<strong>{t('Regeln auf Kaufseiten anwenden')}</strong>} tour="law-enabled" />
        <div className="grid2">
          <Field label={t('Text des Bestell-Buttons')} hint={t('Muss „zahlungspflichtig“ oder „kostenpflichtig“ und ein Bestellwort enthalten.')}>
            <Input value={s.button_text} onChange={(v) => set({ button_text: v })} />
          </Field>
          <Field label={t('Adresse der AGB')} hint={t('Leer lassen: keine AGB-Checkbox.')}>
            <Input value={s.terms_url} onChange={(v) => set({ terms_url: v })} placeholder="https://…" />
          </Field>
          <Field label={t('Adresse der Widerrufsbelehrung')} hint={data.links.withdrawal ? t('Leer lassen: {withdrawal}', { withdrawal: data.links.withdrawal }) : t('Leer lassen, sobald die Firmendaten unter „Rechtstexte“ eingetragen sind, verlinkt der Checkout die gehostete Belehrung.')}>
            <Input value={s.withdrawal_url} onChange={(v) => set({ withdrawal_url: v })} placeholder="https://…" />
          </Field>
          <Field label={t('Standard für Produkte')}>
            <Select value={s.content_type} onChange={(v) => set({ content_type: v })} options={TYPES} />
          </Field>
        </div>
        <Check checked={s.confirmation_mail} onChange={(v) => set({ confirmation_mail: v })} label={t('Nach dem Kauf eine Bestätigungs-Mail mit AGB-/Widerrufsangaben schicken (dauerhafter Datenträger)')} />
        <p className="muted small">{t('Wortlaut der Verzichts-Checkbox (Digitale Inhalte): „{digital}“', { digital: data.waiver.digital })}</p>
        <p className="muted small">{t('Umsatzsteuer-Hinweis auf der Seite richtet sich nach den Rechnungs-Einstellungen („Kleinunternehmer“ nach § 19 UStG oder „inklusive gesetzlicher Umsatzsteuer“).')}</p>
      </div>

      {data.products.length > 0 && (
        <div className="card" data-tour="law-products">
          <h3>{t('Pro Produkt abweichen')}</h3>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t('Produkt')}</th><th>{t('Art')}</th></tr></thead>
              <tbody>
                {data.products.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><Select value={productType(p.id)} onChange={(v) => setProduct(p.id, v)} options={TYPES} placeholder={t('Wie Standard')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p><button className="btn" onClick={save} data-tour="law-save">{t('Speichern')}</button></p>

      <div className="card" data-tour="law-acceptances">
        <h3>{t('Gespeicherte Zustimmungen')}</h3>
        {!list.data?.length ? (
          <Empty>{t('Noch keine Bestellungen mit Zustimmung.')}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t('Wann')}</th><th>{t('Produkt')}</th><th>{t('E-Mail')}</th><th>{t('AGB')}</th><th>{t('Widerrufsverzicht')}</th></tr></thead>
              <tbody>
                {list.data.map((a) => (
                  <tr key={a.id}>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{dt(a.created_at)}</td>
                    <td>{a.product_name || '–'}</td>
                    <td className="small">{a.email || '–'}</td>
                    <td>{a.terms_version ? <Badge tone="green">V{a.terms_version}</Badge> : <Badge>–</Badge>}</td>
                    <td>{a.waiver_kind ? <Badge tone="green">{KIND[a.waiver_kind] ?? a.waiver_kind}</Badge> : <Badge>–</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

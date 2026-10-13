import type { ReactNode } from 'react';
import { flashText, isErrorCode, isWarnCode } from '@/lib/admin/flash';

export function Flash({ code }: { code?: string }) {
  const t = flashText(code);
  if (!t) return null;
  const err = isErrorCode(code) || isWarnCode(code);
  return <div className={`msg ${err ? 'err' : 'ok'}`} role={err ? 'alert' : 'status'}>{t}</div>;
}
export function Field({ label, name, defaultValue, type = 'text', help, wide, required, max, rows, placeholder }: { label: string; name: string; defaultValue?: string | number | null; type?: string; help?: string; wide?: boolean; required?: boolean; max?: number; rows?: number; placeholder?: string }) {
  const id = `f-${name}-${Math.abs(hash(label + String(defaultValue ?? '')))}`;
  return (
    <div className={`field${wide ? ' wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {rows ? <textarea id={id} name={name} rows={rows} defaultValue={defaultValue ?? ''} required={required} maxLength={max} placeholder={placeholder} />
        : <input id={id} name={name} type={type} defaultValue={defaultValue ?? ''} required={required} maxLength={max} placeholder={placeholder} />}
      {help && <small>{help}</small>}
    </div>
  );
}
export function Check({ label, name, checked }: { label: string; name: string; checked?: boolean }) {
  return <div className="field"><label className="chk"><input type="checkbox" name={name} defaultChecked={checked} />{label}</label></div>;
}
export function Confirm({ action, id, label = 'Excluir', extra }: { action: (fd: FormData) => Promise<void>; id: string; label?: string; extra?: ReactNode }) {
  return (
    <details>
      <summary className="btn small" style={{ listStyle: 'none' }}>{label}</summary>
      <form action={action} className="row" style={{ marginTop: 6 }}>
        <input type="hidden" name="id" value={id} />{extra}
        <button className="btn small solid" type="submit">Confirmar: {label.toLowerCase()}</button>
      </form>
    </details>
  );
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

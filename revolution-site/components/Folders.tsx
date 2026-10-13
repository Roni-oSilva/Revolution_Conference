'use client';
import { useState } from 'react';

export interface FolderItem { label: string; hint: string; href: string }
interface Props { kind: 'v' | 'f'; title: string; count: string; items: FolderItem[] }

/** Pasta de vidro que abre e mostra até 3 atalhos. Os atalhos só ficam clicáveis/focáveis com a pasta aberta. */
export function Folder({ kind, title, count, items }: Props) {
  const [open, setOpen] = useState(false);
  const list = items.slice(0, 3);
  return (
    <div className={`fo ${kind}${open ? ' open' : ''}`}>
      <div className="bk" />
      <div className="fl">
        {list.map((it, i) => (
          <a key={it.href + it.label} href={it.href} style={{ ['--i' as string]: i } as React.CSSProperties} tabIndex={open ? 0 : -1} aria-hidden={open ? undefined : true}>
            {it.label}<small>{it.hint}</small>
          </a>
        ))}
      </div>
      <button type="button" className="fr" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <b>{title}</b><i>{count}</i>
      </button>
    </div>
  );
}

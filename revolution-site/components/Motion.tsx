'use client';
import { useEffect } from 'react';
import { initMotion } from '@/lib/motion';

/** Liga as animações do site. Renderiza só a barra de progresso de rolagem. */
export function Motion() {
  useEffect(() => initMotion(), []);
  return <div className="progress" aria-hidden="true" />;
}

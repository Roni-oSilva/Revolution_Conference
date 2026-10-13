import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
/** Hora oficial do servidor (referência da contagem regressiva e da troca de fase). */
export function GET() {
  return NextResponse.json({ now: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}

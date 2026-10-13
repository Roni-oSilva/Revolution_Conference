import type { Metadata } from 'next';
import { LiveView } from '@/components/views/live';
import { ConfigMissing } from '@/components/States';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ao Vivo', description: 'Assista à transmissão ao vivo e reveja os vídeos da Revolution Conference.' };

export default async function Page() {
  const client = createPublicClient();
  if (!client) return <ConfigMissing />;
  return <LiveView client={client} />;
}

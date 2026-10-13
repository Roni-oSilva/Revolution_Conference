import type { Metadata } from 'next';
import { WallView } from '@/components/views/wall';
import { ConfigMissing } from '@/components/States';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mural', description: 'Publicações oficiais da Revolution Conference. Reaja e compartilhe.' };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const client = createPublicClient();
  if (!client) return <ConfigMissing />;
  const { page } = await searchParams;
  const n = Number.parseInt(page ?? '1', 10);
  return <WallView client={client} page={Number.isFinite(n) && n > 0 && n < 10000 ? n : 1} />;
}

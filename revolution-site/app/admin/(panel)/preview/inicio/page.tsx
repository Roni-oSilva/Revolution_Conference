import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { HomeView } from '@/components/views/home';
import type { Phase } from '@/lib/phase';

export default async function Page({ searchParams }: { searchParams: Promise<{ fase?: string }> }) {
  const { client } = await requireAdmin();
  const { fase } = await searchParams;
  const forcePhase: Phase | undefined = fase === 'pre' || fase === 'open' || fase === 'ended' ? fase : undefined;
  return (
    <>
      <div className="admin-banner" role="status">PRÉ-VISUALIZAÇÃO (somente admin) · fase: {forcePhase ?? 'automática'} · <Link href="/admin/preview" style={{ color: '#fff' }}>voltar</Link></div>
      <HomeView client={client} preview forcePhase={forcePhase} />
    </>
  );
}

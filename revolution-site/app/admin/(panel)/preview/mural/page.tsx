import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { WallView } from '@/components/views/wall';

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client } = await requireAdmin();
  const { page } = await searchParams;
  const n = Number.parseInt(page ?? '1', 10);
  return (<><div className="admin-banner" role="status">PRÉ-VISUALIZAÇÃO (somente admin) · inclui rascunhos e ocultas · <Link href="/admin/preview" style={{ color: '#fff' }}>voltar</Link></div><WallView client={client} preview basePath="/admin/preview/mural" page={Number.isFinite(n) && n > 0 ? n : 1} /></>);
}

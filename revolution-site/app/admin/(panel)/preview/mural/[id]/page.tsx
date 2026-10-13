import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { PostView } from '@/components/views/wall';
import { isUuid } from '@/lib/reactions';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { client } = await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return (<><div className="admin-banner" role="status">PRÉ-VISUALIZAÇÃO (somente admin) · <Link href="/admin/mural" style={{ color: '#fff' }}>voltar ao painel</Link></div><PostView client={client} id={id} preview basePath="/admin/preview/mural" /></>);
}

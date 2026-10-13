import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { LiveView } from '@/components/views/live';

export default async function Page() {
  const { client } = await requireAdmin();
  return (<><div className="admin-banner" role="status">PRÉ-VISUALIZAÇÃO (somente admin) · <Link href="/admin/preview" style={{ color: '#fff' }}>voltar</Link></div><LiveView client={client} preview /></>);
}

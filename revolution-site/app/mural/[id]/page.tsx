import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostView } from '@/components/views/wall';
import { ConfigMissing } from '@/components/States';
import { createPublicClient } from '@/lib/supabase/public';
import { getWallPost } from '@/lib/data';
import { isUuid } from '@/lib/reactions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = createPublicClient();
  if (!c || !isUuid(id)) return { title: 'Mural' };
  const r = await getWallPost(c, id);
  const p = r.data;
  if (!p) return { title: 'Publicação', robots: { index: false } };
  const title = p.title || 'Publicação do mural';
  const description = p.body.slice(0, 160);
  return { title, description, openGraph: { title, description, type: 'article' }, alternates: { canonical: `/mural/${id}` } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const client = createPublicClient();
  if (!client) return <ConfigMissing />;
  return <PostView client={client} id={id} />;
}

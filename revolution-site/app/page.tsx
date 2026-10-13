import { HomeView } from '@/components/views/home';
import { ConfigMissing } from '@/components/States';
import { Intro } from '@/components/Intro';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const client = createPublicClient();
  if (!client) return <ConfigMissing />;
  const { album } = await searchParams;
  return (
    <>
      <Intro />
      <HomeView client={client} album={typeof album === 'string' ? album.slice(0, 60) : ''} />
    </>
  );
}

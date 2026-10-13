import { HomeView } from '@/components/views/home';
import { ConfigMissing } from '@/components/States';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const client = createPublicClient();
  if (!client) return <ConfigMissing />;
  return <HomeView client={client} />;
}

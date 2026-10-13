import { handleReactionPost } from '@/lib/reactions-server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleReactionPost(req, { service: createServiceClient(), salt: serverEnv().rateLimitSalt });
}

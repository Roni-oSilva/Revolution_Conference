import { handleMineGet } from '@/lib/reactions-server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleMineGet(req, { service: createServiceClient(), salt: serverEnv().rateLimitSalt });
}

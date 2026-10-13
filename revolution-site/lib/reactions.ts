import { z } from 'zod';

export const REACTION_EMOJIS = ['❤️', '🙌', '🔥', '👏', '😍'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
export const REACTION_LABELS: Record<ReactionEmoji, string> = { '❤️': 'Curtir', '🙌': 'Aleluia', '🔥': 'Fogo', '👏': 'Palmas', '😍': 'Amei' };

const UUID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'uuid inválido');

export const reactionBodySchema = z.object({
  postId: UUID,
  anonId: UUID,
  emoji: z.enum(REACTION_EMOJIS).nullable(),
}).strict();
export type ReactionBody = z.infer<typeof reactionBodySchema>;

export const mineQuerySchema = z.object({
  anonId: UUID,
  postIds: z.array(UUID).min(1).max(50),
});

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.safeParse(v).success;

import type { ReactionEmoji } from './reactions';

export type Availability = 'unknown' | 'ok' | 'unavailable';
export type PostStatus = 'draft' | 'published' | 'hidden';

export interface SiteSettings {
  id: number; site_title: string; tagline: string; seo_description: string;
  hero_image_url: string | null; instagram_url: string | null; youtube_channel_url: string | null; whatsapp_url: string | null;
  privacy_text: string | null; reactions_enabled: boolean; reaction_limit_per_minute: number; reaction_limit_per_ip_minute: number; updated_at: string;
}
export interface EventSettings {
  id: number; name: string; description: string; timezone: string;
  starts_at: string | null; opens_at: string | null; ends_at: string | null;
  location_name: string | null; address: string | null; maps_url: string | null;
  stream_enabled: boolean; stream_url: string | null; stream_video_id: string | null; stream_note: string; updated_at: string;
}
export interface MediaRow {
  id: string; original_url: string; drive_file_id: string; title: string; alt: string; caption: string; album: string; position: number;
  is_featured: boolean; is_published: boolean; availability: Availability; checked_at: string | null; created_at: string;
}
export interface VideoRow {
  id: string; title: string; description: string; category: string; youtube_id: string; url: string; position: number;
  is_published: boolean; availability: Availability; checked_at: string | null; created_at: string;
}
export interface ScheduleRow {
  id: string; day_label: string; time_label: string; title: string; description: string; position: number; is_published: boolean; created_at: string;
}
export interface WallPostRow {
  id: string; title: string; body: string; image_media_id: string | null; position: number; status: PostStatus;
  is_highlight: boolean; published_at: string | null; created_at: string; updated_at: string;
}
export interface WallPost extends WallPostRow {
  media: Pick<MediaRow, 'drive_file_id' | 'alt' | 'availability'> | null;
  counts: Partial<Record<ReactionEmoji, number>>;
}

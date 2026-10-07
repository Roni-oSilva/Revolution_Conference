export type Role = "USER" | "ADMIN";
export interface Profile { id: string; user_id: string; name: string; avatar_url: string | null; role: Role; status: "active" | "blocked" }
export interface EventRow { id: string; name: string; slug: string; description: string | null; start_date: string; end_date: string; cover_image: string | null; drive_folder_id: string | null; status: string }
export interface Media {
  id: string; event_id: string; drive_file_id: string; title: string; description: string | null;
  category: string | null; drive_url: string; thumbnail_url: string | null; is_featured: boolean; created_at: string;
  likes?: { count: number }[]; comments?: { count: number }[];
}
export interface CommentRow {
  id: string; user_id: string; photo_id: string | null; video_id: string | null; parent_id: string | null;
  content: string; status: string; created_at: string; profiles: { name: string; avatar_url: string | null } | null;
}
export type Kind = "photo" | "video";
export const CATEGORIES = ["Abertura", "Louvor", "Ministração", "Oração", "Comunidade", "Bastidores", "Encerramento"];

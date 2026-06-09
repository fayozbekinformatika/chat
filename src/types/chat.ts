export type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: string | null;
};

export type Chat = {
  id: string;
  title: string | null;
  is_group: boolean;
  created_at: string;
};

export type ChatMember = {
  chat_id: string;
  user_id: string;
  role: string;
  profile: Profile;
};

export type Message = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  message_type: "text" | "image" | "audio" | "file";
  file_url: string | null;
  file_name: string | null;
  edited_at: string | null;
  created_at: string;
  sender?: Profile;
};

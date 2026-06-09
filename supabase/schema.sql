-- Run this in Supabase SQL editor
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  username text unique not null,
  full_name text not null,
  avatar_url text,
  last_seen_at timestamptz default timezone('utc'::text, now()),
  is_online boolean default false,
  created_at timestamptz default timezone('utc'::text, now())
);

create table if not exists public.chats (
  id uuid primary key default uuid_generate_v4(),
  title text,
  is_group boolean default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now())
);

create table if not exists public.chat_members (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default timezone('utc'::text, now()),
  unique (chat_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  message_type text default 'text',
  file_url text,
  file_name text,
  edited_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now())
);

create table if not exists public.message_reads (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz default timezone('utc'::text, now()),
  unique (message_id, user_id)
);

create policy "Public profiles are visible" on public.profiles
for select using (true);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
for insert with check (auth.uid() = id);

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;

create policy "Members can see chats" on public.chats
for select using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = id and cm.user_id = auth.uid()
  )
);

create policy "Any authenticated user creates chat" on public.chats
for insert with check (auth.uid() is not null);

create policy "Members can see members" on public.chat_members
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat_id and cm.user_id = auth.uid()
  )
);

create policy "Authenticated can join chats" on public.chat_members
for insert with check (auth.uid() is not null);

create policy "Members can see messages" on public.messages
for select using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat_id and cm.user_id = auth.uid()
  )
);

create policy "Members can send messages" on public.messages
for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat_id and cm.user_id = auth.uid()
  )
);

create policy "Sender can edit own messages" on public.messages
for update using (sender_id = auth.uid());

create policy "Sender can delete own messages" on public.messages
for delete using (sender_id = auth.uid());

create policy "Members can read statuses" on public.message_reads
for select using (
  exists (
    select 1
    from public.messages m
    join public.chat_members cm on cm.chat_id = m.chat_id
    where m.id = message_id and cm.user_id = auth.uid()
  )
);

create policy "Authenticated can mark read" on public.message_reads
for insert with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

create policy "Authenticated upload files" on storage.objects
for insert to authenticated
with check (bucket_id = 'chat-files');

create policy "Public read files" on storage.objects
for select using (bucket_id = 'chat-files');

create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set last_seen_at = timezone('utc'::text, now()), is_online = true
  where id = auth.uid();
end;
$$;

create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(p_email)
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;

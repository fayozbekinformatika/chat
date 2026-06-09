-- Existing project uchun patch (agar schema allaqachon ishlagan bo'lsa)
alter table public.profiles
add column if not exists email text;

-- Null email bo'lgan profillarni to'ldirish
update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

alter table public.profiles
alter column email set not null;

create unique index if not exists profiles_email_unique_idx on public.profiles (email);

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

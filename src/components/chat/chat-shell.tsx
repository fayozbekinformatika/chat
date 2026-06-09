/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, LogOut, Paperclip, Send, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { formatLastSeen } from "@/lib/utils";
import type { Chat, Message, Profile } from "@/types/chat";
import { ThemeToggle } from "@/components/providers/theme-toggle";

type ChatWithMeta = Chat & {
  members: Profile[];
  lastMessage: Message | null;
};

export function ChatShell() {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (err: unknown) {
      setSupabaseError(err instanceof Error ? err.message : "Supabase sozlanmagan");
    }
  }, []);

  const [me, setMe] = useState<Profile | null>(null);
  const [chats, setChats] = useState<ChatWithMeta[]>([]);
  const [activeChat, setActiveChat] = useState<ChatWithMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const activeChannelRef = useRef<unknown>(null);

  const openChat = useCallback(
    async (chat: ChatWithMeta) => {
      if (!supabase) return;
      setActiveChat(chat);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });

      setMessages((data as Message[]) ?? []);

      if (activeChannelRef.current) {
        void supabase.removeChannel(activeChannelRef.current as never);
      }

      const channel = supabase
        .channel(`chat:${chat.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chat.id}`,
          },
          ({ new: row }) => {
            setMessages((prev) => [...prev, row as Message]);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chat.id}`,
          },
          ({ new: row }) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === (row as Message).id ? (row as Message) : m))
            );
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `chat_id=eq.${chat.id}`,
          },
          ({ old }) => {
            setMessages((prev) => prev.filter((m) => m.id !== (old as Message).id));
          }
        )
        .subscribe();

      activeChannelRef.current = channel;
    },
    [supabase]
  );

  const loadChats = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const { data: memberships } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", userId);

      const chatIds = memberships?.map((m) => m.chat_id) ?? [];
      if (!chatIds.length) return;

      const { data: chatRows } = await supabase
        .from("chats")
        .select("*")
        .in("id", chatIds)
        .order("created_at", { ascending: false });

      if (!chatRows) return;

      const assembled: ChatWithMeta[] = [];

      for (const chat of chatRows as Chat[]) {
        const [{ data: memberRows }, { data: msgRows }] = await Promise.all([
          supabase.from("chat_members").select("user_id").eq("chat_id", chat.id),
          supabase
            .from("messages")
            .select("*")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1),
        ]);

        const memberIds = memberRows?.map((m) => m.user_id) ?? [];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", memberIds);

        assembled.push({
          ...chat,
          members: profiles ?? [],
          lastMessage: msgRows?.[0] ?? null,
        });
      }

      setChats(assembled);
      if (!activeChat && assembled.length > 0) {
        await openChat(assembled[0]);
      }
    },
    [supabase, activeChat, openChat]
  );

  const ensureSavedMessages = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const { data: memberships } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", userId);

      const chatIds = memberships?.map((m) => m.chat_id) ?? [];
      const hasSavedMessages = chatIds.length > 0;

      if (hasSavedMessages) {
        const { data: existing } = await supabase
          .from("chats")
          .select("*")
          .in("id", chatIds)
          .eq("title", "Saved Messages")
          .maybeSingle();

        if (existing) return;
      }

      const { data: chat } = await supabase
        .from("chats")
        .insert({ is_group: false, title: "Saved Messages", created_by: userId })
        .select("*")
        .single();

      if (chat) {
        await supabase
          .from("chat_members")
          .insert({ chat_id: chat.id, user_id: userId, role: "owner" });
      }
    },
    [supabase]
  );

  const bootstrap = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
      router.replace("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setMe(profile);
    await supabase.from("profiles").update({ is_online: true }).eq("id", user.id);
    await ensureSavedMessages(user.id);
    await loadChats(user.id);
  }, [supabase, router, ensureSavedMessages, loadChats]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    return () => {
      if (supabase && activeChannelRef.current) {
        void supabase.removeChannel(activeChannelRef.current as never);
      }
    };
  }, [supabase]);

  const sendMessage = async () => {
    if (!supabase) return;
    if (!activeChat || !text.trim() || !me) return;

    await supabase.from("messages").insert({
      chat_id: activeChat.id,
      sender_id: me.id,
      body: text,
      message_type: "text",
    });

    setText("");
  };

  const uploadFile = async (file: File) => {
    if (!supabase) return;
    if (!activeChat || !me) return;

    const path = `${activeChat.id}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("chat-files")
      .upload(path, file, { upsert: false });

    if (error || !data) return;

    const { data: urlData } = supabase.storage.from("chat-files").getPublicUrl(data.path);

    await supabase.from("messages").insert({
      chat_id: activeChat.id,
      sender_id: me.id,
      body: file.type.startsWith("image") ? "Image" : file.name,
      message_type: file.type.startsWith("image") ? "image" : "file",
      file_url: urlData.publicUrl,
      file_name: file.name,
    });
  };

  const deleteMessage = async (id: string) => {
    if (!supabase) return;
    await supabase.from("messages").delete().eq("id", id);
  };

  const editMessage = async (id: string, body: string) => {
    if (!supabase) return;
    await supabase
      .from("messages")
      .update({ body, edited_at: new Date().toISOString() })
      .eq("id", id);
  };

  const logout = async () => {
    if (!supabase) return;
    if (me) {
      await supabase
        .from("profiles")
        .update({ is_online: false, last_seen_at: new Date().toISOString() })
        .eq("id", me.id);
    }
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  const searchUsers = async () => {
    if (!supabase) return;
    if (!userSearch.trim()) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`)
      .limit(10);

    setUsers(data ?? []);
  };

  const startDirectChat = async (target: Profile) => {
    if (!supabase) return;
    if (!me) return;

    const myMemberships = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", me.id);
    const targetMemberships = await supabase
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", target.id);

    const myIds = new Set((myMemberships.data ?? []).map((m) => m.chat_id));
    const commonIds = (targetMemberships.data ?? [])
      .map((m) => m.chat_id)
      .filter((id) => myIds.has(id));

    if (commonIds.length > 0) {
      const { data: directCandidates } = await supabase
        .from("chats")
        .select("id")
        .in("id", commonIds)
        .eq("is_group", false);

      for (const chat of directCandidates ?? []) {
        const { data: members } = await supabase
          .from("chat_members")
          .select("user_id")
          .eq("chat_id", chat.id);
        const memberIds = (members ?? []).map((m) => m.user_id);
        const hasExactPair =
          memberIds.length === 2 &&
          memberIds.includes(me.id) &&
          memberIds.includes(target.id);

        if (hasExactPair) {
          await loadChats(me.id);
          return;
        }
      }
    }

    const { data: createdChat } = await supabase
      .from("chats")
      .insert({ is_group: false, title: null, created_by: me.id })
      .select("*")
      .single();

    if (!createdChat) return;

    await supabase.from("chat_members").insert([
      { chat_id: createdChat.id, user_id: me.id, role: "owner" },
      { chat_id: createdChat.id, user_id: target.id, role: "member" },
    ]);

    await loadChats(me.id);
  };

  const createGroup = async () => {
    if (!supabase) return;
    if (!me) return;

    const title = window.prompt("Guruh nomi");
    const usersInput = window.prompt("Username larni vergul bilan kiriting");
    if (!title || !usersInput) return;

    const usernames = usersInput
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const { data: targets } = await supabase
      .from("profiles")
      .select("*")
      .in("username", usernames);

    const { data: createdChat } = await supabase
      .from("chats")
      .insert({ is_group: true, title, created_by: me.id })
      .select("*")
      .single();

    if (!createdChat) return;

    const members = [
      { chat_id: createdChat.id, user_id: me.id, role: "owner" },
      ...(targets ?? []).map((u) => ({ chat_id: createdChat.id, user_id: u.id, role: "member" })),
    ];

    await supabase.from("chat_members").insert(members);
    await loadChats(me.id);
  };

  const filteredChats = chats.filter((chat) => {
    const title = chat.is_group
      ? chat.title ?? "Group"
      : chat.members.find((m) => m.id !== me?.id)?.full_name ?? "Unknown";

    return title.toLowerCase().includes(query.toLowerCase());
  });

  if (!supabase) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
        {supabaseError ?? "Supabase yuklanmoqda..."}
      </div>
    );
  }

  return (
    <div className="grid h-screen grid-cols-12 bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="col-span-12 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:col-span-4 lg:col-span-3">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chat qidirish"
            className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <ThemeToggle />
          <button
            onClick={createGroup}
            className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700"
            title="Create group"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button onClick={logout} className="rounded-lg border border-zinc-300 p-2 dark:border-zinc-700">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Foydalanuvchi topish"
              className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
            <button onClick={searchUsers} className="rounded-lg bg-sky-600 px-3 text-white">
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
          {!!users.length && (
            <div className="mt-2 space-y-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => void startDirectChat(u)}
                  className="block w-full rounded-lg bg-zinc-100 px-3 py-2 text-left text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  @{u.username} - {u.full_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-[calc(100vh-140px)] overflow-y-auto">
          {filteredChats.map((chat) => {
            const peer = chat.members.find((m) => m.id !== me?.id);
            const title = chat.is_group ? chat.title ?? "Group" : peer?.full_name ?? "Saved Messages";

            return (
              <button
                key={chat.id}
                onClick={() => void openChat(chat)}
                className={`w-full border-b border-zinc-200 px-3 py-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${
                  activeChat?.id === chat.id ? "bg-sky-50 dark:bg-sky-900/30" : ""
                }`}
              >
                <p className="font-medium">{title}</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {chat.lastMessage?.body ?? "No messages yet"}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="col-span-12 flex h-screen flex-col md:col-span-8 lg:col-span-9">
        {activeChat ? (
          <>
            <header className="border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-semibold">
                {activeChat.is_group
                  ? activeChat.title ?? "Group"
                  : activeChat.members.find((m) => m.id !== me?.id)?.full_name ?? "Saved Messages"}
              </h2>
              {!activeChat.is_group && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatLastSeen(
                    activeChat.members.find((m) => m.id !== me?.id)?.last_seen_at ?? null,
                    Boolean(activeChat.members.find((m) => m.id !== me?.id)?.is_online)
                  )}
                </p>
              )}
            </header>

            <section className="flex-1 space-y-3 overflow-y-auto bg-zinc-100 p-4 dark:bg-zinc-950">
              {messages.map((m) => {
                const mine = m.sender_id === me?.id;

                return (
                  <div
                    key={m.id}
                    className={`max-w-xl rounded-2xl px-3 py-2 ${
                      mine
                        ? "ml-auto bg-sky-600 text-white"
                        : "bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    }`}
                  >
                    {m.file_url ? (
                      m.message_type === "image" ? (
                        <Image
                          src={m.file_url}
                          alt={m.file_name ?? "image"}
                          width={480}
                          height={240}
                          unoptimized
                          className="mb-2 max-h-56 rounded-lg object-cover"
                        />
                      ) : (
                        <a
                          href={m.file_url}
                          target="_blank"
                          className="mb-2 block underline"
                          rel="noreferrer"
                        >
                          {m.file_name ?? "Fayl"}
                        </a>
                      )
                    ) : null}

                    <p>{m.body}</p>

                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-80">
                      <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                      {mine ? (m.edited_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />) : null}
                    </div>

                    {mine && (
                      <div className="mt-1 flex gap-2 text-[10px]">
                        <button
                          onClick={() => {
                            const nextBody = window.prompt("Yangi matn", m.body ?? "");
                            if (nextBody) void editMessage(m.id, nextBody);
                          }}
                          className="underline"
                        >
                          Edit
                        </button>
                        <button onClick={() => void deleteMessage(m.id)} className="underline">
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <footer className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex gap-2">
                <label className="flex cursor-pointer items-center rounded-lg border border-zinc-300 px-3 dark:border-zinc-700">
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFile(file);
                    }}
                  />
                </label>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendMessage();
                  }}
                  placeholder="Xabar yozing"
                  className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-4 py-2 dark:border-zinc-700"
                />
                <button
                  onClick={() => void sendMessage()}
                  className="rounded-xl bg-sky-600 px-4 text-white hover:bg-sky-700"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-500">Chat tanlang</div>
        )}
      </main>
    </div>
  );
}

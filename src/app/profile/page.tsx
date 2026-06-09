/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-client";

export default function ProfilePage() {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profile) {
      setUsername(profile.username ?? "");
      setFullName(profile.full_name ?? "");
      setAvatar(profile.avatar_url ?? "");
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    await supabase.from("profiles").upsert({
      id: data.user.id,
      username,
      full_name: fullName,
      avatar_url: avatar,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
      <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-4 text-xl font-semibold">Profil sozlamalari</h1>
        <div className="space-y-3">
          <input className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Ism" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <input className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" placeholder="Avatar URL" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
          <button onClick={save} className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">Saqlash</button>
          {saved && <p className="text-sm text-emerald-500">Saqlandi</p>}
        </div>
      </div>
    </main>
  );
}

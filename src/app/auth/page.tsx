import { AuthForm } from "@/components/auth/auth-form";

export default function AuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 dark:bg-zinc-950">
      <AuthForm />
    </main>
  );
}

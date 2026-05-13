import { redirect } from "next/navigation";
import { issueSession, resolveRoleFromPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function loginAction(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const role = resolveRoleFromPassword(password);
  if (!role) {
    redirect(`/login?next=${encodeURIComponent(next || "/")}&error=invalid`);
  }
  await issueSession(role);
  redirect(next || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "invalid";
  return (
    <main className="min-h-screen grid place-items-center bg-[#f5f7f2] p-6">
      <form action={loginAction} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm grid gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-lime-700">Presence Labs</p>
          <h1 className="mt-2 text-2xl font-black">Sign in</h1>
          <p className="mt-2 text-sm text-slate-500">Enter your role password to access the operator dashboard.</p>
        </div>
        <input type="hidden" name="next" value={params.next || "/"} />
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Password
          <input
            name="password"
            type="password"
            required
            className="h-11 rounded-2xl border border-slate-200 px-3 outline-none focus:border-lime-400"
          />
        </label>
        <button className="h-11 rounded-2xl bg-slate-950 text-sm font-black text-white hover:bg-slate-800">
          Continue
        </button>
        {hasError ? <p className="text-xs font-bold text-rose-600">Invalid password.</p> : null}
      </form>
    </main>
  );
}

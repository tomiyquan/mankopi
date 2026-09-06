import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { notify } from "../lib/notify";
import { Icons } from "../ui/icons";
import { Button, Field, TextInput } from "../ui/kit";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@mankopi.local");
  const [password, setPassword] = useState("ChangeMeNow!23");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(email, password);
      void notify.success("Berhasil masuk", "Selamat bekerja.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal masuk";
      setError(message);
      void notify.error("Gagal masuk", message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="mesh relative hidden overflow-hidden text-white lg:flex flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-leaf-glow text-leaf-deep">
            <Icons.spark className="h-5 w-5" />
          </span>
          <p className="text-xl font-extrabold">Mankopi</p>
        </div>
        <div className="max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-leaf-glow">SaaS koperasi</p>
          <h1 className="mt-4 text-5xl font-extrabold leading-[1.1] tracking-tight">
            Operasi koperasi yang rapi, tanpa kira-kira.
          </h1>
          <p className="mt-5 max-w-md text-white/70 leading-7">
            Multi-tenant, hak akses berjenjang, dan fondasi ledger untuk neraca serta penagihan harian.
          </p>
        </div>
        <p className="text-sm text-white/40">Fase 1 — identitas, cabang, audit</p>
      </section>
      <section className="flex items-center justify-center bg-canvas p-6">
        <form onSubmit={onSubmit} className="page-enter w-full max-w-md rounded-[28px] border border-line bg-white p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf-dark">Selamat datang</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Masuk ke konsol</h2>
          <p className="mt-2 text-sm text-mute">
            Operator platform: <span className="font-medium text-ink">admin@mankopi.local</span>. Admin koperasi
            adalah Ketua, bukan manajer: <span className="font-medium text-ink">ketua@sejahtera.local</span>.
          </p>
          <div className="mt-8 space-y-4">
            <Field label="Email">
              <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </Field>
            <Field label="Kata sandi">
              <TextInput value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
          <Button type="submit" disabled={pending} className="mt-6 w-full">
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>
        </form>
      </section>
    </div>
  );
}

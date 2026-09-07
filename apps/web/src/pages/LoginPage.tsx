import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { notify } from "../lib/notify";
import { BrandLogo } from "../ui/BrandLogo";
import { Button, Field, PasswordInput, TextInput } from "../ui/kit";

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
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="mesh relative hidden overflow-hidden text-white lg:flex flex-col justify-between p-12 xl:p-16">
        <header className="flex items-start justify-between gap-6">
          <div className="min-w-0 pt-1">
            <p className="text-[1.65rem] font-extrabold leading-none tracking-tight">Mankopi</p>
            <p className="mt-2 text-xs font-medium tracking-wide text-white/45">Konsol pengurus koperasi</p>
          </div>
          <BrandLogo size="badge" framed={false} className="shrink-0 mix-blend-screen" />
        </header>
        <div className="max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-leaf-glow">Koperasi simpan-pinjam</p>
          <h1 className="mt-4 text-[2.55rem] font-extrabold leading-[1.15] tracking-tight xl:text-[2.85rem]">
            Tata kelola koperasi yang tertib, tercatat, dan akuntabel.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-white/68">
            Konsol operasional untuk keanggotaan, pembukuan, kredit, dan penagihan harian, dengan hak akses
            berjenjang sesuai struktur organisasi.
          </p>
        </div>
        <p className="text-sm text-white/38">Identitas · pembukuan · jejak audit</p>
      </section>
      <section className="flex items-center justify-center bg-canvas px-4 py-10 sm:p-8">
        <form
          onSubmit={onSubmit}
          className="page-enter w-full max-w-[420px] rounded-[28px] border border-line/90 bg-white p-7 shadow-card sm:p-9"
        >
          <div className="mb-7 flex items-center justify-between gap-4 lg:hidden">
            <p className="text-lg font-extrabold tracking-tight">Mankopi</p>
            <BrandLogo size="compact" className="rounded-xl ring-1 ring-line" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-leaf-dark">Konsol Mankopi</p>
          <h2 className="mt-2 text-[1.75rem] font-extrabold tracking-tight text-ink">Masuk ke akun Anda</h2>
          <p className="mt-2 text-sm leading-6 text-mute">Gunakan email pengurus atau operator platform yang terdaftar.</p>
          <div className="mt-8 space-y-4">
            <Field label="Email">
              <TextInput
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Kata sandi">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
          <Button type="submit" disabled={pending} className="mt-7 h-11 w-full text-[15px]">
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>
          <p className="mt-7 border-t border-line/80 pt-4 text-[11px] leading-5 text-mute">
            Akun demo: <span className="font-medium text-ink">admin@mankopi.local</span> (platform) ·{" "}
            <span className="font-medium text-ink">ketua@sejahtera.local</span> (ketua).
          </p>
        </form>
      </section>
    </div>
  );
}

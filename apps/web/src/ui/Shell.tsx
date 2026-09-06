import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { confirmAction, notify } from "../lib/notify";
import { useWorkspace } from "../lib/workspace";
import { Icons } from "./icons";
import { Avatar, cx } from "./kit";

const groups = [
  {
    label: null,
    items: [{ to: "/", label: "Ringkasan", permission: null, icon: Icons.home }],
  },
  {
    label: "Operasional",
    items: [
      { to: "/members", label: "Anggota", permission: "member:view", icon: Icons.users },
      { to: "/savings", label: "Kas simpanan", permission: "savings:view", icon: Icons.book },
      { to: "/loans", label: "Pinjaman", permission: "loan:view", icon: Icons.journal },
      { to: "/collection", label: "Penagihan", permission: "collection:view", icon: Icons.pin },
      { to: "/personnel", label: "Personalia", permission: "hr:employee:manage", icon: Icons.users },
      { to: "/payroll", label: "Payroll", permission: "hr:payroll:view", icon: Icons.journal },
    ],
  },
  {
    label: "Data induk",
    items: [
      { to: "/setup", label: "Setup awal", permission: "savings:view", icon: Icons.sliders },
      { to: "/accounts", label: "Perkiraan", permission: "ledger:view", icon: Icons.book },
      { to: "/periods", label: "Periode", permission: "ledger:view", icon: Icons.calendar },
      { to: "/products", label: "Produk", permission: "savings:view", icon: Icons.tag },
      { to: "/calendar", label: "Kalender", permission: "loan:view", icon: Icons.calendar },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { to: "/journals", label: "Jurnal", permission: "ledger:view", icon: Icons.journal },
      { to: "/reports", label: "Laporan", permission: "ledger:view", icon: Icons.chart },
      { to: "/shu", label: "PHU & SHU", permission: "ledger:view", icon: Icons.book },
      { to: "/analytics", label: "Analitik", permission: "report:phu:view", icon: Icons.chart },
    ],
  },
  {
    label: "Organisasi",
    items: [
      { to: "/tenants", label: "Koperasi", permission: "platform:tenant:manage", icon: Icons.building },
      { to: "/branches", label: "Cabang", permission: "org:branch:view", icon: Icons.pin },
      { to: "/users", label: "Pengguna", permission: "identity:user:manage", icon: Icons.users },
      { to: "/roles", label: "Hak akses", permission: "identity:role:manage", icon: Icons.shield },
      { to: "/audit", label: "Audit", permission: "audit:view", icon: Icons.pulse },
    ],
  },
] as const;

export function Shell() {
  const { user, logout } = useAuth();
  const { tenantId, setTenantId, tenants, activeTenant } = useWorkspace();
  const [open, setOpen] = useState(false);

  const visible = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((l) => {
        if (l.to === "/products") {
          return Boolean(user?.permissions.includes("savings:view") || user?.permissions.includes("loan:view"));
        }
        if (l.to === "/setup") {
          return Boolean(user?.permissions.includes("savings:view") || user?.permissions.includes("ledger:view"));
        }
        return !l.permission || user?.permissions.includes(l.permission);
      }),
    }))
    .filter((g) => g.items.length > 0);

  const roleLabel = user?.isPlatformAdmin ? "Platform" : user?.tenantSlug ?? "Pengguna";

  const nav = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 pr-5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-leaf-glow text-leaf-deep">
          <Icons.spark className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold leading-none tracking-tight">Mankopi</p>
          <p className="mt-1.5 truncate text-xs text-white/45">Manajemen koperasi</p>
        </div>
      </div>
      <nav className="sidebar-scroll mt-5 min-h-0 flex-1 space-y-4">
        {visible.map((group) => (
          <div key={group.label ?? "root"}>
            {group.label ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{group.label}</p>
            ) : null}
            <div className="space-y-1 pr-2">
              {group.items.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      "grid grid-cols-[1.25rem_1fr] items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium leading-none transition duration-200",
                      isActive ? "bg-white/10 text-white shadow-inner" : "text-white/70 hover:bg-white/5 hover:text-white",
                    )
                  }
                >
                  <l.icon className="h-4 w-4 justify-self-center" />
                  <span className="truncate">{l.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-3 shrink-0 pr-5">
        <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-2xl bg-white/5 px-3 py-3">
          <Avatar name={user?.name ?? "User"} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-none">{user?.name}</p>
            <p className="mt-1.5 truncate text-xs text-white/45">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void confirmAction({
                title: "Keluar dari konsol?",
                text: "Sesi akan ditutup. Masuk lagi untuk lanjut bekerja.",
                confirmText: "Keluar",
                danger: true,
              }).then((ok) => {
                if (ok) logout();
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white/80 transition duration-200 hover:bg-white/15"
            aria-label="Keluar"
          >
            <Icons.logout className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="box-border h-svh overflow-hidden bg-canvas p-3 lg:p-4">
      <div className="mx-auto flex h-full max-w-[1440px] gap-3 lg:gap-4">
        <aside className="hidden h-full w-[268px] shrink-0 overflow-hidden rounded-[28px] bg-leaf-deep py-5 pl-5 text-white shadow-pop lg:flex">{nav}</aside>

        {open ? (
          <div className="fixed inset-0 z-40 bg-leaf-deep/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="flex h-full w-[280px] flex-col bg-leaf-deep py-5 pl-5 text-white animate-drawer-in" onClick={(e) => e.stopPropagation()}>
              {nav}
            </aside>
          </div>
        ) : null}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="mb-3 flex h-14 shrink-0 items-center gap-3 rounded-[24px] border border-line/80 bg-white/80 px-4 shadow-card backdrop-blur">
            <button type="button" className="rounded-xl border border-line p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
              <Icons.menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              {user?.isPlatformAdmin ? (
                <label className="flex min-w-0 items-center gap-3">
                  <span className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-mute sm:block">Koperasi</span>
                  <select
                    className="h-9 w-full max-w-xs rounded-lg border border-line bg-canvas/70 px-3 text-sm font-medium"
                    value={tenantId ?? ""}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      setTenantId(next);
                      const picked = tenants.find((t) => t.id === next);
                      void notify.info(picked ? `Konteks: ${picked.name}` : "Kembali ke semua koperasi");
                    }}
                  >
                    <option value="">Semua koperasi</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="truncate text-sm font-semibold">{user?.tenantSlug ?? "Konsol"}</p>
              )}
            </div>
            {activeTenant ? (
              <span className="hidden truncate rounded-full bg-leaf-mist px-3 py-1 text-xs font-semibold text-leaf-dark sm:inline">
                {activeTenant.name}
              </span>
            ) : user?.isPlatformAdmin ? (
              <span className="hidden rounded-full bg-canvas px-3 py-1 text-xs font-medium text-mute sm:inline">Platform</span>
            ) : null}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="max-w-[160px] text-right">
                <p className="truncate text-sm font-semibold leading-none">{user?.name}</p>
                <p className="mt-1 truncate text-[11px] text-mute">{user?.email}</p>
              </div>
              <Avatar name={user?.name ?? "User"} />
            </div>
          </header>
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-6 pr-1">
            <div className="page-enter">
              <Outlet />
            </div>
          </main>
        </section>
      </div>
    </div>
  );
}

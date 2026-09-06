import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TdHTMLAttributes, type TextareaHTMLAttributes, type ThHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { formatRupiahInput, rupiahDigits } from "../lib/money";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl min-w-0">
        {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">{kicker}</p> : null}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{title}</h1>
        {description ? <p className="mt-1.5 text-sm leading-6 text-mute">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2.5xl border border-line/80 bg-white shadow-card transition duration-200 hover:shadow-pop", className)}>
      {children}
    </section>
  );
}

export function Dialog({
  children,
  onClose,
  className,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-leaf-deep/45 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={cx(
          "relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2.5xl border border-line/80 bg-white shadow-pop sm:max-h-[calc(100dvh-3rem)]",
          className,
        )}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={cx("flex shrink-0 items-start justify-between gap-3 border-b border-line/70 px-5 py-4", className)}>
      {children}
    </header>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5", className)}>{children}</div>;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft"; size?: "sm" | "md" }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-semibold transition duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]",
        size === "sm" ? "h-8 rounded-lg px-2.5 text-xs" : "h-10 rounded-xl px-4 text-sm",
        variant === "primary" && "bg-leaf text-white shadow-sm hover:-translate-y-px hover:bg-leaf-dark hover:shadow-md",
        variant === "ghost" && "border border-line bg-white text-ink hover:-translate-y-px hover:bg-canvas",
        variant === "danger" && "bg-red-50 text-clay hover:-translate-y-px hover:bg-red-100",
        variant === "soft" && "bg-leaf-mist text-leaf-dark hover:-translate-y-px hover:bg-leaf/15",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block text-sm font-medium text-ink", className)}>
      <span className="mb-1.5 block text-mute">{label}</span>
      {children}
    </label>
  );
}

const control =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-mute/70";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, props.className)} {...props} />;
}

export function MoneyInput({
  value,
  onValueChange,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string | number;
  onValueChange: (digits: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-mute">Rp</span>
      <input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        className={cx(control, "pl-10 tabular-nums", className)}
        value={formatRupiahInput(value)}
        onChange={(e) => onValueChange(rupiahDigits(e.target.value))}
      />
    </div>
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, props.className)} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, "min-h-24 resize-y", props.className)} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" || status === "ok" || status === "Sehat" || status === "OPEN" || status === "POSTED" || status === "DISBURSED" || status === "PAID" || status === "APPROVED" || status === "Disetujui" || status === "Dicairkan"
      ? "bg-leaf-mist text-leaf-dark"
      : status === "TRIAL" || status === "CLOSED" || status === "Disetujui bersyarat"
        ? "bg-amber-50 text-amber-800"
        : status === "SUSPENDED" || status === "DISABLED" || status === "INACTIVE" || status === "REVERSED" || status === "VOIDED" || status === "REJECTED" || status === "Ditolak"
          ? "bg-red-50 text-clay"
          : "bg-canvas text-mute";
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", tone)}>{status.toLowerCase()}</span>;
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-mist text-xs font-bold text-leaf-dark">
      {initials || "?"}
    </span>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cx("px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-mute", className)} {...props}>
      {children}
    </th>
  );
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cx("px-4 py-3.5 align-middle transition-colors duration-150", className)} {...props}>
      {children}
    </td>
  );
}

import { useQuery } from "@tanstack/react-query";
import { ops, type ReceiptRow } from "../lib/api";
import { idr } from "../lib/money";
import { terbilangRupiah } from "../lib/terbilang";
import { Button, Dialog, DialogBody, DialogHeader } from "../ui/kit";

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

const PRINT_CSS = `
  @page { size: A5; margin: 12mm; }
  body { margin: 0; color: #12241c; font-family: "Segoe UI", "Plus Jakarta Sans", sans-serif; }
  .sheet { max-width: 640px; margin: 0 auto; border: 1px solid #d8e0d6; padding: 24px 28px; position: relative; }
  .void { position: absolute; inset: 28% 10%; display: grid; place-items: center; font-size: 48px; font-weight: 800; letter-spacing: 0.2em; color: rgba(194,59,42,0.18); transform: rotate(-18deg); }
  .kop { text-align: center; border-bottom: 2px solid #0b5c34; padding-bottom: 10px; }
  .kop img { display: block; height: 52px; width: auto; margin: 0 auto 8px; border-radius: 10px; }
  .kop strong { display: block; font-size: 18px; }
  .kop span { display: block; font-size: 12px; color: #5b6b63; margin-top: 2px; }
  h1 { margin: 14px 0 4px; text-align: center; font-size: 15px; letter-spacing: 0.12em; }
  .no { text-align: center; font-size: 12px; color: #5b6b63; margin-bottom: 16px; }
  table.meta { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.meta td { padding: 3px 0; vertical-align: top; }
  table.meta td:first-child { width: 38%; color: #5b6b63; }
  .amount { margin: 14px 0; padding: 10px 12px; background: #eef2ed; font-size: 18px; font-weight: 800; }
  .words { font-size: 13px; font-style: italic; margin: 0 0 14px; }
  table.alloc { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.alloc th, table.alloc td { border-top: 1px solid #d8e0d6; padding: 6px 0; text-align: right; }
  table.alloc th:first-child, table.alloc td:first-child { text-align: left; }
  .sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 28px; font-size: 12px; text-align: center; }
  .sign p { margin: 48px 0 0; }
  .foot { margin-top: 18px; font-size: 11px; color: #5b6b63; }
`;

function allocRows(receipt: ReceiptRow) {
  const alloc = receipt.allocation ?? { principal: 0, interest: 0, penalty: 0, leftover: 0, items: [] };
  return [
    ["Pokok", alloc.principal],
    ["Bunga", alloc.interest],
    ["Denda", alloc.penalty],
    ["Kelebihan", alloc.leftover],
  ].filter(([, value]) => Number(value) > 0) as Array<[string, number]>;
}

export function receiptSheetHtml(receipt: ReceiptRow) {
  const amount = Number(receipt.amount);
  const voided = receipt.status === "VOIDED";
  const rows = allocRows(receipt)
    .map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(idr(value))}</td></tr>`)
    .join("");
  const items = (receipt.allocation?.items ?? [])
    .filter((item) => item.sequence != null)
    .map((item) => `Angs. #${item.sequence}`)
    .join(", ");
  const logoSrc = typeof window !== "undefined" ? `${window.location.origin}/logo/mankopi.png` : "/logo/mankopi.png";
  return `<div class="sheet">
    ${voided ? `<div class="void">BATAL</div>` : ""}
    <div class="kop">
      <img src="${esc(logoSrc)}" alt="Mankopi" />
      <strong>${esc(receipt.tenant?.name ?? "Koperasi")}</strong>
      <span>${esc(receipt.tenant?.legalName ?? "Tanda bukti setoran angsuran")}</span>
    </div>
    <h1>KWITANSI SETORAN</h1>
    <p class="no">${esc(receipt.receiptNo)} · ${esc(formatDay(receipt.paidOn))}</p>
    <table class="meta">
      <tr><td>Telah diterima dari</td><td><strong>${esc(receipt.member.name)}</strong></td></tr>
      <tr><td>No. anggota</td><td>${esc(receipt.member.memberNo ?? "—")}</td></tr>
      <tr><td>No. pinjaman</td><td>${esc(receipt.loan.loanNo)}${receipt.loan.productName ? ` · ${esc(receipt.loan.productName)}` : ""}</td></tr>
      ${items ? `<tr><td>Untuk angsuran</td><td>${esc(items)}</td></tr>` : ""}
      ${receipt.journalNo ? `<tr><td>No. jurnal</td><td>${esc(receipt.journalNo)}</td></tr>` : ""}
    </table>
    <div class="amount">${esc(idr(amount))}</div>
    <p class="words">Terbilang: ${esc(terbilangRupiah(amount))}</p>
    ${rows ? `<table class="alloc"><thead><tr><th>Rincian</th><th>Nominal</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    <div class="sign">
      <div>Penyetor<br /><p>( ${esc(receipt.member.name)} )</p></div>
      <div>Petugas<br /><p>( ${esc(receipt.collectorName ?? "Koperasi")} )</p></div>
    </div>
    <p class="foot">Kwitansi ini sah sebagai tanda bukti penyetoran. Simpan sebagai arsip anggota.</p>
  </div>`;
}

export function printReceipt(receipt: ReceiptRow) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${receipt.receiptNo}</title><style>${PRINT_CSS}</style></head><body>${receiptSheetHtml(receipt)}</body></html>`,
  );
  doc.close();
  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 800);
  };
  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}

export function ReceiptPreview({
  receiptId,
  tenantId,
  onClose,
}: {
  receiptId: string;
  tenantId?: string;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["receipt", receiptId, tenantId],
    queryFn: () => ops.receipt(receiptId, tenantId),
  });
  const receipt = detail.data;
  const phone = receipt?.member.phone?.replace(/\D/g, "");

  return (
    <Dialog onClose={onClose} className="max-w-xl">
      <DialogHeader>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">Tanda bukti setoran</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{receipt?.receiptNo ?? "Kwitansi"}</h2>
          <p className="mt-1 text-sm text-mute">Pratinjau sebelum dicetak. Anggota dapat membawa salinan ini.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </DialogHeader>
      <DialogBody>
        {detail.isError ? (
          <p className="text-sm text-clay">{detail.error instanceof Error ? detail.error.message : "Gagal memuat kwitansi"}</p>
        ) : null}
        {receipt ? (
          <div className="space-y-4">
            <style>{PRINT_CSS}</style>
            <div dangerouslySetInnerHTML={{ __html: receiptSheetHtml(receipt) }} />
            <div className="flex flex-wrap justify-end gap-2">
              {phone ? (
                <a
                  className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-2.5 text-xs font-semibold"
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(
                    `Kwitansi ${receipt.receiptNo} ${receipt.member.name} ${idr(Number(receipt.amount))} — ${receipt.loan.loanNo}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Bagikan WA
                </a>
              ) : null}
              <Button size="sm" onClick={() => printReceipt(receipt)}>
                Cetak kwitansi
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-mute">Menyusun kwitansi…</p>
        )}
      </DialogBody>
    </Dialog>
  );
}

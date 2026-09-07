import { useQuery } from "@tanstack/react-query";
import { ops, type SavingTxnVoucher } from "../lib/api";
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
  .sign { display: flex; justify-content: space-between; gap: 24px; margin-top: 28px; font-size: 12px; text-align: center; }
  .sign p { margin: 48px 0 0; }
  .foot { margin-top: 18px; font-size: 11px; color: #5b6b63; }
`;

export function savingTxnSheetHtml(voucher: SavingTxnVoucher) {
  const amount = Number(voucher.amount);
  const setor = voucher.type !== "TARIK";
  const title = setor ? "BUKTI PENYETORAN SIMPANAN" : "BUKTI PENARIKAN SIMPANAN";
  const partyLabel = setor ? "Telah diterima dari" : "Telah dibayarkan kepada";
  const logoSrc = typeof window !== "undefined" ? `${window.location.origin}/logo/mankopi.png` : "/logo/mankopi.png";
  const primary = `${voucher.account.accountNo} · ${voucher.member.memberNo} · ${voucher.member.name} · ${voucher.account.productName}`;
  const counter = voucher.counter
    ? `${voucher.counter.accountNo} · ${voucher.counter.memberNo} · ${voucher.counter.memberName} · ${voucher.counter.productName}`
    : "";
  const transfer = voucher.method === "TRANSFER" && counter;
  const source = transfer ? (setor ? counter : primary) : "";
  const dest = transfer ? (setor ? primary : counter) : "";
  return `<div class="sheet">
    <div class="kop">
      <img src="${esc(logoSrc)}" alt="Mankopi" />
      <strong>${esc(voucher.tenant?.name ?? "Koperasi")}</strong>
      <span>${esc(voucher.tenant?.legalName ?? "Tanda bukti transaksi simpanan")}</span>
    </div>
    <h1>${title}</h1>
    <p class="no">${esc(voucher.txnNo)} · ${esc(formatDay(voucher.occurredOn))}</p>
    <table class="meta">
      <tr><td>${partyLabel}</td><td><strong>${esc(voucher.member.name)}</strong></td></tr>
      <tr><td>No. anggota</td><td>${esc(voucher.member.memberNo)}</td></tr>
      ${
        transfer
          ? `<tr><td>Rekening sumber</td><td>${esc(source)}</td></tr>
      <tr><td>Rekening tujuan</td><td>${esc(dest)}</td></tr>`
          : `<tr><td>No. rekening</td><td>${esc(voucher.account.accountNo)} · ${esc(voucher.account.productName)}</td></tr>`
      }
      <tr><td>Jenis</td><td>${setor ? "Penyetoran" : "Penarikan"}</td></tr>
      <tr><td>Metode</td><td>${esc(voucher.methodLabel)}</td></tr>
      ${voucher.note ? `<tr><td>Catatan</td><td>${esc(voucher.note)}</td></tr>` : ""}
      ${voucher.journalNo ? `<tr><td>No. jurnal</td><td>${esc(voucher.journalNo)}</td></tr>` : ""}
      <tr><td>Saldo setelah</td><td>${esc(idr(voucher.balanceAfter))}</td></tr>
    </table>
    <div class="amount">${esc(idr(amount))}</div>
    <p class="words">Terbilang: ${esc(terbilangRupiah(amount))}</p>
    <div class="sign">
      <div>${setor ? "Penyetor" : "Penerima"}<br /><p>( ${esc(voucher.member.name)} )</p></div>
      <div>Petugas<br /><p>( Koperasi )</p></div>
    </div>
    <p class="foot">Bukti ini sah sebagai tanda transaksi simpanan. Simpan sebagai arsip anggota.</p>
  </div>`;
}

export function printSavingTxn(voucher: SavingTxnVoucher) {
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
    `<!doctype html><html><head><title>${voucher.txnNo}</title><style>${PRINT_CSS}</style></head><body>${savingTxnSheetHtml(voucher)}</body></html>`,
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

export function SavingTxnPreview({
  txnId,
  tenantId,
  onClose,
}: {
  txnId: string;
  tenantId?: string;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["saving-txn", txnId, tenantId],
    queryFn: () => ops.savingTxn(txnId, tenantId),
  });
  const voucher = detail.data;
  const phone = voucher?.member.phone?.replace(/\D/g, "");
  const setor = voucher?.type !== "TARIK";

  return (
    <Dialog onClose={onClose} className="max-w-xl">
      <DialogHeader>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf-dark">
            {setor ? "Bukti penyetoran" : "Bukti penarikan"}
          </p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{voucher?.txnNo ?? "Bukti simpanan"}</h2>
          <p className="mt-1 text-sm text-mute">Pratinjau sebelum dicetak. Anggota dapat membawa salinan ini.</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      </DialogHeader>
      <DialogBody>
        {detail.isError ? (
          <p className="text-sm text-clay">{detail.error instanceof Error ? detail.error.message : "Gagal memuat bukti"}</p>
        ) : null}
        {voucher ? (
          <div className="space-y-4">
            <style>{PRINT_CSS}</style>
            <div dangerouslySetInnerHTML={{ __html: savingTxnSheetHtml(voucher) }} />
            <div className="flex flex-wrap justify-end gap-2">
              {phone ? (
                <a
                  className="inline-flex h-8 items-center rounded-lg border border-line bg-white px-2.5 text-xs font-semibold"
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(
                    `${setor ? "Setoran" : "Penarikan"} ${voucher.txnNo} ${voucher.member.name} ${idr(Number(voucher.amount))} — ${voucher.account.accountNo}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Bagikan WA
                </a>
              ) : null}
              <Button size="sm" onClick={() => printSavingTxn(voucher)}>
                Cetak bukti
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-mute">Menyusun bukti transaksi…</p>
        )}
      </DialogBody>
    </Dialog>
  );
}

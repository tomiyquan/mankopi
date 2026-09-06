import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";

const API = "http://localhost:8080/api";

type Card = {
  id: string;
  remaining: number;
  dueDate: string;
  collectability: number;
  loan: { id: string; loanNo: string; member: { name: string; phone?: string | null } };
};

export default function App() {
  const [email, setEmail] = useState("ketua@sejahtera.local");
  const [password, setPassword] = useState("ChangeMeNow!23");
  const [token, setToken] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [note, setNote] = useState("Masuk untuk unduh kartu tagih.");
  const [queue, setQueue] = useState<Array<{ loanId: string; amount: number; clientReceiptId: string }>>([]);
  const [amount, setAmount] = useState<Record<string, string>>({});

  const headers = useMemo(() => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }), [token]);

  async function login() {
    try {
      const res = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Gagal masuk");
      setToken(body.accessToken);
      setNote(`Halo ${body.user.name}`);
      await loadCards(body.accessToken);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Gagal masuk");
    }
  }

  async function loadCards(access = token) {
    if (!access) return;
    const res = await fetch(`${API}/collection/today`, { headers: { Authorization: `Bearer ${access}` } });
    const body = await res.json();
    if (!res.ok) {
      setNote(body?.error?.message ?? "Gagal unduh kartu");
      return;
    }
      setCards(body);
    const loans = new Set(body.map((c: Card) => c.loan.id)).size;
    setNote(loans ? `${loans} pinjaman siap ditagih` : "Tidak ada tagihan hari ini");
  }

  function enqueue(loanId: string) {
    const value = Number(amount[loanId]);
    if (!(value > 0)) {
      setNote("Isi nominal setoran");
      return;
    }
    setQueue((q) => [...q, { loanId, amount: value, clientReceiptId: `${Date.now()}-${loanId}` }]);
    setNote("Disimpan offline. Ketuk Sinkron untuk posting jurnal.");
  }

  async function syncQueue() {
    if (!token) return;
    for (const item of queue) {
      const res = await fetch(`${API}/collection/receipts`, {
        method: "POST",
        headers,
        body: JSON.stringify(item),
      });
      const body = await res.json();
      if (!res.ok) {
        setNote(body?.error?.message ?? "Sinkron gagal");
        return;
      }
      const receipt = body.receipt ?? body;
      const text = `Kwitansi ${receipt.receiptNo} ${receipt.member?.name ?? ""} Rp${item.amount}`;
      await Share.share({ message: text });
    }
    setQueue([]);
    await loadCards();
    setNote("Sinkron selesai. Jurnal dan kwitansi tercatat.");
  }

  async function wa(card: Card) {
    const text = encodeURIComponent(`Tagihan ${card.loan.loanNo} ${card.loan.member.name} Rp${card.remaining}`);
    const url = card.loan.member.phone ? `https://wa.me/${card.loan.member.phone}?text=${text}` : `https://wa.me/?text=${text}`;
    await Linking.openURL(url);
  }

  if (!token) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Text style={styles.brand}>Mankopi</Text>
        <Text style={styles.sub}>Kolektor lapangan</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} autoCapitalize="none" value={email} onChangeText={setEmail} />
          <Text style={styles.label}>Kata sandi</Text>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
          <Pressable style={styles.button} onPress={login}>
            <Text style={styles.buttonText}>Masuk</Text>
          </Pressable>
          <Text style={styles.note}>{note}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <StatusBar style="light" />
      <Text style={styles.brand}>Kartu tagih</Text>
      <Text style={styles.sub}>{note}</Text>
      {Object.values(
        cards.reduce<Record<string, { loanId: string; name: string; loanNo: string; remaining: number; count: number; dueDate: string; collectability: number; phone?: string | null }>>(
          (acc, c) => {
            const cur = acc[c.loan.id];
            if (cur) {
              cur.remaining += c.remaining;
              cur.count += 1;
              cur.collectability = Math.max(cur.collectability, c.collectability);
              return acc;
            }
            acc[c.loan.id] = {
              loanId: c.loan.id,
              name: c.loan.member.name,
              loanNo: c.loan.loanNo,
              remaining: c.remaining,
              count: 1,
              dueDate: c.dueDate,
              collectability: c.collectability,
              phone: c.loan.member.phone,
            };
            return acc;
          },
          {},
        ),
      ).map((c) => (
        <View key={c.loanId} style={styles.card}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.meta}>
            {c.loanNo} · {c.count} angsuran · kol {c.collectability}
          </Text>
          <Text style={styles.amount}>Rp {c.remaining.toLocaleString("id-ID")}</Text>
          <TextInput style={styles.input} keyboardType="numeric" placeholder="Nominal setor" value={amount[c.loanId] ?? String(c.remaining)} onChangeText={(v) => setAmount({ ...amount, [c.loanId]: v })} />
          <View style={styles.row}>
            <Pressable style={styles.button} onPress={() => enqueue(c.loanId)}>
              <Text style={styles.buttonText}>Simpan offline</Text>
            </Pressable>
            <Pressable
              style={styles.ghost}
              onPress={() =>
                wa({
                  id: c.loanId,
                  remaining: c.remaining,
                  dueDate: c.dueDate,
                  collectability: c.collectability,
                  loan: { id: c.loanId, loanNo: c.loanNo, member: { name: c.name, phone: c.phone } },
                })
              }
            >
              <Text style={styles.ghostText}>WhatsApp</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={styles.button} onPress={syncQueue}>
        <Text style={styles.buttonText}>Sinkron {queue.length} setoran</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0A1F16", padding: 20 },
  brand: { color: "#C8F27A", fontSize: 32, fontWeight: "800", marginTop: 24 },
  sub: { color: "#d7e4d6", marginBottom: 16 },
  card: { backgroundColor: "#F3F6F2", borderRadius: 20, padding: 16, marginBottom: 12 },
  label: { marginTop: 8, marginBottom: 4, color: "#12241C" },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 10, marginTop: 8 },
  button: { marginTop: 12, backgroundColor: "#128A4E", borderRadius: 12, padding: 12, alignItems: "center", flex: 1 },
  buttonText: { color: "#fff", fontWeight: "700" },
  note: { marginTop: 12, color: "#5c564c", fontSize: 12 },
  name: { fontWeight: "800", fontSize: 18, color: "#12241C" },
  meta: { color: "#5B6B63", marginTop: 4 },
  amount: { fontSize: 22, fontWeight: "800", marginTop: 8, color: "#0B5C34" },
  row: { flexDirection: "row", gap: 8 },
  ghost: { marginTop: 12, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#128A4E", alignItems: "center" },
  ghostText: { color: "#0B5C34", fontWeight: "700" },
});

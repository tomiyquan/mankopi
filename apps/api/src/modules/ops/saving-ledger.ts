export function formatSavingAccountNo(seq: number) {
  return `SMP-${String(seq).padStart(4, "0")}`;
}

export function applySavingMovement(balance: number, type: string, amount: number) {
  const n = Math.abs(amount);
  return type === "TARIK" ? balance - n : balance + n;
}

export function withSavingRunningBalance<T extends { type: string; amount: number }>(txnsOldestFirst: T[]) {
  let balance = 0;
  return txnsOldestFirst.map((txn) => {
    balance = applySavingMovement(balance, txn.type, Number(txn.amount));
    return { ...txn, balanceAfter: balance };
  });
}

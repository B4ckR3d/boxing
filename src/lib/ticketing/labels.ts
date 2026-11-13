export const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Transfer bank",
  QRIS: "QRIS",
  CASH: "Tunai di lokasi",
  OTHER: "Lainnya",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: "Belum dibayar",
  PROOF_SUBMITTED: "Bukti dikirim",
  VERIFIED: "Terverifikasi",
  REJECTED: "Ditolak",
};

export const methodLabel = (method?: string | null) =>
  method ? METHOD_LABEL[method] ?? method : "—";

export const paymentStatusLabel = (status?: string | null) =>
  status ? PAYMENT_STATUS_LABEL[status] ?? status : "Belum dibayar";

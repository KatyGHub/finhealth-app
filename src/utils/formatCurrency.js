// src/utils/formatCurrency.js
export function formatCurrency(value) {
  const n = Number(value || 0);

  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}
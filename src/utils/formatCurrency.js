// src/utils/formatCurrency.js
export function formatCurrency(num) {
  const safe = Number(num) || 0;
  return "₹" + safe.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
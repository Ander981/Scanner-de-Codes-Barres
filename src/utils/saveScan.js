export function saveScan(barcode) {
  const existing = JSON.parse(localStorage.getItem("lastScans")) || [];

  const updated = [barcode, ...existing.filter(code => code !== barcode)].slice(0, 5);

  localStorage.setItem("lastScans", JSON.stringify(updated));
}

export function getLastScans() {
  return JSON.parse(localStorage.getItem("lastScans")) || [];
}
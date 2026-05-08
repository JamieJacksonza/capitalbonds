"use client";

function escapeCsvCell(v: unknown) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeHtml(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function exportRowsToCsv(filenamePrefix: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsToExcel(
  filenamePrefix: string,
  title: string,
  headers: string[],
  rows: Array<Array<unknown>>
) {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");

  const now = new Date().toLocaleString("en-ZA");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { margin-bottom: 12px; font-size: 12px; color: #555; }
    table { border-collapse: collapse; }
    th, td { border: 1px solid #666; padding: 4px 6px; font-size: 11px; vertical-align: top; white-space: pre-wrap; mso-data-placement: same-cell; }
    th { background: #f3f3f3; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Generated: ${escapeHtml(now)}</div>
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${tr}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${stamp()}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsToPdf(title: string, headers: string[], rows: Array<Array<unknown>>) {
  const compact = headers.length > 8;
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");

  const now = new Date().toLocaleString("en-ZA");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${compact ? "A4 landscape" : "A4 portrait"}; margin: ${compact ? "8mm" : "12mm"}; }
    body { font-family: Inter, Arial, sans-serif; padding: 0; color: #111; }
    h1 { margin: 0 0 6px; font-size: ${compact ? "16px" : "22px"}; }
    .meta { margin-bottom: 14px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: ${compact ? "8px" : "12px"}; table-layout: fixed; }
    th, td { border: 1px solid #ddd; padding: ${compact ? "4px" : "8px"}; text-align: left; vertical-align: top; white-space: pre-wrap; word-break: break-word; }
    th { background: #f5f5f5; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Generated: ${escapeHtml(now)}</div>
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${tr}</tbody>
  </table>
</body>
</html>`;

  // Preferred path: hidden iframe print is more reliable than popup print timing.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    const trigger = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        window.setTimeout(() => {
          iframe.remove();
        }, 1200);
      }
    };
    if (doc.readyState === "complete") {
      window.setTimeout(trigger, 80);
    } else {
      iframe.onload = () => window.setTimeout(trigger, 80);
    }
    return;
  }

  // Fallback: popup window.
  const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  window.setTimeout(() => w.print(), 120);
}

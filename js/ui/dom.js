export const $ = (id) => document.getElementById(id);

export function html(strings, ...values) {
  return strings.reduce((out, part, i) => out + part + (values[i] ?? ""), "");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

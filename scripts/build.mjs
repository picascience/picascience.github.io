#!/usr/bin/env node
// MK Apps — reconstruit le registre des applis.
// Sources : apps/<id>/app.json (applis hébergées ici) + registry/external.json (autres dépôts).
// Sorties : apps.json + copie de secours embarquée dans index.html.
// Usage : node scripts/build.mjs        (échoue avec un message clair si quelque chose cloche)
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [], warnings = [];
const HEX = /^#[0-9a-f]{6}$/i, SLUG = /^[a-z0-9][a-z0-9-]*$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
const PALETTE = [["#4338ca", "#ec4899"], ["#0f766e", "#14b8a6"], ["#7c2d12", "#f59e0b"], ["#1e3a8a", "#60a5fa"], ["#581c87", "#c084fc"], ["#064e3b", "#34d399"], ["#9f1239", "#fb7185"], ["#1f2937", "#9ca3af"]];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const readJSON = (p, label) => {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { errors.push(`${label} : JSON invalide (${e.message})`); return null; }
};

function normalize(a, where) {
  const out = { ...a };
  if (!out.id || !SLUG.test(out.id)) errors.push(`${where} : "id" doit être en minuscules-avec-tirets (reçu "${out.id}")`);
  if (!out.name) errors.push(`${where} : "name" manquant`);
  else if (out.name.length > 14) warnings.push(`${where} : nom "${out.name}" long, il sera tronqué sous l'icône (≤ 12 caractères conseillé)`);
  if (!out.colors) out.colors = PALETTE[hash(out.id || "") % PALETTE.length];
  if (!Array.isArray(out.colors) || out.colors.length !== 2 || !out.colors.every(c => HEX.test(c)))
    errors.push(`${where} : "colors" doit être ["#rrggbb", "#rrggbb"]`);
  if (!out.emoji && !out.icon) warnings.push(`${where} : ni "emoji" ni "icon", la première lettre sera utilisée`);
  if (!out.added) out.added = new Date().toISOString().slice(0, 10);
  if (!DATE.test(out.added)) errors.push(`${where} : "added" doit être AAAA-MM-JJ`);
  if (out.open && out.open !== "tab") errors.push(`${where} : "open" ne peut valoir que "tab"`);
  return out;
}

const apps = [];
// 1) Applis hébergées dans ce dépôt
const appsDir = join(ROOT, "apps");
for (const id of existsSync(appsDir) ? readdirSync(appsDir).sort() : []) {
  const dir = join(appsDir, id);
  if (!statSync(dir).isDirectory() || id.startsWith("_")) continue;
  const where = `apps/${id}`;
  if (!existsSync(join(dir, "index.html"))) { errors.push(`${where} : index.html manquant`); continue; }
  if (!existsSync(join(dir, "app.json"))) { errors.push(`${where} : app.json manquant`); continue; }
  const meta = readJSON(join(dir, "app.json"), `${where}/app.json`); if (!meta) continue;
  if (meta.icon && !/^https?:/.test(meta.icon)) {
    if (!existsSync(join(dir, meta.icon))) errors.push(`${where} : icône "${meta.icon}" introuvable`);
    meta.icon = `apps/${id}/${meta.icon}`;
  }
  const html = readFileSync(join(dir, "index.html"), "utf8");
  if (/(src|href)=["']\/(?!\/)/.test(html)) warnings.push(`${where} : chemin absolu ("/...") détecté dans index.html, utilise des chemins relatifs`);
  apps.push(normalize({ ...meta, id }, where));
}
// 2) Applis vivant dans d'autres dépôts
const extPath = join(ROOT, "registry", "external.json");
if (existsSync(extPath)) {
  const ext = readJSON(extPath, "registry/external.json") || [];
  ext.forEach((a, i) => {
    const where = `registry/external.json[${i}] (${a.id || "?"})`;
    if (!a.url || !/^https:\/\//.test(a.url)) errors.push(`${where} : "url" https manquante`);
    apps.push(normalize(a, where));
  });
}
// 3) Contrôles globaux
const seen = new Map();
for (const a of apps) { if (seen.has(a.id)) errors.push(`id en double : "${a.id}"`); seen.set(a.id, 1); }
const dock = apps.filter(a => a.dock);
if (dock.length > 4) warnings.push(`${dock.length} applis ont "dock": true, seules 4 tiennent dans le dock`);

warnings.forEach(w => console.warn("⚠️  " + w));
if (errors.length) { errors.forEach(e => console.error("❌ " + e)); console.error(`\n${errors.length} erreur(s) : rien n'a été écrit.`); process.exit(1); }

apps.sort((a, b) => b.added.localeCompare(a.added) || a.name.localeCompare(b.name));
const registry = { owner: "picascience", generated: new Date().toISOString(), apps };
writeFileSync(join(ROOT, "apps.json"), JSON.stringify(registry, null, 2) + "\n");

const idx = join(ROOT, "index.html");
const html = readFileSync(idx, "utf8");
const next = html.replace(/\/\*APPS_START\*\/[\s\S]*?\/\*APPS_END\*\//, () => `/*APPS_START*/${JSON.stringify(registry).replace(/</g, "\\u003c")}/*APPS_END*/`);
if (next === html && !html.includes("/*APPS_START*/")) { console.error("❌ marqueurs APPS_START/APPS_END introuvables dans index.html"); process.exit(1); }
writeFileSync(idx, next);
console.log(`✅ ${apps.length} applis dans le registre (${apps.filter(a => !a.url).length} ici, ${apps.filter(a => a.url).length} externes).`);

// Backup local — NÃO faz parte do site, roda só na sua máquina.
// Lê tudo que está no Firestore (temas, links, anotações) e salva uma cópia
// legível em Markdown nas pastas F/ (Filipe) e I/ (Isabelle), com a data no
// nome do arquivo. Assim, se algo sumir do Firestore ou do GitHub, continua
// salvo aqui também.
//
// Além do Markdown, salva uma cópia COMPLETA (todos os campos, todas as
// coleções) em JSON na pasta backup-completo/ — é essa que serve para
// restaurar os dados se um dia for preciso.
//
// Se qualquer leitura falhar, o backup é abortado sem gravar nada, para
// nunca substituir um backup bom por um vazio ou pela metade.

const fs = require("fs");
const path = require("path");

const PROJECT_ID = "estudos-pessoais-filipe";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COLLECTIONS = ["study", "standalone-notes", "groups", "people"];

// O Firestore devolve os documentos em páginas — segue o nextPageToken até
// o fim para não perder nada quando houver muitos documentos.
async function fetchCollection(name) {
  const docs = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${name}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`não consegui ler "${name}" (status ${res.status})`);
    const json = await res.json();
    docs.push(...(json.documents || []));
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  return docs;
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(path.join(__dirname, "backup.log"), line + "\n", "utf8"); } catch {}
}

function parseDoc(doc) {
  const id = doc.name.split("/").pop();
  const data = {};
  for (const [key, val] of Object.entries(doc.fields || {})) data[key] = parseValue(val);
  return { id, ...data };
}

function parseValue(val) {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10);
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(parseValue);
  if (val.mapValue !== undefined) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = parseValue(v);
    return obj;
  }
  return null;
}

function fmtTopic(t) {
  const lines = [];
  lines.push(`## ${t.title || "(sem título)"}${t.locked ? " 🔒" : ""}`);
  lines.push(`_adicionado por ${t.addedBy || "?"}_`);
  if (t.notes && t.notes.trim()) {
    lines.push("");
    lines.push("**Anotação geral:**");
    lines.push(t.notes.trim());
  }
  const links = t.links || [];
  if (links.length) {
    lines.push("");
    lines.push("**Pesquisas:**");
    links.forEach((l) => {
      lines.push(`- ${l.checked ? "[x]" : "[ ]"} [${l.label || l.url}](${l.url})`);
      if (l.notes && l.notes.trim()) lines.push(`  - anotação: ${l.notes.trim()}`);
    });
  }
  lines.push("");
  return lines.join("\n");
}

function fmtNote(n) {
  return [`## ${n.title || "(sem título)"}`, "", (n.content || "").trim(), ""].join("\n");
}

// Temas antigos (de antes de existir o campo "owner") caem no Filipe por
// padrão — mesma regra que o próprio app usa (função ownerOf em app.js).
function ownerOf(t) { return t.owner || "filipe"; }

async function main() {
  const raw = {};
  for (const name of COLLECTIONS) raw[name] = await fetchCollection(name);

  const dateStr = new Date().toISOString().slice(0, 10);

  // Cópia completa e restaurável, no formato original do Firestore.
  const fullDir = path.join(__dirname, "backup-completo");
  fs.mkdirSync(fullDir, { recursive: true });
  const fullPath = path.join(fullDir, `firestore-${dateStr}.json`);
  fs.writeFileSync(fullPath, JSON.stringify({ project: PROJECT_ID, date: new Date().toISOString(), collections: raw }, null, 2), "utf8");
  log(`Salvo: ${fullPath}`);

  const study  = raw["study"].map(parseDoc);
  const notes  = raw["standalone-notes"].map(parseDoc);
  const groups = raw["groups"].map(parseDoc);

  const groupNames = {};
  groups.forEach((g) => { groupNames[g.id] = g.name || g.id; });

  const folders = { filipe: "F", isabelle: "I" };
  const displayName = { filipe: "Filipe", isabelle: "Isabelle" };

  for (const [ownerId, folderName] of Object.entries(folders)) {
    const myTopics     = study.filter((t) => ownerOf(t) === ownerId);
    const myNotes      = notes.filter((n) => ownerOf(n) === ownerId);
    const sharedTopics = study.filter((t) => ownerOf(t) !== "filipe" && ownerOf(t) !== "isabelle");
    const sharedNotes  = notes.filter((n) => ownerOf(n) !== "filipe" && ownerOf(n) !== "isabelle");

    const parts = [];
    parts.push(`# Backup de ${displayName[ownerId]} — ${dateStr}`);
    parts.push("");
    parts.push(`## Temas de estudo (${myTopics.length})`);
    parts.push("");
    myTopics.forEach((t) => parts.push(fmtTopic(t)));

    if (sharedTopics.length) {
      parts.push(`## Temas de grupos compartilhados (${sharedTopics.length})`);
      parts.push("");
      sharedTopics.forEach((t) => {
        parts.push(`> Grupo: ${groupNames[t.owner] || t.owner}`);
        parts.push(fmtTopic(t));
      });
    }

    if (myNotes.length) {
      parts.push(`## Anotações avulsas (${myNotes.length})`);
      parts.push("");
      myNotes.forEach((n) => parts.push(fmtNote(n)));
    }

    if (sharedNotes.length) {
      parts.push(`## Anotações avulsas de grupos (${sharedNotes.length})`);
      parts.push("");
      sharedNotes.forEach((n) => parts.push(fmtNote(n)));
    }

    const dir = path.join(__dirname, folderName);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `backup-${dateStr}.md`);
    fs.writeFileSync(filePath, parts.join("\n"), "utf8");
    log(`Salvo: ${filePath}`);
  }
}

main().catch((err) => {
  log(`ERRO no backup (nada foi gravado/substituído): ${err.message}`);
  process.exit(1);
});

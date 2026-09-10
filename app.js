import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── Coleções ────────────────────────────────────────────────────────────────
const studyRef = collection(db, "study");
const ideasRef = collection(db, "ideas");
const notesRef = collection(db, "standalone-notes");
const qStudy   = query(studyRef, orderBy("createdAt", "asc"));
const qIdeas   = query(ideasRef, orderBy("createdAt", "asc"));
const qNotes   = query(notesRef, orderBy("updatedAt", "desc"));

// ─── Elementos ───────────────────────────────────────────────────────────────
const nameModal       = document.getElementById("name-modal");
const nameForm        = document.getElementById("name-form");
const nameInput       = document.getElementById("name-input");
const userNameDisplay = document.getElementById("user-name-display");
const changeNameBtn   = document.getElementById("change-name-btn");

const editModal       = document.getElementById("edit-modal");
const editForm        = document.getElementById("edit-form");
const editTitleInput  = document.getElementById("edit-title");
const editCancelBtn   = document.getElementById("edit-cancel");

const linkModal       = document.getElementById("link-modal");
const linkForm        = document.getElementById("link-form");
const linkLabelInput  = document.getElementById("link-label");
const linkUrlInput    = document.getElementById("link-url");
const linkCancelBtn   = document.getElementById("link-cancel");

const tabs            = document.querySelectorAll(".tab");
const panelStudy      = document.getElementById("panel-study");
const panelIdeas      = document.getElementById("panel-ideas");

const studyForm       = document.getElementById("study-form");
const studyTitleInput = document.getElementById("study-title");
const studyList       = document.getElementById("study-list");
const studyEmpty      = document.getElementById("study-empty");
const studyTotal      = document.getElementById("study-total");
const studyDone       = document.getElementById("study-done");
const studyBadge      = document.getElementById("study-badge");

const ideasForm       = document.getElementById("ideas-form");
const ideasTitleInput = document.getElementById("ideas-title");
const ideasList       = document.getElementById("ideas-list");
const ideasEmpty      = document.getElementById("ideas-empty");
const ideasTotal      = document.getElementById("ideas-total");
const ideasBadge      = document.getElementById("ideas-badge");

const notesPanel          = document.getElementById("notes-panel");
const newNoteBtn          = document.getElementById("new-note-btn");
const notesDropzone       = document.getElementById("notes-dropzone");
const notesEditor         = document.getElementById("notes-editor");
const notesEditorBadge    = document.getElementById("notes-editor-badge");
const notesEditorTitle    = document.getElementById("notes-editor-title");
const notesEditorClose    = document.getElementById("notes-editor-close");
const notesEditorTextarea = document.getElementById("notes-editor-textarea");
const notesEditorStatus   = document.getElementById("notes-editor-status");
const notesRecentList     = document.getElementById("notes-recent-list");
const notesRecentEmpty    = document.getElementById("notes-recent-empty");

// ─── Usuário ─────────────────────────────────────────────────────────────────
let currentUser = localStorage.getItem("study-username") || null;

function showNameModal() {
  nameModal.style.display = "flex";
  nameInput.value = currentUser || "";
  setTimeout(() => nameInput.focus(), 50);
}

function applyName(name) {
  currentUser = name;
  localStorage.setItem("study-username", name);
  userNameDisplay.textContent = name;
  nameModal.style.display = "none";
}

if (!currentUser) showNameModal();
else userNameDisplay.textContent = currentUser;

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (name) applyName(name);
});

changeNameBtn.addEventListener("click", showNameModal);

// ─── Tabs ─────────────────────────────────────────────────────────────────────
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    panelStudy.style.display = target === "study" ? "block" : "none";
    panelIdeas.style.display = target === "ideas"  ? "block" : "none";
  });
});

// ─── Modal: editar título ─────────────────────────────────────────────────────
let editingId   = null;
let editingType = null;

function openEditModal(id, type, title) {
  editingId         = id;
  editingType       = type;
  editTitleInput.value = title || "";
  editModal.style.display = "flex";
  setTimeout(() => editTitleInput.focus(), 50);
}

function closeEditModal() {
  editModal.style.display = "none";
  editingId = editingType = null;
}

editCancelBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => { if (e.target === editModal) closeEditModal(); });

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = editTitleInput.value.trim();
  if (!title) return;
  const colName = editingType === "study" ? "study" : "ideas";
  try {
    await updateDoc(doc(db, colName, editingId), { title });
    closeEditModal();
  } catch (err) { console.error("Erro ao editar:", err); }
});

// ─── Modal: adicionar link ────────────────────────────────────────────────────
let linkTargetId   = null;
let linkTargetType = null;

function openLinkModal(id, type) {
  linkTargetId   = id;
  linkTargetType = type;
  linkLabelInput.value = "";
  linkUrlInput.value   = "";
  linkModal.style.display = "flex";
  setTimeout(() => linkLabelInput.focus(), 50);
}

function closeLinkModal() {
  linkModal.style.display = "none";
  linkTargetId = linkTargetType = null;
}

linkCancelBtn.addEventListener("click", closeLinkModal);
linkModal.addEventListener("click", (e) => { if (e.target === linkModal) closeLinkModal(); });

linkForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url   = linkUrlInput.value.trim();
  const label = linkLabelInput.value.trim();
  if (!url) return;

  const colName = linkTargetType === "study" ? "study" : "ideas";
  const docRef  = doc(db, colName, linkTargetId);

  // Busca links atuais do snapshot em memória
  const current = linkTargetType === "study"
    ? studyCache.find((t) => t.id === linkTargetId)
    : ideasCache.find((t) => t.id === linkTargetId);

  const links = current?.links ? [...current.links] : [];
  links.push({ url, label: label || url, checked: false });

  try {
    await updateDoc(docRef, { links });
    closeLinkModal();
  } catch (err) { console.error("Erro ao adicionar link:", err); }
});

// ─── Cache local dos snapshots ────────────────────────────────────────────────
let studyCache          = [];
let ideasCache          = [];
let standaloneNotesCache = [];

// ─── Painel de anotações (lateral) ─────────────────────────────────────────────
// activeNote:
//   { kind: "topic",  type: "study"|"ideas", id }
//   { kind: "link",   type: "study"|"ideas", topicId, idx }
//   { kind: "standalone", id: string|null }
let activeNote = null;
let notesSaveTimer = null;
let statusFlashTimer = null;

function hasNotesContent(text) { return !!(text && text.trim().length > 0); }

function flashNotesStatus(text) {
  notesEditorStatus.textContent = text;
  clearTimeout(statusFlashTimer);
  if (text) statusFlashTimer = setTimeout(() => { notesEditorStatus.textContent = ""; }, 1500);
}

function openTopicNote(type, id, title) {
  activeNote = { kind: "topic", type, id };
  const cache = type === "study" ? studyCache : ideasCache;
  const topic = cache.find((t) => t.id === id);

  notesEditorBadge.style.display = "";
  notesEditorBadge.textContent   = title;
  notesEditorTitle.style.display = "none";
  notesEditorTextarea.value      = topic?.notes || "";
  flashNotesStatus("");

  notesDropzone.style.display = "none";
  notesEditor.style.display   = "flex";
}

function openLinkNote(type, topicId, idx) {
  const cache = type === "study" ? studyCache : ideasCache;
  const topic = cache.find((t) => t.id === topicId);
  const link  = topic?.links?.[idx];
  if (!topic || !link) return;

  activeNote = { kind: "link", type, topicId, idx };

  notesEditorBadge.style.display = "";
  notesEditorBadge.textContent   = `${topic.title} › ${link.label || link.url}`;
  notesEditorTitle.style.display = "none";
  notesEditorTextarea.value      = link.notes || "";
  flashNotesStatus("");

  notesDropzone.style.display = "none";
  notesEditor.style.display   = "flex";
}

function openStandaloneNote(note) {
  activeNote = { kind: "standalone", id: note?.id || null };

  notesEditorBadge.style.display = "none";
  notesEditorTitle.style.display = "";
  notesEditorTitle.value         = note?.title || "";
  notesEditorTextarea.value      = note?.content || "";
  flashNotesStatus("");

  notesDropzone.style.display = "none";
  notesEditor.style.display   = "flex";

  if (!note) setTimeout(() => notesEditorTitle.focus(), 50);
}

function closeNotesEditor() {
  clearTimeout(notesSaveTimer);
  activeNote = null;
  notesEditor.style.display   = "none";
  notesDropzone.style.display = "flex";
  notesEditorTextarea.value = "";
  notesEditorTitle.value    = "";
}

function scheduleSaveActiveNote() {
  if (!activeNote) return;
  flashNotesStatus("Salvando…");
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(saveActiveNote, 600);
}

async function saveActiveNote() {
  if (!activeNote) return;
  try {
    if (activeNote.kind === "topic") {
      await updateDoc(doc(db, activeNote.type, activeNote.id), { notes: notesEditorTextarea.value });
    } else if (activeNote.kind === "link") {
      const cache = activeNote.type === "study" ? studyCache : ideasCache;
      const topic = cache.find((t) => t.id === activeNote.topicId);
      if (!topic || !topic.links?.[activeNote.idx]) return;
      const links = [...topic.links];
      links[activeNote.idx] = { ...links[activeNote.idx], notes: notesEditorTextarea.value };
      await updateDoc(doc(db, activeNote.type, activeNote.topicId), { links });
    } else {
      const title   = notesEditorTitle.value.trim() || "Sem título";
      const content = notesEditorTextarea.value;
      if (activeNote.id) {
        await updateDoc(doc(db, "standalone-notes", activeNote.id), { title, content, updatedAt: serverTimestamp() });
      } else {
        const ref = await addDoc(notesRef, {
          title, content,
          addedBy:   currentUser || "Anônimo",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        if (activeNote) activeNote.id = ref.id;
      }
    }
    flashNotesStatus("Salvo");
  } catch (err) {
    console.error("Erro ao salvar anotação:", err);
    flashNotesStatus("Erro ao salvar");
  }
}

newNoteBtn.addEventListener("click", () => {
  openStandaloneNote(null);
  if (window.innerWidth <= 860) notesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

notesEditorClose.addEventListener("click", closeNotesEditor);
notesEditorTextarea.addEventListener("input", scheduleSaveActiveNote);
notesEditorTitle.addEventListener("input", scheduleSaveActiveNote);

// Drag & drop: arrastar um card de tema para o painel abre (ou cria) a anotação dele
notesPanel.addEventListener("dragover", (e) => {
  if (!e.dataTransfer.types.includes("application/json")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  notesPanel.classList.add("drag-over");
});

notesPanel.addEventListener("dragleave", (e) => {
  if (!notesPanel.contains(e.relatedTarget)) notesPanel.classList.remove("drag-over");
});

notesPanel.addEventListener("drop", (e) => {
  e.preventDefault();
  notesPanel.classList.remove("drag-over");
  const raw = e.dataTransfer.getData("application/json");
  if (!raw) return;
  try {
    const payload = JSON.parse(raw);
    if (payload.kind === "link") openLinkNote(payload.type, payload.topicId, payload.idx);
    else openTopicNote(payload.type, payload.id, payload.title);
  } catch (err) { console.error("Erro ao processar o item arrastado:", err); }
});

function renderNotesRecent() {
  const items = [];

  standaloneNotesCache.forEach((n) => {
    if (!hasNotesContent(n.content) && !hasNotesContent(n.title)) return;
    items.push({ kind: "standalone", id: n.id, title: n.title || "Sem título", preview: n.content || "" });
  });

  [["study", studyCache], ["ideas", ideasCache]].forEach(([type, cache]) => {
    cache.forEach((t) => {
      if (hasNotesContent(t.notes)) {
        items.push({ kind: "topic", type, id: t.id, title: t.title, preview: t.notes });
      }
      (t.links || []).forEach((link, idx) => {
        if (!hasNotesContent(link.notes)) return;
        items.push({
          kind: "link", type, topicId: t.id, idx,
          title: `${t.title} › ${link.label || link.url}`,
          preview: link.notes
        });
      });
    });
  });

  notesRecentList.innerHTML = "";
  notesRecentEmpty.style.display = items.length === 0 ? "block" : "none";

  items.forEach((item) => {
    const li = document.createElement("li");
    const isActive = activeNote
      && ((item.kind === "standalone" && activeNote.kind === "standalone" && activeNote.id === item.id)
        || (item.kind === "topic" && activeNote.kind === "topic" && activeNote.type === item.type && activeNote.id === item.id)
        || (item.kind === "link" && activeNote.kind === "link" && activeNote.type === item.type && activeNote.topicId === item.topicId && activeNote.idx === item.idx));

    li.className = "notes-recent-item" + (isActive ? " active" : "");
    li.innerHTML = `
      <div class="notes-recent-row">
        <span class="title">${escapeHtml(item.title)}</span>
        ${item.kind === "standalone" ? `
        <button class="btn-icon notes-recent-delete" aria-label="Remover anotação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>` : ""}
      </div>
      <span class="preview">${escapeHtml(item.preview.replace(/\s+/g, " ").trim())}</span>
    `;
    const openThis = () => {
      if (item.kind === "standalone") {
        const note = standaloneNotesCache.find((n) => n.id === item.id);
        if (note) openStandaloneNote(note);
      } else if (item.kind === "link") {
        openLinkNote(item.type, item.topicId, item.idx);
      } else {
        openTopicNote(item.type, item.id, item.title);
      }
    };
    li.addEventListener("click", openThis);

    const deleteBtn = li.querySelector(".notes-recent-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (activeNote?.kind === "standalone" && activeNote.id === item.id) closeNotesEditor();
        try { await deleteDoc(doc(db, "standalone-notes", item.id)); }
        catch (err) { console.error("Erro ao remover anotação:", err); }
      });
    }
    notesRecentList.appendChild(li);
  });
}

// ─── Snapshot: Anotações avulsas ──────────────────────────────────────────────
onSnapshot(qNotes, (snapshot) => {
  standaloneNotesCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderNotesRecent();
});

// ─── Snapshot: Lista de estudo ────────────────────────────────────────────────
onSnapshot(qStudy, (snapshot) => {
  studyCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderStudyList();
  renderNotesRecent();
});

function renderStudyList() {
  studyList.innerHTML = "";
  studyTotal.textContent = studyCache.length;
  studyBadge.textContent = studyCache.length;
  const done = studyCache.filter((t) => isAllChecked(t)).length;
  studyDone.textContent = done;
  studyEmpty.style.display = studyCache.length === 0 ? "flex" : "none";
  studyCache.forEach((t) => studyList.appendChild(renderStudyItem(t)));
}

function isAllChecked(topic) {
  const links = topic.links || [];
  return links.length > 0 && links.every((l) => l.checked);
}

function renderStudyItem(topic) {
  const allDone  = isAllChecked(topic);
  const links    = topic.links || [];
  const hasNotes = hasNotesContent(topic.notes);
  const li       = document.createElement("li");
  li.className   = "topic-item" + (allDone ? " checked" : "");
  li.draggable   = true;

  li.innerHTML = `
    <div class="topic-header">
      <div class="topic-status ${allDone ? "done" : ""}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="topic-header-info">
        <span class="topic-title">${escapeHtml(topic.title)}</span>
        <span class="topic-author">por ${escapeHtml(topic.addedBy || "Anônimo")}</span>
      </div>
      <div class="topic-header-actions">
        <button class="btn-notes${hasNotes ? " has-notes" : ""}" aria-label="Anotações">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4V4z"/></svg>
          Notas
        </button>
        <button class="btn-add-link" aria-label="Adicionar link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Link
        </button>
        <button class="btn-icon edit-btn" aria-label="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon delete-btn" aria-label="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
    ${links.length > 0 ? `
    <ul class="link-list">
      ${links.map((link, idx) => `
        <li class="link-item ${link.checked ? "checked" : ""}">
          <button class="link-check" data-idx="${idx}" aria-label="${link.checked ? "Desmarcar" : "Marcar"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-label">
            ${escapeHtml(link.label || link.url)}
          </a>
          <button class="btn-icon link-note${hasNotesContent(link.notes) ? " has-notes" : ""}" data-idx="${idx}" aria-label="Anotação do link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4V4z"/></svg>
          </button>
          <button class="btn-icon link-delete" data-idx="${idx}" aria-label="Remover link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
      `).join("")}
    </ul>` : `<p class="no-links">Nenhum link ainda. Clique em "+ Link" para adicionar.</p>`}
  `;

  li.querySelector(".btn-add-link").addEventListener("click", () => openLinkModal(topic.id, "study"));
  li.querySelector(".edit-btn").addEventListener("click", () => openEditModal(topic.id, "study", topic.title));
  li.querySelector(".delete-btn").addEventListener("click", () => {
    if (activeNote?.type === "study" && activeNote.id === topic.id && activeNote.kind === "topic") closeNotesEditor();
    if (activeNote?.type === "study" && activeNote.topicId === topic.id && activeNote.kind === "link") closeNotesEditor();
    deleteDoc(doc(db, "study", topic.id));
  });

  li.querySelectorAll(".link-check").forEach((btn) => {
    btn.addEventListener("click", () => toggleLinkCheck(topic, parseInt(btn.dataset.idx), "study"));
  });

  li.querySelectorAll(".link-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      if (activeNote?.kind === "link" && activeNote.type === "study" && activeNote.topicId === topic.id) closeNotesEditor();
      deleteLink(topic, idx, "study");
    });
  });

  li.querySelectorAll(".link-note").forEach((btn) => {
    btn.addEventListener("click", () => {
      openLinkNote("study", topic.id, parseInt(btn.dataset.idx));
      if (window.innerWidth <= 860) notesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  li.querySelector(".btn-notes").addEventListener("click", () => {
    openTopicNote("study", topic.id, topic.title);
    if (window.innerWidth <= 860) notesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  li.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: topic.id, type: "study", title: topic.title }));
    e.dataTransfer.effectAllowed = "copy";
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => li.classList.remove("dragging"));

  return li;
}

async function toggleLinkCheck(topic, idx, colName) {
  const links = [...(topic.links || [])];
  links[idx] = { ...links[idx], checked: !links[idx].checked };
  try {
    await updateDoc(doc(db, colName, topic.id), { links });
  } catch (err) { console.error("Erro ao marcar link:", err); }
}

async function deleteLink(topic, idx, colName) {
  const links = (topic.links || []).filter((_, i) => i !== idx);
  try {
    await updateDoc(doc(db, colName, topic.id), { links });
  } catch (err) { console.error("Erro ao remover link:", err); }
}

// ─── Snapshot: Ideias ─────────────────────────────────────────────────────────
onSnapshot(qIdeas, (snapshot) => {
  ideasCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderIdeasList();
  renderNotesRecent();
});

function renderIdeasList() {
  ideasList.innerHTML = "";
  ideasTotal.textContent = ideasCache.length;
  ideasBadge.textContent = ideasCache.length;
  ideasEmpty.style.display = ideasCache.length === 0 ? "flex" : "none";
  ideasCache.forEach((t) => ideasList.appendChild(renderIdeaItem(t)));
}

function renderIdeaItem(topic) {
  const links    = topic.links || [];
  const hasLink  = links.length > 0;
  const hasNotes = hasNotesContent(topic.notes);
  const li       = document.createElement("li");
  li.className   = "topic-item";
  li.draggable   = true;

  li.innerHTML = `
    <div class="topic-header">
      <div class="idea-dot"></div>
      <div class="topic-header-info">
        <span class="topic-title">${escapeHtml(topic.title)}</span>
        <span class="topic-author">por ${escapeHtml(topic.addedBy || "Anônimo")}</span>
      </div>
      <div class="topic-header-actions">
        <button class="btn-notes${hasNotes ? " has-notes" : ""}" aria-label="Anotações">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4V4z"/></svg>
          Notas
        </button>
        <button class="btn-move${hasLink ? "" : " disabled"}" ${hasLink ? "" : "disabled"} aria-label="Mover para lista">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
          Mover
        </button>
        <button class="btn-add-link" aria-label="Adicionar link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Link
        </button>
        <button class="btn-icon edit-btn" aria-label="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-icon delete-btn" aria-label="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
    ${links.length > 0 ? `
    <ul class="link-list">
      ${links.map((link, idx) => `
        <li class="link-item">
          <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-label">
            ${escapeHtml(link.label || link.url)}
          </a>
          <button class="btn-icon link-note${hasNotesContent(link.notes) ? " has-notes" : ""}" data-idx="${idx}" aria-label="Anotação do link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H8l-4 4V4z"/></svg>
          </button>
          <button class="btn-icon link-delete" data-idx="${idx}" aria-label="Remover link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
      `).join("")}
    </ul>` : ""}
  `;

  if (hasLink) {
    li.querySelector(".btn-move").addEventListener("click", () => moveToStudy(topic));
  }
  li.querySelector(".btn-add-link").addEventListener("click", () => openLinkModal(topic.id, "ideas"));
  li.querySelector(".edit-btn").addEventListener("click", () => openEditModal(topic.id, "ideas", topic.title));
  li.querySelector(".delete-btn").addEventListener("click", () => {
    if (activeNote?.type === "ideas" && activeNote.id === topic.id && activeNote.kind === "topic") closeNotesEditor();
    if (activeNote?.type === "ideas" && activeNote.topicId === topic.id && activeNote.kind === "link") closeNotesEditor();
    deleteDoc(doc(db, "ideas", topic.id));
  });

  li.querySelectorAll(".link-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      if (activeNote?.kind === "link" && activeNote.type === "ideas" && activeNote.topicId === topic.id) closeNotesEditor();
      deleteLink(topic, idx, "ideas");
    });
  });

  li.querySelectorAll(".link-note").forEach((btn) => {
    btn.addEventListener("click", () => {
      openLinkNote("ideas", topic.id, parseInt(btn.dataset.idx));
      if (window.innerWidth <= 860) notesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  li.querySelector(".btn-notes").addEventListener("click", () => {
    openTopicNote("ideas", topic.id, topic.title);
    if (window.innerWidth <= 860) notesPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  li.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: topic.id, type: "ideas", title: topic.title }));
    e.dataTransfer.effectAllowed = "copy";
    li.classList.add("dragging");
  });
  li.addEventListener("dragend", () => li.classList.remove("dragging"));

  return li;
}

async function moveToStudy(topic) {
  try {
    await addDoc(studyRef, {
      title:     topic.title,
      links:     topic.links || [],
      notes:     topic.notes || "",
      addedBy:   topic.addedBy,
      createdAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "ideas", topic.id));
    if (activeNote?.type === "ideas" && activeNote.id === topic.id && activeNote.kind === "topic") closeNotesEditor();
    if (activeNote?.type === "ideas" && activeNote.topicId === topic.id && activeNote.kind === "link") closeNotesEditor();
    tabs.forEach((t) => t.classList.remove("active"));
    document.querySelector('[data-tab="study"]').classList.add("active");
    panelStudy.style.display = "block";
    panelIdeas.style.display = "none";
  } catch (err) { console.error("Erro ao mover:", err); }
}

// ─── Adicionar tema na lista de estudo ────────────────────────────────────────
studyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = studyTitleInput.value.trim();
  if (!title) return;
  const btn = studyForm.querySelector("button[type='submit']");
  btn.disabled = true;
  try {
    await addDoc(studyRef, {
      title,
      links:     [],
      addedBy:   currentUser || "Anônimo",
      createdAt: serverTimestamp()
    });
    studyTitleInput.value = "";
    studyTitleInput.focus();
  } catch (err) { console.error("Erro ao adicionar:", err); }
  finally { btn.disabled = false; }
});

// ─── Adicionar ideia ──────────────────────────────────────────────────────────
ideasForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = ideasTitleInput.value.trim();
  if (!title) return;
  const btn = ideasForm.querySelector("button[type='submit']");
  btn.disabled = true;
  try {
    await addDoc(ideasRef, {
      title,
      links:     [],
      addedBy:   currentUser || "Anônimo",
      createdAt: serverTimestamp()
    });
    ideasTitleInput.value = "";
    ideasTitleInput.focus();
  } catch (err) { console.error("Erro ao adicionar ideia:", err); }
  finally { btn.disabled = false; }
});

// ─── Utilitários ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

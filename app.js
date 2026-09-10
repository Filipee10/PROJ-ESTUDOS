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
const qStudy   = query(studyRef, orderBy("createdAt", "asc"));
const qIdeas   = query(ideasRef, orderBy("createdAt", "asc"));

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
let studyCache = [];
let ideasCache = [];

// ─── Snapshot: Lista de estudo ────────────────────────────────────────────────
onSnapshot(qStudy, (snapshot) => {
  studyCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderStudyList();
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
  const li       = document.createElement("li");
  li.className   = "topic-item" + (allDone ? " checked" : "");

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
  li.querySelector(".delete-btn").addEventListener("click", () => deleteDoc(doc(db, "study", topic.id)));

  li.querySelectorAll(".link-check").forEach((btn) => {
    btn.addEventListener("click", () => toggleLinkCheck(topic, parseInt(btn.dataset.idx), "study"));
  });

  li.querySelectorAll(".link-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteLink(topic, parseInt(btn.dataset.idx), "study"));
  });

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
});

function renderIdeasList() {
  ideasList.innerHTML = "";
  ideasTotal.textContent = ideasCache.length;
  ideasBadge.textContent = ideasCache.length;
  ideasEmpty.style.display = ideasCache.length === 0 ? "flex" : "none";
  ideasCache.forEach((t) => ideasList.appendChild(renderIdeaItem(t)));
}

function renderIdeaItem(topic) {
  const links   = topic.links || [];
  const hasLink = links.length > 0;
  const li      = document.createElement("li");
  li.className  = "topic-item";

  li.innerHTML = `
    <div class="topic-header">
      <div class="idea-dot"></div>
      <div class="topic-header-info">
        <span class="topic-title">${escapeHtml(topic.title)}</span>
        <span class="topic-author">por ${escapeHtml(topic.addedBy || "Anônimo")}</span>
      </div>
      <div class="topic-header-actions">
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
  li.querySelector(".delete-btn").addEventListener("click", () => deleteDoc(doc(db, "ideas", topic.id)));

  li.querySelectorAll(".link-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteLink(topic, parseInt(btn.dataset.idx), "ideas"));
  });

  return li;
}

async function moveToStudy(topic) {
  try {
    await addDoc(studyRef, {
      title:     topic.title,
      links:     topic.links || [],
      addedBy:   topic.addedBy,
      createdAt: serverTimestamp()
    });
    await deleteDoc(doc(db, "ideas", topic.id));
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

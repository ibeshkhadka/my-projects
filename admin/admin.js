/* Admin — login gate + local editor for the curated layer (projects.json).
   Static hosting can't write files, so this page builds the JSON
   for you to copy into projects.json, commit, and push. */

const GITHUB_USER = "ibeshkhadka";
const API_URL = `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100&type=all`;
const CURATED_URL = "../projects.json";
const EXCLUDE = new Set(["my-projects", "ibeshkhadka"]);
const LOGIN_ID = "admin";
const LOGIN_PASS = "admin";

const state = { entries: {}, liveNames: new Set() };
const $ = (id) => document.getElementById(id);

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showPanel() {
  $("login-view").classList.add("hidden");
  $("panel-view").classList.remove("hidden");
}

$("login-btn").addEventListener("click", tryLogin);
$("login-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });
$("login-id").addEventListener("keydown", (e) => { if (e.key === "Enter") tryLogin(); });

function tryLogin() {
  const id = $("login-id").value.trim();
  const pass = $("login-pass").value;
  if (id === LOGIN_ID && pass === LOGIN_PASS) {
    $("login-error").textContent = "";
    $("login-id").value = "";
    $("login-pass").value = "";
    showPanel();
    init();
  } else {
    $("login-error").textContent = "Wrong ID or password.";
    $("login-pass").value = "";
    $("login-pass").focus();
  }
}

$("logout-btn").addEventListener("click", () => {
  location.reload();
});

async function init() {
  let curated = [];
  try {
    const res = await fetch(CURATED_URL, { cache: "no-store" });
    if (res.ok) curated = (await res.json()).projects || [];
  } catch { /* file:// or missing — start empty */ }

  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      (await res.json())
        .filter((r) => !EXCLUDE.has(r.name))
        .forEach((r) => state.liveNames.add(r.name));
    }
  } catch { /* rate-limited/offline — badges just show unknown */ }

  const names = new Set([...curated.map((p) => p && p.name).filter(Boolean), ...state.liveNames]);
  names.forEach((name) => {
    if (EXCLUDE.has(name)) return;
    const c = curated.find((p) => p && p.name === name) || {};
    state.entries[name] = {
      description: c.description || "",
      liveUrl: c.liveUrl || "",
      tags: [...(c.tags || [])],
    };
  });
  render();
}

function render() {
  renderTags();
  const wrap = $("entries");
  wrap.innerHTML = "";
  Object.keys(state.entries).sort().forEach((name) => {
    const e = state.entries[name];
    const live = state.liveNames.has(name);
    const article = document.createElement("div");
    article.className = "entry";
    article.innerHTML = `
      <div class="entry-top">
        <h3>${escapeHTML(name)}</h3>
        <span class="badge ${live ? "live" : "gone"}">${live ? "LIVE ON GITHUB" : "NOT ON GITHUB"}</span>
      </div>
      <label>DESCRIPTION</label>
      <textarea data-field="description" rows="2"></textarea>
      <label>LIVE URL</label>
      <input type="text" data-field="liveUrl" placeholder="https://…" autocomplete="off" spellcheck="false" />
      <label>TAGS (comma separated)</label>
      <input type="text" data-field="tags" placeholder="ai, web" autocomplete="off" spellcheck="false" />
      <div class="row-end">
        <button class="btn danger" type="button" data-act="delete">Remove</button>
      </div>`;
    article.querySelector('[data-field="description"]').value = e.description;
    article.querySelector('[data-field="liveUrl"]').value = e.liveUrl;
    article.querySelector('[data-field="tags"]').value = e.tags.join(", ");
    article.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("input", () => {
        if (input.dataset.field === "tags") {
          e.tags = input.value.split(",").map((t) => t.trim()).filter(Boolean);
        } else {
          e[input.dataset.field] = input.value;
        }
      });
    });
    article.querySelector('[data-act="delete"]').addEventListener("click", () => {
      delete state.entries[name];
      render();
      status(`Removed ${name} — copy/download JSON to make it stick.`);
    });
    wrap.appendChild(article);
  });
  if (!wrap.children.length) {
    wrap.innerHTML = '<p class="mono">No entries. Add one above.</p>';
  }
}

function allTags() {
  const freq = {};
  Object.values(state.entries).forEach((e) => {
    e.tags.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderTags() {
  const list = $("tag-list");
  list.innerHTML = "";
  const tags = allTags();
  tags.forEach(([tag, count]) => {
    const row = document.createElement("div");
    row.className = "tag-row";
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = tag;
    const n = document.createElement("span");
    n.className = "count";
    n.textContent = `× ${count}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      Object.values(state.entries).forEach((e) => {
        e.tags = e.tags.filter((t) => t !== tag);
      });
      render();
      status(`Removed tag "${tag}" everywhere — copy/download JSON to make it stick.`);
    });
    row.append(chip, n, btn);
    list.appendChild(row);
  });
  if (!tags.length) {
    list.innerHTML = '<p class="mono" style="font-size:12.5px;opacity:.6">No tags yet.</p>';
  }
  const sel = $("new-tag-project");
  sel.innerHTML = "";
  Object.keys(state.entries).sort().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

$("add-tag").addEventListener("click", () => {
  const tag = $("new-tag").value.trim().toLowerCase();
  const project = $("new-tag-project").value;
  if (!tag) return status("Type a tag name first.");
  if (!project || !state.entries[project]) return status("Pick a project first.");
  if (state.entries[project].tags.includes(tag)) return status(`"${tag}" is already on ${project}.`);
  state.entries[project].tags.push(tag);
  $("new-tag").value = "";
  render();
  status(`Added tag "${tag}" to ${project}.`);
});

$("new-tag").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("add-tag").click();
});

function buildJSON() {
  const projects = Object.keys(state.entries).sort().map((name) => {
    const e = state.entries[name];
    const out = { name };
    if (e.liveUrl.trim()) out.liveUrl = e.liveUrl.trim();
    if (e.description.trim()) out.description = e.description.trim();
    if (e.tags.length) out.tags = e.tags;
    return out;
  });
  return JSON.stringify({ owner: GITHUB_USER, exclude: [...EXCLUDE], projects }, null, 2) + "\n";
}

function status(msg) {
  $("admin-status").textContent = msg;
}

$("add-entry").addEventListener("click", () => {
  const name = $("new-name").value.trim();
  if (!name) return status("Type a repo name first.");
  if (state.entries[name]) return status(`${name} is already listed.`);
  state.entries[name] = { description: "", liveUrl: "", tags: [] };
  $("new-name").value = "";
  render();
  status(`Added ${name} — fill in the fields, then copy the JSON.`);
});

$("new-name").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("add-entry").click();
});

$("copy-json").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(buildJSON());
    status("Copied — paste into projects.json, commit, push.");
  } catch {
    status("Clipboard blocked — use Download JSON instead.");
  }
});

$("download-json").addEventListener("click", () => {
  const blob = new Blob([buildJSON()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "projects.json";
  a.click();
  URL.revokeObjectURL(a.href);
  status("Downloaded — replace projects.json, commit, push.");
});

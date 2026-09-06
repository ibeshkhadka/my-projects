/* Field Dossier — live GitHub API data merged with projects.json.
   Same merge rules as the main archive: API is the roster, curated adds
   liveUrl/description/tags, curated-only names appear as private entries. */

const GITHUB_USER = "ibeshkhadka";
const API_URL = `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100&type=all`;
const CURATED_URL = "projects.json";
const EXCLUDE = new Set(["my-projects", "ibeshkhadka"]);

const state = { projects: [], search: "", filter: "all" };
const $ = (id) => document.getElementById(id);

async function loadCurated() {
  try {
    const res = await fetch(CURATED_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return data.projects || {};
  } catch {
    return {};
  }
}

async function loadRepos() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function init() {
  renderSkeletons();
  const curated = await loadCurated();
  let repos = null;
  let apiError = null;
  try {
    repos = await loadRepos();
  } catch (err) {
    apiError = err;
  }

  if (repos) {
    state.projects = repos
      .filter((r) => !EXCLUDE.has(r.name))
      .map((r) => {
        const c = curated[r.name] || {};
        return {
          name: r.name,
          description: c.description || r.description || "No description yet.",
          htmlUrl: r.html_url,
          liveUrl: c.liveUrl || null,
          tags: c.tags || [],
          updatedAt: r.updated_at,
          private: r.private,
          hasLive: Boolean(c.liveUrl),
        };
      });

    const apiNames = new Set(repos.map((r) => r.name));
    Object.entries(curated).forEach(([name, c]) => {
      if (!apiNames.has(name) && !EXCLUDE.has(name)) {
        state.projects.push({
          name,
          description: c.description || "No description yet.",
          htmlUrl: `https://github.com/${GITHUB_USER}/${name}`,
          liveUrl: c.liveUrl || null,
          tags: c.tags || [],
          updatedAt: null,
          private: true,
          hasLive: Boolean(c.liveUrl),
        });
      }
    });
  } else {
    // API down / rate-limited / file:// blocked — fall back to curated only
    state.projects = Object.entries(curated)
      .filter(([name]) => !EXCLUDE.has(name))
      .map(([name, c]) => ({
        name,
        description: c.description || "No description yet.",
        htmlUrl: `https://github.com/${GITHUB_USER}/${name}`,
        liveUrl: c.liveUrl || null,
        tags: c.tags || [],
        updatedAt: null,
        private: true,
        hasLive: Boolean(c.liveUrl),
      }));
  }

  state.projects.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  renderFilters();
  render();
  $("project-count").textContent = `${state.projects.length} entries filed`;
  $("spine-count").textContent = String(state.projects.length).padStart(2, "0");
  const liveCount = state.projects.filter((p) => p.hasLive).length;
  $("ledger-live").textContent = `${liveCount} live sites`;
  $("ledger-date").textContent = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  $("status").textContent = apiError
    ? `GitHub API limit hit (${apiError.message}) — showing ${state.projects.length} curated entries. Refresh in a bit for the live roster.`
    : `Dossier current — ${state.projects.length} entries, refreshed from the GitHub API on each visit.`;
  if (apiError && state.projects.length === 0) throw apiError;
}

function renderSkeletons() {
  $("grid").innerHTML = Array.from({ length: 6 }, () => `
    <div class="card skeleton" aria-hidden="true">
      <div class="stub"><span>——</span></div>
      <div class="skel-wrap">
        <div class="skel" style="height:20px;width:60%"></div>
        <div class="skel" style="height:14px;width:100%"></div>
        <div class="skel" style="height:14px;width:80%"></div>
        <div class="skel" style="height:36px;width:100%"></div>
      </div>
    </div>`).join("");
}

function renderFilters() {
  const tags = new Set(["all"]);
  state.projects.forEach((p) => p.tags.forEach((t) => tags.add(t)));
  const wrap = $("filters");
  wrap.innerHTML = "";
  [...tags].forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (tag === "all" ? " active" : "");
    btn.textContent = tag === "all" ? "all files" : tag;
    btn.dataset.tag = tag;
    btn.setAttribute("aria-pressed", tag === "all" ? "true" : "false");
    btn.addEventListener("click", () => {
      state.filter = tag;
      wrap.querySelectorAll(".chip").forEach((c) => {
        const on = c.dataset.tag === tag;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
    wrap.appendChild(btn);
  });
}

function matches(p) {
  const q = state.search.toLowerCase();
  const inSearch =
    !q ||
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.tags.some((t) => t.toLowerCase().includes(q));
  return inSearch && (state.filter === "all" || p.tags.includes(state.filter));
}

function badgeFor(p) {
  if (p.private) return '<span class="badge private">Private</span>';
  if (p.hasLive) return '<span class="badge live">Live</span>';
  return '<span class="badge">Source only</span>';
}

function cardHTML(p, i) {
  const code = "A-" + String(i + 1).padStart(2, "0");
  const tags = p.tags.map((t) => `<span class="tag">${escapeHTML(t)}</span>`).join("");
  const liveBtn = p.liveUrl
    ? `<a class="btn Go secondary" href="${p.liveUrl}" target="_blank" rel="noopener">Open site ↗</a>`
    : `<span class="btn secondary disabled" aria-disabled="true">No live site</span>`;
  const sourceBtn = p.private
    ? ""
    : `<a class="btn secondary" href="${p.htmlUrl}" target="_blank" rel="noopener">GitHub</a>`;
  const updated = p.updatedAt
    ? new Date(p.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "curated entry";
  return `
    <article class="card">
      <div class="stub" aria-hidden="true"><span>${code}</span></div>
      <div class="card-body">
        <div class="card-top">
          <h3>${escapeHTML(p.name)}</h3>
          ${badgeFor(p)}
        </div>
        <p class="desc">${escapeHTML(p.description)}</p>
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        <div class="card-actions">${liveBtn}${sourceBtn}</div>
        <span class="updated">UPD. ${escapeHTML(updated)}</span>
      </div>
    </article>`;
}

function render() {
  const visible = state.projects.filter(matches);
  $("grid").innerHTML = visible.map(cardHTML).join("");
  $("empty").classList.toggle("hidden", visible.length > 0);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("search").addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  render();
});

$("clear-search").addEventListener("click", () => {
  $("search").value = "";
  state.search = "";
  state.filter = "all";
  document.querySelectorAll("#filters .chip").forEach((c) => {
    const on = c.dataset.tag === "all";
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
  });
  render();
  $("search").focus();
});

$("year").textContent = new Date().getFullYear();

init().catch((err) => {
  $("grid").innerHTML = "";
  $("status").textContent = `Connection failed (${err.message}). Check your connection and refresh — the dossier reads GitHub live.`;
  $("project-count").textContent = "Dossier offline";
  // cover-status removed — header no longer shows status
});

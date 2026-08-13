/* Project Archive — fetches repos live from the GitHub API and merges
   them with the curated projects.json (live URLs, descriptions, tags). */

const GITHUB_USER = "ibeshkhadka";
const API_URL = `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100&type=all`;

const state = {
  projects: [],      // merged list of { name, description, htmlUrl, liveUrl, tags, updatedAt, private, hasLive }
  curated: {},       // from projects.json
  search: "",
  filter: "all",
};

const $ = (id) => document.getElementById(id);

/* ---------- Data ---------- */

async function loadCurated() {
  try {
    const res = await fetch("projects.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return data.projects || {};
  } catch {
    return {}; // curated layer is optional — site still works with raw API data
  }
}

async function loadRepos() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function init() {
  const [curated, repos] = await Promise.all([loadCurated(), loadRepos()]);
  state.curated = curated;

  const exclude = new Set(["my-projects", "ibeshkhadka"]);

  state.projects = repos
    .filter((r) => !exclude.has(r.name))
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

  // Private repos aren't visible to the unauthenticated API — add them from
  // the curated layer so they still appear in the archive.
  const apiNames = new Set(repos.map((r) => r.name));
  Object.entries(curated).forEach(([name, c]) => {
    if (!apiNames.has(name) && !exclude.has(name)) {
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

  renderFilters();
  render();
  $("project-count").textContent = `${state.projects.length} projects archived`;
  $("status").textContent = "Auto-synced with the GitHub API — new repos appear automatically.";
}

/* ---------- Rendering ---------- */

function renderFilters() {
  const tags = new Set(["all"]);
  state.projects.forEach((p) => p.tags.forEach((t) => tags.add(t)));

  const wrap = $("filters");
  wrap.innerHTML = "";
  [...tags].forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (tag === "all" ? " active" : "");
    btn.textContent = tag;
    btn.dataset.tag = tag;
    btn.addEventListener("click", () => {
      state.filter = tag;
      wrap.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.tag === tag));
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
  const inFilter = state.filter === "all" || p.tags.includes(state.filter);
  return inSearch && inFilter;
}

function badgeFor(p) {
  if (p.private) return '<span class="badge private">private</span>';
  if (p.hasLive) return '<span class="badge live">live</span>';
  return '<span class="badge nolive">no live site</span>';
}

function cardHTML(p) {
  const tags = p.tags.map((t) => `<span class="tag">${t}</span>`).join("");
  const liveBtn = p.liveUrl
    ? `<a class="btn live" href="${p.liveUrl}" target="_blank" rel="noopener">Open site ↗</a>`
    : `<span class="btn live" style="opacity:.45;cursor:not-allowed">No live site</span>`;
  const updated = p.updatedAt
    ? `updated ${new Date(p.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`
    : "archived";

  return `
    <article class="card">
      <div class="card-top">
        <h3>${p.name}</h3>
        ${badgeFor(p)}
      </div>
      <p class="desc">${escapeHTML(p.description)}</p>
      ${tags ? `<div class="tags">${tags}</div>` : ""}
      <div class="card-actions">
        ${liveBtn}
        <a class="btn gh" href="${p.htmlUrl}" target="_blank" rel="noopener">GitHub ↗</a>
      </div>
      <span class="updated">updated ${updated}</span>
    </article>`;
}

function render() {
  const grid = $("grid");
  const visible = state.projects.filter(matches);
  grid.innerHTML = visible.map(cardHTML).join("");
  $("empty").classList.toggle("hidden", visible.length > 0);
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Events ---------- */

$("search").addEventListener("input", (e) => {
  state.search = e.target.value.trim();
  render();
});

init().catch((err) => {
  $("status").textContent = `Couldn't reach the GitHub API (${err.message}). Check your connection and refresh.`;
  $("project-count").textContent = "offline";
});
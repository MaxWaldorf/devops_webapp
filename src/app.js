window.createDevopsComponent = (DCLogic, React) => {
const A = 560, B = 430, CX = 800, CY = 300;
const KEY = "devops-loop-model-v3";
const tabFromHash = () => ["loop", "roadmap", "ecosystem", "editor"].includes(window.location.hash.slice(1))
  ? window.location.hash.slice(1) : "loop";

const DEFAULT_RANGE = { sq: 4, sy: 2026, eq: 4, ey: 2027 };
const YEARS = [2026, 2027, 2028, 2029, 2030];

function qCount(r) {
  return Math.max(1, (r.ey - r.sy) * 4 + (r.eq - r.sq) + 1);
}
// stop 0 IS the start quarter, shown as "Today"; stops 1..n are the quarters after it
function quarterList(r) {
  const out = [];
  let q = r.sq, y = r.sy;
  for (let i = 0; i < qCount(r); i++) {
    out.push(i === 0 ? "Today" : "Q" + q + " " + y);
    q++; if (q > 4) { q = 1; y++; }
  }
  return out;
}
// absolute quarter keys ("2027-Q1") so notes, highlights and tool dates stay
// attached to a real quarter when the timeline range moves
function qKey(r, i) {
  let q = r.sq, y = r.sy;
  for (let k = 0; k < i; k++) { q++; if (q > 4) { q = 1; y++; } }
  for (let k = 0; k > i; k--) { q--; if (q < 1) { q = 4; y--; } }
  return y + "-Q" + q;
}
function qIndex(r, key) {
  const mm = /^(\d{4})-Q([1-4])$/.exec(String(key || ""));
  if (!mm) return null;
  return (+mm[1] - r.sy) * 4 + (+mm[2] - r.sq);
}
function migrate(m) {
  if (!m || m.schema === 7) return m;
  if (m.schema !== 6) migrateV6(m);
  // v6 -> v7: each tool lists the tools it depends on
  (m.tools || []).forEach(t => { if (!Array.isArray(t.deps)) t.deps = []; });
  m.schema = 7;
  return m;
}
function migrateV6(m) {
  if (m.schema !== 4 && m.schema !== 5) migrateV4(m);
  if (m.schema === 4) {
    // v4 -> v5: coverage state and dates move from the tool onto each assigned capability
    (m.tools || []).forEach(t => {
      const cov = t.cov || "n", startQ = t.startQ || null, endQ = t.endQ || null;
      t.caps = (t.caps || []).map(c => typeof c === "string" ? { id: c, cov, startQ, endQ } : c);
      delete t.cov; delete t.startQ; delete t.endQ;
    });
    m.schema = 5;
  }
  // v5 -> v6: notes move from the tool onto each assigned capability (each keeps a copy)
  (m.tools || []).forEach(t => {
    (t.caps || []).forEach(c => { c.notes = Object.assign({}, t.notes); });
    delete t.notes;
  });
  m.schema = 6;
}
function migrateV4(m) {
  const r = m.range || DEFAULT_RANGE;
  const conv = obj => {
    if (!obj) return {};
    const out = {};
    Object.keys(obj).forEach(k => { out[/^\d+$/.test(k) ? qKey(r, +k) : k] = obj[k]; });
    return out;
  };
  (m.tools || []).forEach(t => {
    if (typeof t.start === "number") { t.startQ = qKey(r, t.start); }
    if (typeof t.end === "number") { t.endQ = qKey(r, t.end); }
    delete t.start; delete t.end;
    t.notes = conv(t.notes);
  });
  (m.stages || []).forEach(s => { s.highlights = conv(s.highlights); });
  m.schema = 4;
}

function qName(r, i) {
  let q = r.sq, y = r.sy;
  for (let k = 0; k < i; k++) { q++; if (q > 4) { q = 1; y++; } }
  return "Q" + q + " " + y;
}

// model content is user-editable (incl. via JSON import), so escape before innerHTML
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

const STATUS = {
  c: { label: "Covered", rank: 3, bg: "var(--color-accent-300)", bd: "var(--color-accent-300)", fg: "var(--color-accent-200)", cell: "var(--color-accent-400)", w: 1 },
  p: { label: "Partially", rank: 2, bg: "linear-gradient(90deg, var(--color-accent-300) 0 50%, transparent 50% 100%)", bd: "var(--color-accent-500)", fg: "var(--color-accent-300)", cell: "var(--color-accent-700)", w: 0.5 },
  n: { label: "Not covered", rank: 1, bg: "transparent", bd: "#6a6e80", fg: "var(--color-neutral-200)", cell: "#3f4254", w: 0 },
  x: { label: "Not in scope", rank: 0, bg: "#3a3d52", bd: "#3a3d52", fg: "var(--color-neutral-300)", cell: "#2b2e42", w: null }
};

const ICONS = ["compass","code","hammer","test-tube","rocket-launch","cloud-arrow-up","gear-six","pulse","kanban","signpost","file-text","shield-check","git-branch","git-pull-request","key","brackets-curly","arrows-clockwise","package","tree-structure","lightning","check-circle","shield-warning","gauge","flask","tag","seal-check","calendar-check","arrows-left-right","stack","broadcast","sliders","arrow-counter-clockwise","siren","book-open-text","coins","hard-drives","chart-line","list-magnifying-glass","path","bell-ringing","users-three","lock-key","database","terminal-window","bug","graph","plugs","cube"];

// seed: [capability icon, capability label, readiness code per quarter, tools]
const SEED = [
  ["Plan", "ph-compass", [
    ["ph-kanban", "Backlog & sprint planning", "cccccc", ["Jira"]],
    ["ph-signpost", "Roadmap & priorities", "pccccc", ["Jira", "Miro"]],
    ["ph-file-text", "Requirements & specs", "pppccc", ["Confluence"]],
    ["ph-shield-check", "Risk & compliance intake", "npppcc", ["Jira"]]]],
  ["Code", "ph-code", [
    ["ph-git-branch", "Source control & branching", "cccccc", ["GitHub"]],
    ["ph-git-pull-request", "Peer review", "pccccc", ["GitHub"]],
    ["ph-key", "Secrets handling", "nppccc", ["Gitleaks", "GitHub Advanced Security"]],
    ["ph-brackets-curly", "Standards & linting", "nppccc", ["VS Code", "pre-commit"]],
    ["ph-robot", "AI coding assistants & agents", "pppccc", ["GitHub Copilot", "Claude Code"]]]],
  ["Build", "ph-hammer", [
    ["ph-arrows-clockwise", "CI pipelines", "cccccc", ["GitHub Actions"]],
    ["ph-package", "Artifact packaging", "pccccc", ["Docker", "Nexus", "Artifactory"]],
    ["ph-tree-structure", "Dependency management", "nppccc", ["Nexus", "Artifactory", "Renovate"]],
    ["ph-lightning", "Build cache & speed", "nnnppc", ["GitHub Actions"]]]],
  ["Test", "ph-test-tube", [
    ["ph-check-circle", "Unit & integration automation", "npppcc", ["Playwright", "Testcontainers"]],
    ["ph-shield-warning", "SAST / DAST scanning", "nppccc", ["GitHub Advanced Security", "Checkmarx", "SonarQube", "Trivy", "Checkov", "OWASP ZAP"]],
    ["ph-gauge", "Performance & load", "nnnppp", ["k6"]],
    ["ph-flask", "Test data & environments", "nnppcc", ["Testcontainers"]]]],
  ["Release", "ph-rocket-launch", [
    ["ph-tag", "Versioning & changelogs", "pccccc", ["GitHub Releases"]],
    ["ph-seal-check", "Approvals & change management", "ppcccc", ["ServiceNow"]],
    ["ph-calendar-check", "Release orchestration", "npppcc", ["GitHub Actions"]],
    ["ph-arrows-left-right", "Environment promotion", "nppccc", ["ServiceNow"]]]],
  ["Deploy", "ph-cloud-arrow-up", [
    ["ph-stack", "IaC provisioning", "pccccc", ["Terraform"]],
    ["ph-broadcast", "Progressive delivery", "nnppcc", ["Argo Rollouts"]],
    ["ph-sliders", "Config & secrets per env", "nppccc", ["Ansible", "Vault"]],
    ["ph-arrow-counter-clockwise", "Rollback", "npcccc", ["Argo CD"]]]],
  ["Operate", "ph-gear-six", [
    ["ph-siren", "Incident response & on-call", "npcccc", ["PagerDuty"]],
    ["ph-book-open-text", "Runbooks & automation", "npppcc", ["Confluence"]],
    ["ph-coins", "Capacity & cost", "nnnppp", []],
    ["ph-hard-drives", "Backup & DR", "xxxxxx", ["Velero"]]]],
  ["Monitor", "ph-pulse", [
    ["ph-chart-line", "Metrics & dashboards", "ppcccc", ["Grafana", "Prometheus"]],
    ["ph-list-magnifying-glass", "Centralised logging", "nppccc", ["Loki"]],
    ["ph-path", "Tracing & APM", "nnppcc", ["Tempo"]],
    ["ph-bell-ringing", "SLOs & alerting", "nnnpcc", ["Prometheus"]]]]
];

// sample dependencies: tool -> the tools it depends on (by name). Each link is an integration
// the vendors document publicly; the comment names it.
const SEED_DEPS = {
  "GitHub": ["Jira", "Confluence"],                        // at scale, work is planned in Jira (issue keys in branches/PRs) and specified in Confluence
  "Jira": ["GitHub"],                                      // GitHub for Atlassian app: branches, PRs and builds in the Jira development panel
  "Confluence": ["Jira"],                                  // Jira issues macro, native Atlassian link
  "Miro": ["Jira"],                                        // Miro Jira Cards integration
  "VS Code": ["GitHub"],                                   // GitHub Pull Requests extension, GitHub sign-in
  "pre-commit": ["GitHub", "Gitleaks", "Checkov"],         // hooks fetched from git repos; gitleaks and checkov ship pre-commit hooks
  "GitHub Copilot": ["GitHub", "GitHub Actions"],          // Copilot coding agent works on GitHub issues/PRs in a GitHub Actions environment
  "Claude Code": ["GitHub", "GitHub Actions", "Jira", "Confluence"], // Claude GitHub app + claude-code-action; Atlassian remote MCP server
  "GitHub Advanced Security": ["GitHub", "GitHub Actions"], // code/secret scanning on GitHub repos; CodeQL runs on Actions
  "Trivy": ["GitHub Actions", "GitHub Advanced Security"], // aquasecurity/trivy-action; SARIF upload to code scanning
  "Checkmarx": ["GitHub", "GitHub Actions"],               // Checkmarx One GitHub integration (PR decoration); checkmarx/ast-github-action
  "Checkov": ["GitHub Actions", "GitHub Advanced Security"], // bridgecrewio/checkov-action; SARIF upload to code scanning
  "GitHub Actions": ["GitHub", "Docker", "Nexus", "Artifactory", "Vault", "ServiceNow"], // repo events; docker/build-push-action; package publish (setup-jfrog-cli); hashicorp/vault-action; DevOps Change gate
  "Docker": ["Nexus", "Artifactory"],                      // private Docker registries / Docker Hub proxies
  "Renovate": ["GitHub", "Nexus", "Artifactory"],          // runs as a GitHub app; private registry lookups
  "Playwright": ["GitHub Actions"],                        // Playwright "Setting up CI" generates a GitHub Actions workflow
  "Testcontainers": ["Docker"],                            // needs a Docker-compatible runtime
  "SonarQube": ["GitHub", "GitHub Actions"],               // PR decoration via GitHub app; scan action in CI
  "OWASP ZAP": ["GitHub Actions"],                         // zaproxy baseline/full-scan actions
  "k6": ["GitHub Actions", "Prometheus"],                  // grafana/run-k6-action; Prometheus remote-write output
  "GitHub Releases": ["GitHub", "GitHub Actions"],         // releases of a repo, created from workflows
  "ServiceNow": ["Jira", "GitHub Actions"],                // ServiceNow DevOps tool integrations (Jira, GitHub Actions)
  "Terraform": ["GitHub", "GitHub Actions", "Artifactory", "Vault"], // git module sources; setup-terraform; Artifactory Terraform registry; Vault provider
  "Ansible": ["GitHub", "Vault"],                          // playbooks/collections from git; community.hashi_vault
  "Argo CD": ["GitHub", "Artifactory", "Vault"],           // git as source of truth; Helm/OCI chart repo; argocd-vault-plugin
  "Argo Rollouts": ["Prometheus"],                         // AnalysisTemplates query Prometheus metrics
  "Grafana": ["Prometheus", "Loki", "Tempo", "PagerDuty"], // data sources; alerting contact point
  "Prometheus": ["PagerDuty"],                             // Alertmanager PagerDuty receiver
  "PagerDuty": ["ServiceNow"]                              // PagerDuty <-> ServiceNow incident sync
};

function sigOf(code) {
  const first = t => { const i = code.indexOf(t); return i < 0 ? null : i; };
  if (/^x+$/.test(code)) return { cov: "x", start: null, end: null };
  if (code[0] === "c") return { cov: "c", start: null, end: null };
  if (code[0] === "p") return { cov: "p", start: null, end: first("c") };
  const p = first("p"), c = first("c");
  return { cov: "n", start: p !== null ? p : c, end: c };
}

function seedModel() {
  const QUARTERS = quarterList(DEFAULT_RANGE);
  let cid = 0, tid = 0;
  const stages = [], groups = new Map();
  SEED.forEach((s, si) => {
    const caps = s[2].map(c => {
      const id = "c" + (++cid);
      const sig = sigOf(c[2]);
      const maxQ = QUARTERS.length - 1;
      if (sig.start != null) sig.start = Math.min(sig.start, maxQ);
      if (sig.end != null) sig.end = Math.min(sig.end, maxQ);
      c[3].forEach(name => {
        if (!groups.has(name)) groups.set(name, { id: "t" + (++tid), name, caps: [] });
        groups.get(name).caps.push({
          id, cov: sig.cov, notes: {},
          startQ: sig.start == null ? null : qKey(DEFAULT_RANGE, sig.start),
          endQ: sig.end == null ? null : qKey(DEFAULT_RANGE, sig.end)
        });
      });
      return { id, label: c[1], icon: c[0] };
    });
    stages.push({ name: s[0], icon: s[1], caps, highlights: {} });
  });
  const tools = Array.from(groups.values());
  tools.forEach(t => { t.deps = (SEED_DEPS[t.name] || []).map(n => (groups.get(n) || {}).id).filter(Boolean); });
  const nameOf = id => { for (const s of stages) { const c = s.caps.find(c => c.id === id); if (c) return c.label; } return ""; };
  stages.forEach(s => {
    const ids = s.caps.map(c => c.id);
    QUARTERS.forEach((q, qi) => {
      const lines = [], key = qKey(DEFAULT_RANGE, qi);
      tools.forEach(t => {
        const mine = t.caps.filter(a => ids.indexOf(a.id) >= 0);
        const ends = mine.filter(a => a.endQ === key);
        const starts = mine.filter(a => a.startQ === key && a.endQ !== key);
        if (ends.length) lines.push(t.name + " fully covers " + ends.map(a => nameOf(a.id)).join(", "));
        if (starts.length) lines.push(t.name + " starts covering " + starts.map(a => nameOf(a.id)).join(", "));
      });
      if (lines.length) s.highlights[key] = lines.join("\n");
    });
  });
  return { schema: 7, stages, tools, range: Object.assign({}, DEFAULT_RANGE) };
}

function validModel(m) {
  if (!(m && Array.isArray(m.stages) && m.stages.length === 8 && Array.isArray(m.tools))) return null;
  m.stages.forEach(s => { if (!s.highlights) s.highlights = {}; });
  if (!m.range) m.range = Object.assign({}, DEFAULT_RANGE);
  return migrate(m);
}

// ---- tool ecosystem: tool.deps lists the ids of the tools it depends on (A -> B: A needs B).
// A tool's tier comes from how many distinct tools it is linked to (either direction); the map
// is a force layout: central tools end up in the middle, satellites around what they link to ----
const ECO_W = 1000, ECO_H = 620, ECO_CX = 500, ECO_CY = 300;
const TIERS = [
  { label: "Central", note: "3+ links, and the most linked or relied on by 40%+ of tools", tag: "tag-accent", fill: "var(--color-accent-700)", stroke: "var(--color-accent-300)", fg: "var(--color-accent-100)" },
  { label: "Integrated", note: "2+ links", tag: "tag-outline", fill: "var(--color-accent-900)", stroke: "var(--color-accent-500)", fg: "var(--color-text)" },
  { label: "Satellite", note: "a single link", tag: "tag-neutral", fill: "var(--color-bg)", stroke: "var(--color-accent-600)", fg: "var(--color-neutral-100)" },
  { label: "Not linked", note: "no dependencies yet", tag: "tag-neutral c-eco-tag-dim", fill: "var(--color-bg)", stroke: "#5b5f70", fg: "var(--color-neutral-300)" }
];
// filter levels of the Ecosystem tab: each shows tiers up to maxTier
const ECO_LAYERS = [
  { id: "central", label: "Central", icon: "ph-circle", maxTier: 0 },
  { id: "integrated", label: "Central + Integrated", icon: "ph-circles-three", maxTier: 1 },
  { id: "all", label: "All tools", icon: "ph-graph", maxTier: 3 }
];
function ecoGraph(m) {
  const tools = (m.tools || []).filter(t => t && t.id);
  const ids = new Set(tools.map(t => t.id)), seen = new Set(), edges = [];
  tools.forEach(t => (Array.isArray(t.deps) ? t.deps : []).forEach(d => {
    const k = t.id + ">" + d;
    if (ids.has(d) && d !== t.id && !seen.has(k)) { seen.add(k); edges.push({ from: t.id, to: d }); }
  }));
  const byId = new Map(tools.map(t => [t.id, { id: t.id, name: String(t.name || "").trim() || "untitled", tool: t, deps: [], users: [], links: new Set() }]));
  edges.forEach(e => {
    const a = byId.get(e.from), b = byId.get(e.to);
    a.deps.push(e.to); b.users.push(e.from); a.links.add(e.to); b.links.add(e.from);
  });
  // blast radius: every tool that depends on this one, directly or through other tools
  const reach = id => {
    const out = new Set(), q = [id];
    while (q.length) byId.get(q.shift()).users.forEach(u => { if (u !== id && !out.has(u)) { out.add(u); q.push(u); } });
    return out.size;
  };
  const maxDeg = Math.max(0, ...Array.from(byId.values(), n => n.links.size));
  const nodes = Array.from(byId.values(), n => {
    const deg = n.links.size;
    // central: 3+ links and either close to the most linked tool or relied on by 40%+ of all tools
    const rc = reach(n.id), hub = deg >= 3 && (deg >= Math.ceil(maxDeg * 0.6) || rc >= 0.4 * byId.size);
    const tier = deg === 0 ? 3 : deg === 1 ? 2 : hub ? 0 : 1;
    return Object.assign(n, { deg, tier, reach: rc, r: 9 + 4 * Math.sqrt(n.users.length) });
  });
  nodes.sort((a, b) => a.tier - b.tier || b.deg - a.deg || b.reach - a.reach || a.name.localeCompare(b.name));

  // seed positions on a spiral, most central first, so the simulation starts from a sensible
  // shape and every layout is deterministic
  nodes.forEach((n, k) => {
    const a = k * 2.39996, r = 30 + 26 * Math.sqrt(k);
    n.x = ECO_CX + r * 1.5 * Math.cos(a);
    n.y = ECO_CY + r * Math.sin(a);
    n.vx = 0; n.vy = 0; n.fx = null; n.fy = null;
  });
  edges.forEach(e => { e.sat = byId.get(e.from).deg === 1 || byId.get(e.to).deg === 1; });
  const sig = tools.map(t => t.id + ":" + edges.filter(e => e.from === t.id).map(e => e.to).join(",")).join("|");
  return { nodes, edges, byId, sig };
}

// one tick of the force layout: nodes repel, links act as springs (short to satellites, longer
// between connected tools), central tools are pulled hardest towards the middle
function ecoStep(g, alpha) {
  const ns = g.nodes;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j];
    let dx = b.x - a.x, dy = b.y - a.y;
    if (!dx && !dy) { dx = (i - j) * 0.1; dy = 0.1; }
    const d2 = Math.max(dx * dx + dy * dy, 64);
    if (d2 > 160000) continue;
    const f = 600 * alpha / d2;
    a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
  }
  g.edges.forEach(e => {
    const a = g.byId.get(e.from), b = g.byId.get(e.to);
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const k = (d - (e.sat ? 90 : 160) * (g.nodes.length < 15 ? 1.6 : 1)) / d * alpha * (e.sat ? 0.5 : 0.25) / 2;
    a.vx += dx * k; a.vy += dy * k; b.vx -= dx * k; b.vy -= dy * k;
  });
  // keep tools (and the label under them) off links they are not part of: find the closest
  // point of the drawn curve and push the tool away from it
  g.edges.forEach(e => {
    const a = g.byId.get(e.from), b = g.byId.get(e.to);
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, bend = Math.min(40, L * 0.15);
    const cx = (a.x + b.x) / 2 - uy * bend, cy = (a.y + b.y) / 2 + ux * bend;
    ns.forEach(n => {
      if (n === a || n === b) return;
      [[n.x, n.y, n.r + 16], [n.x, n.y + n.r + 11, 11]].forEach(([qx, qy, clear]) => {
        if (qx < Math.min(a.x, b.x, cx) - clear || qx > Math.max(a.x, b.x, cx) + clear || qy < Math.min(a.y, b.y, cy) - clear || qy > Math.max(a.y, b.y, cy) + clear) return;
        let best = Infinity, px = 0, py = 0;
        for (let i = 1; i < 12; i++) {
          const t = i / 12, s = 1 - t;
          const x = s * s * a.x + 2 * s * t * cx + t * t * b.x, y = s * s * a.y + 2 * s * t * cy + t * t * b.y;
          const d = Math.hypot(qx - x, qy - y);
          if (d < best) { best = d; px = x; py = y; }
        }
        if (best >= clear) return;
        let dx = qx - px, dy = qy - py;
        if (best < 0.5) { dx = -uy; dy = ux; best = 1; }
        const k = (clear - best) / best * Math.max(alpha, 0.05) * 0.6;
        n.vx += dx * k; n.vy += dy * k;
        a.vx -= dx * k * 0.1; a.vy -= dy * k * 0.1; b.vx -= dx * k * 0.1; b.vy -= dy * k * 0.1;
      });
    });
  });
  ns.forEach(n => {
    // fewer tools shown (filter): a weaker pull, so they use the whole map
    const pull = [0.07, 0.04, 0.025, 0.04][n.tier] * alpha * Math.min(1, ns.length / 30);
    n.vx += (ECO_CX - n.x) * pull; n.vy += (ECO_CY - n.y) * pull * 1.6;
    if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = 0; n.vy = 0; return; }
    n.vx *= 0.6; n.vy *= 0.6;
    n.x = Math.min(ECO_W - 60, Math.max(60, n.x + n.vx));
    n.y = Math.min(ECO_H - 50, Math.max(30, n.y + n.vy));
    // the top-right corner is the legend's (with room for a label): move out by the shorter way
    const lx = ECO_W - 245, ly = 225;
    if (n.x > lx && n.y < ly) { if (n.x - lx < ly - n.y) n.x = lx; else n.y = ly; }
  });
  // no overlaps: each tool plus its label is a box; overlapping boxes are pushed apart the short way
  const box = n => {
    const w = Math.max(2 * n.r, n.name.length * (n.tier === 0 ? 8.4 : 7.2)) + 14;
    return { w, h: 2 * n.r + 30, cy: n.y + 9 };
  };
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j], ba = box(a), bb = box(b);
    const ox = (ba.w + bb.w) / 2 - Math.abs(b.x - a.x), oy = (ba.h + bb.h) / 2 - Math.abs(bb.cy - ba.cy);
    if (ox <= 0 || oy <= 0) continue;
    const ma = a.fx != null ? 0 : b.fx != null ? 1 : 0.5, mb = 1 - ma;
    if (ox < oy) { const sx = b.x >= a.x ? 1 : -1; a.x -= sx * ox * ma * 0.5; b.x += sx * ox * mb * 0.5; }
    else { const sy = bb.cy >= ba.cy ? 1 : -1; a.y -= sy * oy * ma * 0.5; b.y += sy * oy * mb * 0.5; }
  }
}
function ecoSettle(g) {
  for (let alpha = 1; alpha > 0.005; alpha *= 0.975) ecoStep(g, alpha);
  return g;
}
// the zoomed view: positions scale and shift, circles and labels keep their size, so zooming
// in spreads a busy graph out instead of just magnifying it
function ecoProject(g, v) {
  const nodes = g.nodes.map(n => Object.assign({}, n, { x: n.x * v.k + v.tx, y: n.y * v.k + v.ty }));
  return Object.assign({}, g, { nodes, byId: new Map(nodes.map(n => [n.id, n])), edges: g.edges.map(e => Object.assign({}, e)) });
}
// the tools shown at a filter level (highest tier kept), with only the links between them;
// tiers, counts and blast radius stay those of the whole ecosystem
function ecoFilter(g, maxTier) {
  if (maxTier >= 3) return g;
  const nodes = g.nodes.filter(n => n.tier <= maxTier);
  const byId = new Map(nodes.map(n => [n.id, n]));
  return Object.assign({}, g, { nodes, byId, edges: g.edges.filter(e => byId.has(e.from) && byId.has(e.to)), sig: g.sig + "#" + maxTier });
}
// edges: a curve sampled as points, plus an arrowhead. Each link picks its bend (side and depth)
// to stay clear of the other tools and their labels; a two-way pair keeps opposite sides
function ecoGeom(g) {
  const pairs = new Set(g.edges.map(e => e.from + ">" + e.to));
  g.edges.forEach(e => {
    const a = g.byId.get(e.from), b = g.byId.get(e.to);
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, base = Math.min(40, L * 0.15);
    const options = pairs.has(e.to + ">" + e.from) ? [1, 2, 3] : [1, -1, 0, 2, -2, 3, -3];
    let bend = base, bestScore = -Infinity;
    options.forEach((o, rank) => {
      const bd = base * o, cx = mx - uy * bd, cy = my + ux * bd;
      let clear = 40;
      g.nodes.forEach(n => {
        if (n === a || n === b) return;
        for (let i = 2; i < 15; i++) {
          const t = i / 16, s = 1 - t;
          const x = s * s * a.x + 2 * s * t * cx + t * t * b.x, y = s * s * a.y + 2 * s * t * cy + t * t * b.y;
          if (Math.abs(x - n.x) > 60 || Math.abs(y - n.y) > 60) continue;
          clear = Math.min(clear, Math.hypot(x - n.x, y - n.y) - n.r - 4, Math.hypot(x - n.x, y - n.y - n.r - 11) - 10);
        }
      });
      const score = Math.min(clear, 14) - rank * 0.6;
      if (score > bestScore) { bestScore = score; bend = bd; }
    });
    const p0 = [a.x + ux * a.r, a.y + uy * a.r], p2 = [b.x - ux * (b.r + 4), b.y - uy * (b.r + 4)];
    const c = [(a.x + b.x) / 2 - uy * bend, (a.y + b.y) / 2 + ux * bend];
    e.pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, s = 1 - t;
      e.pts.push([s * s * p0[0] + 2 * s * t * c[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * c[1] + t * t * p2[1]]);
    }
    const tl = Math.hypot(p2[0] - c[0], p2[1] - c[1]) || 1, tx = (p2[0] - c[0]) / tl, ty = (p2[1] - c[1]) / tl;
    e.head = [p2, [p2[0] - tx * 11 - ty * 5, p2[1] - ty * 11 + tx * 5], [p2[0] - tx * 7, p2[1] - ty * 7], [p2[0] - tx * 11 + ty * 5, p2[1] - ty * 11 - tx * 5]];
  });
  return g;
}

// Served over http(s) with the /api/model endpoint present, the model lives on the
// server (per-browser cookie) and localStorage is never touched. From file:// or a
// plain static server the endpoint is absent and localStorage is used instead.
const API = "api/model";
const useLocal = () => window.location.protocol === "file:";

function loadLocal() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return validModel(JSON.parse(raw));
  } catch (e) { /* fall through to seed */ }
  return null;
}

function loadModel() {
  return (useLocal() && loadLocal()) || seedModel();
}

class Component extends DCLogic {
  state = { allIcons: Array.isArray(window.PHOSPHOR_ICONS) ? window.PHOSPHOR_ICONS : null, iconBuf: {}, iconOpen: null, drag: null, dragOver: null, dropAt: null, tab: tabFromHash(), roadmapView: "sdlc", menuOpen: false, exportOpen: false, exporting: null, exportDone: null, exportErr: "", narrow: false, cursor: 0, hover: null, selected: null, tPos: 0, caps: true, coverage: true, tools: false, model: loadModel() };

  flash(msg, bad) {
    this.setState({ ioMsg: msg, ioBad: !!bad });
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => this.setState({ ioMsg: "" }), 4000);
  }
  save(model) {
    this.dirty = true;
    this.persist(model);
    this.setState({ model });
  }
  persist(model) {
    if (this.remote === "yes") {
      clearTimeout(this.putT);
      this.putT = setTimeout(() => {
        fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(model) })
          .then(r => { if (!r.ok) throw new Error(r.status); })
          .catch(() => this.flash("Could not save to the server", true));
      }, 400);
    } else if (this.remote === "no") {
      try { window.localStorage.setItem(KEY, JSON.stringify(model)); } catch (e) { /* storage unavailable */ }
    }
  }
  // Decide where the model lives: ask the server first, fall back to localStorage.
  initStore() {
    const local = () => {
      this.remote = "no";
      const m = loadLocal();
      if (m && !this.dirty) this.setState({ model: m });
      else if (this.dirty) this.persist(this.state.model);
    };
    if (useLocal()) return local();
    fetch(API, { credentials: "same-origin" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        if (!d || !("model" in d)) throw new Error("no api");
        this.remote = "yes";
        const m = validModel(d.model);
        if (this.dirty) this.persist(this.state.model);
        else if (m) this.setState({ model: m });
      })
      .catch(local);
  }
  edit(fn) {
    const m = JSON.parse(JSON.stringify(this.state.model));
    fn(m);
    this.save(m);
  }

  startPulse() {
    const el = this.pulseEl;
    if (!el) return;
    if (this.pulseAnim && this.pulseNode === el) return;
    if (this.pulseAnim) { this.pulseAnim.cancel(); this.pulseAnim = null; }
    this.pulseNode = el;
    const L = el.getTotalLength();
    if (!L) return;
    el.style.strokeDasharray = 70 + " " + (L - 70);
    this.pulseAnim = el.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -L }],
      { duration: 16000, iterations: Infinity, easing: "linear" });
  }

  componentDidMount() {
    this.initStore();
    this.hashH = () => {
      const tab = tabFromHash();
      if (tab !== this.state.tab) this.setState({ tab, selected: null, hover: null, menuOpen: false });
    };
    window.addEventListener("hashchange", this.hashH);
    // Too narrow for the infinity loop: show the stage cards only.
    this.mq = window.matchMedia("(max-width: 899px)");
    this.mqH = () => this.setState({ narrow: this.mq.matches });
    this.mqH();
    this.mq.addEventListener("change", this.mqH);
    // the export menu closes on a click outside it or on Escape
    this.docDown = e => { if (this.state.exportOpen && this.exportEl && !this.exportEl.contains(e.target)) this.setState({ exportOpen: false }); };
    this.docKey = e => { if (e.key === "Escape" && this.state.exportOpen) this.setState({ exportOpen: false }); };
    document.addEventListener("pointerdown", this.docDown);
    document.addEventListener("keydown", this.docKey);
    const ms = Math.max(800, (this.props.cycleSeconds ?? 3) * 1000);
    this.timer = setInterval(() => {
      if (this.props.autoCycle === false || this.state.tab !== "loop" || this.state.narrow) return;
      if (this.state.hover !== null || this.state.selected !== null) return;
      this.setState(s => ({ cursor: (s.cursor + 1) % 8 }));
    }, ms);
  }
  componentWillUnmount() {
    clearInterval(this.timer);
    window.removeEventListener("hashchange", this.hashH);
    if (this.mq) this.mq.removeEventListener("change", this.mqH);
    document.removeEventListener("pointerdown", this.docDown);
    document.removeEventListener("keydown", this.docKey);
    clearTimeout(this.exportT);
    clearTimeout(this.flashT);
    clearTimeout(this.putT);
    if (this.pulseAnim) this.pulseAnim.cancel();
    if (this.ecoRaf) cancelAnimationFrame(this.ecoRaf);
    this.detach();
  }

  // ---- live force layout for the Ecosystem tab: positions survive re-renders and model edits;
  // the simulation re-heats when the graph changes or a tool is dragged ----
  ecoLive(g) {
    const sim = this.ecoSim || (this.ecoSim = { sig: null, pos: new Map(), alpha: 0 });
    if (sim.sig !== g.sig) {
      const fresh = !sim.sig;
      g.nodes.forEach(n => {
        const p = sim.pos.get(n.id);
        if (p) { n.x = p.x; n.y = p.y; n.fx = p.fx; n.fy = p.fy; return; }
        // a newly linked or added tool starts next to a tool it is linked to
        const nb = Array.from(n.links, id => sim.pos.get(id)).find(Boolean);
        if (!fresh && nb) { n.x = nb.x + 18; n.y = nb.y + 18; }
      });
      sim.sig = g.sig;
      sim.alpha = fresh ? 1 : Math.max(sim.alpha, 0.45);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        for (; sim.alpha > 0.005; sim.alpha *= 0.975) ecoStep(g, sim.alpha);
      }
    } else {
      g.nodes.forEach(n => {
        const p = sim.pos.get(n.id);
        if (p) Object.assign(n, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, fx: p.fx, fy: p.fy });
      });
    }
    sim.g = g;
    sim.pos = new Map(g.nodes.map(n => [n.id, n]));
    if (sim.alpha > 0.005 && !this.ecoRaf) this.ecoRaf = requestAnimationFrame(this.ecoTick);
    return g;
  }
  ecoTick = () => {
    this.ecoRaf = null;
    const sim = this.ecoSim;
    if (!sim || !sim.g || this.state.tab !== "ecosystem") return;
    for (let k = 0; k < 2; k++) { ecoStep(sim.g, sim.alpha); sim.alpha *= 0.985; }
    if (this.ecoDrag) sim.alpha = Math.max(sim.alpha, 0.15);
    this.setState(s => ({ ecoTick: (s.ecoTick || 0) + 1 }));
  };
  ecoClamp(v) {
    return { k: v.k, tx: Math.min(0, Math.max(ECO_W - ECO_W * v.k, v.tx)), ty: Math.min(0, Math.max(ECO_H - ECO_H * v.k, v.ty)) };
  }
  // zoom by factor f around a point of the map (viewBox units); centre when none is given
  ecoZoomBy(f, vx, vy) {
    const v = this.state.ecoView || { k: 1, tx: 0, ty: 0 };
    const k = Math.min(4, Math.max(1, v.k * f));
    if (vx == null) { vx = ECO_W / 2; vy = ECO_H / 2; }
    this.setState({ ecoView: this.ecoClamp({ k, tx: vx - (vx - v.tx) * k / v.k, ty: vy - (vy - v.ty) * k / v.k }) });
  }
  ecoWheel = e => {
    if (!this.ecoSvg) return;
    e.preventDefault();
    const r = this.ecoSvg.getBoundingClientRect();
    this.ecoZoomBy(Math.exp(-e.deltaY * 0.0015), (e.clientX - r.left) * ECO_W / r.width, (e.clientY - r.top) * ECO_H / r.height);
  };
  // drag the empty background to pan a zoomed map
  ecoPanDown(e) {
    const v0 = this.state.ecoView;
    if (!this.ecoSvg || e.button > 0 || !v0 || v0.k === 1) return;
    const r = this.ecoSvg.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    const move = ev => this.setState({ ecoView: this.ecoClamp({ k: v0.k, tx: v0.tx + (ev.clientX - x0) * ECO_W / r.width, ty: v0.ty + (ev.clientY - y0) * ECO_H / r.height }) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  ecoDown(id, e) {
    const svg = this.ecoSvg, sim = this.ecoSim;
    if (!svg || !sim || e.button > 0) return;
    const r = svg.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    this.ecoMoved = false;
    this.ecoDrag = id;
    const move = ev => {
      if (!this.ecoMoved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      this.ecoMoved = true;
      const n = this.ecoSim.pos.get(id), v = this.state.ecoView || { k: 1, tx: 0, ty: 0 };
      if (!n) return;
      n.fx = Math.min(ECO_W - 20, Math.max(20, ((ev.clientX - r.left) * ECO_W / r.width - v.tx) / v.k));
      n.fy = Math.min(ECO_H - 20, Math.max(20, ((ev.clientY - r.top) * ECO_H / r.height - v.ty) / v.k));
      this.ecoSim.alpha = Math.max(this.ecoSim.alpha, 0.3);
      if (!this.ecoRaf) this.ecoRaf = requestAnimationFrame(this.ecoTick);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this.ecoDrag = null;
      const n = this.ecoSim.pos.get(id);
      if (n) { n.fx = null; n.fy = null; }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  detach() {
    if (!this.moveH) return;
    window.removeEventListener("pointermove", this.moveH);
    window.removeEventListener("pointerup", this.upH);
    this.moveH = null;
  }
  maxStop() {
    return quarterList((this.state.model || {}).range || DEFAULT_RANGE).length - 1;
  }
  posFrom(e) {
    const r = this.trackEl.getBoundingClientRect(), pad = 10;
    const f = (e.clientX - r.left - pad) / Math.max(1, r.width - pad * 2);
    return Math.min(1, Math.max(0, f)) * this.maxStop();
  }
  dragStart = e => {
    if (!this.trackEl) return;
    this.setState({ tPos: this.posFrom(e) });
    this.moveH = ev => this.setState({ tPos: this.posFrom(ev) });
    this.upH = ev => { this.setState({ tPos: Math.round(this.posFrom(ev)) }); this.detach(); };
    window.addEventListener("pointermove", this.moveH);
    window.addEventListener("pointerup", this.upH);
  };

  seg(i) {
    const lobe = i < 4 ? -1 : 1, k = i % 4;
    const t0 = k * Math.PI / 4, t1 = (k + 1) * Math.PI / 4, N = 46;
    const pt = t => [CX + lobe * A * Math.sin(t), CY - B * Math.sin(t) * Math.cos(t)];
    let d = "";
    for (let j = 0; j <= N; j++) {
      const p = pt(t0 + (t1 - t0) * j / N);
      d += (j ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1) + " ";
    }
    const p = pt((t0 + t1) / 2), lc = [CX + lobe * A * 0.5, CY];
    let vx = p[0] - lc[0], vy = p[1] - lc[1];
    const m = Math.hypot(vx, vy) || 1; vx /= m; vy /= m;
    const off = (k === 0 || k === 3) ? 68 : 80;
    return { d, p, l: [p[0] + vx * off, p[1] + vy * off] };
  }

  // status of one tool→capability assignment {id, cov, startQ, endQ} at stop i
  effective(a, i, range) {
    const r = range || (this.state.model || {}).range || DEFAULT_RANGE;
    const s = a.startQ ? qIndex(r, a.startQ) : null;
    const e = a.endQ ? qIndex(r, a.endQ) : null;
    if (a.cov === "x") return "x";
    if (a.cov === "c") return "c";
    if (a.cov === "p") return e != null && i >= e ? "c" : "p";
    if (e != null && i >= e) return "c";
    if (s != null && i >= s) return "p";
    return "n";
  }

  // ---- export: one deck for PDF and PPTX. Each slide is laid out once as a list of drawing
  // ops in 1600×900 slide units (120 per inch). PPTX turns every op into a native, editable
  // shape; PDF paints the same list onto one canvas per page ----
  cssVar(name) {
    if (!this._cssVars) this._cssVars = getComputedStyle(document.documentElement);
    return this._cssVars.getPropertyValue(name).trim();
  }
  // resolve a template color (var()/gradient/hex) to a plain "RRGGBB" hex for pptxgenjs
  resolveColor(v, fallback) {
    const fb = fallback || "9184D9";
    v = String(v || "").trim();
    let mm = /^var\((--[\w-]+)\)$/.exec(v);
    if (mm) return this.resolveColor(this.cssVar(mm[1]), fb);
    if (/^(repeating-)?linear-gradient/.test(v)) {
      mm = v.match(/#[0-9a-fA-F]{3,8}|var\(--[\w-]+\)/);
      return mm ? this.resolveColor(mm[0], fb) : fb;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(v)) return v.slice(1).replace(/./g, ch => ch + ch).toUpperCase();
    if (/^#[0-9a-fA-F]{6}/.test(v)) return v.slice(1, 7).toUpperCase();
    return fb;
  }
  // like resolveColor, but transparent gives null (no fill/stroke); color-mix() tokens come from the palette
  hex(v) {
    v = String(v || "").trim();
    if (!v || v === "transparent" || v === "none") return null;
    if (v === "var(--color-divider)") return this._pal.divider;
    return this.resolveColor(v, "E9E9ED");
  }
  mixHex(a, b, t) {
    const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
    return [0, 2, 4].map(i => Math.round(ch(a, i) * t + ch(b, i) * (1 - t)).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  exportPalette() {
    const c = n => this.resolveColor("var(--color-" + n + ")", "E9E9ED");
    const p = { bg: c("bg"), surface: c("surface"), text: c("text") };
    [100, 200, 300, 400, 500, 600, 700, 800, 900].forEach(n => { p["n" + n] = c("neutral-" + n); p["a" + n] = c("accent-" + n); });
    p.divider = this.mixHex(p.text, p.bg, 0.16);
    p.cardBd = this.mixHex(p.text, p.surface, 0.16);
    p.band = this.mixHex(p.a900, p.n900, 0.45);
    p.bandBd = this.mixHex(p.a800, p.bg, 0.6);
    return p;
  }
  // a fixed full-overview snapshot (every layer on, no focus, roadmap's end quarter)
  // computed without touching real UI state, so export never flickers the live app;
  // the lifecycle slide (`loop`) is the same view with the Coverage layer off
  exportData() {
    const st = this.state;
    const exportState = Object.assign({}, st, {
      tab: "roadmap", roadmapView: "sdlc", caps: true, coverage: true, tools: true,
      selected: null, hover: null, cursor: -1, narrow: false, tPos: this.maxStop()
    });
    const sdlc = this.renderVals(exportState);
    const tools = this.renderVals(Object.assign({}, exportState, { roadmapView: "tools" }));
    const loop = this.renderVals(Object.assign({}, exportState, { tab: "loop", coverage: false }));
    return Object.assign({}, sdlc, { rmTools: tools.rmTools, loop });
  }
  exportFonts() {
    return Promise.all(["400 12px Inter", "500 12px Inter", "600 12px Inter", "12px Phosphor"].map(f => document.fonts.load(f)));
  }
  measureText(text, size, weight, ls) {
    const ctx = this._mctx || (this._mctx = document.createElement("canvas").getContext("2d"));
    ctx.font = (weight || 400) + " " + size + "px Inter";
    text = String(text);
    return ctx.measureText(text).width + (ls || 0) * size * text.length;
  }
  // greedy word wrap with real Inter metrics, so canvas and PowerPoint break in the same places
  wrapText(text, width, size, weight) {
    const lines = [];
    let cur = "";
    String(text || "").split(/\s+/).filter(Boolean).forEach(w => {
      const next = cur ? cur + " " + w : w;
      if (cur && this.measureText(next, size, weight) > width) { lines.push(cur); cur = w; } else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // one bullet per non-empty line, each wrapped to the cell
  bulletParas(text, width, size) {
    return String(text || "").split("\n").map(l => l.trim()).filter(Boolean)
      .map(l => ({ text: l, bullet: true, lines: this.wrapText(l, width - size, size) }));
  }
  textOp(x, y, w, str, o) {
    o = o || {};
    const size = o.size || 12, weight = o.weight || 400, lh = o.lh || size * 1.3;
    str = String(str == null ? "" : str);
    const paras = o.paras || [{ text: str, lines: o.wrap ? this.wrapText(str, w, size, weight) : [str] }];
    const n = paras.reduce((t, p) => t + p.lines.length, 0);
    return { k: "text", x, y, w, h: n * lh, size, weight, lh, paras, wrap: !!(o.wrap || o.paras), color: o.color || this._pal.text, align: o.align || "left", ls: o.ls || 0 };
  }
  eyebrow(x, y, w, str, size) {
    return this.textOp(x, y, w, String(str).toUpperCase(), { size: size || 10.5, color: this._pal.a300, ls: 0.13 });
  }
  statusCode(label) {
    return Object.keys(STATUS).find(k => STATUS[k].label === label) || "n";
  }
  // the coverage dots of the site: full, left half + ring, empty ring, muted disc
  dotOps(code, cx, cy, r) {
    if (code === "c") return [{ k: "circle", cx, cy, r, fill: this.hex(STATUS.c.bg) }];
    if (code === "p") return [{ k: "half", cx, cy, r, fill: this.hex("var(--color-accent-300)") }, { k: "circle", cx, cy, r, stroke: this.hex(STATUS.p.bd), sw: 1 }];
    if (code === "n") return [{ k: "circle", cx, cy, r, stroke: this.hex(STATUS.n.bd), sw: 1 }];
    return [{ k: "circle", cx, cy, r, fill: this.hex(STATUS.x.bg) }];
  }
  // a template bar background: solid colour, or a repeating-linear-gradient dash pattern
  barSpec(v) {
    const m = /repeating-linear-gradient\(90deg,\s*(\S+?)\s+0\s+([\d.]+)px,\s*transparent\s+[\d.]+px\s+([\d.]+)px\)/.exec(String(v));
    return m ? { color: this.hex(m[1]), dash: [+m[2], m[3] - m[2]] } : { color: this.hex(v), dash: null };
  }
  barOp(x, y, w, h, v) {
    return Object.assign({ k: "bar", x, y, w, h }, this.barSpec(v));
  }
  shiftOps(ops, dy) {
    return ops.map(op => {
      const o = Object.assign({}, op);
      ["y", "y1", "y2", "cy"].forEach(f => { if (o[f] != null) o[f] += dy; });
      if (o.pts) o.pts = o.pts.map(p => [p[0], p[1] + dy]);
      return o;
    });
  }

  buildDeck() {
    this._pal = this.exportPalette();
    const d = this.exportData(), quarters = d.quarterHeaders.map(h => h.label);
    const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const range = this.state.model.range || DEFAULT_RANGE;
    const span = "From " + qName(range, 0) + " To " + qName(range, quarters.length - 1);
    const deck = [this.coverSlide("Engineering Platform", "Delivery lifecycle & roadmap", span, date, d.fullD), this.loopSlide(d.loop), this.ecoSlide()];
    deck.push(this.coverSlide("Section", "SDLC Roadmap", span));
    d.rmStages.forEach(rs => deck.push(...this.gridSlides({
      title: rs.name, icon: rs.icon, summary: rs.summary, quarters, head: "Stage readiness",
      readiness: rs.stageCells, highlights: rs.hlCells,
      blocks: rs.caps.map(c => ({ icon: c.icon, label: c.label, cells: c.cells, rows: c.tools.map(t => ({ name: t.name, cells: t.cells })) }))
    })));
    deck.push(this.coverSlide("Section", "Tools Roadmap", span));
    d.rmTools.filter(t => t.caps.length).forEach(t => deck.push(...this.gridSlides({
      title: t.name, icon: "ph-wrench", summary: t.summary, quarters, head: "Core capabilities",
      blocks: t.caps.map(c => ({ icon: c.icon, label: c.label, sub: c.stage, cells: c.statusCells, rows: [{ name: "Roadmap notes", eyebrow: true, cells: c.cells }] }))
    })));
    return deck;
  }
  coverSlide(kicker, title, sub, date, loopD) {
    const P = this._pal, ops = [];
    if (loopD) {
      const pts = this.pathPoints(loopD).map(p => [1010 + p[0] * 0.34, 200 + p[1] * 0.34]);
      ops.push({ k: "path", pts, color: P.a800, w: 6 });
    }
    ops.push({ k: "rect", x: 84, y: 300, w: 56, h: 4, r: 2, fill: P.a400 });
    ops.push(this.textOp(84, 324, 1300, kicker.toUpperCase(), { size: 15, color: P.a300, ls: 0.16 }));
    ops.push(this.textOp(84, 352, 1430, title, { size: 60, weight: 600, lh: 76 }));
    ops.push(this.textOp(84, 440, 1430, sub, { size: 22, color: P.n300 }));
    if (date) ops.push(this.textOp(84, 478, 1430, date, { size: 16, color: P.n400 }));
    return ops;
  }
  pathPoints(d) {
    const n = String(d).match(/-?\d+(\.\d+)?/g) || [], pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([+n[i], +n[i + 1]]);
    return pts;
  }

  // one stage card, like the cards under the loop on the site (Coverage layer off); y is its top edge
  stageCard(st, x, y, w, k) {
    const P = this._pal, ops = [], pad = 14 * k, badge = 28 * k, right = x + w - pad;
    ops.push({ k: "rect", x: x + pad, y: y + pad, w: badge, h: badge, r: 7 * k, fill: P.n900 });
    ops.push({ k: "icon", name: st.icon, x: x + pad + 6 * k, y: y + pad + 6 * k, size: 16 * k, color: P.a300 });
    const nameSize = 17 * k, mid = y + pad + badge / 2;
    ops.push(this.textOp(x + pad + badge + 10 * k, mid - nameSize * 0.65, right - (x + pad + badge + 10 * k), st.name, { size: nameSize, weight: 600 }));
    let cy = y + pad + badge + 12 * k;
    const labelSize = 13 * k, labelLh = labelSize * 1.3, chipSize = 11.5 * k;
    const chipH = chipSize * 1.5 + 4 * k, chipPad = 7 * k, chipGap = 5 * k;
    st.caps.forEach((c, ci) => {
      if (ci) cy += 10 * k;
      const lx = x + pad + 22 * k;
      ops.push({ k: "icon", name: c.icon, x: x + pad, y: cy + (labelLh - 14 * k) / 2, size: 14 * k, color: P.a400 });
      const label = this.textOp(lx, cy, right - lx, c.label, { size: labelSize, lh: labelLh, wrap: true });
      ops.push(label);
      cy += label.h + 5 * k;
      let chx = lx, line = 0;
      c.tools.forEach(t => {
        const tw = Math.min(right - lx, this.measureText(t.name, chipSize) + 2 * chipPad);
        if (chx > lx && chx + tw > right) { chx = lx; line++; }
        ops.push({ k: "chip", x: chx, y: cy + line * (chipH + 4 * k), w: tw, h: chipH, r: 5 * k, text: t.name, size: chipSize, color: this.hex(t.fg), fill: this.hex(t.bg), stroke: this.hex(t.bd) });
        chx += tw + chipGap;
      });
      cy += (line + 1) * chipH + line * 4 * k;
    });
    const h = cy + pad - y;
    ops.unshift({ k: "rect", x, y, w, h, r: 10 * k, fill: P.surface, stroke: P.cardBd, sw: 1 });
    return { h, ops };
  }
  loopSlide(d) {
    const P = this._pal, ops = [], M = 48, gap = 32, top = 120, bottom = 876;
    ops.push(this.textOp(M, 34, 900, "The delivery loop", { size: 40, weight: 600, lh: 48 }));
    ops.push(this.textOp(M, 86, 900, "Core capabilities and tooling by lifecycle stage", { size: 16, color: P.n300 }));
    // cards in two rows (stages above and below the loop's centre line), shrunk together until
    // the loop's crossing stays visible between the rows
    const rows = [[], []];
    d.stages.forEach(st => rows[st.lyp < 50 ? 0 : 1].push(st));
    rows.forEach(r => r.sort((a, b) => a.lxp - b.lxp));
    const cols = Math.max(rows[0].length, rows[1].length, 1), cw = (1600 - 2 * M - gap * (cols - 1)) / cols;
    let k = 1, hs;
    for (; ; k -= 0.04) {
      hs = rows.map(r => Math.max(0, ...r.map(st => this.stageCard(st, 0, 0, cw, k).h)));
      if (hs[0] + hs[1] <= bottom - top - 120 || k <= 0.6) break;
    }
    // the loop, scaled to the slide width and centred in the gap between the card rows
    const s = 0.95, ox = 800 * (1 - s), oy = (top + hs[0] + bottom - hs[1]) / 2 - 300 * s;
    const T = p => [ox + p[0] * s, oy + p[1] * s];
    const word = 92 * s;
    [["DEV", d.devX], ["OPS", d.opsX]].forEach(([t, x]) => {
      const c = T([x, 318]);
      ops.push(this.textOp(c[0] - 200, c[1] - word * 0.36 - word * 0.5, 400, t, { size: word, weight: 500, lh: word, align: "center", color: "33375A" }));
    });
    // one continuous loop in a single style (no per-stage readiness): soft halo, track, bright line
    const loop = this.pathPoints(d.fullD).map(T);
    ops.push({ k: "path", pts: loop, color: P.a700, w: 30 * s, alpha: 0.35 });
    ops.push({ k: "path", pts: loop, color: P.a800, w: 16 * s });
    ops.push({ k: "path", pts: loop, color: P.a300, w: 7 * s });
    const cards = [];
    rows.forEach((r, ri) => r.forEach((st, i) => {
      const x = M + i * (cw + gap), card = this.stageCard(st, x, 0, cw, k);
      cards.push({ x, y: ri ? bottom - card.h : top, w: cw, h: card.h, ops: card.ops });
    }));
    ops.push(...this.loopArrows(loop, cards, T([800, 300])));
    cards.forEach(c => ops.push(...this.shiftOps(c.ops, c.y)));
    return ops;
  }

  // tool ecosystem: the dependency map on the left, tools by tier on the right
  ecoSlide() {
    const fresh = ecoGraph(this.state.model), live = this.ecoSim && this.ecoSim.g;
    const P = this._pal, ops = [], M = 48, g = ecoGeom(live && live.sig === fresh.sig ? live : ecoSettle(fresh));
    ops.push(this.textOp(M, 34, 1100, "Tool ecosystem", { size: 40, weight: 600, lh: 48 }));
    ops.push(this.textOp(M, 86, 1100, g.nodes.length + " tools · " + g.edges.length + " dependencies · arrows point from a tool to what it depends on", { size: 16, color: P.n300 }));
    const s = Math.min(1040 / ECO_W, 720 / ECO_H), ox = M, oy = 150, T = p => [ox + p[0] * s, oy + p[1] * s];
    const core = e => g.byId.get(e.from).tier === 0 && g.byId.get(e.to).tier === 0;
    g.edges.slice().sort((a, b) => core(a) - core(b)).forEach(e => {
      const c = core(e);
      ops.push({ k: "path", pts: e.pts.map(T), color: c ? P.a300 : e.sat ? P.a500 : P.a700, w: c ? 2.4 : e.sat ? 2 : 1.6, dash: e.sat ? [1, 6] : null });
      ops.push({ k: "path", pts: e.head.map(T), fill: c ? P.a300 : P.a600 });
    });
    g.nodes.forEach(n => {
      const t = TIERS[n.tier], c = T([n.x, n.y]), r = n.r * s, size = (n.tier === 0 ? 15 : 13) * s;
      ops.push({ k: "circle", cx: c[0], cy: c[1], r, fill: this.hex(t.fill), stroke: this.hex(t.stroke), sw: 2 });
      ops.push(this.textOp(c[0] - 100, c[1] + r + 3, 200, n.name, { size, weight: n.tier === 0 ? 600 : 400, align: "center", color: this.hex(t.fg) }));
    });
    // right column: one block per tier, most central first
    const x = 1130, w = 1600 - M - x, bottom = 870;
    let y = 150;
    TIERS.forEach((t, i) => {
      const list = g.nodes.filter(n => n.tier === i);
      if (!list.length || y > bottom - 40) return;
      ops.push({ k: "circle", cx: x + 6, cy: y + 7, r: 6, fill: this.hex(t.fill), stroke: this.hex(t.stroke), sw: 1.5 });
      ops.push(this.textOp(x + 20, y, w - 20, t.label.toUpperCase() + " · " + list.length, { size: 11.5, color: P.a300, ls: 0.13 }));
      y += 26;
      for (let k = 0; k < list.length; k++) {
        if (y > bottom - 22) { ops.push(this.textOp(x + 20, y, w - 20, "+" + (list.length - k) + " more", { size: 13, color: P.n400 })); y += 22; break; }
        const n = list[k];
        ops.push(this.textOp(x + 20, y, w - 150, n.name, { size: 14 }));
        ops.push(this.textOp(x + w - 130, y, 130, "used by " + n.users.length + " · needs " + n.deps.length, { size: 12, color: P.n300, align: "right" }));
        y += 22;
      }
      y += 14;
    });
    return ops;
  }

  // arrowheads along the loop in path order (= the cycle's direction): exactly one at the middle of
  // each visible stretch (not under a card, not on the centre crossing), so every side and arm gets one
  loopArrows(pts, cards, centre) {
    const clear = 22, minRun = 30;
    const hidden = p => Math.hypot(p[0] - centre[0], p[1] - centre[1]) < 36
      || cards.some(c => p[0] > c.x - clear && p[0] < c.x + c.w + clear && p[1] > c.y - clear && p[1] < c.y + c.h + clear);
    const runs = [];
    let run = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (hidden(a) || hidden(b)) { run = null; continue; }
      if (!run) runs.push(run = { segs: [], len: 0 });
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      run.segs.push([a, b, len]);
      run.len += len;
    }
    return runs.filter(r => r.len >= minRun).map(r => {
      let at = r.len / 2, seg = r.segs[0];
      for (seg of r.segs) { if (at <= seg[2]) break; at -= seg[2]; }
      const [a, b, len] = seg, f = len ? Math.min(1, at / len) : 0;
      const p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], tx = (b[0] - a[0]) / (len || 1), ty = (b[1] - a[1]) / (len || 1);
      return { k: "path", fill: this._pal.a100, pts: [
        [p[0] + tx * 11, p[1] + ty * 11],
        [p[0] - tx * 8 - ty * 10, p[1] - ty * 8 + tx * 10],
        [p[0] - tx * 3, p[1] - ty * 3],
        [p[0] - tx * 8 + ty * 10, p[1] - ty * 8 - tx * 10]
      ] };
    });
  }

  // roadmap grid (SDLC stage or tool): the largest note size that fits one slide (down to the
  // site's own 11.5px), else paginated at a comfortable 13px
  gridSlides(spec) {
    for (const fs of [14, 13, 12, 11.5]) {
      const pages = this.gridPages(spec, fs);
      if (pages.length === 1) return pages;
    }
    return this.gridPages(spec, 13);
  }
  gridPages(spec, fs) {
    const P = this._pal, M = 48, W = 1600, limit = 868, labelW = 250, gap = 12, lh = fs * 1.35;
    const nq = spec.quarters.length, x0 = M + labelW, cw = (W - M - x0 - gap * (nq - 1)) / nq;
    const colX = i => x0 + i * (cw + gap);

    // quarter header (+ readiness bars for a stage), repeated on every page
    const qOps = [];
    let qH;
    qOps.push(this.eyebrow(M, 2, labelW - 10, spec.head));
    if (spec.readiness) {
      spec.readiness.forEach((c, i) => {
        qOps.push(this.textOp(colX(i), 0, cw, c.q + " · " + c.pct, { size: 12.5, color: this.hex(c.fg) }));
        qOps.push(this.barOp(colX(i), 21, cw, 5, c.bar));
      });
      qH = 26 + 14;
    } else {
      spec.quarters.forEach((q, i) => qOps.push(this.textOp(colX(i), 0, cw, q, { size: 12.5, color: P.n300 })));
      qH = 16 + 12;
    }

    // highlights band, first page only
    let hl = null;
    if (spec.highlights && spec.highlights.some(c => c.lines.length)) {
      const cells = spec.highlights.map((c, i) => this.textOp(colX(i), 10, cw - 6, "", { size: fs, lh, paras: this.bulletParas(c.text, cw - 6, fs) }));
      const h = 20 + Math.max(lh, ...cells.map(c => c.h));
      hl = { h: h + 14, ops: [{ k: "rect", x: M - 10, y: 0, w: W - 2 * M + 20, h, r: 8, fill: P.band, stroke: P.bandBd, sw: 1 }, this.eyebrow(M, 12, labelW - 10, "Highlights")].concat(cells.filter(c => c.h)) };
    }

    // capability blocks: a status row, then one row per tool with its bar and notes
    const blocks = spec.blocks.map(b => {
      const head = [{ k: "icon", name: b.icon, x: M, y: 1, size: 16, color: P.a400 }];
      const label = this.textOp(M + 24, 0, labelW - 34, b.label, { size: 14, weight: 500, lh: 18, wrap: true });
      head.push(label);
      let hh = label.h;
      if (b.sub) { head.push(this.textOp(M + 24, hh, labelW - 34, b.sub, { size: 11, color: P.n300 })); hh += 15; }
      b.cells.forEach((c, i) => {
        head.push(...this.dotOps(this.statusCode(c.label), colX(i) + 5, 9, 4.5));
        head.push(this.textOp(colX(i) + 15, 9 - 11.5 * 0.65, cw - 15, c.label, { size: 11.5, color: this.hex(c.fg) }));
      });
      const rows = b.rows.map(r => {
        const ops = [];
        let nameH;
        if (r.eyebrow) { ops.push(this.eyebrow(M + 24, 1, labelW - 34, r.name, 10)); nameH = 14; } else {
          ops.push({ k: "icon", name: "ph-wrench", x: M + 24, y: 1, size: 13, color: P.n300 });
          const name = this.textOp(M + 43, 0, labelW - 53, r.name, { size: 12.5, color: P.n100, wrap: true });
          ops.push(name);
          nameH = name.h;
        }
        let notesH = 0;
        r.cells.forEach((c, i) => {
          ops.push(this.barOp(colX(i), 2, cw, 4, c.bar));
          const paras = this.bulletParas(c.note, cw, fs);
          if (paras.length) {
            const t = this.textOp(colX(i), 12, cw, "", { size: fs, lh, paras });
            ops.push(t);
            notesH = Math.max(notesH, 12 + t.h);
          }
        });
        return { ops, h: Math.max(nameH, notesH, 8) + 10 };
      });
      return { head, headH: Math.max(hh, 18) + 4, rows };
    });

    // paginate: keep a block together when it fits a page, split it between tool rows otherwise
    const pages = [];
    let ops, y, pageTop;
    const newPage = () => {
      ops = this.shiftOps(qOps, 96);
      y = 96 + qH;
      if (!pages.length && hl) { ops.push(...this.shiftOps(hl.ops, y)); y += hl.h; }
      pages.push(ops);
      pageTop = y;
    };
    const placeHead = b => {
      ops.push({ k: "line", x1: M, y1: y, x2: W - M, y2: y, color: P.divider, w: 1 });
      ops.push(...this.shiftOps(b.head, y + 10));
      y += 10 + b.headH;
    };
    newPage();
    blocks.forEach(b => {
      const total = 10 + b.headH + b.rows.reduce((t, r) => t + r.h, 0);
      if (y + total > limit && y > pageTop) newPage();
      placeHead(b);
      b.rows.forEach(r => {
        if (y + r.h > limit && y > pageTop + 10 + b.headH) { newPage(); placeHead(b); }
        ops.push(...this.shiftOps(r.ops, y));
        y += r.h;
      });
      y += 6;
    });

    // title row last, once the page count is known
    return pages.map((pg, pi) => {
      const head = [{ k: "rect", x: M, y: 30, w: 40, h: 40, r: 9, fill: P.n900 }, { k: "icon", name: spec.icon, x: M + 9, y: 39, size: 22, color: P.a300 }];
      const titleW = Math.min(900, this.measureText(spec.title, 30, 600) + 4);
      head.push(this.textOp(M + 54, 31, titleW, spec.title, { size: 30, weight: 600, lh: 38 }));
      const pageLabel = pages.length > 1 ? "Page " + (pi + 1) + " of " + pages.length : "";
      const pageW = pageLabel ? this.measureText(pageLabel, 13) + 2 : 0;
      head.push(this.textOp(M + 70 + titleW, 41, W - M - pageW - 24 - (M + 70 + titleW), spec.summary, { size: 14, color: P.n300 }));
      if (pageLabel) head.push(this.textOp(W - M - pageW, 42, pageW, pageLabel, { size: 13, color: P.n300, align: "right" }));
      return head.concat(pg);
    });
  }

  downloadBlob(blob, fileName) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // runs one export with a busy state on the trigger; a failure reopens the menu with the reason
  runExport = async kind => {
    if (this.state.exporting) return;
    clearTimeout(this.exportT);
    this.setState({ exporting: kind, exportDone: null, exportErr: "", exportOpen: false, menuOpen: false });
    await new Promise(r => setTimeout(r, 40)); // let the spinner paint before the synchronous layout work
    const err = kind === "pdf" ? await this.exportPdf() : await this.exportPptx();
    this.setState({ exporting: null, exportDone: err ? null : kind, exportErr: err || "", exportOpen: !!err });
    if (!err) this.exportT = setTimeout(() => this.setState({ exportDone: null }), 2500);
  };
  exportPdf = async () => {
    if (!window.jspdf) return "PDF export isn't available";
    try {
      await this.exportFonts();
      const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "in", format: [13.333, 7.5], compress: true });
      this.buildDeck().forEach((ops, i) => {
        if (i) pdf.addPage([13.333, 7.5], "landscape");
        pdf.addImage(this.paintSlide(ops, 1.5), "PNG", 0, 0, 13.333, 7.5, undefined, "FAST");
      });
      this.downloadBlob(pdf.output("blob"), "devops-lifecycle.pdf");
      return "";
    } catch (e) {
      console.error(e);
      return "Could not generate the PDF file";
    }
  };
  exportPptx = async () => {
    if (!window.PptxGenJS) return "PowerPoint export isn't available";
    try {
      await this.exportFonts();
      const pptx = new window.PptxGenJS();
      pptx.defineLayout({ name: "XWIDE", width: 13.333, height: 7.5 });
      pptx.layout = "XWIDE";
      this.buildDeck().forEach(ops => this.pptxSlide(pptx, ops));
      this.downloadBlob(await pptx.write({ outputType: "blob" }), "devops-lifecycle.pptx");
      return "";
    } catch (e) {
      console.error(e);
      return "Could not generate the PowerPoint file";
    }
  };

  // ---- PDF: paint the ops onto a canvas (scale 1.5 keeps text sharp at a reasonable file size) ----
  iconGlyph(icon) {
    const cache = this._glyphs || (this._glyphs = {});
    if (!(icon in cache)) {
      const el = document.createElement("i");
      el.className = "ph " + icon;
      document.body.appendChild(el);
      const content = getComputedStyle(el, "::before").content;
      el.remove();
      cache[icon] = content && content !== "none" ? content.replace(/^['"]|['"]$/g, "") : "•";
    }
    return cache[icon];
  }
  paintIcon(ctx, name, color, x, y, size) {
    ctx.font = size + "px Phosphor";
    ctx.fillStyle = "#" + color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.iconGlyph(name), x + size / 2, y + size / 2);
  }
  paintSlide(ops, scale) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    canvas.width = 1600 * scale; canvas.height = 900 * scale;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#" + this._pal.bg;
    ctx.fillRect(0, 0, 1600, 900);
    ops.forEach(op => { ctx.save(); this.paintOp(ctx, op); ctx.restore(); });
    return canvas;
  }
  paintOp(ctx, op) {
    const col = c => "#" + c;
    if (op.alpha != null) ctx.globalAlpha = op.alpha;
    if (op.k === "rect" || op.k === "chip") {
      ctx.beginPath(); ctx.roundRect(op.x, op.y, op.w, op.h, op.r || 0);
      if (op.fill) { ctx.fillStyle = col(op.fill); ctx.fill(); }
      if (op.stroke) { ctx.lineWidth = op.sw || 1; ctx.strokeStyle = col(op.stroke); ctx.stroke(); }
      if (op.k === "chip") {
        ctx.font = op.size + "px Inter"; ctx.fillStyle = col(op.color); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(op.text, op.x + op.w / 2, op.y + op.h / 2 + 0.5);
      }
    } else if (op.k === "bar") {
      if (!op.color) return;
      ctx.fillStyle = col(op.color);
      if (!op.dash) { ctx.beginPath(); ctx.roundRect(op.x, op.y, op.w, op.h, op.h / 2); ctx.fill(); return; }
      for (let x = op.x; x < op.x + op.w; x += op.dash[0] + op.dash[1]) ctx.fillRect(x, op.y, Math.min(op.dash[0], op.x + op.w - x), op.h);
    } else if (op.k === "line" || op.k === "path") {
      const pts = op.pts || [[op.x1, op.y1], [op.x2, op.y2]];
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      if (op.fill) { ctx.closePath(); ctx.fillStyle = col(op.fill); ctx.fill(); return; }
      ctx.lineWidth = op.w; ctx.strokeStyle = col(op.color);
      if (op.k === "path") { ctx.lineCap = "round"; ctx.lineJoin = "round"; }
      if (op.dash) ctx.setLineDash(op.dash);
      ctx.stroke();
    } else if (op.k === "circle" || op.k === "half") {
      ctx.beginPath();
      if (op.k === "half") { ctx.arc(op.cx, op.cy, op.r, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); } else ctx.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
      if (op.fill) { ctx.fillStyle = col(op.fill); ctx.fill(); }
      if (op.stroke) { ctx.lineWidth = op.sw || 1; ctx.strokeStyle = col(op.stroke); ctx.stroke(); }
    } else if (op.k === "icon") {
      this.paintIcon(ctx, op.name, op.color, op.x, op.y, op.size);
    } else if (op.k === "text") {
      ctx.font = op.weight + " " + op.size + "px Inter";
      ctx.textAlign = op.align; ctx.textBaseline = "alphabetic";
      if (op.ls) ctx.letterSpacing = op.ls * op.size + "px";
      let row = 0;
      op.paras.forEach(p => p.lines.forEach((line, li) => {
        const base = op.y + row * op.lh + op.lh / 2 + op.size * 0.36;
        if (p.bullet && li === 0) {
          ctx.fillStyle = col(this._pal.a400);
          ctx.beginPath(); ctx.arc(op.x + op.size * 0.3, base - op.size * 0.33, op.size * 0.16, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = col(op.color);
        const x = op.align === "center" ? op.x + op.w / 2 : op.align === "right" ? op.x + op.w : op.x + (p.bullet ? op.size : 0);
        ctx.fillText(line, x, base);
        row++;
      }));
    }
  }

  // ---- PPTX: the same ops as native shapes, text boxes and lines (icons are small PNGs) ----
  // nearest PowerPoint preset dash for an [on, off] pattern drawn at line width w
  pptxDash(dash, w) {
    if (!dash) return "solid";
    const r = dash[0] / dash[1];
    if (r > 2 && dash[0] / w >= 5) return "lgDash";
    const presets = [["sysDash", 3], ["dash", 4 / 3], ["sysDot", 1], ["dot", 1 / 3]];
    return presets.reduce((a, b) => (Math.abs(Math.log(b[1] / r)) < Math.abs(Math.log(a[1] / r)) ? b : a))[0];
  }
  iconImage(name, color) {
    const cache = this._iconPngs || (this._iconPngs = {}), key = name + "|" + color;
    if (!cache[key]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      this.paintIcon(canvas.getContext("2d"), name, color, 0, 0, 96);
      cache[key] = canvas.toDataURL("image/png");
    }
    return cache[key];
  }
  pptxSlide(pptx, ops) {
    const slide = pptx.addSlide(), u = v => v / 120, pt = v => v * 0.6;
    const line = (color, w, dash, alpha) => Object.assign({ color, width: pt(w), dashType: this.pptxDash(dash, w) }, alpha != null && alpha < 1 ? { transparency: Math.round((1 - alpha) * 100) } : {});
    slide.background = { color: this._pal.bg };
    ops.forEach(op => {
      if (op.k === "rect") {
        slide.addShape(op.r ? "roundRect" : "rect", {
          x: u(op.x), y: u(op.y), w: u(op.w), h: u(op.h), rectRadius: op.r ? u(op.r) : undefined,
          fill: op.fill ? { color: op.fill } : undefined, line: op.stroke ? line(op.stroke, op.sw || 1) : undefined
        });
      } else if (op.k === "chip") {
        slide.addText(op.text, {
          shape: "roundRect", x: u(op.x), y: u(op.y), w: u(op.w), h: u(op.h), rectRadius: u(op.r),
          fill: op.fill ? { color: op.fill } : undefined, line: op.stroke ? line(op.stroke, 1) : undefined,
          fontFace: "Inter", fontSize: pt(op.size), color: op.color, align: "center", valign: "middle", margin: 0, wrap: false
        });
      } else if (op.k === "bar") {
        if (!op.color) return;
        if (!op.dash) slide.addShape("roundRect", { x: u(op.x), y: u(op.y), w: u(op.w), h: u(op.h), rectRadius: u(op.h / 2), fill: { color: op.color } });
        else slide.addShape("line", { x: u(op.x), y: u(op.y + op.h / 2), w: u(op.w), h: 0, line: line(op.color, op.h, op.dash) });
      } else if (op.k === "line") {
        slide.addShape("line", {
          x: u(Math.min(op.x1, op.x2)), y: u(Math.min(op.y1, op.y2)), w: u(Math.abs(op.x2 - op.x1)), h: u(Math.abs(op.y2 - op.y1)),
          flipV: (op.x2 - op.x1) * (op.y2 - op.y1) < 0, line: line(op.color, op.w, op.dash, op.alpha)
        });
      } else if (op.k === "path") {
        const xs = op.pts.map(p => p[0]), ys = op.pts.map(p => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        slide.addShape("custGeom", {
          x: u(x), y: u(y), w: u(Math.max(1, Math.max(...xs) - x)), h: u(Math.max(1, Math.max(...ys) - y)),
          points: op.pts.map((p, i) => ({ x: u(p[0] - x), y: u(p[1] - y), moveTo: i === 0 })).concat(op.fill ? [{ close: true }] : []),
          fill: op.fill ? { color: op.fill } : undefined, line: op.fill ? undefined : line(op.color, op.w, op.dash, op.alpha)
        });
      } else if (op.k === "circle" || op.k === "half") {
        slide.addShape(op.k === "half" ? "pie" : "ellipse", {
          x: u(op.cx - op.r), y: u(op.cy - op.r), w: u(op.r * 2), h: u(op.r * 2), angleRange: op.k === "half" ? [90, 270] : undefined,
          fill: op.fill ? { color: op.fill } : undefined, line: op.stroke ? line(op.stroke, op.sw || 1) : undefined
        });
      } else if (op.k === "icon") {
        slide.addImage({ data: this.iconImage(op.name, op.color), x: u(op.x), y: u(op.y), w: u(op.size), h: u(op.size) });
      } else if (op.k === "text") {
        const runs = op.paras.map((p, i) => ({
          text: p.bullet || op.wrap ? p.text : p.lines.join(" "),
          options: Object.assign({ breakLine: i < op.paras.length - 1 }, p.bullet ? { bullet: { indent: pt(op.size) } } : {})
        }));
        slide.addText(runs, Object.assign({
          x: u(op.x), y: u(op.y), w: u(op.w), h: u(Math.max(op.h, op.lh)), margin: 0, valign: "top", align: op.align,
          fontFace: "Inter", fontSize: pt(op.size), bold: op.weight >= 600, color: op.color,
          lineSpacing: pt(op.lh), paraSpaceBefore: 0, paraSpaceAfter: 0, wrap: op.wrap
        }, op.ls ? { charSpacing: pt(op.ls * op.size) } : {}));
      }
    });
  }

  // overrides lets export build a fixed full-overview snapshot without touching real UI state
  renderVals(overrides) {
    const st = overrides || this.state, m = st.model;
    const range = m.range || DEFAULT_RANGE;
    const QUARTERS = quarterList(range);
    const cov = st.coverage;
    const stopIdx = Math.min(QUARTERS.length - 1, Math.round(st.tPos));
    const focus = st.narrow ? null : st.selected !== null ? st.selected : st.hover !== null ? st.hover : st.cursor;

    const assignOf = (t, id) => (t.caps || []).find(a => a.id === id);
    const toolsFor = id => m.tools.filter(t => assignOf(t, id));
    const capStatusAt = (id, i) => {
      const ts = toolsFor(id);
      if (!ts.length) return "n";
      let best = null;
      ts.forEach(t => {
        const e = this.effective(assignOf(t, id), i, range);
        if (best === null) best = e;
        else if (STATUS[e].rank > STATUS[best].rank) best = e;
      });
      return best;
    };
    const capStatus = id => capStatusAt(id, stopIdx);
    const scoreAt = (s, i) => {
      let sum = 0, n = 0;
      s.caps.forEach(c => {
        const sv = STATUS[capStatusAt(c.id, i)];
        if (sv.w !== null) { sum += sv.w; n++; }
      });
      return n ? sum / n : 0;
    };
    const readinessBar = sc2 => {
      const spec = sc2 >= 0.95 ? ["var(--color-accent-300)", 0, 0]
        : sc2 >= 0.7 ? ["var(--color-accent-400)", 0, 0]
        : sc2 >= 0.45 ? ["var(--color-accent-500)", 22, 7]
        : sc2 >= 0.2 ? ["var(--color-accent-700)", 12, 8] : ["#5b5f70", 5, 8];
      return spec[1] === 0 ? spec[0]
        : "repeating-linear-gradient(90deg, " + spec[0] + " 0 " + spec[1] + "px, transparent " + spec[1] + "px " + (spec[1] + spec[2]) + "px)";
    };
    const toolBar = code => code === "c" ? "var(--color-accent-400)"
      : code === "p" ? "repeating-linear-gradient(90deg, var(--color-accent-600) 0 12px, transparent 12px 20px)"
      : code === "x" ? "#2b2e42"
      : "repeating-linear-gradient(90deg, #4a4d5a 0 4px, transparent 4px 12px)";

    const geo = m.stages.map((_, i) => this.seg(i));
    const fullD = geo.map((g, i) => (i ? g.d.replace(/^M/, "L") : g.d)).join("");
    const capName = id => {
      for (const s of m.stages) { const c = s.caps.find(c => c.id === id); if (c) return c.label; }
      return "";
    };

    const built = m.stages.map(s => {
      let sum = 0, n = 0;
      const caps = s.caps.map(c => {
        const code = capStatus(c.id);
        const sv = STATUS[code];
        if (sv.w !== null) { sum += sv.w; n++; }
        const ts = toolsFor(c.id);
        return {
          icon: c.icon, label: c.label,
          title: cov ? c.label + " — " + sv.label : c.label,
          statusLabel: cov ? sv.label : "", statusFg: sv.fg,
          dotBg: cov ? sv.bg : "var(--color-accent-700)", dotBd: cov ? sv.bd : "var(--color-accent-700)",
          cellBg: sv.cell,
          chipBd: code === "c" ? "var(--color-accent-600)" : code === "p" ? "var(--color-accent-800)" : "var(--color-divider)",
          chipFg: code === "c" ? "var(--color-accent-200)" : code === "p" ? "var(--color-accent-300)" : "var(--color-neutral-200)",
          tools: ts.length
            ? ts.map(t => ({ name: t.name || "untitled", bg: "var(--color-accent-900)", fg: "var(--color-accent-200)", bd: "var(--color-accent-700)" }))
            : [{ name: "no tool", bg: "transparent", fg: "var(--color-neutral-200)", bd: "var(--color-divider)" }]
        };
      });
      const plan = String((s.highlights || {})[qKey(range, stopIdx)] || "")
        .split("\n").map(l => l.trim()).filter(Boolean).map(text => ({ text }));
      const score = n ? sum / n : 0;
      return { caps, score, plan, readyLabel: Math.round(score * 100) + "% covered" };
    });

    const stages = m.stages.map((s, i) => {
      const g = geo[i], on = i === focus, b = built[i];
      return {
        name: s.name, icon: s.icon, num: "0" + (i + 1),
        caps: b.caps, readyLabel: b.readyLabel,
        hasPlan: cov && b.plan.length > 0, plan: b.plan,
        lxp: (g.l[0] / 1600) * 100, lyp: (g.l[1] / 600) * 100,
        pillBg: on ? "color-mix(in srgb, var(--color-surface) 92%, transparent)" : "color-mix(in srgb, var(--color-bg) 78%, transparent)",
        pillBd: on ? "var(--color-accent-600)" : "transparent",
        iconBg: on ? "var(--color-accent-700)" : "var(--color-neutral-900)",
        iconFg: on ? "var(--color-accent-100)" : "var(--color-accent-300)",
        nameFg: on ? "var(--color-accent-100)" : "var(--color-text)",
        cardBd: on ? "var(--color-accent-600)" : "var(--color-divider)",
        cardShadow: on ? "0 0 0 1px var(--color-accent-700), 0 10px 30px rgba(0,0,0,.55)" : "var(--shadow-sm)",
        onEnter: () => { if (!st.narrow) this.setState({ hover: i }); },
        onSelect: () => { if (!st.narrow) this.setState({ selected: i, hover: i }); }
      };
    });

    const segments = m.stages.map((s, i) => {
      const g = geo[i], on = i === focus, sc = built[i].score;
      const stroke = on ? "var(--color-accent-200)"
        : !cov ? "var(--color-accent-600)"
        : sc >= 0.95 ? "var(--color-accent-300)"
        : sc >= 0.7 ? "var(--color-accent-400)"
        : sc >= 0.45 ? "var(--color-accent-500)"
        : sc >= 0.2 ? "var(--color-accent-700)" : "#5b5f70";
      return {
        d: g.d, px: g.p[0], py: g.p[1], lx: g.l[0], ly: g.l[1],
        stroke, w: on ? 11 : 6,
        dash: on || !cov || sc >= 0.7 ? "none"
          : sc >= 0.45 ? "30 8"
          : sc >= 0.2 ? "16 10" : "7 11",
        op: on ? 1 : 0.78,
        glow: "var(--color-accent-400)", glowOp: on ? 0.5 : 0,
        tick: on ? "var(--color-accent-300)" : "#3a3d52",
        nr: on ? 10 : 6, haloR: on ? 18 : 6, haloOp: on ? 0.35 : 0,
        onEnter: () => this.setState({ hover: i }),
        onSelect: () => this.setState({ selected: i, hover: i })
      };
    });

    const mk = (id, label) => {
      const on = st[id];
      return {
        label, on,
        bg: on ? "var(--color-accent-900)" : "transparent",
        bd: on ? "var(--color-accent-600)" : "var(--color-divider)",
        fg: on ? "var(--color-accent-100)" : "var(--color-neutral-200)",
        dot: on ? "var(--color-accent-400)" : "transparent",
        tick: on ? 1 : 0,
        onClick: () => this.setState(s => ({ [id]: !s[id] }))
      };
    };
    const tab = (id, label, icon, tone) => {
      const on = st.tab === id, nt = tone === "neutral";
      return {
        label, icon, href: "#" + id, current: on ? "page" : "false",
        bg: nt ? (on ? "var(--color-neutral-700)" : "var(--color-neutral-800)") : (on ? "var(--color-accent-900)" : "transparent"),
        bd: nt ? (on ? "#9397ab" : "#6a6e80") : (on ? "var(--color-accent-600)" : "var(--color-divider)"),
        fg: nt ? "var(--color-neutral-100)" : (on ? "var(--color-accent-100)" : "var(--color-neutral-200)"),
        ml: nt ? "14px" : "0",
        onClick: e => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          this.setState({ tab: id, selected: null, hover: null, menuOpen: false });
        }
      };
    };
    const roadmapMode = (id, label, icon) => {
      const on = st.roadmapView === id;
      return {
        label, icon, selected: on ? "true" : "false",
        bg: on ? "var(--color-accent-900)" : "transparent",
        bd: on ? "var(--color-accent-600)" : "var(--color-divider)",
        fg: on ? "var(--color-accent-100)" : "var(--color-neutral-200)",
        onClick: () => this.setState({ roadmapView: id, noteEdit: null, copyMenu: null })
      };
    };

    // ---- editor ----
    const iconSet = st.allIcons && st.allIcons.length ? st.allIcons : ICONS;
    const drag = st.drag;
    const moveCap = (toSi, toCi) => {
      if (!drag) return;
      this.edit(mm => {
        const cap = mm.stages[drag.si].caps[drag.ci];
        if (!cap) return;
        mm.stages[drag.si].caps.splice(drag.ci, 1);
        let idx = toCi == null ? mm.stages[toSi].caps.length : toCi;
        if (drag.si === toSi && drag.ci < idx) idx--;
        mm.stages[toSi].caps.splice(Math.max(0, Math.min(idx, mm.stages[toSi].caps.length)), 0, cap);
      });
      this.setState({ drag: null, dragOver: null });
    };
    const edStages = m.stages.map((s, si) => ({
      name: s.name, icon: s.icon,
      count: s.caps.length + (s.caps.length === 1 ? " capability" : " capabilities"),
      dropShadow: st.dragOver === si && drag && drag.si !== si ? "0 0 0 2px var(--color-accent-500)" : "var(--shadow-sm)",
      onDragOver: e => { if (drag) { e.preventDefault(); if (st.dragOver !== si) this.setState({ dragOver: si }); } },
      onDragLeave: () => { if (st.dragOver === si) this.setState({ dragOver: null }); },
      onDropEnd: e => { if (!drag) return; e.preventDefault(); moveCap(si, null); },
      caps: s.caps.map((c, ci) => ({
        icon: c.icon, label: c.label,
        dragOp: drag && drag.si === si && drag.ci === ci ? 0.4 : 1,
        dropLine: st.dropAt && st.dropAt.si === si && st.dropAt.ci === ci && drag ? "var(--color-accent-400)" : "transparent",
        onDragStart: e => {
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", c.id); } catch (err) { /* ignore */ }
          this.setState({ drag: { si, ci } });
        },
        onDragEnd: () => this.setState({ drag: null, dragOver: null, dropAt: null }),
        onDragOver: e => {
          if (!drag) return;
          e.preventDefault();
          e.stopPropagation();
          const d = st.dropAt;
          if (!d || d.si !== si || d.ci !== ci) this.setState({ dropAt: { si, ci }, dragOver: si });
        },
        onDrop: e => { if (!drag) return; e.preventDefault(); e.stopPropagation(); this.setState({ dropAt: null }); moveCap(si, ci); },
        iconField: st.iconBuf[si + ":" + ci] != null ? st.iconBuf[si + ":" + ci] : String(c.icon || "").replace(/^ph-/, ""),
        setIcon: e => {
          const raw = e.target.value, k = si + ":" + ci;
          const name = raw.trim().toLowerCase().replace(/\s+/g, "-");
          this.setState(ss => ({ iconBuf: Object.assign({}, ss.iconBuf, { [k]: raw }) }));
          if (iconSet.indexOf(name) >= 0) {
            this.edit(mm => { mm.stages[si].caps[ci].icon = "ph-" + name; });
            this.setState(ss => { const b = Object.assign({}, ss.iconBuf); delete b[k]; return { iconBuf: b, iconOpen: null }; });
          }
        },
        blurIcon: () => this.setState(ss => {
          const b = Object.assign({}, ss.iconBuf); delete b[si + ":" + ci];
          return { iconBuf: b, iconOpen: null };
        }),
        focusIcon: () => this.setState({ iconOpen: si + ":" + ci }),
        open: st.iconOpen === si + ":" + ci,
        noneDisp: (() => {
          const q = String(st.iconBuf[si + ":" + ci] != null ? st.iconBuf[si + ":" + ci] : "").trim().toLowerCase().replace(/\s+/g, "-");
          return q && !iconSet.some(n => n.indexOf(q) >= 0) ? "block" : "none";
        })(),
        matches: (() => {
          const k = si + ":" + ci;
          if (st.iconOpen !== k) return [];
          // Not typed yet (or cleared): browse the whole list.
          const q = String(st.iconBuf[k] != null ? st.iconBuf[k] : "").trim().toLowerCase().replace(/\s+/g, "-");
          if (q && iconSet.indexOf(q) >= 0) return [];
          const pool = q ? iconSet.filter(n => n.indexOf(q) >= 0).sort((x, y) => x.indexOf(q) - y.indexOf(q) || x.length - y.length) : iconSet;
          return pool.map(n => ({
            name: n, cls: "ph-" + n,
            pick: e => {
              e.preventDefault();
              this.edit(mm => { mm.stages[si].caps[ci].icon = "ph-" + n; });
              this.setState(ss => { const b = Object.assign({}, ss.iconBuf); delete b[k]; return { iconBuf: b, iconOpen: null }; });
            }
          }));
        })(),
        setLabel: e => { const v = e.target.value; this.edit(mm => { mm.stages[si].caps[ci].label = v; }); },
        remove: () => this.edit(mm => {
          const id = mm.stages[si].caps[ci].id;
          mm.stages[si].caps.splice(ci, 1);
          mm.tools.forEach(t => { t.caps = (t.caps || []).filter(a => a.id !== id); });
        })
      })).map(o => Object.assign(o, { open: o.open && (o.matches.length > 0 || o.noneDisp === "block") })),
      add: () => this.edit(mm => {
        const ids = mm.stages.reduce((a, s2) => a.concat(s2.caps.map(c => +String(c.id).replace(/\D/g, ""))), [0]);
        mm.stages[si].caps.push({ id: "c" + (Math.max.apply(null, ids) + 1), label: "New capability", icon: "ph-cube" });
      })
    }));

    const capOptions = [];
    m.stages.forEach(s => s.caps.forEach(c => capOptions.push({ v: c.id, n: s.name + " · " + (c.label || "untitled") })));

    const capMeta = id => {
      for (const s of m.stages) { const c = s.caps.find(c => c.id === id); if (c) return c; }
      return null;
    };

    const maxStop = QUARTERS.length - 1;
    const inRange = key => {
      const i = qIndex(range, key);
      return i != null && i >= 0 && i <= maxStop;
    };
    const edTools = m.tools.map((t, ti) => {
      const missing = [];
      if (!t.name || !t.name.trim()) missing.push("name");
      if (!(t.caps || []).length) missing.push("capability");
      return {
        name: t.name,
        rowBg: missing.length ? "color-mix(in srgb, var(--color-surface) 70%, transparent)" : "var(--color-surface)",
        stLabel: missing.length ? "Invalid" : "Valid",
        stError: missing.length ? "Needs " + missing.join(" + ") : "",
        stFg: missing.length ? "var(--color-invalid)" : "var(--color-valid)",
        stIcon: missing.length ? "ph-warning-circle" : "ph-check-circle",
        assigns: (t.caps || []).map((a, k) => {
          const c = capMeta(a.id);
          const startOff = a.cov !== "n";
          const endOff = a.cov === "c" || a.cov === "x";
          const setQ = (field, e) => {
            const v = e.target.value === "" ? null : e.target.value;
            this.edit(mm => { mm.tools[ti].caps[k][field] = v; });
          };
          return {
            label: c ? c.label : "removed", icon: c ? c.icon : "ph-x",
            cov: a.cov || "n",
            start: inRange(a.startQ) ? a.startQ : "",
            end: inRange(a.endQ) ? a.endQ : "",
            startOff, endOff, startOp: startOff ? 0.45 : 1, endOp: endOff ? 0.45 : 1,
            remark: a.remark || "",
            setRemark: e => { const v = e.target.value; this.edit(mm => { mm.tools[ti].caps[k].remark = v; }); },
            setCov: e => {
              const v = e.target.value;
              this.edit(mm => {
                const x = mm.tools[ti].caps[k];
                x.cov = v;
                if (v === "c" || v === "x") { x.startQ = null; x.endQ = null; }
                if (v === "p") x.startQ = null;
              });
            },
            setStart: e => setQ("startQ", e),
            setEnd: e => setQ("endQ", e),
            remove: () => this.edit(mm => { mm.tools[ti].caps.splice(k, 1); })
          };
        }),
        deps: (t.deps || []).map(id => m.tools.find(o => o.id === id)).filter(Boolean).map(o => ({
          name: o.name || "untitled",
          remove: () => this.edit(mm => { mm.tools[ti].deps = (mm.tools[ti].deps || []).filter(d => d !== o.id); })
        })),
        depOptions: m.tools.filter(o => o.id !== t.id && (t.deps || []).indexOf(o.id) < 0)
          .map(o => ({ v: o.id, n: o.name || "untitled" })).sort((a, b) => a.n.localeCompare(b.n)),
        addDep: e => {
          const v = e.target.value;
          if (v) this.edit(mm => { const x = mm.tools[ti]; x.deps = (x.deps || []).concat([v]); });
        },
        setName: e => { const v = e.target.value; this.edit(mm => { mm.tools[ti].name = v; }); },
        addCap: e => {
          const v = e.target.value;
          if (!v) return;
          this.edit(mm => {
            const cs = mm.tools[ti].caps || (mm.tools[ti].caps = []);
            if (!cs.some(a => a.id === v)) cs.push({ id: v, cov: "n", startQ: null, endQ: null, notes: {} });
          });
        },
        remove: () => this.edit(mm => {
          const id = mm.tools[ti].id;
          mm.tools.splice(ti, 1);
          mm.tools.forEach(o => { o.deps = (o.deps || []).filter(d => d !== id); });
        })
      };
    });

    const rangeFields = [
      { key: "sq", group: 0, label: "Quarter", value: String(range.sq), options: [1, 2, 3, 4].map(q => ({ v: String(q), n: "Q" + q })) },
      { key: "sy", group: 0, label: "Year", value: String(range.sy), options: YEARS.map(y => ({ v: String(y), n: String(y) })) },
      { key: "eq", group: 1, label: "Quarter", value: String(range.eq), options: [1, 2, 3, 4].map(q => ({ v: String(q), n: "Q" + q })) },
      { key: "ey", group: 1, label: "Year", value: String(range.ey), options: YEARS.map(y => ({ v: String(y), n: String(y) })) }
    ].map(fd => Object.assign(fd, {
      onChange: e => {
        const v = +e.target.value;
        this.edit(mm => {
          const r = mm.range || (mm.range = Object.assign({}, DEFAULT_RANGE));
          r[fd.key] = v;
          if ((r.ey - r.sy) * 4 + (r.eq - r.sq) < 0) { r.eq = r.sq; r.ey = r.sy; }
          // out-of-range dates and highlights are kept as-is: shortening the
          // range hides them, re-extending it brings them back
        });
        const len = quarterList(Object.assign({}, range, { [fd.key]: v })).length;
        this.setState(s => ({ tPos: Math.min(len - 1, s.tPos) }));
      }
    }));

    const rmStages = st.tab !== "roadmap" ? [] : m.stages.map((s, si) => {
      const hlCells = QUARTERS.map((q, i) => {
        const qk = qKey(range, i), key = "hl:" + si + ":" + i;
        const text = String((s.highlights || {})[qk] || "");
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean).map(t2 => ({ text: t2 }));
        return {
          text, lines, empty: lines.length === 0, hasLines: lines.length > 0,
          editing: st.noteEdit === key, idle: st.noteEdit !== key,
          edit: () => this.setState({ noteEdit: key, copyMenu: null }),
          stop: () => this.setState({ noteEdit: null }),
          setText: e => {
            const v = e.target.value;
            this.edit(mm => { (mm.stages[si].highlights || (mm.stages[si].highlights = {}))[qk] = v; });
          }
        };
      });
      return {
        name: s.name, icon: s.icon,
        summary: s.caps.length + " capabilities · " + Math.round(scoreAt(s, QUARTERS.length - 1) * 100) + "% by " + QUARTERS[QUARTERS.length - 1],
        hlCells,
        stageCells: QUARTERS.map((q, i) => {
          const sc2 = scoreAt(s, i);
          return { q, pct: Math.round(sc2 * 100) + "%", bar: readinessBar(sc2), fg: i === 0 ? "var(--color-accent-200)" : "var(--color-neutral-200)" };
        }),
        caps: s.caps.map(c => ({
          icon: c.icon, label: c.label,
          cells: QUARTERS.map((q, i) => {
            const sv = STATUS[capStatusAt(c.id, i)];
            return { label: sv.label, fg: sv.fg, dotBg: sv.bg, dotBd: sv.bd };
          }),
          tools: toolsFor(c.id).map(t => {
            const ti = m.tools.indexOf(t);
            const ki = t.caps.findIndex(x => x.id === c.id);
            const a = t.caps[ki];
            const others = t.caps.map((x, k) => ({ x, k })).filter(o => o.k !== ki);
            return {
              name: t.name || "untitled",
              cells: QUARTERS.map((q, i) => {
                const key = t.id + ":" + c.id + ":" + i;
                const qk = qKey(range, i);
                const note = ((a.notes || {})[qk] || "");
                const lineList = note.split("\n").map(l => l.trim()).filter(Boolean);
                // append one line to other assignments of this tool at this quarter (skips duplicates)
                const copyTo = (targets, text) => this.edit(mm => {
                  targets.forEach(k => {
                    const dst = mm.tools[ti].caps[k];
                    const notes = dst.notes || (dst.notes = {});
                    const have = String(notes[qk] || "").split("\n").map(l => l.trim()).filter(Boolean);
                    if (have.indexOf(text) < 0) notes[qk] = have.concat([text]).join("\n");
                  });
                  this.setState({ copyMenu: null });
                });
                return {
                  bar: toolBar(this.effective(a, i, range)),
                  note,
                  lines: lineList.map((text, li) => {
                    const mk = key + ":" + li;
                    return {
                      text, canCopy: others.length > 0, menuOpen: st.copyMenu === mk,
                      toggleMenu: () => this.setState(s2 => ({ copyMenu: s2.copyMenu === mk ? null : mk })),
                      targets: others.map(o => ({ label: (capMeta(o.x.id) || {}).label || "removed", copy: () => copyTo([o.k], text) })),
                      copyAll: () => copyTo(others.map(o => o.k), text),
                      edit: () => this.setState({ noteEdit: key, copyMenu: null })
                    };
                  }),
                  emptyNote: lineList.length === 0, hasNote: lineList.length > 0,
                  noteBd: "var(--color-accent-700)",
                  editing: st.noteEdit === key, idle: st.noteEdit !== key,
                  edit: () => this.setState({ noteEdit: key }),
                  stop: () => this.setState({ noteEdit: null }),
                  setNote: e => {
                    const v = e.target.value;
                    this.edit(mm => { (mm.tools[ti].caps[ki].notes || (mm.tools[ti].caps[ki].notes = {}))[qk] = v; });
                  }
                };
              })
            };
          })
        }))
      };
    });

    const rmTools = st.tab !== "roadmap" || st.roadmapView !== "tools" ? [] : m.tools.map((t, ti) => {
      const caps = (t.caps || []).map((a, ki) => {
        let cap = null, stage = "";
        for (const s of m.stages) {
          const found = s.caps.find(c => c.id === a.id);
          if (found) { cap = found; stage = s.name; break; }
        }
        if (!cap) return null;
        const others = t.caps.map((x, k) => ({ x, k })).filter(o => o.k !== ki);
        return {
          icon: cap.icon, label: cap.label || "untitled", stage,
          statusCells: QUARTERS.map((q, i) => {
            const sv = STATUS[this.effective(a, i, range)];
            return { label: sv.label, fg: sv.fg, dotBg: sv.bg, dotBd: sv.bd };
          }),
          cells: QUARTERS.map((q, i) => {
            const key = t.id + ":" + a.id + ":" + i;
            const qk = qKey(range, i);
            const note = ((a.notes || {})[qk] || "");
            const lineList = note.split("\n").map(l => l.trim()).filter(Boolean);
            const copyTo = (targets, text) => this.edit(mm => {
              targets.forEach(k => {
                const dst = mm.tools[ti].caps[k];
                const notes = dst.notes || (dst.notes = {});
                const have = String(notes[qk] || "").split("\n").map(l => l.trim()).filter(Boolean);
                if (have.indexOf(text) < 0) notes[qk] = have.concat([text]).join("\n");
              });
              this.setState({ copyMenu: null });
            });
            return {
              bar: toolBar(this.effective(a, i, range)), note,
              lines: lineList.map((text, li) => {
                const mk = key + ":" + li;
                return {
                  text, canCopy: others.length > 0, menuOpen: st.copyMenu === mk,
                  toggleMenu: () => this.setState(s2 => ({ copyMenu: s2.copyMenu === mk ? null : mk })),
                  targets: others.map(o => ({ label: (capMeta(o.x.id) || {}).label || "removed", copy: () => copyTo([o.k], text) })),
                  copyAll: () => copyTo(others.map(o => o.k), text),
                  edit: () => this.setState({ noteEdit: key, copyMenu: null })
                };
              }),
              emptyNote: lineList.length === 0, hasNote: lineList.length > 0,
              noteBd: "var(--color-accent-700)",
              editing: st.noteEdit === key, idle: st.noteEdit !== key,
              edit: () => this.setState({ noteEdit: key }),
              stop: () => this.setState({ noteEdit: null }),
              setNote: e => {
                const v = e.target.value;
                this.edit(mm => { (mm.tools[ti].caps[ki].notes || (mm.tools[ti].caps[ki].notes = {}))[qk] = v; });
              }
            };
          })
        };
      }).filter(Boolean);
      const covered = (t.caps || []).filter(a => this.effective(a, QUARTERS.length - 1, range) === "c").length;
      return {
        name: t.name || "untitled",
        summary: caps.length + " core capabilities · " + covered + " covered by " + QUARTERS[QUARTERS.length - 1],
        caps, hasCaps: caps.length > 0, noCaps: caps.length === 0
      };
    });

    // ---- ecosystem: tool dependency map, ranking and the selected tool's links ----
    const eco = { ecoNodes: [], ecoEdges: [], ecoRows: [], ecoTiers: [], ecoSel: null };
    if (st.tab === "ecosystem") {
      const full = ecoGraph(m), layer = ECO_LAYERS.find(l => l.id === st.ecoLayer) || ECO_LAYERS[2];
      const eg = ecoGeom(ecoProject(this.ecoLive(ecoFilter(full, layer.maxTier)), st.ecoView || { k: 1, tx: 0, ty: 0 }));
      const selId = st.ecoSel && eg.byId.has(st.ecoSel) ? st.ecoSel : null;
      const fid = selId;
      const fn = fid ? eg.byId.get(fid) : null;
      const pick = id => this.setState({ ecoSel: id === selId ? null : id });
      const stagesOf = t => m.stages.filter(s2 => s2.caps.some(c => (t.caps || []).some(a => a.id === c.id))).map(s2 => s2.name);
      const pathD = pts => "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L");
      eco.ecoEdges = eg.edges.map(e => {
        const inc = !!fn && (e.from === fid || e.to === fid), out = inc && e.from === fid;
        // links between two central tools stand out: the backbone of the ecosystem
        const core = eg.byId.get(e.from).tier === 0 && eg.byId.get(e.to).tier === 0;
        const stroke = inc ? (out ? "var(--color-accent-200)" : "var(--color-accent-400)") : core ? "var(--color-accent-300)" : "var(--color-accent-700)";
        return {
          inc, d: pathD(e.pts), head: pathD(e.head) + " Z", stroke,
          w: e.sat ? (inc ? 2.6 : 2) : (inc || core ? 2.4 : 1.5), dash: e.sat ? "0.5 6" : "none",
          op: !fn ? 0.85 : inc ? 1 : 0.1
        };
      }).sort((a, b) => a.inc - b.inc || (a.stroke === "var(--color-accent-300)") - (b.stroke === "var(--color-accent-300)"));
      eco.ecoNodes = eg.nodes.map(n => {
        const T = TIERS[n.tier], on = n.id === fid, lit = !fn || on || fn.links.has(n.id);
        return {
          x: n.x, y: n.y, r: n.r, haloR: n.r + 7, haloOp: on ? 0.5 : 0,
          fill: T.fill, stroke: on ? "var(--color-accent-200)" : T.stroke, sw: on ? 3 : 2, dash: n.tier === 3 ? "3 4" : "none",
          op: lit ? 1 : 0.22, name: n.name, lxp: n.x / ECO_W * 100, lyp: (n.y + n.r + 3) / ECO_H * 100, fs: n.tier === 0 ? 15 : 13, fsq: (n.tier === 0 ? 15 : 13) / 10, fw: n.tier === 0 ? 600 : 400, fg: T.fg,
          onDown: e => this.ecoDown(n.id, e),
          onSelect: () => { if (this.ecoMoved) { this.ecoMoved = false; return; } pick(n.id); }
        };
      });
      eco.ecoRows = eg.nodes.map(n => ({
        name: n.name, tier: TIERS[n.tier].label, tagCls: TIERS[n.tier].tag,
        usedBy: n.users.length, dependsOn: n.deps.length, reach: n.reach,
        stages: stagesOf(n.tool).join(", ") || "—",
        on: n.id === selId ? "true" : "false",
        onSelect: () => pick(n.id)
      }));
      eco.ecoTiers = TIERS.map((T, i) => ({
        label: T.label, note: T.note, fill: T.fill, stroke: T.stroke,
        count: full.nodes.filter(n => n.tier === i).length
      }));
      eco.ecoSummary = full.nodes.length + " tools · " + full.edges.length + (full.edges.length === 1 ? " dependency" : " dependencies");
      eco.ecoShown = eg.nodes.length === full.nodes.length ? "" : "Showing " + eg.nodes.length + " of " + full.nodes.length + " tools and " + eg.edges.length + " of " + full.edges.length + " dependencies";
      eco.ecoEmpty = full.nodes.length > 0 && full.edges.length === 0;
      eco.ecoLayers = ECO_LAYERS.map(l => {
        const on = l.id === layer.id;
        return {
          label: l.label, icon: l.icon, selected: on ? "true" : "false",
          bg: on ? "var(--color-accent-900)" : "transparent",
          bd: on ? "var(--color-accent-600)" : "var(--color-divider)",
          fg: on ? "var(--color-accent-100)" : "var(--color-neutral-200)",
          onClick: () => this.setState({ ecoLayer: l.id })
        };
      });
      const sn = selId ? eg.byId.get(selId) : null;
      if (sn) {
        // a linked tool hidden by the filter is still listed; selecting it shows all tools
        const link = id => ({ name: full.byId.get(id).name, select: () => this.setState(eg.byId.has(id) ? { ecoSel: id } : { ecoSel: id, ecoLayer: "all" }) });
        const T = TIERS[sn.tier];
        eco.ecoSel = {
          name: sn.name, tier: T.label, tierNote: T.note, tagCls: T.tag,
          usedBy: sn.users.length, dependsOn: sn.deps.length, reach: sn.reach,
          stages: stagesOf(sn.tool).map(name => ({ name })),
          noStages: stagesOf(sn.tool).length === 0,
          deps: sn.deps.map(link), users: sn.users.map(link),
          noDeps: sn.deps.length === 0, noUsers: sn.users.length === 0,
          toEditor: () => { window.location.hash = "editor"; this.setState({ tab: "editor", selected: null, hover: null, menuOpen: false }); window.scrollTo(0, 0); },
          close: () => this.setState({ ecoSel: null })
        };
      }
    }

    const capCount = m.stages.reduce((a, s) => a + s.caps.length, 0);
    const frac = st.tPos / (QUARTERS.length - 1);

    return Object.assign(eco, {
      isLoop: st.tab === "loop", isEditor: st.tab === "editor", isRoadmap: st.tab === "roadmap", isEcosystem: st.tab === "ecosystem",
      ecoNoSel: !eco.ecoSel,
      ecoSvgRef: el => {
        if (this.ecoSvg && this.ecoSvg !== el) this.ecoSvg.removeEventListener("wheel", this.ecoWheel);
        if (el && el !== this.ecoSvg) el.addEventListener("wheel", this.ecoWheel, { passive: false });
        this.ecoSvg = el;
      },
      ecoPanDown: e => this.ecoPanDown(e),
      ecoZoomIn: () => this.ecoZoomBy(1.4),
      ecoZoomOut: () => this.ecoZoomBy(1 / 1.4),
      ecoZoomReset: () => this.setState({ ecoView: null }),
      ecoZoomLabel: Math.round(((st.ecoView || {}).k || 1) * 100) + "%",
      ecoPanCls: st.ecoView && st.ecoView.k > 1 ? "c-eco-bg c-eco-bg-pan" : "c-eco-bg",
      tabs: [tab("loop", "Lifecycle", "ph-infinity"), tab("roadmap", "Roadmap", "ph-flag-banner"), tab("ecosystem", "Ecosystem", "ph-share-network"), tab("editor", "Editor", "ph-table", "neutral")],
      isSdlcRoadmap: st.roadmapView === "sdlc",
      isToolsRoadmap: st.roadmapView === "tools",
      roadmapModes: [roadmapMode("sdlc", "SDLC roadmap", "ph-path"), roadmapMode("tools", "Tools roadmap", "ph-wrench")],
      rmStages, rmTools, quarterHeaders: QUARTERS.map(label => ({ label })),
      cols: "190px repeat(" + QUARTERS.length + ", minmax(120px,1fr))",

      fullD, segments, stages,
      devX: CX - A * 0.52, opsX: CX + A * 0.52,
      pulseOp: this.props.flowPulse === false ? 0 : 0.85,
      pulseRef: el => { if (el) { this.pulseEl = el; this.startPulse(); } },
      menuOpen: st.menuOpen, menuExpanded: st.menuOpen ? "true" : "false", menuIcon: st.menuOpen ? "ph-x" : "ph-list",
      toggleMenu: () => this.setState(s => ({ menuOpen: !s.menuOpen })),
      exportRef: el => { this.exportEl = el; },
      exportOpen: st.exportOpen, exportExpanded: st.exportOpen ? "true" : "false",
      exportBusy: !!st.exporting, exportBusyAttr: st.exporting ? "true" : "false",
      exportIcon: st.exporting ? "ph-circle-notch" : st.exportDone ? "ph-check-circle" : "ph-export",
      exportLabel: st.exporting === "pdf" ? "Building PDF…" : st.exporting ? "Building PPTX…" : st.exportDone ? "Downloaded" : "Export",
      exportMeta: m.stages.length + " stages · " + m.tools.filter(t => (t.caps || []).length).length + " tools · 16:9",
      exportErr: st.exportErr || "", hasExportErr: !!st.exportErr,
      toggleExport: () => { if (!st.exporting) this.setState(s => ({ exportOpen: !s.exportOpen, exportErr: "" })); },
      exportPdfClick: () => this.runExport("pdf"),
      exportPptxClick: () => this.runExport("pptx"),
      showLoop: !st.narrow,
      loopHint: st.narrow ? "" : " Click a stage on the loop for a bigger panel.",
      showCaps: st.caps, showCoverage: cov, showTools: st.tools,
      showCapRows: st.caps || st.tools,
      toolSuffix: st.tools ? " · tooling" : "",
      sel: st.selected === null ? null : stages[st.selected],
      planLabel: "Highlights of " + QUARTERS[stopIdx],
      closePanel: () => this.setState({ selected: null, hover: null }),
      clearHover: () => this.setState({ hover: st.selected }),
      legend: ["c", "p", "n", "x"].map(k => ({ label: STATUS[k].label, dotBg: STATUS[k].bg, dotBd: STATUS[k].bd })),
      stopLabel: QUARTERS[stopIdx], stopNote: stopIdx === 0 ? "current quarter · " + qName(range, 0) : "target quarter",
      dotPct: 3 + frac * 94,
      stops: QUARTERS.map((q, i) => ({
        label: QUARTERS.length > 13 && i % 2 === 1 && i !== QUARTERS.length - 1 ? "" : q,
        fs: QUARTERS.length > 9 ? "10.5px" : "11.5px",
        pct: 3 + (i / (QUARTERS.length - 1)) * 94,
        tickBg: i <= stopIdx ? "var(--color-accent-400)" : "var(--color-bg)",
        tickBd: i <= stopIdx ? "var(--color-accent-400)" : "#5b5f70",
        fg: i === stopIdx ? "var(--color-accent-100)" : "var(--color-neutral-300)"
      })),
      trackRef: el => { if (el) this.trackEl = el; },
      onTrackDown: this.dragStart,
      onDotKey: e => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        this.setState(s => ({ tPos: Math.min(QUARTERS.length - 1, Math.max(0, Math.round(s.tPos) + d)) }));
      },
      toggles: [mk("caps", "Core capabilities"), mk("coverage", "Coverage"), mk("tools", "Tooling")],

      edStages, edTools, capOptions,
      iconOptions: iconSet.map(i => ({ v: "ph-" + i, n: i })),
      iconCount: iconSet.length + " icons",
      covOptions: [{ v: "c", n: "Covered" }, { v: "p", n: "Partially" }, { v: "n", n: "Not covered" }, { v: "x", n: "Not in scope" }],
      quarterOptions: [{ v: "", n: "—" }].concat(QUARTERS.map((q, i) => ({ v: qKey(range, i), n: i === 0 ? "Today (" + qName(range, 0) + ")" : q }))),
      modelSummary: capCount + " capabilities · " + m.tools.length + " tool rows · " + QUARTERS.length + " quarters",
      rangeGroups: [
        { title: "Today", hint: "where the loop starts", fields: rangeFields.filter(fd => fd.group === 0) },
        { title: "Roadmap end", hint: "last quarter on the line", fields: rangeFields.filter(fd => fd.group === 1) }
      ],
      rangeLabel: "Today is " + qName(range, 0) + " · roadmap runs to " + qName(range, QUARTERS.length - 1),
      addTool: () => this.edit(mm => {
        const ids = mm.tools.map(t => +String(t.id).replace(/\D/g, "")).concat([0]);
        mm.tools.push({ id: "t" + (Math.max.apply(null, ids) + 1), name: "", caps: [], deps: [] });
      }),
      confirmReset: !!st.confirmReset,
      askReset: () => this.setState({ confirmReset: true }),
      cancelReset: () => this.setState({ confirmReset: false }),
      keepDialog: e => e.stopPropagation(),
      doReset: () => { this.setState({ confirmReset: false }); this.save(seedModel()); },
      ioMsg: st.ioMsg || "", ioFg: st.ioBad ? "var(--color-neutral-100)" : "var(--color-accent-300)",
      fileRef: el => { if (el) this.fileEl = el; },
      openFile: () => { if (this.fileEl) this.fileEl.click(); },
      saveFile: () => {
        const blob = new Blob([JSON.stringify({ format: "devops-loop", version: 7, model: m }, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "devops-loop-model.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        this.flash("Saved devops-loop-model.json", false);
      },
      loadFile: e => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const raw = JSON.parse(String(reader.result));
            const mm = raw && raw.model ? raw.model : raw;
            if (!mm || !Array.isArray(mm.stages) || mm.stages.length !== 8 || !Array.isArray(mm.tools)) throw new Error("shape");
            mm.stages.forEach(s => { if (!s.highlights) s.highlights = {}; if (!Array.isArray(s.caps)) s.caps = []; });
            if (!mm.range) mm.range = Object.assign({}, DEFAULT_RANGE);
            this.save(migrate(mm));
            this.flash("Loaded " + file.name, false);
          } catch (err) {
            this.flash("Could not read that file — expected a saved loop model", true);
          }
        };
        reader.onerror = () => this.flash("Could not read that file", true);
        reader.readAsText(file);
      }
    });
  }
}
return Component;
};

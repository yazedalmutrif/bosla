// Structural audit of data/dataset.json: required fields, id integrity, link-check coverage, personal-data scan.
// Usage: node scripts/audit-dataset.mjs
import { existsSync, readFileSync } from "node:fs";

const ds = JSON.parse(readFileSync(new URL("../data/dataset.json", import.meta.url), "utf8"));
const problems = [];
const p = (m) => problems.push(m);

const ids = (xs) => new Set(xs.map((x) => x.id));
const fieldIds = ids(ds.fields ?? []);
const sectorIds = ids(ds.sectors ?? []);
const cityIds = ids(ds.cities ?? []);
const sourceIds = ids(ds.meta?.sources ?? []);

const bi = (o, where) => {
  if (!o || typeof o.ar !== "string" || typeof o.en !== "string" || !o.ar.trim() || !o.en.trim()) p(`${where}: missing ar/en text`);
};
const url = (u, where) => {
  try {
    const x = new URL(u);
    if (x.protocol !== "https:") p(`${where}: not https (${u})`);
  } catch {
    p(`${where}: bad url (${u})`);
  }
};
const dupes = (xs, name) => {
  const seen = new Set();
  for (const x of xs) {
    if (seen.has(x.id)) p(`${name}: duplicate id ${x.id}`);
    seen.add(x.id);
  }
};

for (const k of ["meta", "fields", "sectors", "cities", "companies", "salaryTable", "programs", "platforms", "cvPatterns"]) if (!(k in ds)) p(`missing top-level key ${k}`);
bi(ds.meta?.salaryDisclaimer, "meta.salaryDisclaimer");

const linkStats = { ok: 0, blocked: 0, dead: 0, unchecked: 0 };
const countLink = (x, where) => {
  const lc = x.linkCheck;
  if (!lc) {
    linkStats.unchecked++;
    p(`${where}: no linkCheck`);
  } else if (lc.ok === true) linkStats.ok++;
  else if (lc.ok === null) linkStats.blocked++;
  else {
    linkStats.dead++;
    p(`${where}: link check failed (${lc.status ?? "-"} ${lc.note ?? ""})`);
  }
};

dupes(ds.companies, "companies");
for (const c of ds.companies) {
  const w = `company ${c.id}`;
  bi(c.name, w + ".name");
  bi(c.about, w + ".about");
  bi(c.goodFor, w + ".goodFor");
  if (!c.cities?.length) p(`${w}: no cities`);
  for (const ci of c.cities ?? []) if (!cityIds.has(ci)) p(`${w}: unknown city ${ci}`);
  if (!sectorIds.has(c.sector)) p(`${w}: unknown sector ${c.sector}`);
  for (const f of c.fields ?? []) if (!fieldIds.has(f)) p(`${w}: unknown field ${f}`);
  if (!sourceIds.has(c.sourceId)) p(`${w}: unknown source ${c.sourceId}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.asOf ?? "")) p(`${w}: bad asOf`);
  if (c.salary && (c.salary.kind !== "estimate" || !(c.salary.min > 0) || !(c.salary.max >= c.salary.min))) p(`${w}: bad salary`);
  url(c.careersUrl, w);
  countLink(c, w);
}
dupes(ds.salaryTable, "salaryTable");
for (const r of ds.salaryTable) {
  const w = `salary ${r.id}`;
  bi(r.segment, w);
  if (r.kind !== "estimate" && !(r.kind === "official" && r.sourceId && ds.meta.sources.find((s) => s.id === r.sourceId)?.kind === "official-page"))
    p(`${w}: not labelled estimate (and not an official-page figure)`);
  if (!fieldIds.has(r.field) && r.field !== "general") p(`${w}: unknown field ${r.field}`);
  if (!sourceIds.has(r.sourceId)) p(`${w}: unknown source`);
  if (!(r.start?.min > 0)) p(`${w}: bad start`);
}
dupes(ds.programs, "programs");
for (const x of ds.programs) {
  const w = `program ${x.id}`;
  bi(x.name, w);
  bi(x.requirements, w + ".requirements");
  url(x.url, w);
  countLink(x, w);
  if (!sourceIds.has(x.sourceId)) p(`${w}: unknown source`);
}
dupes(ds.platforms, "platforms");
for (const x of ds.platforms) {
  const w = `platform ${x.id}`;
  bi(x.name, w);
  bi(x.goodFor, w);
  url(x.url, w);
  countLink(x, w);
}
dupes(ds.cvPatterns, "cvPatterns");
for (const x of ds.cvPatterns) {
  bi(x.title, `pattern ${x.id}`);
  bi(x.detail, `pattern ${x.id}`);
}

// Personal-data scan: the dataset must describe companies and programmes, never a person.
// Generic patterns (second-person CV wording, private-notes paths) live here. The names and CV details of the real
// people the original research was done for are kept out of the public repo: put them in the git-ignored file
// scripts/private-terms.local.json as [{ "re": "<regex source>", "flags": "i" }, ...] and they are checked too.
// Company/programme facts that mention a banned word are allowed (an employer's name, a programme's GPA rule).
const text = JSON.stringify(ds);
const banned = [
  /\byour (GPA|CV|project|supervisor)\b/i,
  /\byou trained\b|تدربت عندهم|مشرفك|سيرتك|مشروعك/i, /vaultPath/, /Source Archive|Published Pages/i,
];
const localTerms = new URL("./private-terms.local.json", import.meta.url);
if (existsSync(localTerms)) {
  for (const t of JSON.parse(readFileSync(localTerms, "utf8"))) banned.push(new RegExp(t.re, t.flags ?? "i"));
} else {
  console.warn("note: scripts/private-terms.local.json not found; personal-data scan uses the generic patterns only");
}
for (const re of banned) {
  const m = text.match(re);
  if (m) {
    const i = text.indexOf(m[0]);
    p(`personal-data scan hit ${re}: ...${text.slice(Math.max(0, i - 60), i + 60)}...`);
  }
}

console.log(
  JSON.stringify(
    {
      counts: {
        companies: ds.companies.length,
        salaryRows: ds.salaryTable.length,
        programs: ds.programs.length,
        platforms: ds.platforms.length,
        cvPatterns: ds.cvPatterns.length,
        fields: ds.fields.length,
        sectors: ds.sectors.length,
        cities: ds.cities.length,
        sources: ds.meta.sources.length,
      },
      linkStats,
      problems: problems.length,
    },
    null,
    2,
  ),
);
for (const x of problems) console.log(" -", x);
process.exitCode = problems.length ? 1 : 0;

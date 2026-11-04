// Renders the baseline chart set from a deployed ChartRelay and writes a contact sheet to open in a
// browser. This is what Gate E asks the owner to look at before any of it is frozen as a pixel-diff
// baseline — a baseline approved without being seen just freezes whatever bug it contains.
//
// Usage: node scripts/golden-set.mjs [https://target] [--out=reports/baseline]
// Reads nothing secret and sends no credentials. Paced well under the endpoint's 240/minute limit.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://chartrelay.dev";
const DEFAULT_OUT = "reports/baseline";
/** ~4 requests/second against a 240/minute limit: fast enough to be usable, far from the ceiling. */
const PACE_MS = 250;

const MONTHS = "Jan,Feb,Mar,Apr,May,Jun";

/**
 * The set, in the order a reviewer should look at it.
 *
 * `group` is the heading it appears under. `why` says what this image is asking the viewer to check,
 * because "does this look right" is unanswerable without knowing what was wrong before.
 */
export const CASES = [
  ...["bar", "line", "area", "pie", "scatter"].flatMap((type) =>
    ["editorial", "classic"].flatMap((style) =>
      ["light", "dark"].map((theme) => ({
        group: "Every chart type, both styles, both themes",
        name: `${type}-${style}-${theme}`,
        why: `${type}, ${style} style, ${theme} theme`,
        query: `type=${type}&data=12,19,27,22,31,38&labels=${MONTHS}&names=Revenue&title=Monthly recurring revenue&style=${style}&theme=${theme}`,
      })))),

  { group: "Negative and mixed-sign data", name: "all-negative", why: "Every value negative. Used to draw an empty plot under an axis reading 1, 1, 1, 0, 0.",
    query: `type=bar&data=-10,-25,-40,-15,-30&labels=Jan,Feb,Mar,Apr,May&title=Net burn` },
  { group: "Negative and mixed-sign data", name: "one-negative", why: "One negative among positives. The bar used to be missing entirely, which reads as 'no data'.",
    query: `type=bar&data=10,25,-40,15,30&labels=Jan,Feb,Mar,Apr,May&title=Monthly net` },
  { group: "Negative and mixed-sign data", name: "mixed-sign-line", why: "Negative segments used to be drawn outside the plot, through the labels and off the canvas.",
    query: `type=line&data=-40,-10,15,60,-5,30&labels=${MONTHS}&names=Net&title=Net position` },
  { group: "Negative and mixed-sign data", name: "symmetric", why: "Equal magnitudes either side of zero must draw equal lengths.",
    query: `type=bar&data=30,-30,15,-15&labels=A,B,C,D&title=Wins and losses` },

  { group: "Numbers at awkward scales", name: "tiny-values", why: "All four axis ticks used to read 0 while the bars had visibly different heights.",
    query: `type=bar&data=0.00001,0.00002,0.000015&labels=A,B,C&title=Cost per render` },
  { group: "Numbers at awkward scales", name: "millions", why: "Ticks used to read 0 / 0.3M / 0.5M / 0.8M / 1M for evenly spaced gridlines.",
    query: `type=bar&data=250000,500000,750000,1000000&labels=Q1,Q2,Q3,Q4&title=Annual revenue` },
  { group: "Numbers at awkward scales", name: "rates", why: "A 0..1 axis used to print 0, 0, 1, 1, 1 and label -0.45 as '-0'.",
    query: `type=bar&data=0.3,0.7,0.45,0.6&labels=A,B,C,D&title=Conversion rate` },
  { group: "Numbers at awkward scales", name: "all-zeros", why: "A constant-zero series. The axis used to print the same tick three times.",
    query: `type=bar&data=0,0,0,0&labels=A,B,C,D&title=Nothing happened` },
  { group: "Numbers at awkward scales", name: "currency", why: "Prefix and compaction together.",
    query: `type=bar&data=12000,25000,33900,15000,30000&labels=Jan,Feb,Mar,Apr,May&title=MRR&prefix=$` },

  { group: "Crowding", name: "hundred-points-bar", why: "At the schema's 100-point maximum, all 100 labels used to be drawn into an unreadable band.",
    query: `type=bar&data=${Array.from({ length: 100 }, (_, i) => Math.round(50 + 40 * Math.sin(i / 7))).join(",")}&title=Daily active users` },
  { group: "Crowding", name: "hundred-points-line", why: "Same at 100 points, drawn as a line.",
    query: `type=line&data=${Array.from({ length: 100 }, (_, i) => Math.round(50 + 40 * Math.sin(i / 7))).join(",")}&names=Users&title=Daily active users` },
  { group: "Crowding", name: "long-labels", why: "Long category names used to collide into unreadable mush and clip at both canvas edges.",
    query: `type=bar&data=12,19,27&labels=Customer acquisition cost blended,Lifetime value per account,Payback period in months&title=Unit economics` },
  { group: "Crowding", name: "eight-series", why: "The renderer's maximum of eight series; end labels used to collide.",
    query: `type=line&data=${Array.from({ length: 8 }, (_, s) => Array.from({ length: 6 }, (_, i) => 30 + s * 4 + i * 2).join(",")).join("|")}&labels=${MONTHS}&names=${Array.from({ length: 8 }, (_, s) => `Series ${s + 1}`).join(",")}&title=Eight series` },

  { group: "Text the world actually uses", name: "japanese-korean-arabic", why: "Used to return HTTP 500 with an empty body, then tofu boxes. Arabic must be joined, not isolated letters.",
    query: `type=bar&data=12,19,27&labels=A,B,C&title=${encodeURIComponent("日本語 한국어 العربية")}` },
  { group: "Text the world actually uses", name: "indic-thai-ethiopic", why: "Devanagari, Bengali, Tamil, Thai and Ethiopic. Silent tofu at HTTP 200 until the second font round.",
    query: `type=bar&data=12,19,27&labels=A,B,C&title=${encodeURIComponent("हिन्दी বাংলা தமிழ் ภาษาไทย አማርኛ")}` },
  { group: "Text the world actually uses", name: "european-emoji", why: "Emoji, em dash, euro, Cyrillic, Greek, and Polish — the ó in Łódź used to 500.",
    query: `type=bar&data=12,19,27&labels=A,B,C&title=${encodeURIComponent("🚀 Łódź — € Привет Ω")}` },
  { group: "Text the world actually uses", name: "subtitle-cjk", why: "The subtitle reaches the image by a different path from the title and rendered as hex boxes.",
    query: `type=line&data=12,19,27,22&labels=Q1,Q2,Q3,Q4&names=${encodeURIComponent("売上")}&title=Japanese subtitle&subtitle=${encodeURIComponent("売上高の推移")}` },

  { group: "Decisions the renderer makes for you", name: "bar-as-lines", why: "A multi-series bar is drawn as lines. The figure must say so — a header is invisible in an <img>.",
    query: `type=bar&data=20,24,28,32|34,32,28,24&labels=Q1,Q2,Q3,Q4&names=North,South&title=Revenue by region` },
  { group: "Decisions the renderer makes for you", name: "editorial-fallback", why: "Editorial cannot draw a pie, so it falls back to classic and says so.",
    query: `type=pie&data=30,25,20,15&labels=A,B,C,D&names=Share&title=Market share&style=editorial` },

  // A refusal answers 4xx *and* returns a drawn card as the body, because an <img> cannot display a
  // JSON error. The status is the correct behaviour here, so these cases expect it.
  { group: "Refusals", name: "refusal-too-many-series", why: "Nine series, over the cap of eight. The refusal is drawn as an image because an <img> cannot show a body.",
    expectRefusal: true,
    query: `type=line&data=${Array.from({ length: 9 }, () => "1,2,3").join("|")}&labels=A,B,C&title=Too many series` },
  { group: "Refusals", name: "refusal-bad-input", why: "Malformed input. The card has to explain itself to someone reading it hours later.",
    expectRefusal: true,
    query: `type=bar&data=not-a-number&labels=A&title=Bad input` },
  { group: "Refusals", name: "refusal-missing-companion", why: "note without noteAt. The card must say which parameter is missing, not just that something is.",
    expectRefusal: true,
    query: `type=line&data=12,19,27&labels=A,B,C&names=MRR&title=Half a parameter&note=Pricing changed here` },

  { group: "Edges", name: "single-point", why: "One point has no peak, no bottom and no trend.",
    query: `type=bar&data=50&labels=Only&title=Single point` },
  { group: "Edges", name: "no-title", why: "No title supplied.",
    query: `type=bar&data=12,19,27&labels=A,B,C` },
  { group: "Edges", name: "huge-vs-tiny", why: "A value of 2 beside 10 million. It used to be labelled '0M'.",
    query: `type=bar&data=10000000,2,5000000,7500000&labels=A,B,C,D&title=Mixed magnitudes` },
  { group: "Edges", name: "everything-at-once", why: "Prefix, suffix, focus and a note together.",
    query: `type=line&data=12,19,27,22,31,38&labels=${MONTHS}&names=MRR&title=Everything at once&prefix=$&focus=3&note=${encodeURIComponent("Pricing changed here")}&noteAt=3` },
];

export function parseArgs(argv, env = {}) {
  let baseUrl = env.APP_URL ?? DEFAULT_BASE_URL;
  let out = DEFAULT_OUT;
  for (const arg of argv) {
    if (arg.startsWith("--out=")) out = arg.slice(6);
    else if (arg === "--help" || arg === "-h") return { help: true };
    else if (arg.startsWith("http://") || arg.startsWith("https://")) baseUrl = arg;
    else return { error: `Unrecognised argument "${arg}".` };
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), out };
}

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function contactSheet(results, baseUrl, generatedAt) {
  const groups = [];
  for (const result of results) {
    let group = groups.find((g) => g.name === result.group);
    if (!group) { group = { name: result.group, items: [] }; groups.push(group); }
    group.items.push(result);
  }
  const failures = results.filter((r) => !r.ok);
  const body = groups.map((group) => `
    <section>
      <h2>${escapeHtml(group.name)}</h2>
      <div class="grid">
        ${group.items.map((item) => `
          <figure class="${item.ok ? "" : "bad"}">
            ${item.ok
              ? `<img src="${escapeHtml(item.file)}" alt="${escapeHtml(item.why)}" loading="lazy">`
              : `<div class="failed">Did not render — HTTP ${escapeHtml(item.status ?? "error")}${item.error ? `<br><small>${escapeHtml(item.error)}</small>` : ""}</div>`}
            <figcaption><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.why)}</span></figcaption>
          </figure>`).join("")}
      </div>
    </section>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ChartRelay baseline set</title>
<style>
  :root { --ink:#16161a; --muted:#6b6b76; --line:#e6e6ea; --bg:#fbfbfd; --card:#fff; --bad:#c0392b; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ink:#f2f2f5; --muted:#a0a0ad; --line:#2a2a32; --bg:#101014; --card:#18181f; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  header { padding:36px 16px 20px; max-width:1200px; margin:0 auto; }
  h1 { margin:0 0 6px; font-size:26px; letter-spacing:-.01em; }
  .sub { color:var(--muted); font-size:14px; }
  .how { max-width:1200px; margin:0 auto 8px; padding:16px; }
  .how ol { margin:8px 0 0; padding-left:20px; color:var(--muted); font-size:14px; }
  main { max-width:1200px; margin:0 auto; padding:0 16px 64px; }
  section { margin-top:36px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); border-bottom:1px solid var(--line); padding-bottom:8px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(340px,1fr)); gap:18px; margin-top:16px; }
  figure { margin:0; background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  figure.bad { border-color:var(--bad); }
  img { display:block; width:100%; height:auto; background:#fff; }
  .failed { padding:48px 16px; text-align:center; color:var(--bad); font-weight:600; }
  figcaption { padding:12px 14px; border-top:1px solid var(--line); font-size:13px; }
  figcaption strong { display:block; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:12px; }
  figcaption span { color:var(--muted); }
  .alert { background:#fdecea; color:#7b241c; border-radius:12px; padding:14px 16px; margin-top:12px; font-size:14px; }
</style>
</head>
<body>
<header>
  <h1>ChartRelay baseline set</h1>
  <p class="sub">${results.length} charts rendered from ${escapeHtml(baseUrl)} on ${escapeHtml(generatedAt)}.</p>
  ${failures.length ? `<div class="alert"><strong>${failures.length} chart${failures.length === 1 ? "" : "s"} did not render.</strong> Those are marked in red below and must be fixed before anything here is approved.</div>` : ""}
</header>
<div class="how">
  <strong>What you are being asked to do</strong>
  <ol>
    <li>Scroll through. You are not checking that these are beautiful — you are checking that nothing is <em>wrong</em>: no clipped text, no overlapping labels, nothing unreadable, no number that contradicts the bar beside it.</li>
    <li>Each caption says what this image is testing and what used to be broken about it.</li>
    <li>If everything looks right, say so — these become the frozen baselines and any future change that alters them fails the build.</li>
    <li>If anything looks wrong, name the file. It gets fixed before it is frozen.</li>
  </ol>
</div>
<main>${body}</main>
</body>
</html>`;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv, env);
  if (args.error) { console.error(args.error); return 1; }
  if (args.help) { console.log("Usage: node scripts/golden-set.mjs [https://target] [--out=reports/baseline]"); return 0; }

  fs.mkdirSync(args.out, { recursive: true });
  const results = [];
  console.log(`Rendering ${CASES.length} charts from ${args.baseUrl} …`);
  for (const testCase of CASES) {
    const file = `${testCase.name}.png`;
    const url = `${args.baseUrl}/chart?${testCase.query}&format=png`;
    try {
      const response = await fetch(url);
      // A refusal is a drawn card with a 4xx status, so for those cases the status is what we wanted
      // and the body is still the image to look at.
      const refusedAsExpected = testCase.expectRefusal && response.status >= 400 && response.status < 500;
      if (!response.ok && !refusedAsExpected) {
        results.push({ ...testCase, ok: false, status: response.status, error: response.headers.get("x-chartrelay-error") ?? undefined });
        console.log(`  ${testCase.name}: HTTP ${response.status}${response.headers.get("x-chartrelay-error") ? ` — ${response.headers.get("x-chartrelay-error")}` : ""}`);
      } else if (testCase.expectRefusal && response.ok) {
        // A refusal case that succeeded means the guard it exercises has gone.
        results.push({ ...testCase, ok: false, status: "200 (expected a refusal)" });
        console.log(`  ${testCase.name}: rendered a chart where a refusal was expected`);
      } else {
        const bytes = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(path.join(args.out, file), bytes);
        results.push({ ...testCase, ok: true, file, bytes: bytes.length });
        console.log(`  ${testCase.name}: ${(bytes.length / 1024).toFixed(0)} KB${refusedAsExpected ? ` (refusal card, HTTP ${response.status} — correct)` : ""}`);
      }
    } catch (error) {
      results.push({ ...testCase, ok: false, status: error instanceof Error ? error.message : "failed" });
      console.log(`  ${testCase.name}: ${error instanceof Error ? error.message : "failed"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, PACE_MS));
  }

  const sheetPath = path.join(args.out, "index.html");
  fs.writeFileSync(sheetPath, contactSheet(results, args.baseUrl, new Date().toISOString().slice(0, 16).replace("T", " ")));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nContact sheet: ${path.resolve(sheetPath)}`);
  if (failed) console.log(`${failed} chart(s) did not render — they are marked in the sheet.`);
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then((code) => process.exit(code));
}

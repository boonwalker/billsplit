// Turns the demo build (dist-demo) into a page for claude.ai Artifacts:
// the stylesheet is inlined with its fonts as data URIs (the artifact frame only
// loads fonts that way), the scripts stay separate files next to the page.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist-demo");
const html = await readFile(path.join(dist, "index.html"), "utf8");

const cssHref = html.match(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"/)?.[1];
const jsSrc = html.match(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"/)?.[1];
if (!cssHref || !jsSrc) throw new Error("Could not find the built CSS/JS in dist-demo/index.html");

let css = await readFile(path.join(dist, cssHref), "utf8");
const fontTypes = { ".woff2": "font/woff2", ".woff": "font/woff" };
const urls = [...new Set([...css.matchAll(/url\(([^)]+\.(?:woff2?))\)/g)].map((m) => m[1]))];
for (const url of urls) {
  const file = path.join(dist, path.dirname(cssHref), url.replace(/^["']|["']$/g, ""));
  const data = (await readFile(file)).toString("base64");
  css = css.split(`url(${url})`).join(`url(data:${fontTypes[path.extname(file)]};base64,${data})`);
}

const page = `<title>billsplit</title>
<style>
${css}
</style>
<div id="root"></div>
<script type="module" src="${jsSrc}"></script>
`;
await writeFile(path.join(dist, "artifact.html"), page);

const scripts = (await readdir(path.join(dist, "assets"))).filter((f) => f.endsWith(".js"));
console.log(`artifact.html geschrieben (${(page.length / 1024).toFixed(0)} KB), Skripte: ${scripts.join(", ")}`);

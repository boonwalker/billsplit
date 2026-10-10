import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3272", DATA_DIR: SP + "/data-apidbg" }, stdio: "inherit" });
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:3272${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const ME = "mekey-1234567890abcdefghij", KATIA = "katiakey-1234567890abcdefg";
const kino = (await call("/api/bills", KATIA, "POST", { name: "Katia", data: { title: "Kino", date: "", currency: "EUR", items: [{ id: "c", name: "Popcorn", qty: 1, total: 300 }], tipPercent: 0, payment: {} } })).id;
await call(`/api/bills/${kino}/join`, ME, "POST", { name: "Niklas" }); await call(`/api/bills/${kino}/claims`, ME, "PUT", { claims: { c: [0] } });
const net = await call("/api/network", ME, "GET");
console.log("edges", JSON.stringify(net.edges.map((e) => [e.debtorId, e.creditorId, e.amount])));
const e = net.edges[0];
const r = await call("/api/transfers", ME, "POST", { toId: e.creditorId, amount: 300, currency: "EUR", allocations: [{ billId: kino, debtorId: e.debtorId, creditorId: e.creditorId, amount: 300 }] });
console.log("post ->", JSON.stringify(r.transfers.map((t) => t.id)));
console.log("list katia ->", JSON.stringify((await call("/api/transfers", KATIA, "GET")).transfers.map((t) => t.id)));
srv.kill();

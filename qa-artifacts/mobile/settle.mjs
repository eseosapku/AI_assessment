import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SHOTS = path.join(__dirname, "screenshots");

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("ws")));
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  });
  return {
    ws, ready,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("timeout " + method)); }, 15000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function withChrome(tag, run) {
  const port = 9600 + Math.floor(Math.random() * 300);
  const dataDir = path.join(__dirname, "profiles", `${Date.now()}-${tag}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`, "--remote-allow-origins=*",
    `--user-data-dir=${dataDir}`, "about:blank",
  ], { stdio: "ignore" });
  try {
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      try {
        const list = await getJson(`http://127.0.0.1:${port}/json/list`);
        target = list.find((item) => item.type === "page");
      } catch {}
      if (!target) await sleep(250);
    }
    if (!target) throw new Error("no page");
    const client = connect(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await run(client);
    client.ws.close();
  } finally {
    spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
    await sleep(300);
  }
}

async function ev(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 300));
  return result.result.value;
}

async function openPage(client, url, w, h) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: w, height: h, deviceScaleFactor: 1, mobile: false, screenWidth: w, screenHeight: h,
  });
  await client.send("Page.navigate", { url });
  const ready = await ev(client, `new Promise((resolve) => {
    const start = Date.now();
    const chain = (el) => {
      let opacity = 1;
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity) || 0;
      }
      return opacity;
    };
    const tick = () => {
      const heading = [...document.querySelectorAll("h1")].find((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 20 && rect.height > 10 && style.display !== "none" && style.visibility !== "hidden";
      });
      const opacity = heading ? chain(heading) : 0;
      const text = heading ? heading.innerText.replace(/\\s+/g, " ").trim().slice(0, 80) : "";
      if (text && opacity > 0.95 && Date.now() - start > 700) return resolve(text + " opacity=" + opacity.toFixed(2));
      if (Date.now() - start > 10000) return resolve("TIMEOUT " + text + " opacity=" + opacity.toFixed(2));
      setTimeout(tick, 150);
    };
    tick();
  })`);
  await sleep(600);
  return ready;
}

async function shot(client, name) {
  const image = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const bytes = Buffer.from(image.data, "base64");
  fs.writeFileSync(path.join(SHOTS, name), bytes);
  console.log(name, bytes.readUInt32BE(16) + "x" + bytes.readUInt32BE(20));
}

const pages = [
  ["signup-390x844.png", "http://localhost:3000/signup", 390, 844],
  ["signup-768x1024.png", "http://localhost:3000/signup", 768, 1024],
  ["forgot-password-390x844.png", "http://localhost:3000/forgot-password", 390, 844],
  ["forgot-password-768x1024.png", "http://localhost:3000/forgot-password", 768, 1024],
];

for (const [name, url, w, h] of pages) {
  await withChrome(name, async (client) => {
    const ready = await openPage(client, url, w, h);
    console.log("ready", name, ready);
    await shot(client, name);
  });
}

await withChrome("modal", async (client) => {
  await openPage(client, "http://localhost:3000/", 390, 844);
  const info = await ev(client, `new Promise((resolve) => {
    const button = [...document.querySelectorAll("button")].find((el) => /^Get started$/i.test((el.innerText || "").replace(/\\s+/g, " ").trim()));
    button.click();
    const start = Date.now();
    const tick = () => {
      const dialog = document.querySelector("[role='dialog']");
      const signIn = dialog && [...dialog.querySelectorAll("a, button")].find((el) => /^Sign in$/i.test((el.innerText || "").trim()));
      if (signIn) {
        signIn.scrollIntoView({ block: "center" });
        const r = signIn.getBoundingClientRect();
        const close = dialog.querySelector("button[aria-label='Close']");
        const cr = close ? close.getBoundingClientRect() : null;
        return resolve({
          tag: signIn.tagName,
          type: signIn.getAttribute("type"),
          href: signIn.getAttribute("href"),
          text: signIn.innerText.trim(),
          x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          close: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
        });
      }
      if (Date.now() - start > 5000) return resolve({ error: "no sign in in dialog", hasDialog: Boolean(dialog) });
      setTimeout(tick, 100);
    };
    tick();
  })`);
  await sleep(400);
  console.log("modal", JSON.stringify(info));
  await shot(client, "home-390x844-modal-sign-in.png");
  const clip = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { x: 0, y: 600, width: 390, height: 244, scale: 1 },
  });
  fs.writeFileSync(path.join(SHOTS, "home-390x844-modal-sign-in-bottom.png"), Buffer.from(clip.data, "base64"));
});

await withChrome("signup-link", async (client) => {
  await openPage(client, "http://localhost:3000/signup", 390, 844);
  const info = await ev(client, `(() => {
    const link = [...document.querySelectorAll("a")].find((el) => /^Sign in$/i.test((el.innerText || "").trim()));
    if (!link) return { error: "missing" };
    link.scrollIntoView({ block: "center" });
    const r = link.getBoundingClientRect();
    return { href: link.getAttribute("href"), text: link.innerText.trim(), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  await sleep(300);
  console.log("signup-link", JSON.stringify(info));
  await shot(client, "signup-390x844-sign-in-link.png");
});

console.log("settle done");

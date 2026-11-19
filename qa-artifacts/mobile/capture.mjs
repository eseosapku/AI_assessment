import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = path.join(__dirname, "chrome-user-data-studysquare-mobile-qa");
const SHOTS = path.join(__dirname, "screenshots");
const PORT = 9337;

const pages = [
  { name: "home", url: "http://localhost:3000/" },
  { name: "signup", url: "http://localhost:3000/signup" },
  { name: "forgot-password", url: "http://localhost:3000/forgot-password" },
  { name: "pricing", url: "http://localhost:3000/#pricing" },
];

const viewports = [
  { w: 390, h: 844, label: "390x844" },
  { w: 768, h: 1024, label: "768x1024" },
];

fs.mkdirSync(SHOTS, { recursive: true });
fs.rmSync(USER_DATA, { recursive: true, force: true });
fs.mkdirSync(USER_DATA, { recursive: true });

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Bad JSON from ${url}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(4000, () => {
      req.destroy(new Error(`Timeout ${url}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const stderrPath = path.join(__dirname, "chrome-stderr.log");
const stderr = fs.createWriteStream(stderrPath);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-features=PasswordManagerOnboarding,Translate,OptimizationHints",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=390,844",
    `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${USER_DATA}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
chrome.stderr.pipe(stderr);

let pageWs = null;

async function waitForPage() {
  const deadline = Date.now() + 20000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      const page = list.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error("Chrome DevTools endpoint did not come up");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("WebSocket failed")));
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method) {
      for (const listener of listeners.get(message.method) || []) {
        listener(message.params);
      }
    }
  });

  function send(method, params = {}, sessionId) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });
  }

  function on(method, listener) {
    const list = listeners.get(method) || [];
    list.push(listener);
    listeners.set(method, list);
  }

  return { ws, ready, send, on };
}

const LAYOUT_EXPRESSION = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const body = document.body;
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "").replace(/\\s+/g, " ").trim().slice(0, 120);
    return {
      tag: el.tagName,
      text,
      href: el.getAttribute("href"),
      type: el.getAttribute("type"),
      id: el.id || "",
      className: String(el.className || "").slice(0, 240),
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      position: cs.position,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      inViewport: r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05,
    };
  };

  const controls = [...document.querySelectorAll("a, button, input, [role='button']")].map(describe);
  const header = document.querySelector("header");
  const headerControls = header ? [...header.querySelectorAll("a, button, [role='button']")].map(describe) : [];
  const images = [...document.querySelectorAll("img")].map((img) => {
    const r = img.getBoundingClientRect();
    return {
      alt: img.alt || "",
      src: (img.currentSrc || img.getAttribute("src") || "").slice(0, 180),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      broken: img.complete && img.naturalWidth === 0 && r.width > 0,
    };
  });

  const overflowers = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.right > vw + 1) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const text = (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 80);
      overflowers.push({
        tag: el.tagName,
        id: el.id || "",
        className: String(el.className || "").slice(0, 160),
        text,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        right: Math.round(r.right),
      });
    }
  }
  overflowers.sort((a, b) => b.right - a.right);
  const trimmedOverflow = [];
  for (const item of overflowers) {
    if (trimmedOverflow.some((kept) => kept.className === item.className && Math.abs(kept.y - item.y) < 4 && Math.abs(kept.right - item.right) < 4)) continue;
    trimmedOverflow.push(item);
    if (trimmedOverflow.length >= 25) break;
  }

  const headings = [...document.querySelectorAll("h1, h2, h3")].slice(0, 20).map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, text: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 100), y: Math.round(r.y), x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width) };
  });

  return {
    href: location.href,
    title: document.title,
    innerWidth: vw,
    innerHeight: vh,
    scrollWidth: Math.max(doc.scrollWidth, body ? body.scrollWidth : 0),
    clientWidth: doc.clientWidth,
    scrollHeight: Math.max(doc.scrollHeight, body ? body.scrollHeight : 0),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    headerText: header ? header.innerText.replace(/\\s+/g, " ").trim().slice(0, 400) : null,
    headerBox: header ? describe(header) : null,
    headerControls,
    controls,
    images,
    overflowers: trimmedOverflow,
    headings,
  };
})()`;

async function main() {
  const target = await waitForPage();
  const client = connect(target.webSocketDebuggerUrl);
  pageWs = client.ws;
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setScrollbarsHidden", { hidden: true }).catch(() => {});

  const results = [];

  function urlsMatch(actual, expected) {
    if (expected === "about:blank") return actual === "about:blank";
    const a = new URL(actual);
    const b = new URL(expected);
    return a.origin === b.origin && a.pathname === b.pathname && a.search === b.search && a.hash === b.hash;
  }

  async function go(url) {
    const nav = await client.send("Page.navigate", { url });
    if (nav.errorText) throw new Error(`${url}: ${nav.errorText}`);
    const started = Date.now();
    const deadline = started + 15000;
    let last = "";
    while (Date.now() < deadline) {
      await sleep(200);
      try {
        const read = await client.send("Runtime.evaluate", {
          expression: "document.readyState + '\\n' + location.href",
          returnByValue: true,
        });
        last = read.result?.value || "";
        const [ready, href] = last.split("\n");
        const matched = href && urlsMatch(href, url);
        const settled = ready === "complete" || (ready === "interactive" && Date.now() - started > 2500);
        if (matched && settled) {
          return { status: ready, href };
        }
      } catch {
        // The page context is being replaced during navigation.
      }
    }
    throw new Error(`Timed out waiting for ${url}. Last state: ${last}`);
  }

  for (const viewport of viewports) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.w,
      height: viewport.h,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: viewport.w,
      screenHeight: viewport.h,
    });

    for (const page of pages) {
      const settled = await go(page.url);
      console.log(`settled ${page.name} ${viewport.label} -> ${settled.status} ${settled.href}`);
      await client.send("Runtime.evaluate", {
        expression: `Promise.race([
          (document.fonts && document.fonts.ready) || Promise.resolve(),
          new Promise((resolve) => setTimeout(resolve, 4000))
        ]).then(() => new Promise((resolve) => setTimeout(resolve, 1500)))`,
        awaitPromise: true,
      });

      const shot = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: viewport.w, height: viewport.h, scale: 1 },
      });
      const file = path.join(SHOTS, `${page.name}-${viewport.label}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));

      const metrics = await client.send("Runtime.evaluate", {
        expression: LAYOUT_EXPRESSION,
        returnByValue: true,
      });

      results.push({
        page: page.name,
        requestedUrl: page.url,
        viewport: viewport.label,
        screenshot: file,
        pngBytes: fs.statSync(file).size,
        layout: metrics.result.value,
      });
      console.log(`saved ${page.name} ${viewport.label} ${metrics.result.value.innerWidth}x${metrics.result.value.innerHeight} scrollW=${metrics.result.value.scrollWidth} href=${metrics.result.value.href}`);

      if (page.name === "home" && viewport.label === "390x844") {
        const clicked = await client.send("Runtime.evaluate", {
          expression: `(() => {
            const button = [...document.querySelectorAll("button")].find((el) => /^get started$/i.test((el.innerText || "").trim()) && el.getBoundingClientRect().top < 80 && el.getBoundingClientRect().width > 0);
            if (!button) return "not-found";
            button.click();
            return "clicked";
          })()`,
          returnByValue: true,
        });
        await client.send("Runtime.evaluate", {
          expression: `new Promise((resolve) => {
            const start = Date.now();
            const tick = () => {
              const text = document.body.innerText || "";
              if (/create account/i.test(text) && /already have an account/i.test(text)) return resolve("modal");
              if (Date.now() - start > 4000) return resolve("timeout");
              setTimeout(tick, 100);
            };
            tick();
          })`,
          awaitPromise: true,
          returnByValue: true,
        });
        const modalShot = await client.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false,
          clip: { x: 0, y: 0, width: viewport.w, height: viewport.h, scale: 1 },
        });
        const modalFile = path.join(SHOTS, "home-390x844-get-started-modal.png");
        fs.writeFileSync(modalFile, Buffer.from(modalShot.data, "base64"));
        const modalText = await client.send("Runtime.evaluate", {
          expression: `(() => {
            const dialog = document.querySelector("[role='dialog']") || document.body;
            const links = [...dialog.querySelectorAll("a, button")].map((el) => ({
              tag: el.tagName,
              text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 80),
              href: el.getAttribute("href"),
              type: el.getAttribute("type"),
            }));
            return { click: ${JSON.stringify(clicked.result?.value || null)}, text: (dialog.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 900), links };
          })()`,
          returnByValue: true,
        });
        results.push({
          page: "home-get-started-modal",
          requestedUrl: page.url,
          viewport: viewport.label,
          screenshot: modalFile,
          pngBytes: fs.statSync(modalFile).size,
          layout: modalText.result.value,
        });
        console.log(`saved get-started modal click=${clicked.result?.value}`);
      }
    }
  }

  const outPath = path.join(__dirname, "layout-metrics.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`metrics ${outPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  try {
    pageWs?.close();
  } catch {}
  try {
    spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
  } catch {}
  await sleep(800);
  try {
    chrome.kill();
  } catch {}
  stderr.end();
  process.exit(process.exitCode || 0);
}

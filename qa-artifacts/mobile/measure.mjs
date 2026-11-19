import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = path.join(__dirname, "chrome-user-data-studysquare-mobile-qa");
const SHOTS = path.join(__dirname, "screenshots");
const PORT = 9341;
const SUMMARY = path.join(__dirname, "layout-summary.json");

fs.mkdirSync(SHOTS, { recursive: true });

const jobs = [
  ["home", "http://localhost:3000/", 390, 844],
  ["signup", "http://localhost:3000/signup", 390, 844],
  ["forgot-password", "http://localhost:3000/forgot-password", 390, 844],
  ["pricing", "http://localhost:3000/#pricing", 390, 844],
  ["home", "http://localhost:3000/", 768, 1024],
  ["signup", "http://localhost:3000/signup", 768, 1024],
  ["forgot-password", "http://localhost:3000/forgot-password", 768, 1024],
  ["pricing", "http://localhost:3000/#pricing", 768, 1024],
];

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    req.setTimeout(3000, () => req.destroy(new Error("timeout")));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("WebSocket failed")));
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  });
  return {
    ws,
    ready,
    send(method, params = {}, timeout = 15000) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("CDP timeout " + method));
        }, timeout);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

const SNAP = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const shown = cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.width > 0 && r.height > 0;
    return {
      tag: el.tagName,
      text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 90),
      href: el.getAttribute("href"),
      display: cs.display,
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
      shown,
      inViewport: shown && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw,
    };
  };
  const overlap = (a, b) => {
    const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
    const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
    return x > 1 && y > 1 ? { x: Math.round(x), y: Math.round(y) } : null;
  };
  const header = document.querySelector("header");
  const headerNodes = header ? [...header.querySelectorAll("a, button")].map(box) : [];
  const logo = headerNodes[0] || null;
  const headerOverlaps = logo ? headerNodes.slice(1).flatMap((node) => {
    const hit = overlap(logo, node);
    return hit ? [{ text: node.text, hit, x: node.x, right: node.right }] : [];
  }) : [];
  const gaps = [];
  const visibleHeader = headerNodes.filter((node) => node.inViewport).sort((a, b) => a.x - b.x);
  for (let i = 1; i < visibleHeader.length; i += 1) {
    gaps.push({ left: visibleHeader[i - 1].text, right: visibleHeader[i].text, gap: visibleHeader[i].x - visibleHeader[i - 1].right });
  }
  const buttons = [...document.querySelectorAll("button")].map(box).filter((node) => node.inViewport);
  const signIn = [...document.querySelectorAll("a, button")].filter((el) => /sign in/i.test((el.innerText || "") + " " + (el.getAttribute("aria-label") || ""))).map(box);
  const pricing = document.getElementById("pricing");
  return {
    href: location.href,
    innerWidth: vw,
    innerHeight: vh,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollY: Math.round(window.scrollY),
    headerText: header ? header.innerText.replace(/\\s+/g, " ").trim().slice(0, 240) : null,
    headerNodes,
    headerOverlaps,
    gaps,
    pastRight: headerNodes.filter((node) => node.shown && node.right > vw + 1).map((node) => ({ text: node.text, right: node.right, w: node.w })),
    shortButtons: buttons.filter((node) => node.h < 40).map((node) => ({ text: node.text, x: node.x, y: node.y, w: node.w, h: node.h })),
    visibleButtons: buttons.map((node) => ({ text: node.text, x: node.x, y: node.y, w: node.w, h: node.h })),
    signIn,
    pricingTop: pricing ? Math.round(pricing.getBoundingClientRect().top) : null,
  };
})()`;

async function withChrome(run, tag) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const dataDir = path.join(__dirname, "profiles", `${Date.now()}-${tag}`);
  fs.mkdirSync(dataDir, { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--disable-background-networking",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${port}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${dataDir}`,
    "about:blank",
  ], { stdio: "ignore" });
  try {
    let target = null;
    const deadline = Date.now() + 20000;
    while (!target && Date.now() < deadline) {
      try {
        const list = await getJson(`http://127.0.0.1:${port}/json/list`);
        target = list.find((item) => item.type === "page");
      } catch {}
      if (!target) await sleep(200);
    }
    if (!target) throw new Error("no debugging page");
    const client = connect(target.webSocketDebuggerUrl);
    await client.ready;
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await run(client);
    client.ws.close();
  } finally {
    spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
    await sleep(400);
  }
}

async function evalValue(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400));
  return result.result.value;
}

async function go(client, url) {
  await client.send("Page.navigate", { url });
  const started = Date.now();
  let last = "";
  while (Date.now() - started < 12000) {
    await sleep(200);
    try {
      last = await evalValue(client, "document.readyState + '\\n' + location.href");
      const [ready, href] = String(last).split("\n");
      const actual = new URL(href);
      const expected = new URL(url);
      const matched = actual.origin === expected.origin && actual.pathname === expected.pathname && actual.hash === expected.hash;
      if (matched && (ready === "complete" || Date.now() - started > 2000)) return href;
    } catch {}
  }
  throw new Error("navigation timeout " + last);
}

const report = [];

for (const [name, url, w, h] of jobs) {
  const label = `${w}x${h}`;
  console.log(`start ${name} ${label}`);
  try {
    await withChrome(async (client) => {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: w, height: h, deviceScaleFactor: 1, mobile: false, screenWidth: w, screenHeight: h,
      });
      const href = await go(client, url);
      const readyText = await evalValue(client, `new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          const body = ((document.body && document.body.innerText) || "").replace(/\\s+/g, " ").trim();
          if (/Get started|Create your account|Forgot password\\?|Send verification code/i.test(body)) return resolve(body.slice(0, 80));
          if (Date.now() - start > 12000) return resolve("TIMEOUT " + body.slice(0, 80));
          setTimeout(tick, 200);
        };
        tick();
      })`);
      if (String(readyText).startsWith("TIMEOUT")) throw new Error(readyText);
      if (name === "pricing") await sleep(2500);
      const layout = await evalValue(client, SNAP);
      const image = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      const bytes = Buffer.from(image.data, "base64");
      const file = path.join(SHOTS, `${name}-${label}.png`);
      fs.writeFileSync(file, bytes);
      const entry = {
        name, url, viewport: label, href,
        png: `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`,
        layout,
      };
      report.push(entry);
      fs.writeFileSync(SUMMARY, JSON.stringify(report, null, 2));
      console.log(JSON.stringify({
        name, label, png: entry.png, scrollY: layout.scrollY, scrollW: layout.scrollWidth,
        pricingTop: layout.pricingTop, overlaps: layout.headerOverlaps, gaps: layout.gaps,
        pastRight: layout.pastRight, shortButtons: layout.shortButtons,
        signIn: layout.signIn.map((item) => ({ text: item.text, shown: item.shown, inViewport: item.inViewport, display: item.display, x: item.x, y: item.y, w: item.w, h: item.h, href: item.href })),
        header: layout.headerNodes.map((item) => ({ text: item.text, shown: item.shown, x: item.x, right: item.right, w: item.w, h: item.h })),
      }));
    });
  } catch (error) {
    console.error(`FAILED ${name} ${label}: ${error.message}`);
    report.push({ name, url, viewport: label, error: error.message });
    fs.writeFileSync(SUMMARY, JSON.stringify(report, null, 2));
  }
}

await withChrome(async (client) => {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
  });
  await go(client, "http://localhost:3000/signup");
  await evalValue(client, `new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const body = document.body ? document.body.innerText : "";
      if (/Create your account/i.test(body) || Date.now() - start > 12000) resolve(true);
      else setTimeout(tick, 200);
    };
    tick();
  })`);
  const signupLinks = await evalValue(client, `(() => [...document.querySelectorAll("a, button")].filter((el) => /sign in/i.test(el.innerText || "")).map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { tag: el.tagName, text: (el.innerText || "").replace(/\\s+/g, " ").trim(), href: el.getAttribute("href"), display: cs.display, y: Math.round(r.y), h: Math.round(r.height), inViewport: r.top < innerHeight && r.bottom > 0 && r.height > 0 && cs.display !== "none" };
  }))()`);
  await go(client, "http://localhost:3000/");
  await evalValue(client, `new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const body = document.body ? document.body.innerText : "";
      if (/Get started/i.test(body) || Date.now() - start > 12000) resolve(true);
      else setTimeout(tick, 200);
    };
    tick();
  })`);
  const modal = await evalValue(client, `new Promise((resolve) => {
    const button = [...document.querySelectorAll("button")].find((el) => /^Get started$/i.test((el.innerText || "").replace(/\\s+/g, " ").trim()));
    if (!button) return resolve({ error: "no button" });
    button.click();
    const start = Date.now();
    const tick = () => {
      const nodes = [...document.querySelectorAll("a, button")].filter((el) => /^sign in$/i.test((el.innerText || "").replace(/\\s+/g, " ").trim()));
      if (nodes.length || Date.now() - start > 4000) {
        if (nodes[0]) nodes[0].scrollIntoView({ block: "center" });
        const dialog = document.querySelector("[role='dialog']");
        return resolve({
          found: nodes.map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, text: (el.innerText || "").replace(/\\s+/g, " ").trim(), href: el.getAttribute("href"), type: el.getAttribute("type"), y: Math.round(r.y), h: Math.round(r.height) };
          }),
          tail: dialog ? dialog.innerText.replace(/\\s+/g, " ").trim().slice(-180) : "",
        });
      }
      setTimeout(tick, 100);
    };
    tick();
  })`);
  await sleep(500);
  const image = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  fs.writeFileSync(path.join(SHOTS, "home-390x844-modal-sign-in.png"), Buffer.from(image.data, "base64"));
  const extra = { signupLinks, modal };
  report.push({ name: "sign-in-paths", viewport: "390x844", extra });
  fs.writeFileSync(SUMMARY, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(extra));
});

console.log("done");

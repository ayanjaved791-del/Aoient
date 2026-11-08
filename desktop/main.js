// Aoient desktop app: a secure window onto the Aoient web app.
//
// The app shows the live site, so features and fixes arrive without a new
// download. This shell adds what a browser tab can't: its own window and
// icon, a single running instance, the `aoient://` link for Google sign-in,
// an offline screen and (Windows/Linux) automatic updates of the shell itself.
"use strict";

const { app, BrowserWindow, Menu, shell, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const APP_URL = new URL(process.env.AOIENT_APP_URL || require("./package.json").aoient.appUrl);
const APP_ORIGIN = APP_URL.origin;
const START_PATH = "/organizations?source=desktop";
const PROTOCOL = "aoient";

/** @type {BrowserWindow | null} */
let win = null;
/** A deep link that arrived before the window existed (macOS cold start). */
let pendingDeepLink = null;

// ---- Single instance + deep links -------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

if (process.defaultApp && process.argv.length >= 2) {
  // `electron .` during development needs the script path to register.
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const deepLinkFrom = (argv) => argv.find((a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`));

app.on("second-instance", (_event, argv) => {
  const link = deepLinkFrom(argv);
  if (link) handleDeepLink(link);
  focusWindow();
});

// macOS delivers links through this event, possibly before `ready`.
app.on("open-url", (event, url) => {
  event.preventDefault();
  if (win) handleDeepLink(url);
  else pendingDeepLink = url;
});

/**
 * `aoient://auth/callback?code=…&next=/…` comes back from Google sign-in in
 * the system browser. The one-time code is finished inside the app window,
 * where the sign-in started, because only this window holds the secret that
 * matches it (PKCE). A code without that secret is useless, so a forged link
 * can't sign anyone in.
 */
function handleDeepLink(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== `${PROTOCOL}:`) return;
  const route = `${url.hostname}${url.pathname}`.replace(/\/+$/, "");
  if (route !== "auth/callback") return;

  const code = url.searchParams.get("code") || "";
  const next = url.searchParams.get("next") || "/organizations";
  if (!/^[A-Za-z0-9._~-]{8,512}$/.test(code)) return;
  // The server checks `next` again; this only keeps obvious junk out.
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/organizations";

  const target = new URL("/auth/callback", APP_ORIGIN);
  target.searchParams.set("code", code);
  target.searchParams.set("next", safeNext);
  focusWindow();
  win?.loadURL(target.toString());
}

function focusWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---- Window ---------------------------------------------------------------

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (Number.isFinite(s.width) && Number.isFinite(s.height)) return s;
  } catch {
    // First run or unreadable file: use defaults.
  }
  return { width: 1280, height: 820 };
}

function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    // Not worth interrupting the person over.
  }
}

const isAppUrl = (u) => {
  try {
    return new URL(u).origin === APP_ORIGIN;
  } catch {
    return false;
  }
};

/** Paddle's checkout may open its own windows (card checks); keep those in the app. */
const isPaymentUrl = (u) => {
  try {
    const host = new URL(u).hostname;
    return host === "paddle.com" || host.endsWith(".paddle.com");
  } catch {
    return false;
  }
};

const openOutside = (u) => {
  try {
    const p = new URL(u).protocol;
    if (p === "https:" || p === "http:" || p === "mailto:") shell.openExternal(u);
  } catch {
    // Ignore malformed links.
  }
};

function createWindow() {
  const state = loadState();
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 380,
    minHeight: 560,
    title: "Aoient",
    show: false,
    backgroundColor: "#ffffff",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win?.show());
  win.on("close", saveState);
  win.on("closed", () => {
    win = null;
  });

  const wc = win.webContents;

  // Only Aoient itself loads in the window. Everything else (Google sign-in,
  // help links, other sites) opens in the person's normal browser.
  wc.on("will-navigate", (event, url) => {
    if (isAppUrl(url) || url.startsWith("file:")) return;
    event.preventDefault();
    openOutside(url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (isPaymentUrl(url) || isAppUrl(url)) {
      return { action: "allow", overrideBrowserWindowOptions: { parent: win ?? undefined, autoHideMenuBar: true } };
    }
    openOutside(url);
    return { action: "deny" };
  });

  wc.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    // -3 is "aborted" (a navigation replaced by another), not a failure.
    if (!isMainFrame || code === -3 || !isAppUrl(url)) return;
    win?.loadFile(path.join(__dirname, "offline.html"), { query: { retry: url } });
  });

  win.loadURL(new URL(START_PATH, APP_ORIGIN).toString());

  const startLink = pendingDeepLink || deepLinkFrom(process.argv);
  pendingDeepLink = null;
  if (startLink) wc.once("did-finish-load", () => handleDeepLink(startLink));
}

// ---- Menu -----------------------------------------------------------------

function buildMenu() {
  const go = (p) => win?.loadURL(new URL(p, APP_ORIGIN).toString());
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        { label: "My workspaces", accelerator: "CmdOrCtrl+Shift+H", click: () => go("/organizations?all=1") },
        { label: "Account settings", accelerator: "CmdOrCtrl+,", click: () => go("/account") },
        { type: "separator" },
        { label: "Open in browser", click: () => win && openOutside(isAppUrl(win.webContents.getURL()) ? win.webContents.getURL() : APP_ORIGIN) },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Back", accelerator: process.platform === "darwin" ? "Cmd+[" : "Alt+Left", click: () => win?.webContents.navigationHistory.goBack() },
        { label: "Forward", accelerator: process.platform === "darwin" ? "Cmd+]" : "Alt+Right", click: () => win?.webContents.navigationHistory.goForward() },
        { role: "reload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        { label: "Questions and answers", click: () => openOutside(`${APP_ORIGIN}/faq`) },
        { label: "Security", click: () => openOutside(`${APP_ORIGIN}/security`) },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- Updates (the shell only; the app itself is always the live site) ------

function checkForUpdates() {
  // macOS only installs updates for apps signed with a paid Apple certificate,
  // so Mac users download new versions from the website instead.
  if (!app.isPackaged || process.platform === "darwin") return;
  if (process.platform === "linux" && !process.env.APPIMAGE) return; // .deb updates come from the website
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  } catch {
    // Updater unavailable: the app still works.
  }
}

// ---- Start ----------------------------------------------------------------

app.whenReady().then(() => {
  // Lets the website know it's in the desktop app (for Google sign-in), and
  // drops "Electron" from the browser name so sites treat it like Chrome.
  const ua = session.defaultSession
    .getUserAgent()
    .replace(/\s?Electron\/\S+/, "")
    .replace(new RegExp(`\\s?${app.getName()}/\\S+`, "i"), "");
  session.defaultSession.setUserAgent(`${ua} AoientDesktop/${app.getVersion()}`);

  // No camera, microphone, location or similar: the app doesn't use them.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === "clipboard-sanitized-write" || permission === "fullscreen");
  });

  buildMenu();
  createWindow();
  checkForUpdates();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else focusWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

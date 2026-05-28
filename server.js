const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4174);
const stateFile = path.join(root, ".runtime-state.json");

const bingoCandidates = [
  "增长", "客户", "协同", "创新", "AI", "全球化", "合规", "利润", "现金流", "品牌",
  "组织", "人才", "效率", "生态", "突破", "复盘", "交付", "质量", "体验", "长期主义",
  "战略", "风险", "数据", "产品", "文化", "冠军", "目标", "信任", "韧性", "未来"
];

const questionIds = [
  "sector-1-1", "sector-1-2", "sector-2-1", "sector-2-2", "sector-3-1", "sector-3-2",
  "sector-4-1", "sector-4-2", "sector-5-1", "sector-5-2",
  "panel-1", "panel-2", "panel-3", "panel-4", "panel-5", "panel-6",
  "survival-1", "survival-2", "survival-3", "survival-4", "survival-5"
];

const seedPlayers = [];

let version = Date.now();
let state = loadState();

function defaultUser(user) {
  return {
    ...user,
    roundId: user.roundId || "main",
    bingo: { selected: [], submitted: false },
    drafts: {},
    submissions: {},
    survivalAlive: true
  };
}

function defaultState() {
  return {
    users: [],
    admin: {
      roundId: "main",
      gameOpen: { bingo: true, sector: false, panel: false, survival: false },
      gameEnded: { bingo: false, sector: false, panel: false, survival: false },
      answersVisible: { sector: false, panel: false, survival: false },
      bingoDeadline: null,
      bingoRevealed: Object.fromEntries(bingoCandidates.map((word) => [word, false])),
      released: Object.fromEntries(questionIds.map((id) => [id, false]))
    }
  };
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return defaultState();
  }
}

function persistState() {
  version = Date.now();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function mergeUserState(incoming, userId) {
  if (!incoming?.users) return;
  const users = new Map(state.users.map((user) => [user.id, user]));
  incoming.users.forEach((user) => {
    if (!user?.id) return;
    if (user.id.startsWith("seed-")) return;
    if (!userId || user.id === userId || !users.has(user.id)) {
      users.set(user.id, user);
    }
  });
  state.users = [...users.values()];
}

function mergeAdminState(incoming) {
  if (!incoming?.admin) return;
  state.admin = incoming.admin;
  mergeUserState(incoming);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function serveFile(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, safePath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    }[ext] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/state" && request.method === "GET") {
    sendJson(response, 200, { state, version });
    return;
  }
  if (url.pathname === "/api/state" && request.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(request) || "{}");
      const role = url.searchParams.get("role");
      if (role === "admin") {
        mergeAdminState(payload.state);
      } else {
        mergeUserState(payload.state, payload.userId);
      }
      persistState();
      sendJson(response, 200, { ok: true, version });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }
  if (url.pathname === "/api/reset" && request.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(request) || "{}");
      state = payload.state || defaultState();
    } catch {
      state = defaultState();
    }
    persistState();
    sendJson(response, 200, { ok: true, version });
    return;
  }
  serveFile(response, decodeURIComponent(url.pathname));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`HongShan Cloud Interaction is running:`);
  console.log(`  Local:   http://127.0.0.1:${port}/`);
  console.log(`  STAFF:   http://127.0.0.1:${port}/?admin=1`);
  console.log(`  Screen:  http://127.0.0.1:${port}/?screen=1`);
});

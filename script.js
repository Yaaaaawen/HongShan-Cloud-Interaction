const STORE_KEY = "live-play-arena-state-v3";
const ME_KEY = "live-play-arena-current-user";
const SUPABASE_URL = "https://gqonejvsckzlbbubeoqy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CuI1xNMOAsBjEL02prrB0A_UlX31xsW";
const isAdminMode = new URLSearchParams(location.search).has("admin");
const isScreenMode = new URLSearchParams(location.search).has("screen");
const offices = ["北京", "上海/武汉", "香港/深圳/新加坡/东京/伦敦"];
const hasLocalSyncServer = location.protocol.startsWith("http") && !location.hostname.endsWith("github.io");
const apiStateUrl = hasLocalSyncServer ? "/api/state" : "";
const apiResetUrl = hasLocalSyncServer ? "/api/reset" : "";

const gameMeta = {
  bingo: { label: "Bingo", panel: "bingoPanel", order: 1 },
  sector: { label: "快问快答", panel: "sectorPanel", order: 2 },
  panel: { label: "真假判断", panel: "panelPanel", order: 3 },
  survival: { label: "知识问答", panel: "survivalPanel", order: 4 }
};

const bingoCandidates = [
  "增长", "客户", "协同", "创新", "AI", "全球化", "合规", "利润", "现金流", "品牌",
  "组织", "人才", "效率", "生态", "突破", "复盘", "交付", "质量", "体验", "长期主义",
  "战略", "风险", "数据", "产品", "文化", "冠军", "目标", "信任", "韧性", "未来"
];

const sectorQuestions = [
  q("sector-1-1", "Sector A", "今年 Sector A 的核心关键词是哪一个？", ["增长", "搬家", "休眠"], "增长", 20),
  q("sector-1-2", "Sector A", "Sector A 最关注的客户指标是？", ["留存", "天气", "座位号"], "留存", 20),
  q("sector-2-1", "Sector B", "跨部门协作优先看什么？", ["共同目标", "个人喜好", "随机抽签"], "共同目标", 20),
  q("sector-2-2", "Sector B", "复盘会议最应该产出什么？", ["行动项", "表情包", "新口号"], "行动项", 20),
  q("sector-3-1", "Sector C", "客户体验问题应优先记录在哪里？", ["统一工单", "私人聊天", "纸巾背面"], "统一工单", 20),
  q("sector-3-2", "Sector C", "数据看板的主要价值是？", ["辅助决策", "装饰屏幕", "制造焦虑"], "辅助决策", 20),
  q("sector-4-1", "Sector D", "合规要求的底线是？", ["真实准确", "差不多", "以后再补"], "真实准确", 20),
  q("sector-4-2", "Sector D", "风险预警应该什么时候提出？", ["尽早", "结束后", "没人问时"], "尽早", 20),
  q("sector-5-1", "Sector E", "团队学习最需要什么？", ["持续分享", "信息孤岛", "只靠记忆"], "持续分享", 20),
  q("sector-5-2", "Sector E", "年度目标拆解后要形成？", ["责任人和时间点", "神秘感", "无限延期"], "责任人和时间点", 20)
];

const panelQuestions = [
  q("panel-1", "第一组", "嘉宾 A 曾负责过跨区域项目。", ["真", "假"], "真", 15),
  q("panel-2", "第一组", "嘉宾 B 的第一份岗位是数据分析。", ["真", "假"], "真", 15),
  q("panel-3", "第一组", "嘉宾 C 从未带过项目团队。", ["真", "假"], "假", 15),
  q("panel-4", "第二组", "嘉宾 D 今年完成了关键流程优化。", ["真", "假"], "真", 15),
  q("panel-5", "第二组", "嘉宾 E 曾参与 Function Team 出题。", ["真", "假"], "真", 15),
  q("panel-6", "第二组", "嘉宾 F 的陈述里有一个时间点是假的。", ["真", "假"], "假", 15)
];

const survivalQuestions = [
  q("survival-1", "第 1 题", "公司价值观里最强调哪类行为？", ["主动负责", "被动等待", "只看短期"], "主动负责", 30),
  q("survival-2", "第 2 题", "Function Team 出题需要后台支持什么？", ["分批发布", "只能一次发完", "不能修改"], "分批发布", 30),
  q("survival-3", "第 3 题", "知识问答大逃杀的核心规则是？", ["单错淘汰", "错题倒扣", "无限复活"], "单错淘汰", 30),
  q("survival-4", "第 4 题", "排行榜更新应该尽量做到？", ["实时", "隔天", "手算"], "实时", 30),
  q("survival-5", "第 5 题", "退出后再次进入应恢复什么？", ["积分和状态", "空白账号", "仅姓名"], "积分和状态", 30)
];

const questionSets = { sector: sectorQuestions, panel: panelQuestions, survival: survivalQuestions };

const seedPlayers = [];

let metricMode = "score";
let backendOnline = false;
let lastServerVersion = 0;
let isPullingState = false;
let cloudClient = null;
let cloudReady = false;
let cloudPulling = false;
let cloudSignature = "";

let state = loadState();
let currentUserId = localStorage.getItem(ME_KEY);

function q(id, group, text, options, answer, points) {
  return { id, group, text, options, answer, points };
}

function defaultUser(user) {
  return {
    ...user,
    office: user.office || offices[0],
    baseScore: user.baseScore || 0,
    bingo: { selected: [], submitted: false },
    drafts: {},
    submissions: {},
    survivalAlive: true
  };
}

function isRealUser(user) {
  return user?.id && !user.id.startsWith("seed-");
}

function loadState() {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (saved) {
    saved.users = saved.users.filter(isRealUser).map(normalizeUser);
    saved.admin = normalizeAdmin(saved.admin);
    return saved;
  }
  return {
    users: seedPlayers.map(defaultUser),
    admin: normalizeAdmin()
  };
}

function normalizeState(nextState) {
  return {
    users: Array.isArray(nextState?.users) ? nextState.users.filter(isRealUser).map(normalizeUser) : [],
    admin: normalizeAdmin(nextState?.admin)
  };
}

function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    office: user.office || offices[0],
    baseScore: user.baseScore || 0,
    bingo: {
      selected: user.bingo?.selected || [],
      submitted: Boolean(user.bingo?.submitted || user.bingo?.locked)
    },
    drafts: user.drafts || {},
    submissions: user.submissions || {},
    survivalAlive: user.survivalAlive !== false
  };
}

function normalizeAdmin(admin = {}) {
  return {
    gameOpen: { bingo: true, sector: false, panel: false, survival: false, ...(admin.gameOpen || {}) },
    bingoRevealed: { ...Object.fromEntries(bingoCandidates.map((word) => [word, false])), ...(admin.bingoRevealed || {}) },
    released: {
      ...Object.fromEntries([...sectorQuestions, ...panelQuestions, ...survivalQuestions].map((item) => [item.id, false])),
      ...(admin.released || {})
    }
  };
}

function resetUserForNewRound(user) {
  return defaultUser({
    id: user.id,
    name: user.name,
    office: user.office || offices[0],
    baseScore: 0
  });
}

function resetRoundState() {
  const currentUsers = state.users.filter(isRealUser);
  state = {
    users: currentUsers.map(resetUserForNewRound),
    admin: normalizeAdmin()
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  saveState();
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  if (!isPullingState) pushState();
  if (!isPullingState && !cloudPulling) pushCloudState();
}

function getCurrentUser() {
  return state.users.find((user) => user.id === currentUserId);
}

function createUser(name, office) {
  const id = `user-${office}-${name.trim().toLowerCase()}`;
  let user = state.users.find((item) => item.id === id);
  if (!user) {
    user = defaultUser({ id, name: name.trim(), office });
    state.users.push(user);
  } else {
    user.name = name.trim();
    user.office = office;
  }
  currentUserId = id;
  localStorage.setItem(ME_KEY, id);
  saveState();
  render();
}

function getBingoScore(user) {
  if (!user.bingo.submitted) return 0;
  const hits = user.bingo.selected.filter((word) => state.admin.bingoRevealed[word]);
  return hits.length * 10 + (hits.length === 9 ? 10 : 0);
}

function getQuizScore(user, game) {
  const submitted = user.submissions[game];
  if (!submitted) return 0;
  const questions = questionSets[game];
  let score = 0;
  let alive = true;
  questions.forEach((question) => {
    const choice = submitted.answers?.[question.id];
    if (!choice) return;
    const correct = choice === question.answer;
    if (game === "survival") {
      if (alive && correct) score += question.points;
      if (!correct) alive = false;
      return;
    }
    if (correct) score += question.points;
  });
  if (game === "panel" && questions.every((question) => submitted.answers?.[question.id] === question.answer)) {
    score += 10;
  }
  return score;
}

function correctStats(user) {
  let correct = 0;
  let total = 0;
  if (user.bingo.submitted) {
    const revealed = user.bingo.selected.filter((word) => state.admin.bingoRevealed[word]).length;
    correct += revealed;
    total += revealed;
  }
  Object.entries(questionSets).forEach(([game, questions]) => {
    const answers = user.submissions[game]?.answers || {};
    questions.forEach((question) => {
      if (!answers[question.id]) return;
      total += 1;
      if (answers[question.id] === question.answer) correct += 1;
    });
  });
  return { correct, total, rate: total ? Math.round((correct / total) * 100) : 0 };
}

function totalScore(user) {
  return (user.baseScore || 0) + getBingoScore(user) + getQuizScore(user, "sector") + getQuizScore(user, "panel") + getQuizScore(user, "survival");
}

function rankUsers() {
  return [...state.users].sort((a, b) => totalScore(b) - totalScore(a) || a.name.localeCompare(b.name));
}

function userRank(userId) {
  return rankUsers().findIndex((user) => user.id === userId) + 1;
}

function isReleased(questionId) {
  return Boolean(state.admin.released[questionId]);
}

function visibleQuestions(game) {
  return questionSets[game].filter((question) => isReleased(question.id));
}

function isGameAvailable(game) {
  return Boolean(state.admin.gameOpen[game]);
}

function toggleBingoSelection(word) {
  const user = getCurrentUser();
  if (!user || user.bingo.submitted || !isGameAvailable("bingo")) return;
  const selected = user.bingo.selected;
  if (selected.includes(word)) {
    user.bingo.selected = selected.filter((item) => item !== word);
  } else if (selected.length < 9) {
    selected.push(word);
  }
  saveState();
  renderBingo();
}

function submitBingo() {
  const user = getCurrentUser();
  if (!user || user.bingo.selected.length !== 9) return;
  user.bingo.submitted = true;
  saveState();
  render();
}

function setDraftAnswer(game, questionId, choice) {
  const user = getCurrentUser();
  if (!user || user.submissions[game]?.answers?.[questionId]) return;
  user.drafts[questionId] = choice;
  saveState();
  renderQuiz(`${game}Quiz`.replace("panelQuiz", "panelQuestions"), game, questionSets[game]);
}

function submitGame(game) {
  const user = getCurrentUser();
  if (!user) return;
  const alreadySubmitted = user.submissions[game]?.answers || {};
  const questions = visibleQuestions(game).filter((question) => !alreadySubmitted[question.id]);
  if (!questions.length || questions.some((question) => !user.drafts[question.id])) return;
  user.submissions[game] = user.submissions[game] || { answers: {} };
  questions.forEach((question) => {
    user.submissions[game].answers[question.id] = user.drafts[question.id];
  });
  if (game === "survival") {
    user.survivalAlive = user.survivalAlive && questions.every((question) => user.drafts[question.id] === question.answer);
  }
  saveState();
  render();
}

function switchPanel(panelId) {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelId);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active-panel", panel.id === panelId);
  });
}

function render() {
  renderQr();
  renderMode();
  if (isScreenMode) {
    renderScreen();
    return;
  }
  if (isAdminMode) {
    renderAdmin();
    return;
  }
  const user = getCurrentUser();
  document.getElementById("loginView").hidden = Boolean(user);
  document.getElementById("gameView").hidden = !user;
  if (!user) return;
  renderHeader(user);
  renderNav();
  renderDashboard(user);
  renderBingo();
  renderQuiz("sectorQuiz", "sector", sectorQuestions);
  renderQuiz("panelQuestions", "panel", panelQuestions);
  renderQuiz("survivalQuiz", "survival", survivalQuestions);
}

function renderMode() {
  document.body.classList.toggle("admin-mode", isAdminMode);
  document.body.classList.toggle("screen-mode", isScreenMode);
  if (isScreenMode) {
    document.getElementById("loginView").hidden = true;
    document.getElementById("gameView").hidden = false;
    document.querySelector(".side-nav").hidden = true;
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active-panel"));
    document.getElementById("screenPanel").classList.add("active-panel");
    return;
  }
  if (isAdminMode) {
    document.getElementById("loginView").hidden = true;
    document.getElementById("gameView").hidden = false;
    document.querySelector(".side-nav").hidden = true;
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active-panel"));
    document.getElementById("adminPanel").classList.add("active-panel");
    document.getElementById("headerName").textContent = "STAFF 控制台";
    document.getElementById("headerRank").textContent = "单独入口";
  }
}

function renderHeader(user) {
  document.getElementById("headerName").textContent = user.name;
  document.getElementById("headerRank").textContent = `排名 ${userRank(user.id)}`;
}

function renderNav() {
  Object.entries(gameMeta).forEach(([game, meta]) => {
    const button = document.querySelector(`[data-panel="${meta.panel}"]`);
    button.hidden = !isGameAvailable(game);
  });
  const activeButton = document.querySelector(".nav-button.active:not([hidden])");
  if (!activeButton) {
    const firstOpen = Object.entries(gameMeta).find(([game]) => isGameAvailable(game));
    switchPanel(firstOpen ? firstOpen[1].panel : "dashboardPanel");
  }
}

function renderDashboard(user) {
  const stats = correctStats(user);
  document.getElementById("metricLabel").textContent = metricMode === "score" ? "已公布总分" : "正确率";
  document.getElementById("scoreCard").textContent = metricMode === "score" ? totalScore(user) : `${stats.rate}%`;
  document.getElementById("rankCard").textContent = userRank(user.id);
  document.getElementById("stageCard").textContent =
    Object.entries(gameMeta).filter(([game]) => isGameAvailable(game)).map(([, meta]) => meta.label).join(" / ") || "未开放";
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";
  rankUsers().forEach((item, index) => {
    list.append(leaderboardRow(item, index));
  });
}

function renderBingo() {
  const user = getCurrentUser();
  if (!user) return;
  const words = document.getElementById("bingoWords");
  const grid = document.getElementById("bingoGrid");
  const status = document.getElementById("bingoStatus");
  words.innerHTML = "";
  grid.innerHTML = "";

  bingoCandidates.forEach((word) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-pill";
    button.textContent = word;
    button.disabled = user.bingo.submitted || !isGameAvailable("bingo");
    button.classList.toggle("selected", user.bingo.selected.includes(word));
    button.addEventListener("click", () => toggleBingoSelection(word));
    words.append(button);
  });

  const lineIndexes = bingoLines(user);
  for (let index = 0; index < 9; index += 1) {
    const word = user.bingo.selected[index] || "待选择";
    const cell = document.createElement("div");
    cell.className = "bingo-cell";
    cell.classList.toggle("hit", Boolean(state.admin.bingoRevealed[word]));
    cell.classList.toggle("line", lineIndexes.has(index));
    cell.textContent = word;
    grid.append(cell);
  }

  const hitCount = user.bingo.selected.filter((word) => state.admin.bingoRevealed[word]).length;
  status.textContent = user.bingo.submitted ? `已提交，后台已发布 ${hitCount}/9` : `已选择 ${user.bingo.selected.length}/9`;
  document.getElementById("lockBingoButton").disabled =
    user.bingo.submitted || user.bingo.selected.length !== 9 || !isGameAvailable("bingo");
  document.getElementById("bingoResult").textContent = user.bingo.submitted
    ? `Bingo 已公布积分：${getBingoScore(user)}`
    : "提交后等待 STAFF 逐词发布积分";
}

function bingoLines(user) {
  const cells = user.bingo.selected;
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  return new Set(lines.filter((line) => line.every((index) => state.admin.bingoRevealed[cells[index]])).flat());
}

function renderQuiz(containerId, game, questions) {
  const user = getCurrentUser();
  if (!user) return;
  const container = document.getElementById(containerId);
  const releasedQuestions = questions.filter((question) => isReleased(question.id));
  const submitted = user.submissions[game];
  container.innerHTML = "";
  if (!isGameAvailable(game)) {
    container.append(note("本阶段尚未开放"));
  } else if (!releasedQuestions.length) {
    container.append(note("等待主持人放题"));
  }

  releasedQuestions.forEach((question) => {
    const questionSubmitted = Boolean(submitted?.answers?.[question.id]);
    const choice = submitted?.answers?.[question.id] || user.drafts[question.id];
    const card = document.createElement("article");
    card.className = "question-card";
    card.classList.toggle("locked", game === "survival" && !user.survivalAlive && !questionSubmitted);
    card.innerHTML = `
      <div class="question-meta"><span>${question.group}</span><span>${question.points} 分</span></div>
      <p>${question.text}</p>
      <div class="answer-row"></div>
    `;
    const row = card.querySelector(".answer-row");
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer-button";
      button.textContent = option;
      button.disabled = questionSubmitted || !isGameAvailable(game) || (game === "survival" && !user.survivalAlive);
      button.classList.toggle("selected", choice === option && !questionSubmitted);
      if (questionSubmitted && choice === option) button.classList.add(option === question.answer ? "correct" : "incorrect");
      button.addEventListener("click", () => setDraftAnswer(game, question.id, option));
      row.append(button);
    });
    if (questionSubmitted) row.append(note("已提交"));
    if (!questionSubmitted && choice) row.append(note("已选择，可修改"));
    container.append(card);
  });
  renderSubmitState(game, releasedQuestions);
}

function renderSubmitState(game, questions) {
  const user = getCurrentUser();
  const button = document.getElementById(`submit${capitalize(game)}Button`);
  const result = document.getElementById(`${game}Result`);
  const submitted = user.submissions[game];
  const pendingQuestions = questions.filter((question) => !submitted?.answers?.[question.id]);
  const ready = pendingQuestions.length > 0 && pendingQuestions.every((question) => user.drafts[question.id]);
  button.disabled = !ready || !isGameAvailable(game) || (game === "survival" && !user.survivalAlive);
  const submittedCount = questions.length - pendingQuestions.length;
  result.textContent = submittedCount > 0
    ? `已提交 ${submittedCount}/${questions.length} 题，本环节得分：${getQuizScore(user, game)}`
    : ready
      ? "已选完，可提交"
      : "选择答案后可提交，提交前都能修改";
  if (game === "panel" && submittedCount === panelQuestions.length && getQuizScore(user, game) === 100) {
    result.textContent = "本环节得分：100（含全对奖励）";
  }
  if (game === "panel") {
    document.getElementById("panelPerfect").textContent =
      submittedCount === panelQuestions.length && getQuizScore(user, game) === 100
        ? "6 题全对，奖励已发放"
        : "全对有额外奖励";
  }
  if (game === "survival" && submittedCount > 0 && !user.survivalAlive) {
    result.textContent = `本环节得分：${getQuizScore(user, game)}，已淘汰`;
  }
  if (game === "survival") {
    document.getElementById("survivalStatus").textContent = user.survivalAlive ? "单错淘汰" : "已淘汰";
  }
}

function note(text) {
  const span = document.createElement("span");
  span.className = "status-pill";
  span.textContent = text;
  return span;
}

function renderAdmin() {
  const stageBox = document.getElementById("adminStageList");
  const wordBox = document.getElementById("adminBingoWords");
  const releaseBox = document.getElementById("adminReleaseList");
  stageBox.innerHTML = "";
  wordBox.innerHTML = "";
  releaseBox.innerHTML = "";

  Object.entries(gameMeta).forEach(([game, meta]) => {
    const row = document.createElement("div");
    row.className = "release-row stage-switch-row";
    row.innerHTML = `<span>${meta.order}. ${meta.label}</span>`;
    const label = document.createElement("label");
    label.className = "switch-control";
    label.innerHTML = `<small>不开放</small><input type="checkbox" ${state.admin.gameOpen[game] ? "checked" : ""} /><span></span><small>开放</small>`;
    label.querySelector("input").addEventListener("change", (event) => {
      state.admin.gameOpen[game] = event.target.checked;
      saveState();
      render();
    });
    row.append(label);
    stageBox.append(row);
  });

  bingoCandidates.forEach((word) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-pill";
    button.classList.toggle("correct", state.admin.bingoRevealed[word]);
    button.textContent = `${word} ${state.admin.bingoRevealed[word] ? "已发布" : "发布"}`;
    button.addEventListener("click", () => {
      state.admin.bingoRevealed[word] = !state.admin.bingoRevealed[word];
      saveState();
      render();
    });
    wordBox.append(button);
  });

  [...sectorQuestions, ...panelQuestions, ...survivalQuestions].forEach((question) => {
    const row = document.createElement("div");
    row.className = "release-row";
    row.innerHTML = `<span>${question.group} · ${question.text}</span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = isReleased(question.id) ? "已放行" : "放行";
    button.addEventListener("click", () => {
      state.admin.released[question.id] = !state.admin.released[question.id];
      saveState();
      render();
    });
    row.append(button);
    releaseBox.append(row);
  });
}

function renderQr() {
  const url = location.href.split("?")[0].split("#")[0];
  const joinUrl = url;
  document.getElementById("joinUrl").textContent = joinUrl;
  document.getElementById("qrImage").src =
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(joinUrl)}`;
}

function leaderboardRow(user, index) {
  const row = document.createElement("div");
  row.className = "rank-row";
  row.innerHTML = `<b>#${index + 1}</b><span>${user.name}</span><span class="office-text">${user.office}</span><strong>${totalScore(user)}</strong>`;
  return row;
}

function officeAverages() {
  return offices.map((office) => {
    const users = state.users.filter((user) => user.office === office);
    const average = users.length ? Math.round(users.reduce((sum, user) => sum + totalScore(user), 0) / users.length) : 0;
    return { office, average };
  });
}

function renderScreen() {
  const bars = document.getElementById("screenOfficeBars");
  const list = document.getElementById("screenLeaderboard");
  const updated = document.getElementById("screenUpdatedAt");
  bars.innerHTML = "";
  list.innerHTML = "";
  const averages = officeAverages();
  const maxAverage = Math.max(1, ...averages.map((item) => item.average));
  averages.forEach((item) => {
    const bar = document.createElement("div");
    bar.className = "office-bar";
    bar.innerHTML = `
      <div class="office-bar-head"><span>${item.office}</span><strong>${item.average}</strong></div>
      <div class="office-bar-track"><div class="office-bar-fill" style="width: ${(item.average / maxAverage) * 100}%"></div></div>
    `;
    bars.append(bar);
  });
  rankUsers().slice(0, 12).forEach((user, index) => list.append(leaderboardRow(user, index)));
  updated.textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

document.getElementById("joinForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createUser(document.getElementById("nameInput").value, document.getElementById("officeInput").value);
});

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => switchPanel(button.dataset.panel));
});

document.getElementById("lockBingoButton").addEventListener("click", submitBingo);
document.getElementById("submitSectorButton").addEventListener("click", () => submitGame("sector"));
document.getElementById("submitPanelButton").addEventListener("click", () => submitGame("panel"));
document.getElementById("submitSurvivalButton").addEventListener("click", () => submitGame("survival"));
document.getElementById("resetMeButton").addEventListener("click", () => {
  localStorage.removeItem(ME_KEY);
  currentUserId = null;
  render();
});
document.getElementById("resetAllButton").addEventListener("click", () => {
  document.getElementById("resetModal").hidden = false;
});
document.getElementById("cancelResetButton").addEventListener("click", () => {
  document.getElementById("resetModal").hidden = true;
});
document.getElementById("confirmResetButton").addEventListener("click", async () => {
  document.getElementById("resetModal").hidden = true;
  resetRoundState();
  switchPanel("dashboardPanel");
  await resetServerState();
  render();
});

document.getElementById("metricToggle").addEventListener("change", (event) => {
  metricMode = event.target.checked ? "accuracy" : "score";
  render();
});

window.addEventListener("storage", () => {
  state = loadState();
  currentUserId = localStorage.getItem(ME_KEY);
  render();
});

window.setInterval(() => {
  if (isScreenMode) renderScreen();
}, 3000);

window.setInterval(() => {
  pullState();
}, 1000);

async function pullState() {
  if (!apiStateUrl) return;
  try {
    const response = await fetch(apiStateUrl, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    backendOnline = true;
    if (!payload?.state || payload.version === lastServerVersion) return;
    lastServerVersion = payload.version || Date.now();
    isPullingState = true;
    state = normalizeState(payload.state);
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    isPullingState = false;
    render();
  } catch (error) {
    backendOnline = false;
  }
}

async function pushState() {
  if (!apiStateUrl || isScreenMode) return;
  try {
    const role = isAdminMode ? "admin" : "user";
    const response = await fetch(`${apiStateUrl}?role=${role}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, userId: currentUserId })
    });
    if (!response.ok) return;
    const payload = await response.json();
    backendOnline = true;
    lastServerVersion = payload.version || lastServerVersion;
  } catch (error) {
    backendOnline = false;
  }
}

async function resetServerState() {
  if (!apiResetUrl || !isAdminMode) return;
  try {
    await fetch(apiResetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state })
    });
  } catch (error) {
    backendOnline = false;
  }
}

function initCloudSync() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !window.supabase) return;
  cloudClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  cloudReady = true;
  pullCloudState();
  cloudClient
    .channel("hongshan-cloud-interaction")
    .on("postgres_changes", { event: "*", schema: "public", table: "hongshan_admin" }, pullCloudState)
    .on("postgres_changes", { event: "*", schema: "public", table: "hongshan_users" }, pullCloudState)
    .subscribe();
}

function stateSignature(nextState) {
  return JSON.stringify({
    admin: nextState.admin,
    users: nextState.users.map((user) => [user.id, user.office, user.bingo, user.submissions, user.survivalAlive, user.baseScore])
  });
}

async function pullCloudState() {
  if (!cloudReady || cloudPulling) return;
  cloudPulling = true;
  try {
    const [{ data: adminRows, error: adminError }, { data: userRows, error: usersError }] = await Promise.all([
      cloudClient.from("hongshan_admin").select("admin").eq("id", "main").limit(1),
      cloudClient.from("hongshan_users").select("id,payload")
    ]);
    if (adminError || usersError) throw adminError || usersError;
    const nextState = normalizeState({
      admin: adminRows?.[0]?.admin || state.admin,
      users: userRows?.length ? userRows.map((row) => row.payload) : state.users
    });
    const signature = stateSignature(nextState);
    if (signature !== cloudSignature) {
      cloudSignature = signature;
      isPullingState = true;
      state = nextState;
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      isPullingState = false;
      render();
    }
  } catch (error) {
    console.warn("Supabase sync unavailable", error);
  } finally {
    cloudPulling = false;
  }
}

async function pushCloudState() {
  if (!cloudReady) return;
  try {
    if (isAdminMode) {
      await cloudClient.from("hongshan_admin").upsert({
        id: "main",
        admin: state.admin,
        updated_at: new Date().toISOString()
      });
      await cloudClient.from("hongshan_users").upsert(
        state.users.map((user) => ({ id: user.id, payload: user, updated_at: new Date().toISOString() }))
      );
    } else if (currentUserId) {
      const user = getCurrentUser();
      if (user) {
        await cloudClient.from("hongshan_users").upsert({
          id: user.id,
          payload: user,
          updated_at: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.warn("Supabase push unavailable", error);
  }
}

initCloudSync();
pullState();
render();

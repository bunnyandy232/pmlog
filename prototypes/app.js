/* PMLog app logic — Scheme A shell */
(function () {
  var params = new URLSearchParams(location.search);
  var userId = params.get("user") || localStorage.getItem("pmlog_user");
  var currentUser = userId ? PMLOG.userById(userId) : null;
  if (!currentUser) {
    location.href = "index.html";
    return;
  }
  localStorage.setItem("pmlog_user", currentUser.id);
  var isLeader = currentUser.role === "leader";

  var STORE_KEY = "pmlog_store_v1";
  var SEED_VERSION = "2026-11-23-b";
  var projects, milestones, logs, nextId;

  function persistStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        seedVersion: SEED_VERSION,
        nextId: nextId,
        projects: projects,
        milestones: milestones,
        logs: logs
      }));
    } catch (err) {
      console.warn("persistStore failed", err);
    }
  }

  function syncSpecialLogsToMilestones() {
    logs.forEach(function (l) {
      if (l.type !== "special" || !l.projectId) return;
      var exists = milestones.some(function (m) {
        return m.fromLog && m.projectId === l.projectId && m.text === l.content && m.authorId === l.authorId;
      });
      if (exists) return;
      milestones.push({
        id: "m" + (nextId++),
        projectId: l.projectId,
        date: l.date,
        text: l.content,
        authorId: l.authorId,
        fromLog: true
      });
    });
  }

  function loadStore() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var stored = JSON.parse(raw);
        if (stored && stored.seedVersion === SEED_VERSION && Array.isArray(stored.projects)) {
          projects = stored.projects;
          milestones = stored.milestones || [];
          logs = stored.logs || [];
          nextId = stored.nextId || 1000;
          return;
        }
      } catch (e) { /* fall through to seed */ }
    }
    projects = JSON.parse(JSON.stringify(PMLOG.PROJECTS));
    milestones = JSON.parse(JSON.stringify(PMLOG.MILESTONES));
    logs = JSON.parse(JSON.stringify(PMLOG.LOGS));
    nextId = 1000;
    syncSpecialLogsToMilestones();
    persistStore();
  }
  loadStore();

  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function formatDateTime(d) {
    var week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " 周" + week + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
  function tickClock() {
    var el = document.getElementById("top-datetime");
    if (el) el.textContent = formatDateTime(new Date());
  }
  tickClock();
  setInterval(tickClock, 1000);

  function userName(id) {
    var u = PMLOG.userById(id);
    return u ? u.name : id;
  }
  function projectOf(id) {
    return projects.find(function (p) { return p.id === id; });
  }
  function urgencyOf(p) {
    if (!p || !p.leadId) return null;
    return p.urgencyByUser[p.leadId] || null;
  }
  function quadrantOf(p) {
    var imp = p.importance;
    var urg = urgencyOf(p);
    if (!imp || !urg) return "pending";
    if (urg === "urgent" && imp === "important") return "q1";
    if (urg === "urgent" && imp === "not_important") return "q2";
    if (urg === "not_urgent" && imp === "important") return "q3";
    return "q4";
  }
  function impLabel(v) {
    if (v === "important") return "重要";
    if (v === "not_important") return "不重要";
    return "未设定";
  }
  function urgLabel(v) {
    if (v === "urgent") return "紧急";
    if (v === "not_urgent") return "不紧急";
    return "未设定";
  }
  function myProjects() {
    /* 项目中心：仅本人参与的项目；全员总览在监视模块 */
    return projects.filter(function (p) {
      return p.memberIds.indexOf(currentUser.id) >= 0;
    });
  }
  function myLogs() {
    return logs.filter(function (l) { return l.authorId === currentUser.id; })
      .sort(function (a, b) {
        return (b.date + b.time).localeCompare(a.date + a.time);
      });
  }
  function isDone(p) {
    return p && (p.status === "done" || (p.progress || 0) >= 100);
  }
  function isOverdue(p) {
    return !isDone(p) && p.end < today() && (p.progress || 0) < 100;
  }
  function parseYmd(s) {
    var p = String(s || "").split("-");
    return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
  }
  function toYmd(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }
  function startOfWeek(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay();
    var diff = day === 0 ? -6 : 1 - day; /* 周一为一周开始 */
    return addDays(x, diff);
  }
  /* kind: week|month|quarter|half|year|cyear */
  function periodRange(kind) {
    var now = parseYmd(today());
    var start;
    var end = now;
    var label;
    if (kind === "week") {
      start = startOfWeek(now);
      end = addDays(start, 6);
      label = "本周";
    } else if (kind === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      label = "本月";
    } else if (kind === "quarter") {
      var q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = new Date(now.getFullYear(), q * 3 + 3, 0);
      label = "本季";
    } else if (kind === "half") {
      start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      label = "近半年";
    } else if (kind === "year") {
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      label = "近一年";
    } else if (kind === "cyear") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      label = "本年";
    } else {
      start = addDays(now, -6);
      label = "近期";
    }
    return { start: toYmd(start), end: toYmd(end), label: label };
  }
  function inDateRange(dateStr, range) {
    return dateStr >= range.start && dateStr <= range.end;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Top bar + chrome */
  document.title = "PMLog — " + currentUser.name;
  document.getElementById("top-line").textContent = currentUser.line;
  document.getElementById("top-name").textContent = currentUser.name;
  document.getElementById("side-role").innerHTML =
    "当前角色<br><strong>" + (isLeader ? "部门领导" : "普通员工") + " · " + currentUser.name + "</strong><br>" +
    (isLeader ? "可查看全部员工" : "仅本人工作内容");
  function updatePageChrome(section) {
    if (section === "monitor") {
      document.getElementById("page-title").textContent = "项目中心";
      document.getElementById("page-subtitle").textContent = "部门全员系统项目与工作日志总览（仅领导可见）。";
    } else {
      document.getElementById("page-title").textContent = "我的工作";
      document.getElementById("page-subtitle").textContent = isLeader
        ? "本人系统项目与工作日志同屏维护；项目中心查看部门全貌。"
        : "系统项目与工作日志同屏维护：跟进项目、记录日常/专项日志。";
    }
  }
  document.getElementById("projects-intro").textContent = isLeader
    ? "领导可新增维护系统项目并分配员工；多人时必须指定牵头人。重要度由领导设定。"
    : "每位员工至少含 6 个系统项目与 5 条日常日志演示数据。牵头人可设定紧急度。";

  document.querySelectorAll(".leader-only").forEach(function (el) {
    if (!isLeader) el.classList.add("hidden");
  });

  /* Sidebar collapse */
  var sidebar = document.getElementById("sidebar");
  var sidebarToggle = document.getElementById("sidebar-toggle");
  function applySidebarCollapsed(collapsed) {
    sidebar.classList.toggle("collapsed", collapsed);
    sidebarToggle.textContent = collapsed ? "展开" : "收起";
    document.querySelectorAll(".nav-link").forEach(function (a) {
      var full = a.getAttribute("data-full") || a.textContent.trim();
      a.setAttribute("data-full", full);
      a.textContent = collapsed ? (a.getAttribute("data-short") || full.slice(0, 2)) : full;
    });
    localStorage.setItem("pmlog_sidebar_collapsed", collapsed ? "1" : "0");
  }
  applySidebarCollapsed(localStorage.getItem("pmlog_sidebar_collapsed") === "1");
  sidebarToggle.addEventListener("click", function () {
    applySidebarCollapsed(!sidebar.classList.contains("collapsed"));
  });

  function showSection(name) {
    document.querySelectorAll(".section").forEach(function (s) {
      s.classList.toggle("active", s.getAttribute("data-section") === name);
    });
    document.querySelectorAll(".nav-link").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-section") === name);
    });
    location.hash = "sec-" + name;
    updatePageChrome(name);
  }
  document.querySelectorAll(".nav-link").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      showSection(a.getAttribute("data-section"));
    });
  });
  var hash = (location.hash || "").replace("#sec-", "");
  if (hash === "monitor" && !isLeader) hash = "work";
  if (hash === "projects" || hash === "logs") hash = "work";
  showSection(hash === "monitor" || hash === "work" ? hash : (isLeader ? "monitor" : "work"));

  /* Monitor / 项目中心 */
  var monitorSort = { key: "assignedAt", dir: -1 }; /* 默认按分配时间新→旧 */
  var monitorExpanded = {};
  var monitorFilterIds = [];
  var monitorLogPeriod = "week";

  function monitorDateRange() {
    var startEl = document.getElementById("monitor-date-start");
    var endEl = document.getElementById("monitor-date-end");
    return {
      start: startEl && startEl.value ? startEl.value : "",
      end: endEl && endEl.value ? endEl.value : ""
    };
  }
  function matchLeadFilter(p, filters) {
    if (!filters.length) return true;
    return filters.indexOf(p.leadId) >= 0;
  }
  /* 进行中项目是否落在筛选区间：计划周期与区间有交集 */
  function projectOverlapsRange(p, range) {
    if (!range.start && !range.end) return true;
    var ps = p.start || p.assignedAt || "";
    var pe = p.end || ps || "";
    if (range.start && pe && pe < range.start) return false;
    if (range.end && ps && ps > range.end) return false;
    return true;
  }
  function completedInRange(p, range) {
    if (!isDone(p)) return false;
    var d = p.completedAt || p.end || "";
    if (!d) return !range.start && !range.end;
    if (range.start && d < range.start) return false;
    if (range.end && d > range.end) return false;
    return true;
  }
  function logInRange(l, range) {
    if (range.start && l.date < range.start) return false;
    if (range.end && l.date > range.end) return false;
    return true;
  }
  /* 逾期：区间内未完成，且预计完成日早于筛选截止日（无截止日则相对今天） */
  function overdueInBoard(p, range) {
    if (isDone(p) || !p.end) return false;
    if (!projectOverlapsRange(p, range)) return false;
    var cutoff = range.end || today();
    return p.end < cutoff;
  }

  function selectedMonitorFilters() {
    return Array.prototype.map.call(
      document.querySelectorAll("#monitor-filter-users input:checked"),
      function (el) { return el.value; }
    );
  }

  function fillMonitorFilter() {
    var box = document.getElementById("monitor-filter-users");
    if (!box) return;
    var employees = PMLOG.USERS.filter(function (u) { return u.role === "employee"; });
    var selected = monitorFilterIds.slice();
    var html = "";
    PMLOG.LINE_ORDER.forEach(function (line) {
      if (line === "中心主管") return;
      var list = employees.filter(function (u) { return u.line === line; });
      if (!list.length) return;
      html += "<div class='member-group'>" +
        "<div class='member-group-title'>" + escapeHtml(line) + "</div>" +
        "<div class='member-group-body'>";
      list.forEach(function (u) {
        var checked = selected.indexOf(u.id) >= 0 ? " checked" : "";
        html += "<label class='member-chip'><input type='checkbox' value='" + u.id + "'" + checked + ">" +
          "<span>" + escapeHtml(u.name) + "</span></label>";
      });
      html += "</div></div>";
    });
    box.innerHTML = html;
  }

  function milestoneListHtml(projectId) {
    var ms = milestones.filter(function (m) { return m.projectId === projectId; })
      .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    return "<ul class='ms-list'>" +
      (ms.map(function (m) {
        var tag = m.fromLog ? "专项日志" : "节点";
        return "<li>" + m.date + " · " + escapeHtml(m.text) +
          " <span class='muted'>（" + escapeHtml(userName(m.authorId)) + " · " + tag + "）</span></li>";
      }).join("") || "<li class='muted'>暂无里程碑节点</li>") +
      "</ul>";
  }

  function sortValue(p, key) {
    switch (key) {
      case "name": return p.name || "";
      case "lead": return userName(p.leadId);
      case "members": return (p.memberIds || []).map(userName).join("、");
      case "importance": return p.importance || "";
      case "urgency": return urgencyOf(p) || "";
      case "quadrant": return quadrantOf(p);
      case "start": return p.start || "";
      case "end": return p.end || "";
      case "assignedAt": return p.assignedAt || "";
      case "status": return isDone(p) ? "1-done" : "0-active";
      default: return "";
    }
  }

  function renderMonitor() {
    if (!isLeader) return;
    var filters = monitorFilterIds;
    var range = monitorDateRange();
    var scoped = projects.filter(function (p) { return matchLeadFilter(p, filters); });
    var list = scoped.slice();
    list.sort(function (a, b) {
      var va = sortValue(a, monitorSort.key);
      var vb = sortValue(b, monitorSort.key);
      if (va < vb) return -1 * monitorSort.dir;
      if (va > vb) return 1 * monitorSort.dir;
      return 0;
    });

    var activeInRange = scoped.filter(function (p) {
      return !isDone(p) && projectOverlapsRange(p, range);
    });
    var q1Active = activeInRange.filter(function (p) { return quadrantOf(p) === "q1"; });
    var doneInRange = scoped.filter(function (p) { return completedInRange(p, range); });
    var logsScoped = logs.filter(function (l) {
      if (filters.length && filters.indexOf(l.authorId) < 0) return false;
      return logInRange(l, range);
    });
    var overdueBoard = scoped.filter(function (p) { return overdueInBoard(p, range); });

    var kpiQ1 = document.getElementById("kpi-q1");
    if (kpiQ1) kpiQ1.textContent = String(q1Active.length);
    document.getElementById("kpi-projects").textContent = String(activeInRange.length);
    var kpiDone = document.getElementById("kpi-done");
    if (kpiDone) kpiDone.textContent = String(doneInRange.length);
    document.getElementById("kpi-logs").textContent = String(logsScoped.length);
    document.getElementById("kpi-overdue").textContent = String(overdueBoard.length);

    document.querySelectorAll("#monitor-project-table th.sortable").forEach(function (th) {
      th.classList.remove("asc", "desc");
      if (th.getAttribute("data-sort") === monitorSort.key) {
        th.classList.add(monitorSort.dir === 1 ? "asc" : "desc");
      }
    });

    document.getElementById("monitor-project-body").innerHTML = list.map(function (p) {
      var q = quadrantOf(p);
      var open = !!monitorExpanded[p.id];
      return "<tr class='mon-main" + (open ? " is-open" : "") + "' data-project-id='" + p.id + "'>" +
        "<td><button type='button' class='mon-name-btn' data-toggle-ms='" + p.id + "'>" +
          "<span class='mon-caret' aria-hidden='true'>" + (open ? "▾" : "▸") + "</span>" +
          escapeHtml(p.name) +
          (isOverdue(p) ? ' <span class="pill danger">逾期</span>' : "") +
        "</button></td>" +
        "<td>" + escapeHtml(userName(p.leadId)) + "</td>" +
        "<td>" + p.memberIds.map(userName).map(escapeHtml).join("、") + "</td>" +
        "<td>" + impLabel(p.importance) + "</td>" +
        "<td>" + urgLabel(urgencyOf(p)) + "</td>" +
        "<td><span class='pill " + q + "'>" + PMLOG.quadrantLabel[q] + "</span></td>" +
        "<td>" + (p.start || "—") + "</td>" +
        "<td>" + (p.end || "—") + "</td>" +
        "<td>" + (p.assignedAt || "—") + "</td>" +
        "<td>" + (isDone(p)
          ? "<span class='pill done'>已完成</span>" +
            (p.completedAt ? "<div class='muted' style='font-size:11px;margin-top:4px'>" + p.completedAt + "</div>" : "")
          : "<span class='pill pending'>进行中</span>") + "</td>" +
        "<td><button type='button' class='btn btn-ghost mon-edit-btn' data-edit-project='" + p.id + "'>编辑</button></td>" +
        "</tr>" +
        "<tr class='mon-ms-row" + (open ? "" : " hidden") + "' data-ms-for='" + p.id + "'>" +
        "<td colspan='11'><div class='mon-ms-panel'>" +
          "<div class='mon-ms-head'>" +
            "<span>里程碑节点 · " + escapeHtml(p.name) + "</span>" +
            "<span class='muted'>对接人 " + escapeHtml(p.contact || "—") +
            " · 计划 " + (p.start || "—") + " — " + (p.end || "—") + "</span>" +
          "</div>" +
          milestoneListHtml(p.id) +
        "</div></td></tr>";
    }).join("") || "<tr><td colspan='11' class='muted'>无匹配项目</td></tr>";

    var logRange = periodRange(monitorLogPeriod);
    var logRows = logs.slice().sort(function (a, b) {
      return (b.date + b.time).localeCompare(a.date + a.time);
    }).filter(function (l) {
      if (filters.length && filters.indexOf(l.authorId) < 0) return false;
      return inDateRange(l.date, logRange);
    }).slice(0, 50);
    document.getElementById("monitor-log-body").innerHTML = logRows.map(function (l) {
      var proj = l.projectId ? projectOf(l.projectId) : null;
      return "<tr>" +
        "<td>" + l.date + " " + l.time + "</td>" +
        "<td>" + escapeHtml(userName(l.authorId)) + "</td>" +
        "<td>" + (l.type === "special" ? "专项" : "日常") +
          (proj ? " · " + escapeHtml(proj.name) : "") + "</td>" +
        "<td>" + escapeHtml(l.content) + "</td>" +
        "</tr>";
    }).join("") || "<tr><td colspan='4' class='muted'>" + logRange.label + "暂无日志</td></tr>";

    document.querySelectorAll("#monitor-log-period .period-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-period") === monitorLogPeriod);
    });
  }

  fillMonitorFilter();
  var filterBox = document.getElementById("monitor-filter-users");
  if (filterBox) {
    filterBox.addEventListener("change", function () {
      monitorFilterIds = selectedMonitorFilters();
      renderMonitor();
    });
  }
  var filterClear = document.getElementById("monitor-filter-clear");
  if (filterClear) {
    filterClear.addEventListener("click", function () {
      monitorFilterIds = [];
      fillMonitorFilter();
      renderMonitor();
    });
  }
  var periodBox = document.getElementById("monitor-log-period");
  if (periodBox) {
    periodBox.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-period]");
      if (!btn) return;
      monitorLogPeriod = btn.getAttribute("data-period");
      renderMonitor();
    });
  }
  ["monitor-date-start", "monitor-date-end"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", renderMonitor);
  });
  var dateReset = document.getElementById("monitor-date-reset");
  if (dateReset) {
    dateReset.addEventListener("click", function () {
      var s = document.getElementById("monitor-date-start");
      var e = document.getElementById("monitor-date-end");
      if (s) s.value = "";
      if (e) e.value = "";
      renderMonitor();
    });
  }

  var monitorTable = document.getElementById("monitor-project-table");
  if (monitorTable) {
    monitorTable.querySelector("thead").addEventListener("click", function (e) {
      var th = e.target.closest("th.sortable");
      if (!th) return;
      var key = th.getAttribute("data-sort");
      if (monitorSort.key === key) monitorSort.dir *= -1;
      else {
        monitorSort.key = key;
        monitorSort.dir = 1;
      }
      renderMonitor();
    });
    monitorTable.querySelector("tbody").addEventListener("click", function (e) {
      var toggle = e.target.closest("[data-toggle-ms]");
      if (toggle) {
        var tid = toggle.getAttribute("data-toggle-ms");
        monitorExpanded[tid] = !monitorExpanded[tid];
        renderMonitor();
        return;
      }
      var editBtn = e.target.closest("[data-edit-project]");
      if (editBtn) {
        var pid = editBtn.getAttribute("data-edit-project");
        openProjectForm(projectOf(pid));
        showSection("work");
        location.hash = "sec-work";
        setTimeout(function () {
          var wrap = document.getElementById("project-form-wrap");
          if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    });
  }

  /* Log calendar (my work — left) */
  var calCursor = (function () {
    var d = parseYmd(today());
    return { y: d.getFullYear(), m: d.getMonth() }; /* m: 0-11 */
  })();
  var calSelectedDay = "";

  function logsByDateInMonth(y, m) {
    var prefix = y + "-" + pad(m + 1);
    var map = {};
    myLogs().forEach(function (l) {
      if (l.date.indexOf(prefix) !== 0) return;
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }

  function renderLogCalendar() {
    var box = document.getElementById("log-calendar");
    if (!box) return;
    var y = calCursor.y;
    var m = calCursor.m;
    var byDate = logsByDateInMonth(y, m);
    var first = new Date(y, m, 1);
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var startWeekday = (first.getDay() + 6) % 7; /* Mon=0 */
    var todayStr = today();
    var monthLabel = y + "年" + (m + 1) + "月";

    var html = "<div class='cal-head'>" +
      "<div class='cal-title'>" + monthLabel + " · " + escapeHtml(currentUser.name) + "</div>" +
      "<div class='cal-nav'>" +
      "<button type='button' class='btn btn-ghost' data-cal-nav='-1'>上月</button>" +
      "<button type='button' class='btn btn-ghost' data-cal-nav='0'>本月</button>" +
      "<button type='button' class='btn btn-ghost' data-cal-nav='1'>下月</button>" +
      "</div></div>" +
      "<div class='cal-weekdays'>" +
      ["一", "二", "三", "四", "五", "六", "日"].map(function (w) {
        return "<span>" + w + "</span>";
      }).join("") +
      "</div><div class='cal-grid'>";

    var i;
    for (i = 0; i < startWeekday; i++) {
      html += "<div class='cal-cell empty'></div>";
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = y + "-" + pad(m + 1) + "-" + pad(day);
      var list = byDate[dateStr] || [];
      var cls = "cal-cell";
      if (dateStr === todayStr) cls += " is-today";
      if (list.length) cls += " has-logs";
      if (calSelectedDay === dateStr) cls += " is-selected";
      var dailyN = list.filter(function (l) { return l.type !== "special"; }).length;
      var specialN = list.length - dailyN;
      var dots = "";
      var di;
      for (di = 0; di < Math.min(dailyN, 3); di++) dots += "<span class='cal-dot daily'></span>";
      for (di = 0; di < Math.min(specialN, 3); di++) dots += "<span class='cal-dot special'></span>";
      html += "<div class='" + cls + "' data-cal-day='" + dateStr + "' title='" + dateStr +
        (list.length ? " · " + list.length + " 条日志" : "") + "'>" +
        "<span class='cal-daynum'>" + day + "</span>" +
        (list.length ? "<span class='cal-count'>" + list.length + "条</span><div class='cal-dots'>" + dots + "</div>" : "") +
        "</div>";
    }
    html += "</div>" +
      "<div class='cal-legend'><span><i class='lg-daily'></i>日常日志</span>" +
      "<span><i class='lg-special'></i>专项日志</span></div>";

    if (calSelectedDay && byDate[calSelectedDay]) {
      var selected = byDate[calSelectedDay];
      html += "<div class='cal-detail'><strong>" + calSelectedDay + " · " + selected.length + " 条日志</strong><ul>" +
        selected.map(function (l) {
          var tag = l.type === "special" ? "专项" : "日常";
          var proj = l.projectId ? projectOf(l.projectId) : null;
          return "<li>[" + l.time + "] " + tag +
            (proj ? " · " + escapeHtml(proj.name) : "") +
            " — " + escapeHtml(l.content) + "</li>";
        }).join("") +
        "</ul></div>";
    } else if (calSelectedDay) {
      html += "<div class='cal-detail muted'>" + calSelectedDay + " 暂无日志</div>";
    }

    box.innerHTML = html;
  }

  var logCalBox = document.getElementById("log-calendar");
  if (logCalBox) {
    logCalBox.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-cal-nav]");
      if (nav) {
        var dir = nav.getAttribute("data-cal-nav");
        if (dir === "0") {
          var now = parseYmd(today());
          calCursor.y = now.getFullYear();
          calCursor.m = now.getMonth();
        } else {
          calCursor.m += dir === "1" ? 1 : -1;
          if (calCursor.m > 11) { calCursor.m = 0; calCursor.y += 1; }
          if (calCursor.m < 0) { calCursor.m = 11; calCursor.y -= 1; }
        }
        calSelectedDay = "";
        renderLogCalendar();
        return;
      }
      var cell = e.target.closest("[data-cal-day]");
      if (cell) {
        var d = cell.getAttribute("data-cal-day");
        calSelectedDay = calSelectedDay === d ? "" : d;
        renderLogCalendar();
      }
    });
  }

  /* Projects */
  function renderQuad() {
    var buckets = { pending: [], q1: [], q2: [], q3: [], q4: [] };
    myProjects().filter(function (p) { return !isDone(p); }).forEach(function (p) {
      buckets[quadrantOf(p)].push(p);
    });
    function shortName(name) {
      var parts = name.split("·");
      return parts.length > 1 ? parts.slice(1).join("·") : name;
    }
    function cell(key, title, cls) {
      var all = buckets[key];
      var show = all.slice(0, 6);
      var items = show.map(function (p) {
        return "<li title='" + escapeHtml(p.name) + "'>" + escapeHtml(shortName(p.name)) + "</li>";
      }).join("") || "<li class='muted'>暂无项目</li>";
      var more = all.length > show.length
        ? "<div class='quad-more'>另有 " + (all.length - show.length) + " 项…</div>"
        : "";
      return "<div class='quad-cell " + cls + "'><h4>" + title +
        "<span>" + all.length + "</span></h4><ul>" + items + "</ul>" + more + "</div>";
    }
    var pendingHtml = "";
    if (buckets.pending.length) {
      pendingHtml = "<div class='pending-inline'><strong>待归类 " + buckets.pending.length +
        "</strong>：缺重要度或牵头人紧急度（列表中可继续设定）</div>";
    }
    document.getElementById("quad-wrap").innerHTML =
      pendingHtml +
      "<div class='quad-compact'>" +
      cell("q1", "紧急且重要", "q1") + cell("q2", "紧急不重要", "q2") +
      cell("q3", "不紧急重要", "q3") + cell("q4", "不紧急不重要", "q4") +
      "</div>";
  }

  function renderProjectList() {
    var box = document.getElementById("project-list");
    var list = myProjects();
    if (!list.length) {
      box.innerHTML = "<p class='muted'>暂无系统项目。</p>";
      return;
    }
    box.innerHTML = list.map(function (p, idx) {
      var q = quadrantOf(p);
      var ms = milestones.filter(function (m) { return m.projectId === p.id; })
        .sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      var showUrgencyCtrl = p.memberIds.indexOf(currentUser.id) >= 0 && p.leadId === currentUser.id;
      var showImportanceCtrl = isLeader;
      var memberOpts = p.memberIds.map(function (id) {
        return escapeHtml(userName(id)) + (id === p.leadId ? "（牵头）" : "");
      }).join("、");
      var openAttr = idx === 0 ? " open" : "";

      var urg = urgencyOf(p);
      var impClass = !p.importance ? "prio-unset" : (p.importance === "important" ? "prio-imp" : "prio-imp not");
      var urgClass = !urg ? "prio-unset" : (urg === "urgent" ? "prio-urg" : "prio-urg not");
      var done = isDone(p);
      var html = "<details class='project-acc" + (done ? " is-done" : "") + "' id='proj-" + p.id + "'" + openAttr + ">" +
        "<summary>" +
        "<span>" + escapeHtml(p.name) +
        " <span class='pill " + q + "'>" + PMLOG.quadrantLabel[q] + "</span>" +
        (done ? " <span class='pill done'>已完成" + (p.completedAt ? " · " + p.completedAt : "") + "</span>" : "") +
        (isOverdue(p) ? " <span class='pill danger'>逾期</span>" : "") +
        "</span></summary>" +
        "<div class='acc-body'>" +
        "<p class='muted'>计划 " + p.start + " — " + p.end +
        " · 分配于 " + p.assignedAt +
        " · 对接人 " + escapeHtml(p.contact || "—") +
        "</p>" +
        (done ? "<div class='done-meta'>项目状态：已完成　完成日期：" + escapeHtml(p.completedAt || "—") + "</div>" : "") +
        "<p>成员：" + memberOpts + "</p>" +
        "<p>重要度：<strong class='" + impClass + "'>" + impLabel(p.importance) + "</strong>　" +
        "紧急度（牵头人）：<strong class='" + urgClass + "'>" + urgLabel(urg) + "</strong></p>";

      if (!done && showImportanceCtrl) {
        html += "<div class='form-row'><label>调整重要度</label>" +
          "<select data-set-importance='" + p.id + "' style='max-width:200px'>" +
          "<option value=''" + (!p.importance ? " selected" : "") + ">未设定</option>" +
          "<option value='important'" + (p.importance === "important" ? " selected" : "") + ">重要</option>" +
          "<option value='not_important'" + (p.importance === "not_important" ? " selected" : "") + ">不重要</option>" +
          "</select></div>";
      }
      if (!done && showUrgencyCtrl) {
        html += "<div class='form-row'><label>设定紧急度（牵头人）</label>" +
          "<select data-set-urgency='" + p.id + "' style='max-width:200px'>" +
          "<option value=''" + (!urgencyOf(p) ? " selected" : "") + ">未设定</option>" +
          "<option value='urgent'" + (urgencyOf(p) === "urgent" ? " selected" : "") + ">紧急</option>" +
          "<option value='not_urgent'" + (urgencyOf(p) === "not_urgent" ? " selected" : "") + ">不紧急</option>" +
          "</select></div>";
      }

      html += "<h4>里程碑节点</h4><ul class='ms-list'>" +
        (ms.map(function (m) {
          var tag = m.fromLog ? "专项日志" : "节点";
          return "<li>" + m.date + " · " + escapeHtml(m.text) +
            " <span class='muted'>（" + escapeHtml(userName(m.authorId)) + " · " + tag + "）</span></li>";
        }).join("") || "<li class='muted'>暂无里程碑节点</li>") + "</ul>";

      if (!done && p.memberIds.indexOf(currentUser.id) >= 0) {
        html += "<div class='form-row'><label>新增里程碑节点</label>" +
          "<input data-ms-input='" + p.id + "' placeholder='阶段性完成情况…' />" +
          "<div class='form-actions' style='margin-top:6px'>" +
          "<button type='button' class='btn btn-ghost' data-ms-add='" + p.id + "'>添加里程碑节点</button>" +
          "</div></div>";
      }

      if (!isLeader && !done && p.memberIds.indexOf(currentUser.id) >= 0) {
        html += "<div class='form-actions'>" +
          "<button type='button' class='btn btn-done' data-complete-project='" + p.id + "'>项目完成</button>" +
          "</div>";
      }

      if (isLeader) {
        html += "<div class='form-actions'>" +
          "<button type='button' class='btn btn-ghost' data-edit-project='" + p.id + "'>编辑</button>" +
          "<button type='button' class='btn btn-ghost' data-del-project='" + p.id + "'>删除</button>" +
          "</div>";
      }
      html += "</div></details>";
      return html;
    }).join("");
  }

  function renderProjects() {
    renderLogCalendar();
    renderQuad();
    renderProjectList();
  }

  function fillMemberChecks(selected) {
    selected = selected || [];
    var box = document.getElementById("pf-members");
    var employees = PMLOG.USERS.filter(function (u) { return u.role === "employee"; });
    var html = "";
    PMLOG.LINE_ORDER.forEach(function (line) {
      if (line === "中心主管") return;
      var list = employees.filter(function (u) { return u.line === line; });
      if (!list.length) return;
      html += "<div class='member-group'>" +
        "<div class='member-group-title'>" + escapeHtml(line) + "</div>" +
        "<div class='member-group-body'>";
      list.forEach(function (u) {
        var checked = selected.indexOf(u.id) >= 0 ? " checked" : "";
        html += "<label class='member-chip'><input type='checkbox' value='" + u.id + "'" + checked + ">" +
          "<span>" + escapeHtml(u.name) + "</span></label>";
      });
      html += "</div></div>";
    });
    box.innerHTML = html;
    refreshLeadOptions();
  }
  function selectedMembers() {
    return Array.prototype.map.call(
      document.querySelectorAll("#pf-members input:checked"),
      function (el) { return el.value; }
    );
  }
  function refreshLeadOptions() {
    var members = selectedMembers();
    var lead = document.getElementById("pf-lead");
    var cur = lead.value;
    lead.innerHTML = members.map(function (id) {
      return "<option value='" + id + "'>" + escapeHtml(userName(id)) + "</option>";
    }).join("") || "<option value=''>请先选择成员</option>";
    if (members.indexOf(cur) >= 0) lead.value = cur;
  }
  document.getElementById("pf-members").addEventListener("change", refreshLeadOptions);

  function openProjectForm(p) {
    document.getElementById("project-form-wrap").classList.remove("hidden");
    document.getElementById("project-form-title").textContent = p ? "编辑系统项目" : "新增系统项目";
    document.getElementById("pf-id").value = p ? p.id : "";
    document.getElementById("pf-name").value = p ? p.name : "";
    document.getElementById("pf-start").value = p ? p.start : today();
    document.getElementById("pf-end").value = p ? p.end : "";
    document.getElementById("pf-importance").value = p && p.importance ? p.importance : "";
    document.getElementById("pf-contact").value = p ? (p.contact || "") : "";
    document.getElementById("pf-assigned").value = p ? p.assignedAt : today();
    fillMemberChecks(p ? p.memberIds : []);
    if (p) document.getElementById("pf-lead").value = p.leadId;
  }
  document.getElementById("btn-new-project").addEventListener("click", function () {
    openProjectForm(null);
  });
  document.getElementById("pf-cancel").addEventListener("click", function () {
    document.getElementById("project-form-wrap").classList.add("hidden");
  });
  document.getElementById("project-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var members = selectedMembers();
    var lead = document.getElementById("pf-lead").value;
    if (!members.length) { alert("请至少分配一名员工"); return; }
    if (members.length > 1 && (!lead || members.indexOf(lead) < 0)) {
      alert("多名员工时必须指定牵头人"); return;
    }
    if (members.length === 1) lead = members[0];
    var id = document.getElementById("pf-id").value;
    var payload = {
      name: document.getElementById("pf-name").value.trim(),
      start: document.getElementById("pf-start").value,
      end: document.getElementById("pf-end").value,
      importance: document.getElementById("pf-importance").value || null,
      contact: document.getElementById("pf-contact").value.trim(),
      assignedAt: document.getElementById("pf-assigned").value || today(),
      memberIds: members,
      leadId: lead
    };
    if (id) {
      var p = projectOf(id);
      Object.assign(p, payload);
      if (!p.urgencyByUser) p.urgencyByUser = {};
    } else {
      projects.push(Object.assign({
        id: "p" + (nextId++),
        urgencyByUser: {},
        progress: 0,
        status: "active"
      }, payload));
    }
    document.getElementById("project-form-wrap").classList.add("hidden");
    refreshAll();
  });

  document.getElementById("project-list").addEventListener("click", function (e) {
    var t = e.target.closest("[data-edit-project], [data-del-project], [data-ms-add], [data-complete-project]");
    if (!t) return;
    if (t.getAttribute("data-edit-project")) {
      openProjectForm(projectOf(t.getAttribute("data-edit-project")));
      showSection("work");
    }
    if (t.getAttribute("data-del-project")) {
      var id = t.getAttribute("data-del-project");
      if (confirm("确认删除该系统项目？")) {
        projects = projects.filter(function (p) { return p.id !== id; });
        refreshAll();
      }
    }
    if (t.getAttribute("data-ms-add")) {
      var pid = t.getAttribute("data-ms-add");
      var input = document.querySelector("[data-ms-input='" + pid + "']");
      var text = input && input.value.trim();
      if (!text) return;
      milestones.push({
        id: "m" + (nextId++),
        projectId: pid,
        date: today(),
        text: text,
        authorId: currentUser.id
      });
      refreshAll();
    }
    if (t.getAttribute("data-complete-project")) {
      var cid = t.getAttribute("data-complete-project");
      var cp = projectOf(cid);
      if (!cp || isDone(cp)) return;
      if (!confirm("确认将「" + cp.name + "」标记为已完成？")) return;
      cp.status = "done";
      cp.progress = 100;
      cp.completedAt = today();
      refreshAll();
    }
  });
  document.getElementById("project-list").addEventListener("change", function (e) {
    var t = e.target;
    if (t.getAttribute("data-set-importance")) {
      var p = projectOf(t.getAttribute("data-set-importance"));
      p.importance = t.value || null;
      refreshAll();
    }
    if (t.getAttribute("data-set-urgency")) {
      var p2 = projectOf(t.getAttribute("data-set-urgency"));
      if (!p2.urgencyByUser) p2.urgencyByUser = {};
      if (t.value) p2.urgencyByUser[currentUser.id] = t.value;
      else delete p2.urgencyByUser[currentUser.id];
      refreshAll();
    }
  });

  /* Logs */
  function fillLogProjects() {
    var sel = document.getElementById("lf-project");
    var opts = myProjects().filter(function (p) { return !isDone(p); });
    sel.innerHTML = opts.map(function (p) {
      return "<option value='" + p.id + "'>" + escapeHtml(p.name) + "</option>";
    }).join("") || "<option value=''>无可用项目</option>";
  }
  document.getElementById("lf-type").addEventListener("change", function () {
    document.getElementById("lf-project-row").classList.toggle("hidden", this.value !== "special");
  });
  document.getElementById("log-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var type = document.getElementById("lf-type").value;
    var projectId = type === "special" ? document.getElementById("lf-project").value : null;
    if (type === "special" && !projectId) { alert("专项日志须绑定系统项目"); return; }
    var content = document.getElementById("lf-content").value.trim();
    if (!content) return;
    var now = new Date();
    var time = pad(now.getHours()) + ":" + pad(now.getMinutes());
    logs.unshift({
      id: "l" + (nextId++),
      type: type,
      projectId: projectId,
      authorId: currentUser.id,
      date: today(),
      time: time,
      content: content
    });
    /* 专项日志同步写入对应系统项目的里程碑节点 */
    if (type === "special" && projectId) {
      milestones.push({
        id: "m" + (nextId++),
        projectId: projectId,
        date: today(),
        text: content,
        authorId: currentUser.id,
        fromLog: true
      });
    }
    document.getElementById("lf-content").value = "";
    refreshAll();
    showSection("work");
  });

  function renderLogs() {
    fillLogProjects();
    var rows = myLogs();
    document.getElementById("log-body").innerHTML = rows.map(function (l) {
      var proj = l.projectId ? projectOf(l.projectId) : null;
      var related = l.type === "special"
        ? (proj ? escapeHtml(proj.name) : "—")
        : "日常日志";
      return "<tr>" +
        "<td>" + l.date + " " + l.time + "</td>" +
        "<td>" + (l.type === "special" ? "专项" : "日常") + "</td>" +
        "<td>" + related + "</td>" +
        "<td>" + escapeHtml(l.content) + "</td>" +
        "</tr>";
    }).join("") || "<tr><td colspan='4' class='muted'>暂无日志</td></tr>";
  }

  /* Reports + export */
  function reportKindMeta(kind) {
    if (kind === "week") return { title: "周报", range: periodRange("week") };
    if (kind === "month") return { title: "月报", range: periodRange("month") };
    if (kind === "quarter") return { title: "季报", range: periodRange("quarter") };
    if (kind === "year") return { title: "年报", range: periodRange("cyear") };
    return { title: "周报", range: periodRange("week") };
  }
  function openReport(kind) {
    var body;
    var title;
    if (kind === "ai") {
      var weekRange = periodRange("week");
      var mineAi = myLogs().filter(function (l) { return inDateRange(l.date, weekRange); });
      title = "AI 版周报（草稿）";
      body = currentUser.name + " · 本周工作总结（AI 草稿）\n周期：" + weekRange.start + " — " + weekRange.end + "\n\n" +
        "本周共记录 " + mineAi.length + " 条日志。" +
        (mineAi.length ? "主要围绕：" + mineAi.slice(0, 3).map(function (l) { return l.content; }).join("；") : "暂无足够素材。") +
        "\n\n遗留与风险请结合系统项目进度自行补充。";
    } else {
      var meta = reportKindMeta(kind === "summary" ? "week" : kind);
      var range = meta.range;
      var mine = myLogs().filter(function (l) { return inDateRange(l.date, range); });
      title = meta.title + "草稿 · " + currentUser.name;
      body = "【" + meta.title + " · " + currentUser.name + "】\n周期：" + range.start + " — " + range.end + "\n\n";
      var byProj = {};
      mine.forEach(function (l) {
        var key = l.type === "special" && l.projectId ? l.projectId : "_daily";
        if (!byProj[key]) byProj[key] = [];
        byProj[key].push(l);
      });
      Object.keys(byProj).forEach(function (key) {
        if (key === "_daily") body += "一、日常工作\n";
        else {
          var p = projectOf(key);
          body += "· " + (p ? p.name : key) + "\n";
        }
        byProj[key].forEach(function (l) {
          body += "  - [" + l.date + " " + l.time + "] " + l.content + "\n";
        });
        body += "\n";
      });
      if (!mine.length) body += "（该周期暂无日志）\n";
    }
    document.getElementById("report-title").textContent = title;
    document.getElementById("report-body").textContent = body;
    document.getElementById("report-modal").classList.add("open");
  }
  document.querySelectorAll("[data-report]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openReport(btn.getAttribute("data-report"));
    });
  });
  function exportProjectsExcel() {
    var list = myProjects();
    if (!list.length) {
      alert("暂无可导出的系统项目");
      return;
    }
    var headers = ["项目名称", "状态", "牵头人", "成员", "重要度", "紧急度", "四象限", "计划开始", "计划完成", "任务分配时间", "对接人", "完成日期"];
    function cell(v) {
      return "<td>" + String(v == null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</td>";
    }
    var rows = list.map(function (p) {
      return "<tr>" +
        cell(p.name) +
        cell(isDone(p) ? "已完成" : "进行中") +
        cell(userName(p.leadId)) +
        cell(p.memberIds.map(userName).join("、")) +
        cell(impLabel(p.importance)) +
        cell(urgLabel(urgencyOf(p))) +
        cell(PMLOG.quadrantLabel[quadrantOf(p)]) +
        cell(p.start || "") +
        cell(p.end || "") +
        cell(p.assignedAt || "") +
        cell(p.contact || "") +
        cell(p.completedAt || "") +
        "</tr>";
    }).join("");
    var html = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='UTF-8'><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>" +
      "<x:ExcelWorksheet><x:Name>系统项目</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>" +
      "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>" +
      "<body><table border='1'><thead><tr>" +
      headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows + "</tbody></table></body></html>";
    var blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "系统项目_" + currentUser.name + "_" + today() + ".xls";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  var exportBtn = document.getElementById("btn-export-projects");
  if (exportBtn) exportBtn.addEventListener("click", exportProjectsExcel);
  document.getElementById("report-close").addEventListener("click", function () {
    document.getElementById("report-modal").classList.remove("open");
  });
  document.getElementById("report-copy").addEventListener("click", function () {
    var text = document.getElementById("report-body").textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    else {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    alert("已复制到剪贴板");
  });
  document.getElementById("report-modal").addEventListener("click", function (e) {
    if (e.target.id === "report-modal") this.classList.remove("open");
  });
  document.getElementById("btn-logout").addEventListener("click", function () {
    location.href = "index.html";
  });

  function refreshAll() {
    persistStore();
    renderMonitor();
    renderProjects();
    renderLogs();
  }
  refreshAll();
})();

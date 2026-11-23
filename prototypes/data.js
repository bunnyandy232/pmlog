/* PMLog prototype demo data — shared by index.html / app.html */
window.PMLOG = window.PMLOG || {};

PMLOG.USERS = [
  { id: "wangrui", name: "王蕊", line: "中心主管", role: "leader" },
  { id: "liyicheng", name: "李忆程", line: "自营资管条线", role: "employee" },
  { id: "lizhiyuan", name: "李志远", line: "财富条线", role: "employee" },
  { id: "zhuyingbai", name: "朱英柏", line: "中后台", role: "employee" },
  { id: "zhangjiahong", name: "张佳红", line: "风控合规", role: "employee" },
  { id: "wangbo", name: "王博", line: "自营资管条线", role: "employee" },
  { id: "suilintong", name: "隋林桐", line: "自营资管条线", role: "employee" },
  { id: "luanqiushuang", name: "栾秋爽", line: "中后台", role: "employee" },
  { id: "degejirifu", name: "德格吉日夫", line: "自营资管条线", role: "employee" },
  { id: "linmengcheng", name: "林梦成", line: "财富条线", role: "employee" },
  { id: "zhangxiangjun", name: "张相军", line: "自营资管条线", role: "employee" },
  { id: "biyaqing", name: "毕亚青", line: "财富条线", role: "employee" },
  { id: "hanmei", name: "韩梅", line: "财富条线", role: "employee" },
  { id: "libo", name: "李博", line: "中后台", role: "employee" },
  { id: "lihongtao", name: "李红涛", line: "自营资管条线", role: "employee" },
  { id: "liusainan", name: "刘赛男", line: "财富条线", role: "employee" },
  { id: "lixiaoying", name: "李晓莹", line: "财富条线", role: "employee" },
  { id: "mazhen", name: "马珍", line: "财富条线", role: "employee" },
  { id: "xubowen", name: "许博文", line: "财富条线", role: "employee" },
  { id: "xudan", name: "许丹", line: "中后台", role: "employee" },
  { id: "xuguisheng", name: "徐桂生", line: "中后台", role: "employee" },
  { id: "xuhua", name: "许华", line: "财富条线", role: "employee" },
  { id: "zhangaijuan", name: "张爱娟", line: "风控合规", role: "employee" },
  { id: "zhangqingwen", name: "张晴雯", line: "财富条线", role: "employee" }
];

PMLOG.LINE_ORDER = ["中心主管", "自营资管条线", "财富条线", "中后台", "风控合规"];

PMLOG.PROJECT_NAME_POOL = [
  "条线日报自动化",
  "客户画像标签治理",
  "投研周报模板升级",
  "交易核对台账改造",
  "持仓风险预警看板",
  "产品说明书结构化入库",
  "合规检查抽样工具",
  "销售话术知识库",
  "权限中台接入试点",
  "监控告警降噪",
  "CI 流水线标准化",
  "值班手册改版",
  "数据质量核验脚本",
  "客户回访任务闭环",
  "费用分摊规则梳理",
  "接口稳定性压测",
  "移动端审批轻量版",
  "档案电子化归档",
  "对账差异归因分析",
  "条线培训材料沉淀"
];

PMLOG.DAILY_LOG_POOL = [
  "参加条线晨会，同步本周重点事项。",
  "梳理待办清单并与对接人确认口径。",
  "回复业务咨询邮件并记录结论。",
  "整理周例会纪要，分发行动项。",
  "学习内部制度更新并做笔记。",
  "协助同事排查数据口径不一致问题。",
  "完成本人当周工时填报。",
  "与跨组同事对齐联调窗口。",
  "归档本周会议材料与往来邮件。",
  "跟进临时事务并更新进展备注。"
];

PMLOG.SPECIAL_LOG_POOL = [
  "完成阶段性方案初稿并提交评审。",
  "落地一批规则/模板并完成自测。",
  "与对接人确认验收标准。",
  "修复联调发现问题并回归验证。",
  "输出进度说明与风险升级备注。",
  "补充文档与操作说明。",
  "试点环境验证通过，准备推广。",
  "收集反馈并纳入下一批改动。"
];

PMLOG.MILESTONE_POOL = [
  "完成需求澄清与范围确认",
  "输出方案草案并通过初审",
  "完成核心功能开发/配置",
  "联调通过并形成验收清单",
  "试点上线并观察一周"
];

(function seedDemoData() {
  var employees = PMLOG.USERS.filter(function (u) { return u.role === "employee"; });
  var projects = [];
  var milestones = [];
  var logs = [];
  var pid = 1;
  var mid = 1;
  var lid = 1;

  function pad(n) { return String(n).padStart(2, "0"); }
  function dateOf(offsetDays) {
    var d = new Date(2026, 10, 23); /* 2026-11-23 */
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  employees.forEach(function (emp, empIdx) {
    for (var i = 0; i < 6; i++) {
      var nameIdx = (empIdx * 6 + i) % PMLOG.PROJECT_NAME_POOL.length;
      var name = emp.name + "·" + PMLOG.PROJECT_NAME_POOL[nameIdx];
      var h = hash(emp.id + "-" + i);
      var importance = h % 5 === 0 ? null : (h % 3 === 0 ? "not_important" : "important");
      var urgency = h % 4 === 0 ? null : (h % 2 === 0 ? "urgent" : "not_urgent");
      var progress = 10 + (h % 80);
      var startOff = -18 + (i * 2);
      var endOff = 5 + i * 4;
      var peer = employees[(empIdx + 1 + i) % employees.length];
      var memberIds = [emp.id];
      if (i % 2 === 1 && peer.id !== emp.id) memberIds.push(peer.id);

      var urgencyByUser = {};
      if (urgency) urgencyByUser[emp.id] = urgency;

      var projectId = "p" + pid++;
      projects.push({
        id: projectId,
        name: name,
        start: dateOf(startOff),
        end: dateOf(endOff),
        importance: importance,
        contact: emp.line + "对接人",
        assignedAt: dateOf(startOff),
        memberIds: memberIds,
        leadId: emp.id,
        urgencyByUser: urgencyByUser,
        progress: progress
      });

      var msCount = 1 + (h % 3);
      for (var m = 0; m < msCount; m++) {
        milestones.push({
          id: "m" + mid++,
          projectId: projectId,
          date: dateOf(startOff + 3 + m * 3),
          text: PMLOG.MILESTONE_POOL[m % PMLOG.MILESTONE_POOL.length],
          authorId: emp.id
        });
      }

      /* 1–2 special logs bound to this project */
      var specialN = 1 + (h % 2);
      for (var s = 0; s < specialN; s++) {
        logs.push({
          id: "l" + lid++,
          type: "special",
          projectId: projectId,
          authorId: emp.id,
          date: dateOf(-s - (i % 3)),
          time: pad(9 + ((h + s) % 8)) + ":" + pad((h * 7 + s * 11) % 60),
          content: PMLOG.SPECIAL_LOG_POOL[(h + s) % PMLOG.SPECIAL_LOG_POOL.length],
          hours: 1 + ((h + s) % 4) * 0.5
        });
      }
    }

    /* at least 5 daily logs per employee */
    for (var d = 0; d < 5; d++) {
      logs.push({
        id: "l" + lid++,
        type: "daily",
        projectId: null,
        authorId: emp.id,
        date: dateOf(-d),
        time: pad(8 + d) + ":" + pad((empIdx * 13 + d * 17) % 60),
        content: PMLOG.DAILY_LOG_POOL[(empIdx + d) % PMLOG.DAILY_LOG_POOL.length],
        hours: 0.5 + (d % 3) * 0.5
      });
    }
  });

  /* leader personal daily logs */
  for (var ld = 0; ld < 5; ld++) {
    logs.push({
      id: "l" + lid++,
      type: "daily",
      projectId: null,
      authorId: "wangrui",
      date: dateOf(-ld),
      time: pad(9 + ld) + ":00",
      content: ["审阅本周项目风险清单。", "组织条线进度同步会。", "约谈重点项目牵头人。", "确认周报口径。", "跟进跨组资源协调。"][ld],
      hours: 1
    });
  }

  PMLOG.PROJECTS = projects;
  PMLOG.MILESTONES = milestones;
  PMLOG.LOGS = logs;
})();

PMLOG.userById = function (id) {
  return PMLOG.USERS.find(function (u) { return u.id === id; });
};

PMLOG.projectById = function (id) {
  return PMLOG.PROJECTS.find(function (p) { return p.id === id; });
};

PMLOG.projectUrgency = function (p) {
  if (!p || !p.leadId) return null;
  return p.urgencyByUser[p.leadId] || null;
};

PMLOG.quadrantOf = function (p) {
  var imp = p.importance;
  var urg = PMLOG.projectUrgency(p);
  if (!imp || !urg) return "pending";
  if (urg === "urgent" && imp === "important") return "q1";
  if (urg === "urgent" && imp === "not_important") return "q2";
  if (urg === "not_urgent" && imp === "important") return "q3";
  return "q4";
};

PMLOG.quadrantLabel = {
  pending: "待归类",
  q1: "紧急且重要",
  q2: "紧急不重要",
  q3: "不紧急重要",
  q4: "不紧急不重要"
};

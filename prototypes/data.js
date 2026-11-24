/* PMLog shared helpers — users/projects load from Supabase via Auth/Store */
window.PMLOG = window.PMLOG || {};

PMLOG.USERS = PMLOG.USERS || [];

PMLOG.LINE_ORDER = ["中心主管", "自营资管条线", "财富条线", "中后台", "风控合规"];

PMLOG.userById = PMLOG.userById || function (id) {
  return (PMLOG.USERS || []).find(function (u) { return u.id === id; });
};

PMLOG.projectUrgency = function (p) {
  if (!p || !p.leadId) return null;
  return (p.urgencyByUser && p.urgencyByUser[p.leadId]) || null;
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

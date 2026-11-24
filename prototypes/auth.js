/* PMLog auth via Supabase Auth — username maps to {username}@pmlog.local */
window.PMLOG = window.PMLOG || {};

(function (PMLOG) {
  var SESSION_KEY = "pmlog_auth_session_v1";

  function setLocalSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem("pmlog_user", session.userId);
    return session;
  }

  function clearLocalSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("pmlog_user");
  }

  function mapProfile(row) {
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      name: row.display_name,
      line: row.line || "",
      role: row.role,
      mustChangePassword: !!row.must_change_password,
      active: row.active !== false
    };
  }

  async function fetchProfileById(userId) {
    var sb = PMLOG.getSupabase();
    var res = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (res.error) throw res.error;
    return mapProfile(res.data);
  }

  async function loadUsers() {
    var sb = PMLOG.getSupabase();
    var res = await sb.from("profiles").select("*").eq("active", true).order("display_name");
    if (res.error) throw res.error;
    PMLOG.USERS = (res.data || []).map(mapProfile);
    return PMLOG.USERS;
  }

  PMLOG.userById = function (id) {
    return (PMLOG.USERS || []).find(function (u) { return u.id === id; });
  };

  PMLOG.Auth = {
    emailOf: function (username) {
      return PMLOG.emailOfUsername(username);
    },
    getSession: function () {
      try {
        var raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    clearSession: async function () {
      clearLocalSession();
      try {
        var sb = PMLOG.getSupabase();
        await sb.auth.signOut();
      } catch (e) { /* ignore */ }
    },
    ensureSeed: function () { /* no-op: seeded server-side */ },
    restoreSession: async function () {
      var sb = PMLOG.getSupabase();
      function delay(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
      }
      /* 等待 Auth storage hydration，避免刚跳转时 getSession 空值误清会话 */
      var authUser = null;
      var i;
      for (i = 0; i < 6; i++) {
        try {
          var sess = await sb.auth.getSession();
          authUser = sess.data && sess.data.session && sess.data.session.user;
          if (authUser) break;
          var gu = await sb.auth.getUser();
          authUser = gu.data && gu.data.user;
          if (authUser) break;
        } catch (e) { /* retry */ }
        await delay(100 + i * 150);
      }
      if (!authUser) {
        /* 仅在确认无 Supabase 会话时清理；避免打断刚写入的本地会话 */
        clearLocalSession();
        return null;
      }
      var profile = await fetchProfileById(authUser.id);
      if (!profile || !profile.active) {
        await sb.auth.signOut();
        clearLocalSession();
        return null;
      }
      await loadUsers();
      return setLocalSession({
        username: profile.username,
        userId: profile.id,
        mustChangePassword: !!profile.mustChangePassword,
        at: Date.now()
      });
    },
    login: async function (username, password) {
      var name = String(username || "").trim().toLowerCase();
      if (!name || !password) {
        return { ok: false, error: "请输入用户名和密码" };
      }
      var sb = PMLOG.getSupabase();
      var email = PMLOG.emailOfUsername(name);
      var signed = await sb.auth.signInWithPassword({ email: email, password: password });
      if (signed.error) {
        return { ok: false, error: "用户名或密码错误" };
      }
      var uid = signed.data.user && signed.data.user.id;
      var profile = await fetchProfileById(uid);
      if (!profile || !profile.active) {
        await sb.auth.signOut();
        return { ok: false, error: "账号未激活或未建档，请联系管理员" };
      }
      await loadUsers();
      var session = setLocalSession({
        username: profile.username,
        userId: profile.id,
        mustChangePassword: !!profile.mustChangePassword,
        at: Date.now()
      });
      return { ok: true, session: session, mustChangePassword: !!profile.mustChangePassword };
    },
    changePassword: async function (username, oldPassword, newPassword) {
      if (!newPassword || String(newPassword).length < 6) {
        return { ok: false, error: "新密码至少 6 位" };
      }
      if (newPassword === oldPassword) {
        return { ok: false, error: "新密码不能与当前密码相同" };
      }
      var sb = PMLOG.getSupabase();
      var name = String(username || "").trim().toLowerCase();
      var email = PMLOG.emailOfUsername(name);
      var reauth = await sb.auth.signInWithPassword({ email: email, password: oldPassword });
      if (reauth.error) {
        return { ok: false, error: "当前密码不正确" };
      }
      var updated = await sb.auth.updateUser({ password: newPassword });
      if (updated.error) {
        return { ok: false, error: updated.error.message || "修改密码失败" };
      }
      var uid = reauth.data.user.id;
      var patch = await sb.from("profiles").update({ must_change_password: false }).eq("id", uid);
      if (patch.error) {
        return { ok: false, error: patch.error.message || "更新档案失败" };
      }
      await loadUsers();
      var profile = await fetchProfileById(uid);
      var session = setLocalSession({
        username: profile.username,
        userId: profile.id,
        mustChangePassword: false,
        at: Date.now()
      });
      return { ok: true, session: session };
    },
    loadUsers: loadUsers
  };
})(window.PMLOG);

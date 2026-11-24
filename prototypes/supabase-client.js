/* Supabase browser client — requires config.js + CDN @supabase/supabase-js */
window.PMLOG = window.PMLOG || {};

(function (PMLOG) {
  var EMAIL_DOMAIN = "pmlog.local";

  function config() {
    return window.PMLOG_CONFIG || {};
  }

  function emailOfUsername(username) {
    return String(username || "").trim().toLowerCase() + "@" + EMAIL_DOMAIN;
  }

  function getClient() {
    if (PMLOG._supabase) return PMLOG._supabase;
    var cfg = config();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || cfg.supabaseAnonKey.indexOf("YOUR_") === 0) {
      throw new Error("请先配置 prototypes/config.js（从 config.example.js 复制并填入 anon key）");
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("未加载 @supabase/supabase-js");
    }
    PMLOG._supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "pmlog_supabase_auth"
      }
    });
    return PMLOG._supabase;
  }

  PMLOG.emailOfUsername = emailOfUsername;
  PMLOG.getSupabase = getClient;
})(window.PMLOG);

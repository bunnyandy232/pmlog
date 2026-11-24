/* PMLog data access layer over Supabase */
window.PMLOG = window.PMLOG || {};

(function (PMLOG) {
  function mapProject(row, members) {
    var memberIds = [];
    var urgencyByUser = {};
    (members || []).forEach(function (m) {
      memberIds.push(m.user_id);
      if (m.urgency) urgencyByUser[m.user_id] = m.urgency;
    });
    return {
      id: row.id,
      name: row.name,
      start: row.start_date || "",
      end: row.end_date || "",
      importance: row.importance || null,
      contact: row.contact || "",
      assignedAt: row.assigned_at || "",
      memberIds: memberIds,
      leadId: row.lead_id,
      urgencyByUser: urgencyByUser,
      progress: row.progress || 0,
      status: row.status || "active",
      completedAt: row.completed_at || null
    };
  }

  function mapMilestone(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      date: row.milestone_date,
      text: row.body,
      authorId: row.author_id,
      fromLog: !!row.from_log
    };
  }

  function mapLog(row) {
    return {
      id: row.id,
      type: row.log_type,
      projectId: row.project_id,
      authorId: row.author_id,
      date: row.log_date,
      time: row.log_time || "09:00",
      content: row.content
    };
  }

  PMLOG.Store = {
    projects: [],
    milestones: [],
    logs: [],

    reload: async function () {
      var sb = PMLOG.getSupabase();
      var [pRes, mRes, lRes, memRes] = await Promise.all([
        sb.from("projects").select("*").order("assigned_at", { ascending: false }),
        sb.from("milestones").select("*").order("milestone_date", { ascending: false }),
        sb.from("work_logs").select("*").order("log_date", { ascending: false }),
        sb.from("project_members").select("*")
      ]);
      if (pRes.error) throw pRes.error;
      if (mRes.error) throw mRes.error;
      if (lRes.error) throw lRes.error;
      if (memRes.error) throw memRes.error;

      var byProject = {};
      (memRes.data || []).forEach(function (m) {
        if (!byProject[m.project_id]) byProject[m.project_id] = [];
        byProject[m.project_id].push(m);
      });

      this.projects = (pRes.data || []).map(function (row) {
        return mapProject(row, byProject[row.id] || []);
      });
      this.milestones = (mRes.data || []).map(mapMilestone);
      this.logs = (lRes.data || []).map(mapLog);
      return this;
    },

    upsertProject: async function (payload, existingId) {
      var sb = PMLOG.getSupabase();
      var session = PMLOG.Auth.getSession();
      var row = {
        name: payload.name,
        start_date: payload.start || null,
        end_date: payload.end || null,
        importance: payload.importance || null,
        contact: payload.contact || "",
        assigned_at: payload.assignedAt || null,
        lead_id: payload.leadId,
        status: payload.status || "active",
        progress: payload.progress || 0,
        completed_at: payload.completedAt || null
      };
      var projectId = existingId;
      if (existingId) {
        var upd = await sb.from("projects").update(row).eq("id", existingId).select("*").single();
        if (upd.error) throw upd.error;
        projectId = upd.data.id;
        await sb.from("project_members").delete().eq("project_id", projectId);
      } else {
        row.created_by = session && session.userId;
        var ins = await sb.from("projects").insert(row).select("*").single();
        if (ins.error) throw ins.error;
        projectId = ins.data.id;
      }
      var members = (payload.memberIds || []).map(function (uid) {
        return {
          project_id: projectId,
          user_id: uid,
          urgency: (payload.urgencyByUser && payload.urgencyByUser[uid]) || null
        };
      });
      if (members.length) {
        var mIns = await sb.from("project_members").insert(members);
        if (mIns.error) throw mIns.error;
      }
      return projectId;
    },

    deleteProject: async function (id) {
      var sb = PMLOG.getSupabase();
      var res = await sb.from("projects").delete().eq("id", id);
      if (res.error) throw res.error;
    },

    setImportance: async function (projectId, importance) {
      var sb = PMLOG.getSupabase();
      var res = await sb.from("projects").update({ importance: importance || null }).eq("id", projectId);
      if (res.error) throw res.error;
    },

    setUrgency: async function (projectId, userId, urgency) {
      var sb = PMLOG.getSupabase();
      var res = await sb.from("project_members")
        .update({ urgency: urgency || null })
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (res.error) throw res.error;
    },

    completeProject: async function (projectId, completedAt) {
      var sb = PMLOG.getSupabase();
      var res = await sb.from("projects").update({
        status: "done",
        progress: 100,
        completed_at: completedAt
      }).eq("id", projectId);
      if (res.error) throw res.error;
    },

    addMilestone: async function (payload) {
      var sb = PMLOG.getSupabase();
      var res = await sb.from("milestones").insert({
        project_id: payload.projectId,
        milestone_date: payload.date,
        body: payload.text,
        author_id: payload.authorId,
        from_log: !!payload.fromLog
      }).select("*").single();
      if (res.error) throw res.error;
      return mapMilestone(res.data);
    },

    addLog: async function (payload) {
      var sb = PMLOG.getSupabase();
      var res = await sb.from("work_logs").insert({
        log_type: payload.type,
        project_id: payload.projectId || null,
        author_id: payload.authorId,
        log_date: payload.date,
        log_time: payload.time,
        content: payload.content
      }).select("*").single();
      if (res.error) throw res.error;
      return mapLog(res.data);
    }
  };
})(window.PMLOG);

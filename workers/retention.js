export default {
  async scheduled(_event, env) {
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM inquiries WHERE expires_at < ?').bind(new Date(now).toISOString()),
      env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM bookings WHERE expires_at < ?').bind(new Date(now).toISOString()),
      env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR last_seen < ?').bind(now,now-1800000),
      env.DB.prepare('DELETE FROM admin_limits WHERE expires_at < ?').bind(now),
      env.DB.prepare('DELETE FROM admin_audit WHERE created_at < ?').bind(new Date(now-365*86400000).toISOString())
    ]);
  }
};

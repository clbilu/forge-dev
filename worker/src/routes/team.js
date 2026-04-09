import { Router } from 'itty-router';
import { uid } from '../lib/uid.js';
import { requireOwner, requireAccess } from '../middleware/auth.js';

const router = Router({ base: '/api' });

// ── GET /api/apps/:id/team ───────────────────────────────────────
router.get('/apps/:id/team', async (request, env) => {
  const appId = request.params.id;
  const err = await requireAccess(request, env, appId);
  if (err) return err;

  const app = await env.DB.prepare('SELECT user_id FROM apps WHERE id = ?').bind(appId).first();

  // Owner info
  const owner = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?')
    .bind(app.user_id).first();

  // Members
  const { results: members } = await env.DB.prepare(`
    SELECT m.id, m.role, m.joined_at, u.email, u.name
    FROM app_members m JOIN users u ON m.user_id = u.id
    WHERE m.app_id = ? ORDER BY m.joined_at
  `).bind(appId).all();

  // Pending invites
  const { results: invites } = await env.DB.prepare(`
    SELECT id, email, role, created_at, expires_at, token
    FROM invitations WHERE app_id = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY created_at DESC
  `).bind(appId).all();

  return new Response(JSON.stringify({
    owner: { ...owner, role: 'owner' },
    members,
    invites,
    currentRole: request.appRole,
  }));
});

// ── POST /api/apps/:id/invite ────────────────────────────────────
router.post('/apps/:id/invite', async (request, env) => {
  const appId = request.params.id;
  const err = await requireOwner(request, env, appId);
  if (err) return err;

  const { email, role = 'editor' } = await request.json();
  if (!email?.trim()) return new Response(JSON.stringify({ error: 'Email requerido' }), { status: 400 });
  if (!['editor','viewer'].includes(role))
    return new Response(JSON.stringify({ error: 'Role inválido' }), { status: 400 });

  // Delete existing unused invite for same email+app
  await env.DB.prepare('DELETE FROM invitations WHERE app_id = ? AND email = ? AND used = 0')
    .bind(appId, email.toLowerCase()).run();

  const token     = uid() + uid(); // longer token
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().replace('T',' ').slice(0,19);

  await env.DB.prepare(
    'INSERT INTO invitations (id, app_id, email, role, token, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(uid(), appId, email.toLowerCase(), role, token, request.userId, expiresAt).run();

  const frontendUrl = env.FRONTEND_URL || 'https://your-app.pages.dev';
  const inviteUrl   = `${frontendUrl}/invite/${token}`;

  return new Response(JSON.stringify({ ok: true, inviteUrl, token, expiresAt }), { status: 201 });
});

// ── DELETE /api/apps/:id/members/:memberId ───────────────────────
router.delete('/apps/:id/members/:memberId', async (request, env) => {
  const appId = request.params.id;
  const err = await requireOwner(request, env, appId);
  if (err) return err;
  await env.DB.prepare('DELETE FROM app_members WHERE id = ? AND app_id = ?')
    .bind(request.params.memberId, appId).run();
  return new Response(JSON.stringify({ ok: true }));
});

// ── PUT /api/apps/:id/members/:memberId ──────────────────────────
router.put('/apps/:id/members/:memberId', async (request, env) => {
  const appId = request.params.id;
  const err = await requireOwner(request, env, appId);
  if (err) return err;
  const { role } = await request.json();
  if (!['editor','viewer'].includes(role))
    return new Response(JSON.stringify({ error: 'Role inválido' }), { status: 400 });
  await env.DB.prepare('UPDATE app_members SET role = ? WHERE id = ? AND app_id = ?')
    .bind(role, request.params.memberId, appId).run();
  return new Response(JSON.stringify({ ok: true }));
});

// ── DELETE /api/invites/:inviteId ────────────────────────────────
router.delete('/invites/:inviteId', async (request, env) => {
  const invite = await env.DB.prepare('SELECT app_id FROM invitations WHERE id = ?')
    .bind(request.params.inviteId).first();
  if (!invite) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  const err = await requireOwner(request, env, invite.app_id);
  if (err) return err;
  await env.DB.prepare('DELETE FROM invitations WHERE id = ?').bind(request.params.inviteId).run();
  return new Response(JSON.stringify({ ok: true }));
});

export default router;

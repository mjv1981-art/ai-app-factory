import fs from 'node:fs/promises';
import path from 'node:path';
import { invariant, safePath } from '../factory/policy.mjs';
import { cookie, cookieValue, verifyWebhook } from './auth.mjs';
import { readiness } from './config.mjs';
import { previewDocument } from './preview.mjs';

export async function body(req, limit = 50000) {
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; invariant(size <= limit, 'Request too large.', 413); parts.push(part); }
  return Buffer.concat(parts);
}
const mime = name => ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }[path.extname(name)] || 'application/octet-stream');

export function createHandler({ service, auth, config, store, artifacts, dist = new URL('../dist/', import.meta.url) }) {
  return async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    const redirect = (url, cookies) => { res.writeHead(302, { Location: url, ...(cookies ? { 'Set-Cookie': cookies } : {}) }); res.end(); };
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, config.origin), route = url.pathname;
      if (route === '/health') return json(200, { status: 'ok' });
      if (route === '/api/session' && req.method === 'GET') {
        let session; try { session = await auth.session(req); } catch { /* Public setup status contains no secrets. */ }
        return json(200, { owner: session?.owner || null, csrf: session?.csrf || null, setup: readiness(config) });
      }
      if (route === '/api/auth/login' && req.method === 'GET') {
        invariant(readiness(config).authentication, 'GitHub sign-in is not configured.', 503);
        const login = await auth.begin(); return redirect(login.url, cookie('factory_oauth', login.state, config.origin.startsWith('https:'), 600));
      }
      if (route === '/api/auth/callback' && req.method === 'GET') {
        const sid = await auth.callback(url.searchParams.get('code'), url.searchParams.get('state'), cookieValue(req, 'factory_oauth'));
        return redirect('/factory', [cookie('factory_session', sid, config.origin.startsWith('https:')), cookie('factory_oauth', '', config.origin.startsWith('https:'), 0)]);
      }
      if (route === '/api/github/webhook' && req.method === 'POST') {
        const raw = await body(req, 1000000); verifyWebhook(raw, req.headers['x-hub-signature-256'], config.webhookSecret);
        const event = JSON.parse(raw);
        await store.audit(config.owner, 'github.webhook', { delivery: req.headers['x-github-delivery'], event: req.headers['x-github-event'], repository: event.repository?.full_name });
        if (req.headers['x-github-event'] === 'github_app_authorization') {
          for (const session of await store.list('sessions', config.owner)) await store.remove('sessions', session.id, config.owner);
        }
        if (['check_run', 'check_suite', 'status'].includes(req.headers['x-github-event'])) {
          const sha = event.check_run?.head_sha || event.check_suite?.head_sha || event.sha;
          const projects = await store.list('projects', config.owner);
          for (const run of await store.list('runs', config.owner)) {
            if (run.status === 'awaiting_ci' && run.pr?.sha === sha && projects.some(p => p.id === run.projectId && p.repository === event.repository?.full_name)) await service.check(run.id);
          }
        }
        return json(200, { accepted: true });
      }
      if (route.startsWith('/api/')) {
        const session = await auth.session(req);
        const data = req.method === 'POST' ? JSON.parse((await body(req)).toString() || '{}') : {};
        if (route === '/api/logout' && req.method === 'POST') {
          await store.remove('sessions', session.id, session.owner); res.setHeader('Set-Cookie', cookie('factory_session', '', config.origin.startsWith('https:'), 0)); return json(200, { ok: true });
        }
        if (route === '/api/dashboard' && req.method === 'GET') return json(200, await service.dashboard());
        if (route === '/api/projects/connect' && req.method === 'POST') return json(201, await service.connect(data, session.token));
        if (route === '/api/projects/create' && req.method === 'POST') return json(201, await service.create(data));
        const projectMatch = /^\/api\/projects\/([a-f0-9-]+)\/(request|baseline|refresh|knowledge|messages)$/.exec(route);
        if (projectMatch) {
          const [, projectId, action] = projectMatch;
          const project = await store.get('projects', projectId, session.owner);
          if (action === 'request' && req.method === 'POST') return json(201, await service.request(projectId, data.request));
          if (action === 'baseline' && req.method === 'POST') return json(200, await service.approveBaseline(projectId, data.sha));
          if (action === 'refresh' && req.method === 'POST') { await service.github.authorized(project.repository, session.token); return json(202, await service.queue(project, 'baseline')); }
          if (['knowledge', 'messages'].includes(action) && req.method === 'GET') return json(200, (await store.list(action, session.owner)).filter(r => r.projectId === projectId));
        }
        const runMatch = /^\/api\/runs\/([a-f0-9-]+)\/(approve|cancel|dispatch|checks)$/.exec(route);
        if (runMatch && req.method === 'POST') {
          const [, runId, action] = runMatch;
          await store.get('runs', runId, session.owner);
          if (action === 'approve') { await service.approve(runId, data.revision); await service.dispatch(runId); }
          if (action === 'cancel') await service.cancel(runId);
          if (action === 'dispatch') await service.dispatch(runId);
          if (action === 'checks') return json(200, await service.check(runId));
          return json(200, { ok: true });
        }
        const previewMatch = /^\/api\/preview\/([a-f0-9-]+)$/.exec(route);
        if (previewMatch && req.method === 'GET') {
          const { item, bytes } = await artifacts.get(session.owner, previewMatch[1]);
          invariant(item.name === 'preview.json', 'Not a preview artifact.');
          res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store',
            'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'" });
          return res.end(previewDocument(JSON.parse(bytes)));
        }
        const artifactMatch = /^\/api\/artifacts\/([a-f0-9-]+)$/.exec(route);
        if (artifactMatch && req.method === 'GET') {
          const { item, bytes } = await artifacts.get(session.owner, artifactMatch[1]);
          if (url.searchParams.get('preview') === '1') {
            invariant(item.name === 'preview.json', 'Not a preview artifact.');
            return json(200, { html: previewDocument(JSON.parse(bytes)) });
          }
          // Never execute repository-generated HTML on the authenticated control origin.
          res.writeHead(200, { 'Content-Type': item.type, 'Content-Disposition': `attachment; filename="${item.id}${path.extname(item.name)}"`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox; default-src 'none'" });
          return res.end(bytes);
        }
        return json(404, { error: 'Not found.' });
      }
      invariant(req.method === 'GET', 'Method not allowed.', 405);
      const relative = route.startsWith('/factory') || route === '/' ? 'index.html' : decodeURIComponent(route).slice(1);
      safePath(relative);
      let bytes; try { bytes = await fs.readFile(new URL(relative, dist)); } catch { return json(404, { error: 'Not found.' }); }
      res.writeHead(200, { 'Content-Type': mime(relative) }); res.end(bytes);
    } catch (error) { if (!res.headersSent) json(error.status || 500, { error: error.status ? error.message : 'Operation failed. Check server setup or run evidence.' }); else res.end(); }
  };
}

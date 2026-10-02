import path from 'node:path';
import { invariant } from '../factory/policy.mjs';

// Static previews execute only in an opaque-origin, network-disabled iframe.
// No preview server, credentials, or target backend is exposed on the control origin.
export function previewDocument(bundle) {
  invariant(bundle['dist/index.html'], 'Build did not provide a static index.html.');
  const cache = new Map(), visiting = new Set();
  function rewrite(text, current) {
    return text.replace(/(["'(])((?:\/?assets\/|\.\.?\/)[^"'()\s<>]+)(["')])/g, (match, left, url, right) => {
      const clean = url.split(/[?#]/)[0];
      const target = clean.startsWith('/') ? 'dist' + clean : path.posix.normalize(path.posix.join(path.posix.dirname(current), clean));
      return bundle[target] ? left + resource(target) + right : match;
    });
  }
  function resource(name) {
    if (cache.has(name)) return cache.get(name);
    invariant(!visiting.has(name), 'Cyclic preview imports require a dedicated isolated preview host.');
    visiting.add(name);
    let bytes = Buffer.from(bundle[name], 'base64');
    const ext = path.posix.extname(name);
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }[ext] || 'application/octet-stream';
    if (['.js', '.css'].includes(ext)) bytes = Buffer.from(rewrite(bytes.toString('utf8'), name));
    const data = `data:${type};base64,${bytes.toString('base64')}`;
    visiting.delete(name); cache.set(name, data); return data;
  }
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">`;
  let html = rewrite(Buffer.from(bundle['dist/index.html'], 'base64').toString('utf8'), 'dist/index.html');
  // Place policy before repository markup; later policies can restrict, never relax it.
  html = csp + html;
  invariant(html.length <= 20_000_000, 'Preview exceeds the inline size limit.');
  return html;
}

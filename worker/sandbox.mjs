import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { id, safePath, validateBundle, invariant } from '../factory/policy.mjs';

export function command(executable, args, { timeout = 120000, cwd, signal } = {}) {
  return new Promise((resolve, reject) => {
    // No cloud/model/database credentials reach docker or child tools.
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'TEMP', 'TMP', 'DOCKER_HOST', 'DOCKER_CONFIG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
    const child = spawn(executable, args, { cwd, env, shell: false, windowsHide: true, signal });
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    const collect = bytes => { output = (output + bytes.toString()).slice(-2_000_000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({ code: timedOut ? 124 : code, output, timedOut }); });
  });
}
export function dockerArgs({ name, root, network, image, args }) {
  invariant(/^[a-zA-Z0-9_./:-]+(?:@sha256:[a-f0-9]{64})?$/.test(image), 'Invalid worker image.');
  invariant(/^[a-zA-Z0-9_.-]+$/.test(network), 'Invalid build network.');
  return ['run', '--name', name, '--rm', '--init', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--pids-limit=256', '--memory=2g', '--cpus=2', '--network', network, '--user', '1000:1000',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=512m', '--mount', `type=bind,source=${root},target=/workspace`,
    '--workdir', '/workspace', '--env', 'CI=true', '--env', 'HOME=/tmp', '--env', 'PLAYWRIGHT_BROWSERS_PATH=/ms-playwright', image, ...args];
}
async function collect(root, directory, maxBytes = 12000000) {
  const result = {}; let total = 0;
  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      invariant(!entry.isSymbolicLink(), 'Symlink output rejected.');
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/'); safePath(relative);
        const stat = await fs.stat(absolute);
        invariant(stat.size <= maxBytes - total, 'Output exceeds artifact allowance.');
        const bytes = await fs.readFile(absolute); total += bytes.length;
        invariant(total <= maxBytes && Object.keys(result).length < 1000, 'Output exceeds artifact allowance.');
        result[relative] = bytes.toString('base64');
      }
    }
  }
  try { await fs.lstat(path.join(root, directory)); } catch (error) { if (error.code === 'ENOENT') return result; throw error; }
  invariant(!(await fs.lstat(path.join(root, directory))).isSymbolicLink(), 'Symlink output directory rejected.');
  await walk(path.join(root, directory)); return result;
}
export class Sandbox {
  constructor({ image, network, runner = command }) { Object.assign(this, { image, network, runner }); }
  async verify(files, { create = false, signal } = {}) {
    validateBundle(files);
    invariant(this.image && this.network, 'Isolated build image and restricted network must be configured.', 503);
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-job-'));
    const results = [], names = [];
    try {
      // Files enter a fresh directory as regular files. Never unpack repository-controlled archives.
      for (const [name, entry] of Object.entries(files)) {
        const full = path.join(root, safePath(name)); await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, entry.content, entry.encoding === 'base64' ? 'base64' : 'utf8');
      }
      await fs.chmod(root, 0o777);
      // UID 1000 in a rootless, capability-free container owns only its disposable workspace.
      if (process.platform !== 'win32') {
        const permission = await this.runner('chmod', ['-R', 'a+rwX', root]);
        invariant(permission.code === 0, 'Could not prepare disposable workspace.');
      }
      const steps = [...(create ? [['lockfile', ['npm', 'install', '--package-lock-only', '--ignore-scripts']]] : []),
        ['install', ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']],
        ['build', ['npm', 'run', 'build']],
        ['playwright', ['npx', '--no-install', 'playwright', 'test', '--reporter=json', '--output=test-results']]];
      for (const [stage, args] of steps) {
        const name = `factory-${id()}`; names.push(name);
        const started = Date.now();
        const r = await this.runner('docker', dockerArgs({ name, root, network: stage === 'install' || stage === 'lockfile' ? this.network : 'none', image: this.image, args }), { timeout: 300000, signal });
        // Kill a container after timeout/abort; killing the docker client alone is insufficient.
        await this.runner('docker', ['rm', '-f', name], { timeout: 10000 }).catch(() => {});
        results.push({ stage, ...r, elapsedMs: Date.now() - started });
        if (r.code !== 0) break;
      }
      const evidence = await collect(root, 'test-results');
      const preview = await collect(root, 'dist');
      const testResult = results.find(r => r.stage === 'playwright');
      let stats = null;
      if (testResult) { try { stats = JSON.parse(testResult.output).stats; } catch { /* Insufficient evidence fails closed. */ } }
      const passed = results.length === steps.length && results.every(r => r.code === 0) && stats && stats.expected > 0 && stats.unexpected === 0 && stats.skipped === 0;
      let lockfile;
      if (create && results.find(r => r.stage === 'lockfile')?.code === 0) {
        invariant(!(await fs.lstat(path.join(root, 'package-lock.json'))).isSymbolicLink(), 'Invalid lockfile output.');
        lockfile = await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'); JSON.parse(lockfile);
      }
      return { passed: Boolean(passed), results, stats, evidence, preview, lockfile };
    } finally {
      for (const name of names) await this.runner('docker', ['rm', '-f', name], { timeout: 10000 }).catch(() => {});
      await fs.rm(root, { recursive: true, force: true });
    }
  }
}

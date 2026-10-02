export function newProjectFiles() {
  const raw = {
    'package.json': JSON.stringify({ name: 'factory-app', private: true, version: '0.0.0', type: 'module', scripts: { dev: 'vite --host 0.0.0.0', build: 'vite build', test: 'playwright test' },
      dependencies: { react: '19.2.8', 'react-dom': '19.2.8' }, devDependencies: { vite: '8.2.0', '@playwright/test': '1.63.0' } }, null, 2),
    'index.html': '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>New app</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    'src/main.jsx': "import React from 'react'; import {createRoot} from 'react-dom/client'; import App from './App.jsx'; createRoot(document.getElementById('root')).render(<App/>);",
    'src/App.jsx': "import React from 'react'; export default function App(){return <main><h1>New app</h1><p>Your application starts here.</p></main>}",
    'playwright.config.js': "import {defineConfig} from '@playwright/test'; export default defineConfig({testDir:'./tests',use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173'}});",
    'tests/home.spec.js': "import {test,expect} from '@playwright/test'; test('app renders a main landmark',async({page})=>{await page.goto('/'); await expect(page.getByRole('main')).toBeVisible();});",
    '.gitignore': 'node_modules/\ndist/\n.env\ntest-results/\nplaywright-report/\n',
    '.github/workflows/regression.yml': 'name: Regression\non: [push, pull_request]\npermissions:\n  contents: read\njobs:\n  playwright:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          persist-credentials: false\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 24\n      - run: npm ci\n      - run: npx playwright install --with-deps chromium\n      - run: npm run build\n      - run: npx playwright test\n',
    'docs/PRODUCT.md': '# Product\n\nPending the approved creation request.\n',
    'docs/ARCHITECTURE.md': '# Architecture\n\nReact / Vite web application; Playwright browser regression.\n',
    'docs/DECISIONS.md': '# Decisions\n\nInitial architecture: React / Vite, as approved in the creation plan.\n',
    'docs/PRODUCT_REGRESSION_PACK.md': '# Regression baseline\n\nA main landmark loads. Extend this pack with each accepted product journey.\n',
    'AGENTS.md': '# Project rules\n\nImplement only approved Change Contracts. Preserve existing tests and golden images. Human merge required. Read docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/DECISIONS.md and docs/PRODUCT_REGRESSION_PACK.md.\n',
  };
  return Object.fromEntries(Object.entries(raw).map(([p, content]) => [p, { encoding: 'utf-8', content }]));
}

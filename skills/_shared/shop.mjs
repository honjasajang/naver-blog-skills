// 가게 파일(.agents/blog-shop.md)의 ```json shop 블록을 읽는다. 모든 스크립트가 이걸로만 값을 가져온다.
import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// .env를 읽어 process.env에 넣는다. 모든 스크립트가 이 파일을 import하므로, 스크립트 본문보다 먼저 돈다.
// 찾는 곳: 지금 폴더부터 위로 6단계 → 이 도구 폴더(skills/_shared의 두 단계 위). 이미 있는 환경변수는 덮지 않는다.
function loadDotEnv() {
  const seen = new Set();
  const tryFile = (p) => {
    if (seen.has(p) || !existsSync(p)) return;
    seen.add(p);
    for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const line = raw.replace(/^﻿/, '').trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, '');
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  };
  let d = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    tryFile(join(d, '.env'));
    const up = resolve(d, '..');
    if (up === d) break;
    d = up;
  }
  tryFile(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env'));
}
loadDotEnv();

export function findShop(start = process.cwd()) {
  let d = resolve(start);
  for (let i = 0; i < 6; i++) {
    for (const n of ['.agents/blog-shop.md', '.agents/blog-shop.example.md']) {
      const p = join(d, n);
      if (existsSync(p)) return p;
    }
    const up = resolve(d, '..');
    if (up === d) break;
    d = up;
  }
  return null;
}

export function loadShop() {
  const p = process.env.BLOG_SHOP || findShop();
  if (!p) {
    console.error('🔴 가게 파일이 없다 — .agents/blog-shop.example.md를 복사해 .agents/blog-shop.md를 만들어라(업종·씨앗 검색어·블로그 ID만 먼저).');
    process.exit(2);
  }
  const md = readFileSync(p, 'utf8');
  const m = md.match(/```json\s+shop\s*\n([\s\S]*?)\n```/);
  if (!m) { console.error(`🔴 가게 파일에 \`\`\`json shop 블록이 없다: ${p}`); process.exit(2); }
  const shop = JSON.parse(m[1]);
  shop._path = p;
  shop._root = resolve(p, '..', '..');
  shop._example = /example\.md$/.test(p);
  return shop;
}

export function dataDir(shop) {
  const rel = shop.폴더?.자료 || '.agents/blog-data';
  return resolve(shop._root, rel);
}

export function naverKeys() {
  const id = process.env.NAVER_CLIENT_ID, secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    console.error('🔴 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 없다 — .env에 넣어라.');
    console.error('   발급: developers.naver.com → 애플리케이션 등록 → 「사용 API」에 검색·데이터랩(검색어트렌드) 둘 추가.');
    console.error('   키 없이 보낼 요청만 보려면 --dry');
    process.exit(2);
  }
  return { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

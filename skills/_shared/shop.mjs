// 가게 파일(.agents/blog-shop.md)의 ```json shop 블록을 읽는다. 모든 스크립트가 이걸로만 값을 가져온다.
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

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

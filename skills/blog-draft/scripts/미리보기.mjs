#!/usr/bin/env node
// 미리보기 — 초안 폴더를 네이버 본문처럼 그려 미리보기.html로 뽑는다. 표는 휴대폰 폭(350px)으로 그린다.
//   node 미리보기.mjs <초안 폴더>
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { loadShop } from '../../_shared/shop.mjs';

const DIR = resolve(process.argv[2] ?? '');
if (!existsSync(join(DIR, 'post.json'))) { console.error('post.json 없음:', DIR); process.exit(2); }
const shop = loadShop();
const post = JSON.parse(readFileSync(join(DIR, 'post.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const body = post.blocks.map((b) => {
  if (b.t === 'h') return `<h2>${esc(b.x)}</h2>`;
  if (b.t === 'p') return `<p>${esc(b.x).replace(/\n/g, '<br>')}</p>`;
  if (b.t === 'ul') return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  if (b.t === 'table') return `<table>${b.rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>`;
  if (b.t === 'img') return `<figure><img src="${b.src}" alt="${esc(b.alt ?? '')}"></figure>`;
  if (b.t === 'link') return `<p class="link">→ ${esc(b.url)}</p>`;
  return '';
}).join('\n');
const chars = post.blocks.filter((b) => ['p', 'ul', 'h'].includes(b.t)).reduce((n, b) => n + (b.x ?? b.items?.join('') ?? '').replace(/\s/g, '').length, 0);
writeFileSync(join(DIR, '미리보기.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(post.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap">
<style>
 body{background:#f5f5f5;margin:0;padding:24px;font-family:"Noto Sans KR",sans-serif;color:#222}
 .sheet{max-width:640px;margin:0 auto;background:#fff;padding:36px 28px 60px;border-radius:8px;box-shadow:0 1px 8px rgba(0,0,0,.08)}
 h1{font-size:23px;line-height:1.4;margin:0 0 6px}
 .meta{font-size:13px;color:#888;border-bottom:1px solid #eee;padding-bottom:16px;margin-bottom:24px}
 h2{font-size:19px;font-weight:700;margin:34px 0 12px}
 table{width:350px;table-layout:fixed;border-collapse:collapse;margin:0 0 14px} th,td{border:1px solid #ddd;padding:8px 6px;font-size:16px;text-align:center} th{background:#f6f6f6}
 p{font-size:16px;line-height:1.8;margin:0 0 14px} p.link{color:#2a6fb0;font-size:14px}
 ul{margin:0 0 14px;padding-left:20px} li{font-size:16px;line-height:1.8;margin-bottom:6px}
 figure{margin:22px 0} img{width:100%;border-radius:4px;display:block}
 .tags{margin-top:36px;font-size:14px;color:#2e7d32;line-height:2}
</style></head><body><div class="sheet">
<h1>${esc(post.title)}</h1>
<div class="meta">${esc(shop.가게?.이름 ?? '')} &nbsp;|&nbsp; 본문 ${chars}자 · 소제목 ${post.blocks.filter((b) => b.t === 'h').length} · 사진 ${post.blocks.filter((b) => b.t === 'img').length} · 표 ${post.blocks.filter((b) => b.t === 'table').length}</div>
${body}
<div class="tags">${(post.tags ?? []).map((t) => '#' + esc(t)).join(' ')}</div>
</div></body></html>`);
console.log(`미리보기.html 만듦 · 본문 ${chars}자 · 휴대폰 폭으로 보려면 창을 390px로 좁혀라`);

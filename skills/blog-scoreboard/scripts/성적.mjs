#!/usr/bin/env node
/**
 * 성적 — 하루 한 번. 통계(자기 크롬, 통계 화면만) + 색인·순위(네이버 검색 API).
 *   node 성적.mjs [--기간=7] [--순위 "검색어" ...]
 * 우리 글을 열지 않는다. 비공식 글 목록 엔드포인트를 쓰지 않는다(발행일·글 목록은 「올린-글」 폴더 안 각 글의 발행.json).
 */
import { chromium } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { loadShop, sleep } from '../../_shared/shop.mjs';

const shop = loadShop();
const BLOG = shop.가게?.블로그ID;
if (!BLOG) { console.error('🔴 가게 파일 가게.블로그ID가 없다'); process.exit(2); }
const PORT = shop.폴더?.크롬포트;
const argv = process.argv.slice(2);
const 기간 = Math.max(1, Math.min(15, +(argv.find((a) => a.startsWith('--기간='))?.split('=')[1] || 7)));
const ri = argv.indexOf('--순위');
const ranks = ri === -1 ? [] : argv.slice(ri + 1).filter((a) => !a.startsWith('--'));
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const keys = process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET ? { 'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID, 'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET } : null;

/* 올린 글 목록·발행일 — 「올린-글」 폴더 안 각 글의 발행.json { url, date, title } */
const 올린글 = [];
{
  const base = resolve(shop._root, shop.폴더?.초안 ?? 'blog/drafts', '올린-글');
  if (existsSync(base)) for (const d of readdirSync(base)) {
    const f = join(base, d, '발행.json');
    if (!existsSync(f)) continue;
    try { const j = JSON.parse(readFileSync(f, 'utf8')); const post = existsSync(join(base, d, 'post.json')) ? JSON.parse(readFileSync(join(base, d, 'post.json'), 'utf8')) : null; 올린글.push({ ...j, no: String(j.url || '').split('/').pop(), post }); } catch { /* 깨진 파일 */ }
  }
}
const 발행일 = new Set(올린글.map((x) => String(x.date || '').slice(0, 10)));
const 못본것 = [];

// ── 1. 조회수 (자기 크롬 · 통계 화면만) ──────────────────────────────
if (!PORT) { console.log('■ 조회수 — 못 잼: 가게 파일 폴더.크롬포트가 비어 있다. docs/설치안내.md 「성적표용 크롬」대로 크롬을 포트와 함께 띄우고 네이버에 로그인해 둬라'); 못본것.push('조회수(크롬 포트 없음)'); }
else {
  let b;
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    if (!list.some((t) => t.type === 'page')) await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
    b = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  } catch { console.log(`■ 조회수 — 못 잼: 포트 ${PORT}에 크롬이 없다. docs/설치안내.md 「성적표용 크롬」`); 못본것.push('조회수(크롬 안 뜸)'); }
  if (b) {
    const p = await b.contexts()[0].newPage();
    await p.goto(`https://admin.blog.naver.com/${BLOG}/stat/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(6000);
    const stat = p.frames().find((f) => /blog\.stat\.naver\.com/.test(f.url()));
    if (!stat) { console.log('■ 조회수 — 못 잼: 통계 화면이 안 열린다(네이버 로그인이 풀렸거나 화면이 바뀜). 그 크롬에서 로그인 상태를 봐라'); 못본것.push('조회수(통계 화면)'); }
    else {
      const api = (path) => stat.evaluate(async (path) => { const r = await fetch('https://blog.stat.naver.com/api/blog/' + path + '&exclude=&_=' + Date.now(), { credentials: 'include' }); try { return (await r.json()).result.statDataList; } catch { return null; } }, path);
      const rowsOf = (list, id) => (list || []).find((s) => s.dataId === id)?.data?.rows || {};
      const 갈래 = (dom) => (/검색|oogle|Daum|Bing/.test(dom) ? '검색' : /^네이버 블로그/.test(dom) ? '안' : /^네이버 메인/.test(dom) ? '홈' : '밖');
      const 가르기 = (경로) => { const n = { 검색: 0, 안: 0, 홈: 0, 밖: 0 }; (경로.referrerDomain || []).forEach((dom, k) => { if (dom) n[갈래(dom)] += 경로.cv[k]; }); return n; };
      const 일 = rowsOf(await api(`daily/cv?timeDimension=DATE&startDate=${오늘}`), 'cv');
      const 날짜들 = (일.date || []).slice(0, 기간);
      console.log(`\n■ 일별 조회수 (최근 ${날짜들.length}일 · ${오늘}은 지금까지) — 글별 숫자는 검색에서 온 것만`);
      console.log('   날짜   전체  검색  홈판  안  출처없음');
      const 검색어줄 = []; const 합 = { 전체: 0, 검색: 0, 홈: 0, 안: 0, 없음: 0 };
      for (const [i, d] of 날짜들.entries()) {
        const r = await api(`user/referer/total?timeDimension=DATE&startDate=${d}`);
        const n = 가르기(rowsOf(r, 'refererTotal'));
        const 없음 = 일.cv[i] - n.검색 - n.안 - n.홈 - n.밖;
        const g = rowsOf(await api(`rank/cvContentPc?timeDimension=DATE&startDate=${d}`), 'rankCv');
        const 글 = [];
        for (const [k, uri] of (g.uri || []).entries()) {
          if (!g.cv[k]) continue;
          const no = String(uri).split('/').pop();
          const 검색 = 가르기(rowsOf(await api(`article/referer/total?timeDimension=DATE&startDate=${d}&contentId=${no}`), 'refererTotal')).검색;
          if (검색) 글.push(`${String(g.title[k]).slice(0, 9)} ${검색}`);
        }
        console.log('   ' + d.slice(5) + String(일.cv[i]).padStart(6) + String(n.검색).padStart(6) + String(n.홈).padStart(6) + String(n.안).padStart(4) + String(없음).padStart(8) + (없음 > 0 ? ' 🔴' : '   ') + (발행일.has(d) ? '⚠️ ' : '   ') + 글.join(' · ') + (n.밖 ? ` · (그 밖 ${n.밖})` : ''));
        합.전체 += 일.cv[i]; 합.검색 += n.검색; 합.홈 += n.홈; 합.안 += n.안; 합.없음 += 없음;
        const 검색어 = {}; const t = rowsOf(r, 'refererTotal');
        for (const dom of t.referrerDomain || []) {
          if (갈래(dom) !== '검색') continue;
          const dl = await api(`user/referer/total/detail?timeDimension=DATE&startDate=${d}&searchEngine=1&refererDomain=${encodeURIComponent(dom)}`);
          const q = rowsOf(dl, (dl || [])[0]?.dataId);
          (q.searchQuery || []).forEach((s, k) => { 검색어[s] = (검색어[s] || 0) + q.cv[k]; });
        }
        검색어줄.push('   ' + d.slice(5) + '  ' + (Object.entries(검색어).sort((a, c) => c[1] - a[1]).map(([s, c]) => `${s} ${c}`).join(' · ') || '(검색어 없음)'));
      }
      console.log(`   합    ${String(합.전체).padStart(6)}${String(합.검색).padStart(6)}${String(합.홈).padStart(6)}${String(합.안).padStart(4)}${String(합.없음).padStart(8)}`);
      console.log('   (🔴 출처 없음 = 주소로 바로 연 것, 큰 숫자는 우리 접속 · ⚠️ = 글을 올린 날 · 성과는 「검색」 칸으로, 홈판은 따로)');
      console.log('\n■ 들어온 검색어'); 검색어줄.forEach((l) => console.log(l));
    }
    await p.close(); await b.close();
  }
}

// ── 2·3. 색인·순위 (검색 API, 블로그 탭 기준) ──────────────────────────
const search = async (q, display = 100) => {
  const r = await fetch(`https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(q)}&display=${display}&sort=sim`, { headers: keys });
  if (!r.ok) throw new Error(`검색 API ${r.status}`);
  return ((await r.json()).items ?? []).map((it) => ({ id: (it.bloggerlink.match(/blog\.naver\.com\/([^/?#]+)/) || [])[1], no: (it.link.match(/(\d{9,})/) || [])[1] }));
};
if (!keys) { console.log('\n■ 색인·순위 — 못 잼: NAVER_CLIENT_ID/SECRET이 없다(.env). 검색 API가 필요하다'); 못본것.push('색인·순위(API 키 없음)'); }
else {
  if (올린글.length) {
    console.log('\n■ 색인 (제목 그대로 검색 → 안 잡히면 본문 문장 둘을 따옴표로) — 블로그 탭 기준');
    let ok = 0;
    for (const it of 올린글) {
      const title = it.title || it.post?.title || '';
      const mine = (r) => r.id === BLOG && (!it.no || r.no === it.no);
      let 표시 = '❌       ';
      try {
        if ((await search(title, 30)).some(mine)) 표시 = '✅ 제목  ';
        else {
          const paras = (it.post?.blocks ?? []).filter((x) => x.t === 'p').map((x) => x.x);
          const 문장 = []; for (const t of paras) for (const s of t.split(/(?<=[.?!요다])\s+|\n/)) { const x = s.replace(/[.?!]+$/, '').trim(); if (x.length >= 16 && x.length <= 30 && /^[가-힣0-9 ]+$/.test(x)) 문장.push(x); }
          const pick = [문장[Math.floor(문장.length * 0.3)], 문장[Math.floor(문장.length * 0.7)]].filter(Boolean);
          const 잡힘 = []; for (const s of pick) { 잡힘.push((await search('"' + s + '"', 30)).some(mine)); await sleep(1200); }
          if (잡힘.some(Boolean)) 표시 = '✅ 본문  '; else if (!잡힘.length) 표시 = '❓ 초안없음';
        }
      } catch (e) { 표시 = `⚠️ ${String(e.message).slice(0, 12)}`; }
      if (표시.startsWith('✅')) ok++;
      console.log('   ' + 표시 + ' ' + String(it.date || '').slice(0, 10).padEnd(11) + title.slice(0, 38));
      await sleep(1200);
    }
    console.log(`   → 올린 글 ${올린글.length}편 중 색인 ${ok}편 (색인과 순위는 다른 문제다)`);
  } else console.log('\n■ 색인 — 올린-글/*/발행.json이 없어 잴 글이 없다. 올린 뒤 발행.json에 {url,date,title}을 적어라');
  if (ranks.length) {
    console.log('\n■ 블로그 탭 순위 (검색 API 100위까지) — 사람 화면(통합검색 첫 화면)과 다르다');
    for (const q of ranks) {
      try { const rows = await search(q, 100); const i = rows.findIndex((r) => r.id === BLOG); console.log('   ' + q.padEnd(14) + (i === -1 ? `${rows.length}위 밖` : `${i + 1}위`)); }
      catch (e) { console.log('   ' + q.padEnd(14) + '못 잼 ' + e.message); }
      await sleep(1200);
    }
  }
}
console.log(`\n■ 못 본 것: ${못본것.length ? 못본것.join(' · ') : '없음'} · 순위는 블로그 탭·API 기준 · 통계 주소는 네이버가 바꾸면 깨진다`);

#!/usr/bin/env node
/**
 * 타율 — 수요 × 자리 × 가족을 한 표로. **무엇을 쓸지는 여기서 고른다.**
 *
 *   node 타율.mjs            # 가족별
 *   node 타율.mjs --검색어   # 검색어 하나하나(수요 높은 순 40)
 *   node 타율.mjs 백호살      # 그 가족만
 *
 * 왜 셋을 곱하나: 자리만 보면 「이겨도 안 남는」 곳(백호살 8/10인데 수요 29), 수요만 보면 못 뚫는 곳(띠별운세 5,171인데 2/10),
 * 가족을 빼면 한 자리만 먹는다(홍염살 하나로 13자리 1위를 먹는 블로그가 하루 593명). 가족을 통째로 먹는 게 실력이다.
 *
 * 입력: 자료/상위10.json(자리-api) · 자료/수요.json(수요재기-api) · 자료/블로그.json(이웃 수, 있으면) · 가게 파일(가족·우리글·기준치)
 * 「작은 블로그」 판정은 이웃 수가 있는 곳만. 없는 곳은 미판정 — 분모에서도 뺀다.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadShop, dataDir } from '../../_shared/shop.mjs';

const shop = loadShop();
const DATA = dataDir(shop);
const rd = (f, dflt) => (existsSync(join(DATA, f)) ? JSON.parse(readFileSync(join(DATA, f), 'utf8')) : dflt);
const top = rd('상위10.json', {});
const demand = rd('수요.json', { 값: {} }).값;
const blogs = rd('블로그.json', {});
const 이웃최대 = shop.기준치?.레퍼런스?.이웃최대 ?? 300;
const 약한최소 = shop.기준치?.자리?.약한자리최소 ?? 6;
const 경고지수 = shop.수요?.환산?.지수 ?? null;
const FAM = shop.검색어?.가족 ?? [];
const 우리것 = new Set(shop.검색어?.우리글 ?? []);
if (shop._example) console.log('⚠️ 예시 가게 파일(blog-shop.example.md)로 돌고 있다 — 가상 네일샵 값이다. 자기 가게 파일을 만들어라.');

const 가족 = (kw) => FAM.find((f) => kw.includes(f)) ?? '기타';
const 판정 = (id) => { const b = blogs[id]; return b?.이웃 == null ? null : b.이웃 < 이웃최대; };

const rows = Object.entries(top).filter(([k, v]) => !k.startsWith('_') && Array.isArray(v) && v.length >= 8).map(([kw, v]) => {
  const js = v.map((x) => 판정(x.id));
  return {
    kw, 가족: 가족(kw), n: v.length,
    약한: js.filter((x) => x === true).length, 판정됨: js.filter((x) => x !== null).length, 미판정: js.filter((x) => x === null).length,
    수요: demand[kw]?.제외 ? null : (demand[kw]?.지수 ?? null),
  };
});
if (!rows.length) { console.log('잰 자료가 없다 — 자리-api.mjs와 수요재기-api.mjs를 먼저 돌려라'); process.exit(2); }

const 뚫림 = (r) => r.판정됨 > 0 && r.약한 >= Math.min(약한최소, r.판정됨) && r.약한 >= 약한최소 * (r.판정됨 / r.n);
const fmt = (r) => `${String(r.수요 ?? '-').padStart(7)} ${(r.약한 + '/' + r.판정됨 + (r.미판정 ? `(?${r.미판정})` : '')).padStart(10)}  ${r.kw}${뚫림(r) ? '  ✓뚫림' : ''}${경고지수 && r.수요 != null && r.수요 < 경고지수 ? '  ⚠수요낮음' : ''}`;

const one = process.argv.slice(2).find((a) => !a.startsWith('-'));
if (one) {
  const r = rows.filter((x) => x.kw.includes(one)).sort((a, b) => (b.수요 ?? -1) - (a.수요 ?? -1));
  console.log(`\n■ "${one}" 가족 — 검색어 ${r.length}개 · 우리 글 ${우리것.has(one) ? '있음' : '없음'}`);
  console.log('   수요'.padStart(8) + '약한자리'.padStart(10) + '  검색어   (약한/판정됨, ?=미판정)');
  r.forEach((x) => console.log(fmt(x)));
  console.log(`  → 수요 합 ${r.reduce((a, c) => a + (c.수요 ?? 0), 0).toFixed(0)} · 뚫리는 검색어 ${r.filter(뚫림).length}/${r.length} · 미판정 블로그 ${r.reduce((a, c) => a + c.미판정, 0)}`);
  console.log('  한계: 블로그 탭 기준 · 수요는 상대값(큰쪽 앵커=100) · 미판정은 이웃 수를 손으로 넣으면 판정된다');
  process.exit(0);
}
if (process.argv.includes('--검색어')) {
  console.log('\n■ 검색어별 (수요 높은 순 40)');
  rows.filter((x) => x.수요 != null).sort((a, b) => b.수요 - a.수요).slice(0, 40).forEach((x) => console.log(fmt(x)));
  process.exit(0);
}
const byFam = {};
for (const r of rows) (byFam[r.가족] ||= []).push(r);
console.log('\n■ 가족별 타율  (수요 합 · 뚫리는 검색어/전체 · 미판정 · 우리 글)');
Object.entries(byFam)
  .map(([f, rs]) => ({ f, n: rs.length, 수요: rs.reduce((a, c) => a + (c.수요 ?? 0), 0), 뚫: rs.filter(뚫림).length, 미: rs.reduce((a, c) => a + c.미판정, 0), 우리: 우리것.has(f) }))
  .sort((a, b) => b.수요 - a.수요)
  .forEach((x) => console.log(`  ${String(x.수요.toFixed(0)).padStart(7)}  ${(x.뚫 + '/' + x.n).padStart(7)}  ?${String(x.미).padStart(3)}  ${x.우리 ? '우리글○' : '       '}  ${x.f}`));
console.log(`\n  기준: 약한자리 = 이웃 < ${이웃최대} · 뚫림 = 판정된 것 중 ${약한최소}/10 비율 이상${경고지수 ? ` · ⚠ = 수요 < ${경고지수}(가게 파일 환산 기준)` : ''}`);
console.log('  한계: 블로그 탭 기준 · 수요는 상대값 · 미판정(?)은 세지도 분모에도 넣지 않았다');

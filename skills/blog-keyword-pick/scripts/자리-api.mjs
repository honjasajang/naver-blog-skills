#!/usr/bin/env node
/**
 * 자리 — 네이버 검색 **공식 API**(블로그)로 검색어마다 상위 10의 블로그를 받아 둔다.
 *
 *   node 자리-api.mjs "백호살 뜻" "백호살 여자"      # 몇 개
 *   node 자리-api.mjs --가족 백호살                    # 자료/검색어사전.json에서 그 가족 전부
 *   node 자리-api.mjs --dry "백호살 뜻"
 *
 * 한계(결과에 그대로 적어라):
 *  - 이것은 **블로그 탭** 결과다. 휴대폰 통합검색 첫 화면(인플루언서·AI 탭·동영상 섞임)과 다르다.
 *  - API에는 **이웃 수·방문 수가 없다**. 「작은 블로그」 판정은 자료/블로그.json에 이웃 수가 있는 곳만 하고,
 *    없는 곳은 「미판정」이다. 손으로 넣는 법: {"<블로그ID>": {"이웃": 123}} 를 블로그.json에 추가.
 *  - 자동완성·통합검색 긁기는 하지 않는다(네이버 약관).
 *
 * API: GET https://openapi.naver.com/v1/search/blog.json?query=&display=10&sort=sim · 하루 25,000회
 *      items[]: title · link · description · bloggername · bloggerlink · postdate (문서 2026-10-30 확인)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadShop, dataDir, naverKeys, sleep } from '../../_shared/shop.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const shop = loadShop();
const DATA = dataDir(shop);
const OUT = join(DATA, '상위10.json');
const n = shop.기준치?.자리?.표본 ?? 10;

let targets = args.filter((a) => !a.startsWith('--'));
const fam = args.indexOf('--가족');
if (fam >= 0) {
  const name = args[fam + 1];
  const dict = join(DATA, '검색어사전.json');
  if (!existsSync(dict)) { console.error('자료/검색어사전.json이 없다 — 가족 검색어 목록을 먼저 만들어라(손·가게 파일)'); process.exit(2); }
  targets = JSON.parse(readFileSync(dict, 'utf8')).filter((k) => k.includes(name));
}
if (!targets.length) { console.error('잴 검색어가 없다'); process.exit(2); }

const store = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const idOf = (bloggerlink) => (bloggerlink.match(/blog\.naver\.com\/([^/?#]+)/)?.[1] ?? bloggerlink);
const strip = (s) => s.replace(/<[^>]+>/g, '');

let calls = 0;
for (const kw of [...new Set(targets)]) {
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(kw)}&display=${n}&sort=sim`;
  if (dry) { console.log(url); continue; }
  const res = await fetch(url, { headers: naverKeys() });
  calls++;
  if (!res.ok) { console.error(`API ${res.status}: ${await res.text()}`); process.exit(1); }
  const j = await res.json();
  store[kw] = (j.items ?? []).map((it, i) => ({
    rank: i + 1, id: idOf(it.bloggerlink), blog: it.bloggername, title: strip(it.title), postdate: it.postdate, link: it.link,
  }));
  store[kw]._meta = { total: j.total, 기준: '블로그 탭(검색 API sort=sim)', 잰날: new Date().toISOString().slice(0, 10) };
  console.log(`  ${kw.padEnd(16)} ${store[kw].length}개 · 전체 ${j.total}`);
  mkdirSync(DATA, { recursive: true }); writeFileSync(OUT, JSON.stringify(store, null, 1));
  await sleep(1500);
}
if (!dry) console.log(`저장 ${OUT} · API 호출 ${calls}회 (하루 한도 25,000)`);

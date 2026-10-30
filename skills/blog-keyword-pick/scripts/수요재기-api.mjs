#!/usr/bin/env node
/**
 * 수요재기 — 네이버 데이터랩 검색어트렌드 **공식 API**로 검색어 수요 지수를 잰다.
 *
 *   node 수요재기-api.mjs 백호살 삼재 "띠별 운세"     # 몇 개
 *   node 수요재기-api.mjs --씨앗                      # 가게 파일 씨앗 전부(이미 잰 건 건너뜀)
 *   node 수요재기-api.mjs --dry 백호살                 # 보낼 요청만 보여 준다(키 없어도 됨)
 *
 * 왜 앵커를 끼우나: 데이터랩은 한 조회(최대 5그룹) 안에서 최대를 100으로 두는 **상대값**이다.
 * 조회끼리 비교하려면 같은 기준 검색어(가게 파일 수요.앵커 큰쪽·작은쪽)를 매 조회에 끼워야 한다.
 * 그래서 한 조회 = 앵커 2 + 새 검색어 3. 결과 지수는 「큰쪽 앵커 = 100」으로 환산한다.
 *
 * API: POST https://openapi.naver.com/v1/datalab/search · 하루 1,000회 · startDate는 2016-01-01부터
 *      keywordGroups 최대 5개, 그룹당 keywords 최대 20개 · timeUnit date|week|month (문서 2026-10-30 확인)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadShop, dataDir, naverKeys, sleep } from '../../_shared/shop.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const shop = loadShop();
const DATA = dataDir(shop);
const OUT = join(DATA, '수요.json');
const A = shop.수요?.앵커;
if (!A?.큰쪽 || !A?.작은쪽) { console.error('가게 파일 수요.앵커(큰쪽·작은쪽)가 없다'); process.exit(2); }

const targets = args.includes('--씨앗')
  ? (shop.검색어?.씨앗 ?? [])
  : args.filter((a) => !a.startsWith('--'));
if (!targets.length) { console.error('잴 검색어가 없다'); process.exit(2); }

const store = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { _기준: [A.큰쪽, A.작은쪽], _단위: '큰쪽 앵커 = 100 (12개월 월평균)', 값: {} };
const todo = [...new Set(targets)].filter((k) => k !== A.큰쪽 && k !== A.작은쪽 && !store.값[k]);
console.log(`수요 잴 것 ${todo.length} / 대상 ${targets.length} (이미 잰 것 ${Object.keys(store.값).length}) · 자료: ${OUT}`);
if (!todo.length) process.exit(0);

const end = new Date(); end.setDate(0);                     // 지난달 말
const start = new Date(end); start.setMonth(start.getMonth() - 11); start.setDate(1);
const ymd = (d) => d.toISOString().slice(0, 10);
const body = (kws) => ({
  startDate: ymd(start), endDate: ymd(end), timeUnit: 'month',
  keywordGroups: [A.큰쪽, A.작은쪽, ...kws].map((k) => ({ groupName: k, keywords: [k] })),
});

const avg = (data) => data.reduce((s, x) => s + parseFloat(x.ratio), 0) / (data.length || 1);

let calls = 0;
for (let i = 0; i < todo.length; i += 3) {
  const batch = todo.slice(i, i + 3);
  const req = body(batch);
  if (dry) { console.log(JSON.stringify(req, null, 1)); continue; }
  const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
    method: 'POST', headers: { ...naverKeys(), 'Content-Type': 'application/json' }, body: JSON.stringify(req),
  });
  calls++;
  if (!res.ok) { console.error(`API ${res.status}: ${await res.text()}`); process.exit(1); }
  const j = await res.json();
  const byName = Object.fromEntries(j.results.map((r) => [r.title, r]));
  const big = avg(byName[A.큰쪽]?.data ?? []), small = avg(byName[A.작은쪽]?.data ?? []);
  for (const k of batch) {
    const r = byName[k]; if (!r) continue;
    const raw = avg(r.data);
    // 큰쪽이 0.x로 뭉개지면(새 검색어가 훨씬 크면) 작은쪽으로 환산 → 가게 파일 환산.지수와 같은 자
    let 지수, 기준;
    if (big >= 1) { 지수 = +(raw / big * 100).toFixed(1); 기준 = A.큰쪽; }
    else if (small >= 1 && store.값[A.작은쪽]?.지수) { 지수 = +(raw / small * store.값[A.작은쪽].지수).toFixed(1); 기준 = A.작은쪽; }
    else { 지수 = null; 기준 = '환산 불가(앵커가 0에 가깝다)'; }
    store.값[k] = {
      지수, 기준, 월: Object.fromEntries(r.data.map((d) => [d.period.slice(0, 7), +parseFloat(d.ratio).toFixed(2)])),
      잰날: ymd(new Date()),
    };
    console.log(`  ${k.padEnd(14)} 지수 ${지수 ?? '-'}  (${기준})`);
  }
  // 작은쪽 앵커의 큰쪽 기준 지수도 저장해 둔다(다음 환산에 쓴다)
  if (big >= 1 && !store.값[A.작은쪽]) store.값[A.작은쪽] = { 지수: +(small / big * 100).toFixed(1), 기준: A.큰쪽, 잰날: ymd(new Date()) };
  mkdirSync(DATA, { recursive: true }); writeFileSync(OUT, JSON.stringify(store, null, 1));
  await sleep(1500);
}
if (!dry) console.log(`저장 ${OUT} · API 호출 ${calls}회 (하루 한도 1,000)`);

#!/usr/bin/env node
/**
 * 읽기 — 사용자가 붙여 준 네이버 블로그 글 링크를 열어 짜임·말투를 숫자로 읽고 기준치를 제안한다.
 *
 *   node 읽기.mjs --검색어 "젤네일 가격" https://m.blog.naver.com/<id>/<no> https://blog.naver.com/<id>/<no> … [--화면 3] [--파일 urls.txt]
 *
 * 하지 않는 것: 검색 결과·자동완성 긁기(네이버 약관). 우리 블로그 글(가게 파일 블로그ID)은 열지 않는다.
 * 결과: <자료>/레퍼런스/읽기-<날짜>.json · <자료>/레퍼런스/본문/<id>_<no>.txt · (--화면) <자료>/레퍼런스/화면/<id>_<no>-1.png
 */
import { chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadShop, dataDir, sleep } from '../../_shared/shop.mjs';

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const 검색어 = opt('--검색어');
const 화면N = Number(opt('--화면') ?? 0);
const 파일 = opt('--파일');
let urls = argv.filter((a, i) => /^https?:\/\//.test(a) && !['--검색어', '--화면', '--파일'].includes(argv[i - 1]));
if (파일 && existsSync(파일)) urls = urls.concat(readFileSync(파일, 'utf8').split(/\s+/).filter((u) => /^https?:\/\//.test(u)));
if (!검색어) { console.error('🔴 --검색어 "<검색어>"를 적어라 — 어느 검색어의 레퍼런스인지 blog-draft-check가 이걸로 본다'); process.exit(2); }
if (!urls.length) { console.error('🔴 링크가 없다 — 휴대폰 통합검색 첫 화면에서 본 블로그 글 링크를 3~10개 붙여 달라고 해라'); process.exit(2); }

const shop = loadShop();
const 우리ID = shop.가게?.블로그ID || '';
const 군말 = (shop.말투?.군말 ?? []).filter(Boolean);
const OUT = join(dataDir(shop), '레퍼런스');
mkdirSync(join(OUT, '본문'), { recursive: true }); if (화면N) mkdirSync(join(OUT, '화면'), { recursive: true });
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

const parse = (u) => { const m = u.match(/blog\.naver\.com\/(?:PostView\.naver\?blogId=)?([A-Za-z0-9_-]+)(?:\/|&logNo=)(\d{9,})/); return m ? { id: m[1], no: m[2] } : null; };
const 글목록 = [...new Map(urls.map((u) => [u, parse(u)]).filter(([, g]) => g).map(([u, g]) => [g.id + '_' + g.no, { ...g, url: u }])).values()];
const 못파싱 = urls.filter((u) => !parse(u));
if (못파싱.length) console.log(`⚠️ 블로그 글 주소가 아니라 건너뜀: ${못파싱.join(' ')}`);

const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ko-KR' });
const p = await ctx.newPage();
const 결과 = [];
let 번째 = 0;
for (const g of 글목록) {
  번째++;
  const k = g.id + '_' + g.no;
  if (우리ID && g.id === 우리ID) { 결과.push({ ...g, 건너뜀: '우리 글 — 열지 않는다' }); console.log(`· ${k} 우리 글 — 건너뜀`); continue; }
  try {
    await p.goto(`https://m.blog.naver.com/${g.id}/${g.no}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(2000);
    if (번째 <= 화면N) {
      await p.screenshot({ path: join(OUT, '화면', `${k}-1.png`) });
      await p.evaluate(() => window.scrollBy(0, window.innerHeight)); await p.waitForTimeout(700);
      await p.screenshot({ path: join(OUT, '화면', `${k}-2.png`) });
    }
    for (let i = 0; i < 8; i++) { await p.evaluate(() => window.scrollBy(0, 2500)); await p.waitForTimeout(300); }
    const r = await p.evaluate((ID) => {
      const c = document.querySelector('.se-main-container');
      if (!c) return null;
      const tops = [...c.querySelectorAll('.se-component')].filter((x) => !x.parentElement.closest('.se-component'));
      const kind = (x) => [...x.classList].find((n) => n.startsWith('se-') && n !== 'se-component' && !n.startsWith('se-l-') && !/^se-(section|module)-/.test(n)) || '?';
      const 차례 = tops.map(kind);
      const cnt = (t) => 차례.filter((x) => x === t).length;
      const 표 = [...c.querySelectorAll('.se-table')].map((t) => { const rows = [...t.querySelectorAll('tr')]; return { 줄: rows.length, 칸: Math.max(0, ...rows.map((r) => r.querySelectorAll('td,th').length)), 첫줄: (rows[0]?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) }; });
      const 사진 = [...c.querySelectorAll('.se-image, .se-imageGroup, .se-imageStrip')].filter((x) => !x.parentElement.closest('.se-imageGroup, .se-imageStrip')).map((x) => { const im = x.querySelector('img'); return { 장: x.querySelectorAll('img').length, 설명: (x.querySelector('.se-caption')?.innerText || '').trim().slice(0, 60), w: +(im?.getAttribute('data-width') || 0), h: +(im?.getAttribute('data-height') || 0) }; });
      const 인용 = [...c.querySelectorAll('.se-quotation')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60));
      const 소제목 = [...c.querySelectorAll('.se-sectionTitle')].map((x) => (x.innerText || '').trim().split('\n')[0].slice(0, 50));
      const a = [...c.querySelectorAll('a[href]')].map((x) => x.href);
      const 내글링크 = [...new Set(a.filter((h) => new RegExp(`blog\\.naver\\.com/${ID}/\\d{9,}`).test(h)))];
      const text = c.innerText.replace(/​/g, '').replace(/\n{2,}/g, '\n').trim();
      const 태그 = [...document.querySelectorAll('.post_tag a, .tag_area a, [class*=tag_list] a, [class*=TagList] a')].map((x) => x.innerText.trim()).filter((t) => t.startsWith('#'));
      const num = (sel) => { const e = document.querySelector(sel); return e ? Number((e.innerText || '').replace(/\D/g, '')) || 0 : null; };
      const 댓글el = [...document.querySelectorAll('a, button, span')].find((e) => /^댓글\s*\d+$/.test((e.innerText || '').trim().replace(/\s+/g, ' ')));
      return {
        title: (document.querySelector('.se-title-text')?.innerText || document.title || '').trim(),
        날짜: document.querySelector('.blog_date, .se_publishDate')?.innerText.trim() || '',
        공감: num('.u_likeit_list.like ._count'), 댓글: 댓글el ? Number(댓글el.innerText.replace(/\D/g, '')) : null,
        칸수: { 글: cnt('se-text'), 소제목: cnt('se-sectionTitle'), 사진: 사진.length, 표: cnt('se-table'), 인용: cnt('se-quotation'), 구분선: cnt('se-horizontalLine'), 영상: cnt('se-video') + cnt('se-oembed'), 링크카드: cnt('se-oglink') },
        표, 사진, 인용, 소제목, 내글링크, 태그수: 태그.length, text,
      };
    }, g.id);
    if (!r) { 결과.push({ ...g, 실패: '본문 틀 없음(옛 편집기일 수 있다)' }); console.log(`· ${k} 못 읽음(옛 편집기)`); continue; }
    const t = r.text;
    const 줄 = t.split('\n').map((l) => l.trim()).filter((l) => l.length > 1);
    const 문장 = t.split(/(?<=[.!?…])\s+|\n/).map((s) => s.trim()).filter((s) => s.length > 3);
    const 끝 = (s) => s.replace(/[.?!~」』"')\s]+$/, '');
    const 니다 = 문장.filter((s) => /니다$/.test(끝(s))).length;
    const 요 = 문장.filter((s) => /[가-힣](요|죠)$/.test(끝(s)) && !/니다$/.test(끝(s))).length;
    const 다 = 문장.filter((s) => /[가-힣]다$/.test(끝(s)) && !/니다$/.test(끝(s))).length;
    const 물음 = 문장.filter((s) => /\?$/.test(s)).length;
    const len = (a) => a.map((x) => x.replace(/\s/g, '').length);
    const avg = (a) => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : 0);
    const 문장길이 = len(문장), 줄길이 = len(줄);
    const 리듬 = +(Math.sqrt(avg(문장길이.map((x) => (x - avg(문장길이)) ** 2))) / (avg(문장길이) || 1)).toFixed(2);
    const 군말수 = 군말.length ? (t.match(new RegExp(군말.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')) ?? []).length : null;
    const 글자 = t.replace(/\s/g, '').length;
    writeFileSync(join(OUT, '본문', `${k}.txt`), `# ${r.title}\n# ${g.id} · 「${검색어}」 · ${오늘}\n\n${t}\n`);
    const rest = { ...r }; delete rest.text;
    결과.push({
      ...g, ...rest, 검색어, 글자, 제목길이: r.title.length, 문장수: 문장.length,
      문장평균: +avg(문장길이).toFixed(1), 줄평균: +avg(줄길이).toFixed(1), 리듬,
      니다비율: +(니다 / (문장.length || 1)).toFixed(2), 요: 요, 요비율: +(요 / (문장.length || 1)).toFixed(2), 다비율: +(다 / (문장.length || 1)).toFixed(2),
      물음천자: +((1000 * 물음) / (글자 || 1)).toFixed(1), 군말: 군말수,
      가로사진: r.사진.filter((x) => x.w && x.h && x.w > x.h).length, 글자표: r.표.length, 표최대칸: Math.max(0, ...r.표.map((x) => x.칸)),
      첫줄: 줄.slice(0, 5), 끝줄: 줄.slice(-5),
    });
    console.log(`· ${k} ${글자}자 제목${r.title.length} 소제목${r.칸수.소제목} 사진${r.칸수.사진} 표${r.칸수.표} 인용${r.칸수.인용} 내글링크${r.내글링크.length} · 문장${avg(문장길이).toFixed(0)} 줄${avg(줄길이).toFixed(0)} 니다${Math.round(100 * 니다 / (문장.length || 1))}% 해요${요} 물음${((1000 * 물음) / (글자 || 1)).toFixed(1)} 리듬${리듬}${군말수 != null ? ` 군말${군말수}` : ''} · 공감${r.공감 ?? '-'} 댓글${r.댓글 ?? '-'} ${r.날짜}`);
  } catch (e) { 결과.push({ ...g, 실패: String(e).slice(0, 80) }); console.log(`· ${k} 실패 ${String(e).slice(0, 60)}`); }
  await sleep(1500);
}
await b.close();

/* 분포 */
const 읽음 = 결과.filter((x) => x.글자);
const q = (arr, pct) => { const a = [...arr].filter((x) => x != null).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * pct; const lo = Math.floor(i), hi = Math.ceil(i); return +(a[lo] + (a[hi] - a[lo]) * (i - lo)).toFixed(1); };
const dist = (key) => { const a = 읽음.map((x) => x[key]); return { n: a.filter((x) => x != null).length, q1: q(a, 0.25), 중앙: q(a, 0.5), q3: q(a, 0.75), p90: q(a, 0.9) }; };
const D = Object.fromEntries(['글자', '제목길이', '문장평균', '줄평균', '리듬', '니다비율', '요', '물음천자', '군말', '칸수.소제목', '칸수.사진', '칸수.표', '글자표', '표최대칸'].map((k) => [k, k.includes('.') ? (() => { const [a, b2] = k.split('.'); const arr = 읽음.map((x) => x[a]?.[b2]); return { n: arr.length, q1: q(arr, .25), 중앙: q(arr, .5), q3: q(arr, .75), p90: q(arr, .9) }; })() : dist(k)]));
const 가로비율 = 읽음.length ? Math.round(100 * 읽음.reduce((s, x) => s + x.가로사진, 0) / Math.max(1, 읽음.reduce((s, x) => s + x.칸수.사진, 0))) : null;

console.log(`\n■ 「${검색어}」 레퍼런스 ${결과.length}편 (읽음 ${읽음.length} · 우리 글 건너뜀 ${결과.filter((x) => x.건너뜀).length} · 못 읽음 ${결과.filter((x) => x.실패).length})`);
if (읽음.length) {
  const f = (d, unit = '') => d.중앙 == null ? '-' : `${d.중앙}${unit} (${d.q1}~${d.q3})`;
  console.log(`  글자 중앙 ${f(D.글자)} · 제목 ${f(D.제목길이, '자')} · 소제목 ${f(D['칸수.소제목'])} · 사진 ${f(D['칸수.사진'])}(가로형 ${가로비율}%) · 표 ${f(D['칸수.표'])}(글자 표 있는 글 ${읽음.filter((x) => x.글자표).length}편, 최대 ${Math.max(0, ...읽음.map((x) => x.표최대칸))}칸)`);
  console.log(`  말투: 문장 ${f(D.문장평균, '자')} · 줄 ${f(D.줄평균, '자')} · 니다 ${Math.round(100 * (D.니다비율.중앙 ?? 0))}% · 해요 ${f(D.요, '문장')} · 물음 ${f(D.물음천자)}/천 자 · 리듬 ${f(D.리듬)}${D.군말.중앙 != null ? ` · 군말 ${f(D.군말)}` : ''}`);
  const 특징 = [];
  if (읽음.filter((x) => x.글자표).length >= 읽음.length / 2) 특징.push('표를 글자 표로 넣는다(그림 말고)');
  if (읽음.filter((x) => /\?$/.test(x.첫줄[0] || '')).length >= 읽음.length / 2) 특징.push('첫 줄을 질문으로 연다');
  if (읽음.filter((x) => x.내글링크.length).length >= 읽음.length / 2) 특징.push('자기 다른 글 링크를 건다');
  if ((D.요.중앙 ?? 0) >= 3) 특징.push('합니다체에 해요체를 섞는다');
  if (가로비율 != null && 가로비율 >= 60) 특징.push('사진이 가로형이다(세로 짧음)');
  console.log(`  눈에 띄는 것: ${특징.length ? 특징.join(' / ') : '(분포만 보고 특징은 사람이 읽어라 — 화면 PNG)'}`);
  const r100 = (x) => Math.floor(x / 100) * 100;
  const 제안 = {
    _: `「${검색어}」 상위 글 ${읽음.length}편 실측(${오늘})에서 제안. 사람이 확인한 뒤 가게 파일 기준치.글규격에 붙인다. 문턱은 상위 범위의 안쪽.`,
    본문최소: r100((D.글자.중앙 ?? 0) * 0.95), 제목최대: Math.round(D.제목길이.p90 ?? 0),
    문장최대: Math.ceil((D.문장평균.q3 ?? 0) * 1.2), 줄최대: Math.ceil((D.줄평균.q3 ?? 0) * 1.4),
    말버릇최대: 1, 리듬최소: +Math.max(0, (D.리듬.q1 ?? 0) * 0.9).toFixed(2), 해요섞임최소: Math.max(0, Math.floor((D.요.q1 ?? 0) * 0.8)), 물음최대: +((D.물음천자.q3 ?? 0) * 1.15).toFixed(1),
    _근거: { N: 읽음.length, 글자: D.글자, 제목길이: D.제목길이, 문장평균: D.문장평균, 줄평균: D.줄평균, 리듬: D.리듬, 요: D.요, 물음천자: D.물음천자 },
  };
  console.log('\n■ 기준치 제안 (가게 파일 기준치.글규격 — 사람이 확인하고 붙여라)');
  console.log(JSON.stringify(제안, null, 1));
  var 기준치제안 = 제안;
}
console.log('\n■ 못 본 것: 통합검색 순위(사용자 화면 기준) · 끝맺음은 정규식 판정 · 공감·댓글·날짜는 화면에 없으면 null · 이 값은 「이 업종 이 검색어」 것');
const outFile = join(OUT, `읽기-${오늘}.json`);
const prev = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : { 잰날: 오늘, 검색: [], 글: [] };
prev.검색 = [...prev.검색.filter((s) => s.q !== 검색어), { q: 검색어, 편수: 결과.length, 기준치제안: 기준치제안 ?? null }];
prev.글 = [...prev.글.filter((x) => !결과.some((y) => y.id === x.id && y.no === x.no)), ...결과];
writeFileSync(outFile, JSON.stringify(prev, null, 1));
console.log(`저장 ${outFile}`);

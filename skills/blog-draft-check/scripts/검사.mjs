#!/usr/bin/env node
/**
 * 검사 — 초안(post.json)을 발행 전에 기계가 막는다. 문턱은 전부 가게 파일 `기준치`에서 온다.
 *
 *   node 검사.mjs <초안 폴더>
 *   exit 0 통과 · 1 규격 미달 · 2 잴 자료 없음
 *
 * 걸리면 문턱을 눅이지 말고 글을 고쳐라. 문턱이 틀렸으면 blog-reference-read로 다시 재서 가게 파일을 바꾼다.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { loadShop, dataDir } from '../../_shared/shop.mjs';

const shop = loadShop();
const DATA = dataDir(shop);
const G = shop.기준치?.글규격;
if (!G || G.본문최소 == null) { console.error('🔴 가게 파일 기준치.글규격이 비어 있다 — blog-reference-read로 그 업종 상위 글을 재서 채워라. 남의 업종 값으로 검사하지 않는다.'); process.exit(2); }
const dir = resolve(process.argv[2] ?? '');
if (!existsSync(join(dir, 'post.json'))) { console.error('post.json 없음:', dir); process.exit(2); }
const post = JSON.parse(readFileSync(join(dir, 'post.json'), 'utf8'));

const rd = (f, d) => (existsSync(join(DATA, f)) ? JSON.parse(readFileSync(join(DATA, f), 'utf8')) : d);
const top = rd('상위10.json', {});
const blogs = rd('블로그.json', {});
const 수요파일있음 = existsSync(join(DATA, '수요.json'));
const demand = 수요파일있음 ? rd('수요.json', { 값: {} }).값 : {};
const 이웃최대 = shop.기준치?.레퍼런스?.이웃최대 ?? 300;
const 작다 = (id) => { const b = blogs[id]; return !!b && b.이웃 != null && b.이웃 < 이웃최대; };

const kw = post.keyword ?? '';
const 머리 = kw.split(/\s+/)[0];
const 머리들 = Array.isArray(post.가족) && post.가족.length ? post.가족 : [머리];
const 가족검색어 = Object.keys(top).filter((k) => !k.startsWith('_') && 머리들.some((h) => k.includes(h)));
const 본문 = post.blocks.flatMap((b) => (b.t === 'ul' ? b.items : b.x ? [b.x] : []));
const 소제목 = post.blocks.filter((b) => b.t === 'h').map((b) => b.x);
const 글자 = 본문.join('').replace(/\s/g, '').length;
const 전체글 = [post.title, ...소제목, ...본문].join(' ');
const 덮은것 = 가족검색어.filter((k) => k.split(/\s+/).filter((w) => w && w !== 머리).every((w) => 전체글.includes(w)));
const 제외어 = (shop.검색어?.제목제외어 ?? ['뜻', '특징', '정리', '방법', '보는']).filter(Boolean);
const 제목변형 = [...new Set((post.title.match(/[가-힣0-9]+/g) ?? []).filter((w) => w !== 머리 && w.length >= 2 && !제외어.some((x) => w.includes(x))))];
const 수요 = demand[kw]?.지수 ?? demand[머리]?.지수 ?? null;
const 자리행 = Array.isArray(top[kw]) ? top[kw] : null;
const 자리 = 자리행 ? 자리행.filter((x) => 작다(x.id)).length : null;
const 미판정 = 자리행 ? 자리행.filter((x) => blogs[x.id]?.이웃 == null).length : null;

const 줄들 = post.blocks.flatMap((b) => (b.t === 'p' ? b.x.split('\n') : b.t === 'ul' ? b.items : [])).map((l) => l.trim()).filter(Boolean);
const 문장들 = 줄들.flatMap((l) => l.split(/(?<=[.?!])\s+/)).map((x) => x.trim()).filter((x) => x.length > 3);
const 평균 = (a) => +(a.reduce((n, x) => n + x.replace(/\s/g, '').length, 0) / (a.length || 1)).toFixed(1);
const 문장길이 = 평균(문장들), 줄길이 = 평균(줄들);
const 군말목록 = (shop.말투?.군말 ?? []).filter(Boolean);
const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const 말버릇 = 군말목록.length ? (본문.join('\n').match(new RegExp(군말목록.map(esc).join('|'), 'g')) ?? []) : [];
const 금지어목록 = (shop.말투?.금지어 ?? []).filter(Boolean);
const 금지걸림 = 금지어목록.filter((w) => 전체글.includes(w));
const 리듬문장 = 본문.join('\n').split(/(?<=[.?!])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length > 3);
const 리듬 = (() => { const l = 리듬문장.map((x) => x.length); const a = l.reduce((n, x) => n + x, 0) / (l.length || 1); return +(Math.sqrt(l.reduce((n, x) => n + (x - a) ** 2, 0) / (l.length || 1)) / (a || 1)).toFixed(2); })();
const 문단문장 = post.blocks.filter((b) => b.t === 'p').flatMap((b) => b.x.split('\n')).flatMap((l) => l.split(/(?<=[.?!])\s+/)).map((x) => x.trim().replace(/[.?!~」』"')\s]+$/, '')).filter((x) => x.length > 3);
const 해요 = 문단문장.filter((x) => /[가-힣](요|죠)$/.test(x) && !/니다$/.test(x)).length;
const 해요비율 = +(해요 / (문단문장.length || 1)).toFixed(2);
const 물음 = +((1000 * 리듬문장.filter((x) => /\?$/.test(x)).length) / (글자 || 1)).toFixed(1);

const fails = [], warns = [];
const 검 = (ok, msg) => (ok ? null : fails.push(msg));

console.log(`\n■ ${post.title}`);
console.log(`  검색어 「${kw}」 · 가족 「${머리들.join('·')}」 (표본 안 검색어 ${가족검색어.length}개)`);
console.log(`  수요 ${수요 ?? '못 잼'}${shop.수요?.앵커?.큰쪽 ? ` (${shop.수요.앵커.큰쪽}=100)` : ''} · 자리 ${자리 ?? '못 잼'}${자리 != null ? `/${자리행.length}${미판정 ? `(미판정 ${미판정})` : ''}` : ''}`);
console.log(`  제목 ${post.title.length}자 · 본문 ${글자}자 · 소제목 ${소제목.length} · 가족 덮기 ${덮은것.length} · 제목 변형 ${제목변형.length}`);
console.log(`  말투 지문 — 문장 ${문장길이}자 · 줄 ${줄길이}자 · 군말 ${말버릇.length}   (기준: 문장 ≤${G.문장최대} · 줄 ≤${G.줄최대} · 군말 ≤${G.말버릇최대})`);
console.log(`  리듬 — 들쭉날쭉 ${리듬} · 해요 ${해요}문장(${Math.round(해요비율 * 100)}%) · 물음 ${물음}/천 자   (기준: ≥${G.리듬최소} · ≥${G.해요섞임최소} · ≤${G.물음최대}; 해요 비율은 막지 않음)`);

if (!수요파일있음) warns.push('수요를 잰 적이 없다(자료/수요.json 없음) — blog-keyword-pick의 수요재기-api로 재면 「이겨서 남나」를 알 수 있다. 네이버 API 키가 필요하다');
else if (수요 == null) fails.push(`🔴 「${kw}」 수요를 안 쟀다 — blog-keyword-pick 수요재기-api "${kw}" "${머리}"`);
else if (shop.수요?.환산?.지수 != null && 수요 < shop.수요.환산.지수) warns.push(`수요 ${수요} < ${shop.수요.환산.지수}(가게 파일 환산 기준) — 10위에 들어도 하루 조회가 적다. 알고 쓰는 거면 ok`);
const 약한최소 = shop.기준치?.자리?.약한자리최소;
if (자리 != null && 약한최소 != null && 자리 + (미판정 ?? 0) < 약한최소) warns.push(`자리 ${자리}/${자리행.length}(미판정 ${미판정}) < ${약한최소} — 상위가 큰 블로그로 차 있다`);
if ((post.tags ?? []).length > 12) warns.push(`태그 ${post.tags.length}개 — 새 글이 잘 들어가는 블로그는 8~12개였다(근거 약함). 늘린 이유가 있으면 ok`);

{
  const 카드 = readdirSync(dir).filter((f) => /^\d{2}-.+\.png$/.test(f));
  const 넣은것 = new Set(post.blocks.filter((b) => b.t === 'img').map((b) => b.src));
  const 빠짐 = 카드.filter((f) => !넣은것.has(f));
  검(!빠짐.length, `🔴 카드 ${빠짐.join(' · ')}가 폴더엔 있는데 본문에 없다 — img 블록으로 넣거나 파일을 지워라`);
}
검(글자 >= G.본문최소, `🔴 본문 ${글자}자 < ${G.본문최소}자 — 상위 글 실측 중앙값 아래다(가게 파일 _근거)`);
if (G.가족덮기최소 != null && 가족검색어.length) 검(덮은것.length >= G.가족덮기최소, `🔴 가족 덮기 ${덮은것.length} < ${G.가족덮기최소} — 한 글이 그 가족의 검색어를 여러 개 받아야 한다.\n       안 받은 것: ${가족검색어.filter((k) => !덮은것.includes(k)).slice(0, 12).join(' · ')}`);
else if (G.가족덮기최소 != null) warns.push('가족 검색어 표본이 없어 덮기를 못 쟀다(자료/상위10.json) — blog-keyword-pick 자리-api로 재면 센다');
if (G.제목변형최소 != null) 검(제목변형.length >= G.제목변형최소, `🔴 제목 변형 ${제목변형.length} < ${G.제목변형최소} — 제목에 변형 검색어를 몰아넣어라`);
검(문장길이 <= G.문장최대, `🔴 문장 평균 ${문장길이}자 > ${G.문장최대}자 — 긴 문장을 둘로 나눠라`);
검(줄길이 <= G.줄최대, `🔴 줄 평균 ${줄길이}자 > ${G.줄최대}자 — 한두 문장마다 줄을 바꿔라(문단 안 \\n)`);
if (G.리듬최소 != null) 검(리듬 >= G.리듬최소, `🔴 문장 길이 들쭉날쭉 ${리듬} < ${G.리듬최소} — 박자가 너무 고르다. 짧은 줄을 섞어라`);
if (G.해요섞임최소 != null) 검(해요 >= G.해요섞임최소, `🔴 해요체 섞임 ${해요}문장 < ${G.해요섞임최소} — 「~죠?」·「~해 보세요」를 섞어라`);
if (G.물음최대 != null) 검(물음 <= G.물음최대, `🔴 물음 ${물음}/천 자 > ${G.물음최대} — 묻는 줄이 넘친다`);
검(말버릇.length <= G.말버릇최대, `🔴 군말 ${말버릇.length}번(${[...new Set(말버릇)].join('·')}) — 가게 파일 말투.군말. 「~입니다」·「~로 봅니다」로`);
검(!금지걸림.length, `🔴 금지어 ${금지걸림.map((w) => `「${w}」`).join(' ')} — 가게 파일 말투.금지어`);
if (G.제목최대 != null) 검(post.title.length <= G.제목최대, `🔴 제목 ${post.title.length}자 > ${G.제목최대}자 — 휴대폰에서 네 줄이 된다`);

/* 레퍼런스 7일 — 자료/레퍼런스/읽기-*.json(하위 폴더 한 단계까지) */
const REF = join(DATA, '레퍼런스');
const 읽은검색어 = new Set();
const scan = (d) => { if (!existsSync(d)) return; for (const f of readdirSync(d)) { const pth = join(d, f); if (statSync(pth).isDirectory()) { scan(pth); continue; } const m = f.match(/^읽기-(\d{4}-\d{2}-\d{2})\.json$/); if (!m || Date.now() - Date.parse(m[1]) > 8 * 864e5) continue; try { for (const q of JSON.parse(readFileSync(pth, 'utf8')).검색 ?? []) 읽은검색어.add(q.q); } catch { /* 깨진 파일은 안 친다 */ } } };
scan(REF); if (shop.폴더?.레퍼런스) scan(resolve(shop._root, shop.폴더.레퍼런스));
검(읽은검색어.has(kw), `🔴 「${kw}」 상위 글 짜임을 7일 안에 안 읽었다 — blog-reference-read 읽기.mjs --검색어 "${kw}" <링크…>`);

for (const [i, t] of post.blocks.filter((b) => b.t === 'table').entries()) {
  const 칸 = Math.max(...t.rows.map((r) => r.length));
  const 최대 = 칸 >= 3 ? 7 : 10;
  const 긴칸 = t.rows.flat().filter((c) => String(c).length > 최대);
  검(칸 <= 3, `🔴 글자 표 ${i + 1}이 ${칸}칸 — 휴대폰에서 4칸부터는 옆으로 밀린다. 3칸 이하로`);
  검(!긴칸.length, `🔴 글자 표 ${i + 1}(${칸}칸) 칸 글자 ${최대}자 넘음 — 휴대폰에서 두세 줄로 꺾인다: ${긴칸.slice(0, 4).join(' / ')}`);
}

if (warns.length) { console.log('\n  ⚠️ 알고는 있어라'); warns.forEach((w) => console.log('   · ' + w)); }
if (fails.length) {
  console.log('\n  ✗ 규격 미달'); fails.forEach((f) => console.log('   · ' + f));
  console.log('\n  🔴 문턱을 눅이지 마라. 가게 파일 기준치는 상위 글 실측값이다 — 글을 고쳐라. 문턱이 틀렸으면 blog-reference-read로 다시 재라.');
  process.exit(1);
}
console.log('\n  ✓ 규격 통과');

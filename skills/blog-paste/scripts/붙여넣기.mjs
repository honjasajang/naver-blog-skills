#!/usr/bin/env node
/**
 * 붙여넣기 — 초안을 **사람이 네이버 에디터에 직접 붙여 넣는** 페이지로 만든다.
 *   node 붙여넣기.mjs <초안 폴더>   → <초안 폴더>/붙여넣기.html
 * 프로그램이 에디터에 글을 넣지 않는다(네이버 게시물 운영정책·검색 FAQ). 페이지 안의 「복사」 버튼은 서식째 클립보드에 싣는다.
 * 사진은 data URI로 본문에 박지 않는다(에디터가 「허용하지 않는 형식의 이미지」로 막는다) — 사람이 끌어다 놓는다.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve, basename } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadShop } from '../../_shared/shop.mjs';

const DIR = resolve(process.argv[2] ?? '');
if (!existsSync(join(DIR, 'post.json'))) { console.error('post.json 없음:', DIR); process.exit(2); }
const shop = loadShop();
const post = JSON.parse(readFileSync(join(DIR, 'post.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* 검사 — blog-draft-check. 미달이면 맨 위에 빨갛게(막지는 않는다: 사람이 보고 판단) */
const checkPath = fileURLToPath(new URL('../../blog-draft-check/scripts/검사.mjs', import.meta.url));
let check;
try { check = { ok: true, out: execFileSync(process.execPath, [checkPath, DIR], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env }) }; }
catch (e) { check = { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') }; }

const GAP = '<p>​</p>';
const BODY = (x) => `<span style="font-size:16px">${x}</span>`;
const dataUri = (src) => { try { return 'data:image/png;base64,' + readFileSync(join(DIR, src)).toString('base64'); } catch { return null; } };
let imgNo = 0; const imgs = [];
const blockHtml = (b) => {
  if (b.t === 'p') return b.x.split('\n').map((l) => `<p>${BODY(esc(l))}</p>`).join('') + GAP;   // 한 줄씩 <p>, 문단 끝에만 빈 줄
  if (b.t === 'h') return `${GAP}<p><b><span style="font-size:19px">${esc(b.x)}</span></b></p>${GAP}`;
  if (b.t === 'ul') return `<ul>${b.items.map((i) => `<li>${BODY(esc(i))}</li>`).join('')}</ul>${GAP}`;
  if (b.t === 'table') return `<table border="1" style="border-collapse:collapse">${b.rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${BODY(esc(c))}</td>` : `<th><b>${BODY(esc(c))}</b></th>`)).join('')}</tr>`).join('')}</table>${GAP}`;
  if (b.t === 'img') { imgNo++; imgs.push({ n: imgNo, src: b.src, uri: dataUri(b.src) }); return `<p class="slot">【사진 ${imgNo} — ${esc(b.src)}】 이 줄을 지우고 사진을 넣으세요</p>${GAP}`; }
  return '';
};
const body = (post.blocks ?? []).map(blockHtml).join('\n');
const endLink = (post.blocks ?? []).find((b) => b.t === 'link')?.url ?? null;
const 시각 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const checkHtml = `<div class="chk ${check.ok ? 'ok' : 'bad'}"><b>${check.ok ? '✓ 글 규격 통과' : '✗ 글 규격 미달 — 고치고 다시 만들어라'}</b><pre>${esc(check.out.split('\n').filter((l) => /■|검색어|제목|말투|리듬|🔴|✗|⚠️|·/.test(l)).slice(0, 14).join('\n'))}</pre><small>${시각} 기준</small></div>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>붙여넣기 · ${esc(post.keyword ?? basename(DIR))}</title>
<style>
:root{--ink:#1f1d1a;--sub:#6b6458;--line:#e4ddd0;--bg:#faf7f1;--ok:#2f6b46;--bad:#b23a22}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
.w{max-width:760px;margin:0 auto;padding:24px 16px 80px}
h1{font-size:22px;margin:0 0 4px}.lead{color:var(--sub);font-size:14px;margin:0 0 20px}
h2{font-size:17px;margin:30px 0 10px;padding-top:14px;border-top:1px solid var(--line)}
.chk{border-radius:8px;padding:10px 12px;margin:6px 0;font-size:14px}.chk.ok{background:#e9f2ec;color:var(--ok)}.chk.bad{background:#f8e7e2;color:var(--bad)}
.chk pre{white-space:pre-wrap;margin:6px 0 0;font-size:12px;color:var(--ink)}
.box{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px}
button{font:inherit;font-size:14px;border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:8px;padding:7px 14px;cursor:pointer;margin:0 6px 8px 0}
button.done{background:var(--ok);border-color:var(--ok)}
#body p{font-size:16px;line-height:1.8;margin:0 0 14px}#body ul{margin:0 0 14px;padding-left:22px}#body li{font-size:16px;line-height:1.8}
#body .slot{background:#fff3c4;color:#7a5b00;font-weight:700;padding:6px 8px;border-radius:6px}
#body table{border-collapse:collapse}#body td,#body th{border:1px solid #ccc;padding:4px 8px}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.imgs figure{margin:0;font-size:12px;color:var(--sub)}.imgs img{width:100%;border-radius:6px;border:1px solid var(--line)}
ul.plain{padding-left:20px;font-size:15px;line-height:1.8}code{background:#f0ebe1;padding:1px 5px;border-radius:4px;font-size:13px}
</style></head><body><div class="w">
<h1>붙여넣기 — ${esc(post.keyword ?? '')}</h1>
<p class="lead">프로그램이 에디터에 글을 넣지 않습니다(네이버 게시물 운영정책 · 검색 FAQ). 위에서부터 차례로 복사해 네이버 글쓰기 화면에 붙여 넣으세요. 오늘 이미 올린 글이 있는지는 블로그 글 목록에서 직접 확인하세요.</p>

<h2>0. 올리기 전 확인</h2>
${checkHtml}

<h2>1. 제목</h2>
<div class="box" id="title">${esc(post.title)}</div>
<p><button data-copy="title">제목 복사</button></p>

<h2>2. 사진 ${imgs.length}장 — 먼저 글쓰기 화면에 한꺼번에 끌어다 놓기</h2>
<p class="lead">폴더: <code>${esc(DIR)}</code> · 이 순서대로</p>
<div class="imgs">${imgs.map((i) => `<figure><img src="${i.uri ?? esc(i.src)}" alt=""><figcaption>${i.n}. ${esc(i.src)}<br><button data-img="${i.n}">사진 ${i.n} 복사</button></figcaption></figure>`).join('')}</div>

<h2>3. 본문 — 복사해서 에디터 본문에 붙여 넣기</h2>
<p><button data-copy="body" data-rich="1">본문 전체 복사</button> <span class="lead">서식(소제목 19 굵게 · 본문 16 · 목록 · 글자 표 · 문단 사이 빈 줄)째 들어갑니다. 노란 줄 【사진 n】 자리에 올려 둔 사진을 끌어 놓거나 「사진 n 복사」 → ⌘V.</span></p>
<div class="box" id="body">${body}</div>

<h2>4. 글 맨 끝 링크</h2>
${endLink ? `<div class="box" id="endlink">${esc(endLink)}</div>
<p><button data-copy="endlink">링크 복사</button> <span class="lead">본문 맨 마지막 줄 아래에. 링크 카드가 생기면 위에 남은 파란 주소 줄은 지우세요(카드만 남깁니다). 본문 중간·사진에는 링크를 걸지 않습니다.</span></p>` : '<p class="lead">이 글은 끝 링크가 없습니다.</p>'}

<h2>5. 태그 ${(post.tags ?? []).length}개</h2>
<div class="box" id="tags">${(post.tags ?? []).map(esc).join(', ')}</div>
<p><button data-copy="tags">태그 복사</button> <span class="lead">태그 칸에 하나씩(쉼표·엔터로 끊깁니다).</span></p>

<h2>6. 발행 설정</h2>
<ul class="plain"><li>공개: <b>전체공개</b> · <b>검색 허용</b> 켜기 · 주제는 글에 맞게</li><li>링크는 <b>글 맨 끝 한 줄만</b></li><li>바로 올려도, 에디터의 <b>예약 발행</b>으로 시간을 정해도 됩니다</li></ul>

<h2>7. 올린 뒤</h2>
<ul class="plain"><li><b>48시간은 고치지 않습니다</b>(제목·사진·글)</li><li>올린 주소를 이 폴더 <code>발행.json</code>에 적고 폴더를 <code>올린-글/</code>로 옮깁니다 — blog-scoreboard가 다음 날부터 셉니다</li></ul>
</div>
<script>
document.querySelectorAll('button[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const el = document.getElementById(b.dataset.copy);
  try {
    if (b.dataset.rich && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([el.innerHTML], { type: 'text/html' }), 'text/plain': new Blob([el.innerText], { type: 'text/plain' }) })]);
    else await navigator.clipboard.writeText(el.innerText);
  } catch { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges(); }
  const t = b.textContent; b.textContent = '복사됨 ✓'; b.classList.add('done'); setTimeout(() => { b.textContent = t; b.classList.remove('done'); }, 1500);
}));
document.querySelectorAll('button[data-img]').forEach((b) => b.addEventListener('click', async () => {
  const img = b.closest('figure').querySelector('img'); const t = b.textContent;
  try { const blob = await (await fetch(img.src)).blob(); await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]); b.textContent = '복사됨 ✓ 이제 ⌘V'; b.classList.add('done'); }
  catch { b.textContent = '복사 실패 — 사진 버튼으로 넣으세요'; }
  setTimeout(() => { b.textContent = t; b.classList.remove('done'); }, 2500);
}));
</script></body></html>`;
writeFileSync(join(DIR, '붙여넣기.html'), html);
console.log(`만들었다: ${join(DIR, '붙여넣기.html')} · 검사 ${check.ok ? '✓ 통과' : '✗ 미달(페이지 맨 위에 표시)'} · 사진 ${imgs.length}장 · 끝 링크 ${endLink ? '있음' : '없음'}`);

#!/usr/bin/env node
/**
 * 새초안 — 초안 폴더와 post.json 틀, 가로형 카드 틀(cards.html)을 만든다.
 *
 *   node 새초안.mjs "<검색어>" "<영문-슬러그>" [--가족 "머리말1,머리말2"] [--카드없이]
 *   → <가게 파일 폴더.초안>/<YYYY-MM-DD>-<슬러그>/post.json · cards.html
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { loadShop } from '../../_shared/shop.mjs';

const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const [kw, slug] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--가족');
if (!kw || !slug) { console.error('사용: 새초안.mjs "<검색어>" "<영문-슬러그>" [--가족 "a,b"] [--카드없이]'); process.exit(2); }
if (!/^[a-z0-9-]+$/.test(slug)) { console.error('슬러그는 영문 소문자·숫자·하이픈만 (utm_term에 쓴다)'); process.exit(2); }
const shop = loadShop();
const G = shop.기준치?.글규격 ?? {};
const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dir = resolve(shop._root, shop.폴더?.초안 ?? 'blog/drafts', `${오늘}-${slug}`);
if (existsSync(join(dir, 'post.json'))) { console.error('이미 있다:', dir); process.exit(1); }
mkdirSync(dir, { recursive: true });
const 가족 = (opt('--가족') ?? kw.split(/\s+/)[0]).split(',').map((s) => s.trim()).filter(Boolean);
const [W, H] = Array.isArray(G.카드가로세로) ? G.카드가로세로 : [1080, 810];
const site = shop.가게?.사이트 ?? '';

const post = {
  keyword: kw, slug, title: `${kw} — (제목: 머리말 + 변형 검색어 ${G.제목변형최소 ?? 3}개 이상, ${G.제목최대 ?? 47}자 이하)`,
  가족, tags: [kw.replace(/\s+/g, '')],
  blocks: [
    { t: 'img', src: '01-cover.png', alt: '(표지 카드 — 한 줄 결론)' },
    { t: 'p', x: `(첫 세 줄 = 장면 · 질문 · 공감. 한두 문장마다 \\n)\n(손님이 치는 질문을 그대로: ${kw}?)\n(한 줄 공감)` },
    { t: 'p', x: '(결론 먼저. 답을 두 번째 문단에.)' },
    { t: 'h', x: '(소제목 1 — 가족 검색어 꼬리말이 들어가게)' },
    { t: 'p', x: '(근거 · 숫자는 목록이나 표로)' },
    { t: 'table', rows: [['항목', '값'], ['(2칸·칸 10자 이하)', '(3칸이면 7자)']] },
    { t: 'h', x: '(소제목 2 — 여는 방식을 바꾼다: 장면/질문/숫자/비교)' },
    { t: 'p', x: '(해요체 문장을 섞는다 — ~죠? ~해 보세요)' },
    ...(site ? [{ t: 'link', url: `${site.replace(/\/$/, '')}/?utm_source=naver_blog&utm_medium=post&utm_term=${slug}` }] : []),
  ],
  _규격: { 본문최소: G.본문최소, 가족덮기최소: G.가족덮기최소, 제목변형최소: G.제목변형최소, 제목최대: G.제목최대, 문장최대: G.문장최대, 줄최대: G.줄최대, 리듬최소: G.리듬최소, 해요섞임최소: G.해요섞임최소, 물음최대: G.물음최대, _: '참고용. 검사는 blog-draft-check가 가게 파일로 한다. 쓰고 나면 이 칸은 지워도 된다' },
};
writeFileSync(join(dir, 'post.json'), JSON.stringify(post, null, 1));
if (!argv.includes('--카드없이')) {
  writeFileSync(join(dir, 'cards.html'), `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap">
<style>
body{margin:0;background:#ddd;font-family:"Noto Sans KR",sans-serif}
/* 블로그 카드는 가로형 ${W}×${H} — 휴대폰에서 정사각형은 장당 1.45배를 먹는다(한 업종 실측) */
.card{width:${W}px;height:${H}px;box-sizing:border-box;padding:72px;margin:20px auto;background:#fff;color:#1f1d1a;display:flex;flex-direction:column;justify-content:center;gap:28px;overflow:hidden}
.card .eyebrow{font-size:30px;color:#6b6458}.card h1{font-size:64px;line-height:1.25;margin:0;font-weight:900}.card p{font-size:36px;line-height:1.5;margin:0}
</style></head><body>
<section class="card" data-file="01-cover"><div class="eyebrow">${kw}</div><h1>(표지 — 한 줄 결론)</h1><p>(부제 한 줄)</p></section>
<section class="card" data-file="02-point"><div class="eyebrow">핵심</div><h1>(숫자 하나)</h1><p>(그 숫자의 뜻 한 줄)</p></section>
</body></html>`);
}
console.log(`만들었다: ${dir}\n  post.json(틀) ${argv.includes('--카드없이') ? '' : '· cards.html(가로형 ' + W + '×' + H + ')'}\n  다음: post.json에 글을 쓰고 → 미리보기.mjs → 카드캡처.mjs → blog-draft-check`);

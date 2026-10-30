#!/usr/bin/env node
// 카드캡처 — cards.html의 각 <section class="card" data-file="01-cover">를 PNG로 찍는다. 글자가 넘치면 찍지 않고 멈춘다.
//   node 카드캡처.mjs <초안 폴더>
// 카드 크기는 가게 파일 기준치.글규격.카드가로세로(기본 1080×810 가로형)와 다르면 경고한다.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadShop } from '../../_shared/shop.mjs';

const dir = resolve(process.argv[2] ?? '');
const html = resolve(dir, 'cards.html');
if (!existsSync(html)) { console.error('cards.html 없음:', html); process.exit(2); }
const shop = loadShop();
const [W, H] = Array.isArray(shop.기준치?.글규격?.카드가로세로) ? shop.기준치.글규격.카드가로세로 : [1080, 810];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W + 100, height: H + 200 }, deviceScaleFactor: 1 });
await page.goto('file://' + html);
await page.evaluate('document.fonts.ready');
await page.waitForTimeout(1200);
const cards = await page.$$('section.card');
if (!cards.length) { console.error('section.card가 없다'); await browser.close(); process.exit(2); }
const first = await cards[0].boundingBox();
if (first && (Math.round(first.width) !== W || Math.round(first.height) !== H)) {
  console.error(`⚠️ 카드가 ${Math.round(first.width)}×${Math.round(first.height)} — 가게 파일 기준은 ${W}×${H}. 정사각형은 휴대폰에서 장당 1.45배를 먹는다.`);
}
let bad = 0;
for (const card of cards) {
  const file = await card.getAttribute('data-file');
  if (!file) { console.error('data-file 없는 카드가 있다'); process.exit(2); }
  const over = await card.evaluate((el) => {
    const box = el.getBoundingClientRect(); let worst = 0;
    for (const child of el.querySelectorAll('*')) { const r = child.getBoundingClientRect(); worst = Math.max(worst, r.bottom - (box.bottom - 36), (box.top + 36) - r.top, r.right - (box.right - 36), (box.left + 36) - r.left); }
    return Math.round(Math.max(worst, el.scrollHeight - el.clientHeight));
  });
  if (over > 0) { console.error(`✗ ${file} — 테두리 밖으로 ${over}px 넘침. 글자를 줄여라`); bad++; continue; }
  await card.screenshot({ path: resolve(dir, file + '.png') });
  console.log(`✓ ${file}.png`);
}
await browser.close();
process.exit(bad ? 3 : 0);

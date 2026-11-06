// HTML overlay: annotations, lower-thirds, title cards, and burned-in subtitles.
// It is part of the page, so the headless-browser screenshot captures it exactly as designed.
import { clamp } from '../animations/ease.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export class Overlay {
  constructor(el, W, H) {
    this.el = el; this.W = W; this.H = H; this.portrait = H > W;
    el.style.setProperty('--u', `${Math.min(W, H) / 100}px`);   // 1u = 1% of the short side
    this.last = '';
  }
  // items: list of {kind, ...}; rebuilt only when the markup changes
  set(items) {
    const u = (v) => `calc(var(--u) * ${v})`;
    const P = this.portrait;
    let html = '';
    for (const it of items) {
      const a = clamp(it.a ?? 1).toFixed(3);
      if (a === '0.000') continue;
      if (it.kind === 'label') {
        const x = (it.x * 100).toFixed(2), y = (it.y * 100).toFixed(2);
        const dx = it.dx ?? 6, dy = it.dy ?? -5;   // leader line vector in u
        const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const left = dx < 0;
        html += `<div style="position:absolute;left:${x}%;top:${y}%;opacity:${a};">
          <div style="position:absolute;left:${u(-0.55)};top:${u(-0.55)};width:${u(1.1)};height:${u(1.1)};border-radius:50%;background:#fff;box-shadow:0 0 ${u(1.6)} rgba(180,220,255,.9);"></div>
          <div style="position:absolute;left:0;top:0;width:${u(len)};height:${u(0.16)};background:rgba(255,255,255,.75);transform-origin:0 50%;transform:rotate(${ang}deg);"></div>
          <div style="position:absolute;left:${u(dx)};top:${u(dy)};transform:translate(${left ? '-100%' : '0'},-100%);padding:${u(0.2)} ${u(0.8)};white-space:nowrap;font-size:${u(P ? 2.55 : 1.75)};letter-spacing:.06em;text-transform:uppercase;font-weight:600;text-shadow:0 0 ${u(1)} #000,0 0 ${u(0.5)} #000;">
          ${esc(it.text)}${it.sub ? `<div style="font-size:${u(P ? 2.05 : 1.35)};opacity:.75;letter-spacing:.03em;text-transform:none;font-weight:400;">${esc(it.sub)}</div>` : ''}</div></div>`;
      } else if (it.kind === 'lower') {
        const bottom = P ? 17 : 11.5;
        html += `<div style="position:absolute;left:${P ? 5 : 4.5}%;bottom:${bottom}%;opacity:${a};transform:translateX(${((1 - clamp(it.a ?? 1)) * -2).toFixed(2)}%);display:flex;gap:${u(1.4)};align-items:stretch;">
          <div style="width:${u(0.55)};background:linear-gradient(#7fd0ff,#ff9a5a);"></div>
          <div><div style="font-size:${u(P ? 3.6 : 2.6)};font-weight:700;letter-spacing:.04em;text-shadow:0 0 ${u(1.2)} #000;">${esc(it.title)}</div>
          <div style="font-size:${u(P ? 2.45 : 1.65)};opacity:.82;margin-top:${u(0.3)};text-shadow:0 0 ${u(1)} #000;">${esc(it.sub || '')}</div></div></div>`;
      } else if (it.kind === 'title') {
        html += `<div style="position:absolute;left:0;right:0;top:${it.y ?? 40}%;text-align:center;opacity:${a};transform:scale(${(1 + (1 - clamp(it.a ?? 1)) * 0.04).toFixed(4)});">
          ${it.small ? `<div style="font-size:${u(P ? 2.6 : 1.75)};letter-spacing:.5em;text-transform:uppercase;opacity:.8;text-shadow:0 0 ${u(1)} #000;">${esc(it.small)}</div>` : ''}
          <div style="font-size:${u(it.size ?? (P ? 7.2 : 5.4))};font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:${u(1)} ${u(3)};text-shadow:0 0 ${u(3)} rgba(120,180,255,.55),0 0 ${u(1)} #000;line-height:1.08;">${esc(it.text)}</div>
          ${it.sub ? `<div style="font-size:${u(P ? 2.9 : 2.0)};opacity:.85;letter-spacing:.12em;text-shadow:0 0 ${u(1)} #000;">${esc(it.sub)}</div>` : ''}</div>`;
      } else if (it.kind === 'tag') {   // small corner note (e.g. "Illustrative visualization")
        html += `<div style="position:absolute;${P ? 'left:5%;top:5.5%' : 'right:2.6%;top:3.6%'};opacity:${a};font-size:${u(P ? 2.1 : 1.3)};letter-spacing:.14em;text-transform:uppercase;padding:${u(0.5)} ${u(1.2)};border:${u(0.12)} solid rgba(255,255,255,.45);border-radius:${u(0.5)};background:rgba(0,0,0,.35);">${esc(it.text)}</div>`;
      } else if (it.kind === 'credit') {
        html += `<div style="position:absolute;left:${P ? 5 : 4.5}%;bottom:${P ? 14 : 4.2}%;opacity:${a};font-size:${u(P ? 1.9 : 1.15)};letter-spacing:.06em;opacity:${(a * 0.7).toFixed(3)};text-shadow:0 0 ${u(0.8)} #000;">${esc(it.text)}</div>`;
      } else if (it.kind === 'bar') {   // horizontal scale bar: x,y,w in %, fill 0..1
        html += `<div style="position:absolute;left:${it.x}%;top:${it.y}%;width:${it.w}%;opacity:${a};">
          <div style="font-size:${u(P ? 2.4 : 1.55)};letter-spacing:.06em;margin-bottom:${u(0.5)};text-shadow:0 0 ${u(1)} #000;">${esc(it.text)}</div>
          <div style="height:${u(P ? 1.1 : 0.9)};width:${(clamp(it.fill) * 100).toFixed(2)}%;background:${it.color || 'linear-gradient(90deg,#7fd0ff,#ffb070)'};border-radius:${u(0.5)};box-shadow:0 0 ${u(1.4)} ${it.glow || 'rgba(255,170,100,.7)'};"></div></div>`;
      } else if (it.kind === 'stat') {
        html += `<div style="position:absolute;left:${it.x}%;top:${it.y}%;opacity:${a};text-align:${it.align || 'left'};transform:translateX(${it.align === 'center' ? '-50%' : '0'});">
          <div style="font-size:${u(it.size ?? (P ? 6.4 : 4.2))};font-weight:800;letter-spacing:.03em;text-shadow:0 0 ${u(1.6)} rgba(120,180,255,.5),0 0 ${u(0.8)} #000;">${esc(it.text)}</div>
          <div style="font-size:${u(P ? 2.4 : 1.5)};opacity:.8;letter-spacing:.1em;text-transform:uppercase;text-shadow:0 0 ${u(1)} #000;">${esc(it.sub || '')}</div></div>`;
      } else if (it.kind === 'subtitle') {
        const bottom = P ? 24 : 6.2;   // Shorts: keep above the platform UI zone
        html += `<div style="position:absolute;left:${P ? 6 : 12}%;right:${P ? 6 : 12}%;bottom:${bottom}%;text-align:center;opacity:${a};">
          <span style="display:inline-block;font-size:${u(P ? 4.3 : 2.45)};line-height:1.22;font-weight:700;padding:${u(0.6)} ${u(1.6)};background:rgba(0,0,0,.58);border-radius:${u(0.9)};text-shadow:0 ${u(0.1)} ${u(0.5)} #000;white-space:pre-line;">${esc(it.text)}</span></div>`;
      }
    }
    if (html !== this.last) { this.el.innerHTML = html; this.last = html; }
  }
}

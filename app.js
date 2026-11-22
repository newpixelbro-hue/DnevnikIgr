'use strict';
/* ---------- утилиты ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DAY = 86400000;

const STATUS = {
  wish: 'Хочу пройти', playing: 'Играю', done: 'Пройдена', dropped: 'Бросил', paused: 'На паузе'
};
const PLATFORMS = ['', 'PS5', 'PS4', 'PS3', 'ПК', 'Xbox', 'Switch', 'Другое'];

/* ---------- хранилище (IndexedDB) ---------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('game-diary', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { DB.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  get(k) {
    return new Promise(res => {
      const q = DB.db.transaction('kv').objectStore('kv').get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => res(undefined);
    });
  },
  set(k, v) {
    return new Promise(res => {
      const t = DB.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res;
    });
  }
};

let S = { games: [], settings: { key: '', theme: 'dark' } };
let saveTimer;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => DB.set('state', S), 250); };

function newGame(o = {}) {
  return Object.assign({
    id: uid(), name: '', year: '', genre: '', series: '', status: 'wish', priority: 2,
    rating: 0, rs: 0, rg: 0, rm: 0, start: '', end: '', hours: '', platform: '',
    notes: '', spoiler: '', ending: '', favChar: '', tags: [],
    checks: { platinum: false, full: false, dlc: false, side: false },
    shots: [], quotes: [], cover: '', coverTried: false, updated: Date.now()
  }, o);
}

function seed() {
  S.games = CATALOG.map(c => {
    const g = newGame({ name: c.name, year: c.year, genre: c.genre, series: c.series, status: c.status });
    if (c.status === 'done') g.end = today();
    return g;
  });
  save();
}

/* ---------- состояние интерфейса ---------- */
const ui = { tab: 'lib', q: '', status: 'all', genre: '', sort: 'updated', group: false, open: null, tag: '' };
const byId = id => S.games.find(g => g.id === id);

/* ---------- обложки (RAWG) ---------- */
let coverBusy = false;
async function rawg(path) {
  const key = S.settings.key.trim();
  if (!key) throw new Error('no key');
  const r = await fetch(`https://api.rawg.io/api/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
async function fetchCovers() {
  if (coverBusy || !S.settings.key.trim()) return;
  coverBusy = true;
  try {
    for (const g of S.games) {
      if (g.cover || g.coverTried) continue;
      try {
        const d = await rawg(`games?search=${encodeURIComponent(g.name)}&page_size=1&search_precise=true`);
        const hit = d.results && d.results[0];
        if (hit && hit.background_image) g.cover = hit.background_image;
        g.coverTried = true;
        save(); if (ui.tab === 'lib' || ui.tab === 'wish') renderMain(true);
      } catch (e) { if (String(e.message).includes('http 401')) { toast('Ключ RAWG не подошёл'); break; } }
      await new Promise(r => setTimeout(r, 350));
    }
  } finally { coverBusy = false; }
}

/* ---------- отрисовка ---------- */
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = n => n.replace(/[^\p{L}\p{N} ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
function coverEl(g, big) {
  const st = g.cover
    ? `background-image:url('${esc(g.cover)}')`
    : `background:linear-gradient(145deg,hsl(${hue(g.name)} 38% 30%),hsl(${(hue(g.name) + 40) % 360} 40% 18%))`;
  return `<div class="cover ${big ? 'big' : ''}" style="${st}">${g.cover ? '' : esc(initials(g.name))}</div>`;
}
const avg = g => {
  const v = [g.rating, g.rs, g.rg, g.rm].filter(x => x > 0);
  return g.rating || (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
};

function gameCard(g) {
  const sc = g.rating ? `<span class="score">★ ${g.rating}</span>` : '';
  const sub = [g.year, g.genre, g.platform].filter(Boolean).join(', ');
  return `<div class="card" data-open="${g.id}">${coverEl(g)}
    <div class="meta"><b>${esc(g.name)}</b><div class="sub">${esc(sub) || '&nbsp;'}</div>
    <span class="badge st-${g.status}">${STATUS[g.status]}</span>${sc}</div></div>`;
}

function filtered(wishOnly) {
  const q = ui.q.trim().toLowerCase();
  let L = S.games.filter(g => {
    if (wishOnly && g.status !== 'wish') return false;
    if (!wishOnly && ui.status !== 'all' && g.status !== ui.status) return false;
    if (ui.genre && g.genre !== ui.genre) return false;
    if (ui.tag && !g.tags.includes(ui.tag)) return false;
    if (q && !(g.name + ' ' + g.series + ' ' + g.tags.join(' ')).toLowerCase().includes(q)) return false;
    return true;
  });
  const s = wishOnly ? 'priority' : ui.sort;
  const cmp = {
    updated: (a, b) => b.updated - a.updated,
    name: (a, b) => a.name.localeCompare(b.name),
    rating: (a, b) => b.rating - a.rating,
    year: (a, b) => (b.year || 0) - (a.year || 0),
    end: (a, b) => (b.end || '').localeCompare(a.end || ''),
    priority: (a, b) => b.priority - a.priority || a.name.localeCompare(b.name)
  }[s];
  return L.sort(cmp);
}

function filterBar(wishOnly) {
  const genres = [...new Set(S.games.map(g => g.genre).filter(Boolean))].sort();
  const tags = [...new Set(S.games.flatMap(g => g.tags))].sort();
  const chips = wishOnly ? '' : `<div class="chips">${['all', ...Object.keys(STATUS)].map(k =>
    `<button class="chip ${ui.status === k ? 'on' : ''}" data-status="${k}">${k === 'all' ? 'Все' : STATUS[k]}</button>`).join('')}</div>`;
  const sortSel = wishOnly ? '' : `<select class="in" data-ui="sort">
      ${[['updated', 'Недавние'], ['name', 'По названию'], ['rating', 'По оценке'], ['year', 'По году выхода'], ['end', 'По дате прохождения']]
        .map(([v, t]) => `<option value="${v}" ${ui.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<input class="search" data-ui="q" placeholder="Поиск по названию, серии, тегу" value="${esc(ui.q)}">
    ${chips}
    <div class="row">
      <select class="in" data-ui="genre"><option value="">Все жанры</option>${genres.map(x => `<option ${ui.genre === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      ${sortSel}
    </div>
    ${tags.length ? `<div class="chips">${tags.map(t => `<button class="chip ${ui.tag === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
    ${wishOnly ? '' : `<div class="row"><button class="chip ${ui.group ? 'on' : ''}" data-group="1">Группировать по сериям</button></div>`}`;
}

function listHtml(L, grouped) {
  if (!L.length) return '<div class="empty">Ничего не найдено.<br>Нажми «+», чтобы добавить игру.</div>';
  if (!grouped) return L.map(gameCard).join('');
  const m = new Map();
  L.forEach(g => { const k = g.series || 'Без серии'; (m.get(k) || m.set(k, []).get(k)).push(g); });
  const keys = [...m.keys()].sort((a, b) => a === 'Без серии' ? 1 : b === 'Без серии' ? -1 : a.localeCompare(b));
  return keys.map(k => `<div class="group">${esc(k)}</div>${m.get(k).sort((a, b) => (a.year || 0) - (b.year || 0)).map(gameCard).join('')}`).join('');
}

function renderLib() {
  const L = filtered(false);
  const stale = S.games.filter(g => g.status === 'playing' && Date.now() - g.updated > 7 * DAY);
  const banner = stale.slice(0, 2).map(g =>
    `<div class="banner">Ты давно не заходил в «${esc(g.name)}»: ${Math.floor((Date.now() - g.updated) / DAY)} дн. Продолжить?</div>`).join('');
  const done = S.games.filter(g => g.status === 'done').length;
  return `<h1>Мои игры</h1><div class="mute small" style="margin:-8px 0 8px">Всего ${S.games.length}, пройдено ${done}</div>
    ${banner}${filterBar(false)}<div id="list">${listHtml(L, ui.group)}</div>
    <button class="fab" data-add="1" aria-label="Добавить игру">+</button>`;
}

function renderWish() {
  const L = filtered(true);
  const pr = ['', 'Низкий', 'Средний', 'Высокий'];
  const body = L.length ? L.map(g => gameCard(g).replace('</div></div>', `</div><div class="sub" style="margin:6px 0 0">Приоритет: ${pr[g.priority]}</div></div>`)).join('')
    : '<div class="empty">Список «хочу пройти» пуст.</div>';
  return `<h1>Хочу пройти</h1>
    <button class="btn" data-random="1">Выбрать случайную игру</button>
    ${filterBar(true)}<div id="list">${body}</div>
    <button class="fab" data-add="1" aria-label="Добавить игру">+</button>`;
}

const ACH = [
  ['🎮', 'Первая победа', 'Пройти 1 игру', s => s.done >= 1],
  ['🔟', 'Десятка', 'Пройти 10 игр', s => s.done >= 10],
  ['🏆', 'Четвертак', 'Пройти 25 игр', s => s.done >= 25],
  ['👑', 'Полтинник', 'Пройти 50 игр', s => s.done >= 50],
  ['💯', 'Перфекционист', 'Получить 100% или платину в любой игре', s => s.full >= 1],
  ['⭐', 'Критик', 'Оценить 10 игр', s => s.rated >= 10],
  ['📝', 'Летописец', 'Написать заметки к 10 играм', s => s.noted >= 10],
  ['⏱', 'Марафонец', 'Набрать 100 часов в дневнике', s => s.hours >= 100],
  ['📚', 'Коллекционер', 'Собрать 100 игр в списке', s => s.total >= 100],
  ['🔗', 'Фанат серий', 'Пройти 2 игры из одной серии', s => s.seriesDone >= 1],
  ['📸', 'Фотограф', 'Добавить 5 скриншотов', s => s.shots >= 5],
  ['🗓', 'Годовая норма', 'Пройти 12 игр за год', s => s.maxYear >= 12]
];

function stats() {
  const G = S.games, done = G.filter(g => g.status === 'done');
  const sc = {}, byYear = {}, byGenre = {}, byPlat = {};
  done.forEach(g => {
    if (g.series) sc[g.series] = (sc[g.series] || 0) + 1;
    const y = (g.end || '').slice(0, 4); if (y) byYear[y] = (byYear[y] || 0) + 1;
    if (g.genre) byGenre[g.genre] = (byGenre[g.genre] || 0) + 1;
    if (g.platform) byPlat[g.platform] = (byPlat[g.platform] || 0) + 1;
  });
  const rated = G.filter(g => g.rating > 0);
  return {
    total: G.length, done: done.length,
    playing: G.filter(g => g.status === 'playing').length,
    wish: G.filter(g => g.status === 'wish').length,
    avg: rated.length ? (rated.reduce((a, g) => a + g.rating, 0) / rated.length) : 0,
    hours: G.reduce((a, g) => a + (+g.hours || 0), 0),
    thisYear: byYear[new Date().getFullYear()] || 0,
    maxYear: Math.max(0, ...Object.values(byYear)),
    full: G.filter(g => g.checks.full || g.checks.platinum).length,
    rated: rated.length, noted: G.filter(g => g.notes || g.spoiler).length,
    shots: G.reduce((a, g) => a + g.shots.length, 0),
    seriesDone: Object.values(sc).filter(n => n >= 2).length,
    byYear, byGenre, byPlat
  };
}
function bars(obj, limit) {
  const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit || 6);
  if (!e.length) return '<div class="mute small">Пока нет данных</div>';
  const mx = Math.max(...e.map(x => x[1]));
  return e.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${Math.round(v / mx * 100)}%"></i><span style="width:auto;color:var(--text)">${v}</span></div>`).join('');
}
function renderStats() {
  const s = stats();
  const topGenre = Object.entries(s.byGenre).sort((a, b) => b[1] - a[1])[0];
  return `<h1>Статистика</h1>
  <div class="stats">
    <div class="stat"><b>${s.done}</b><span>пройдено</span></div>
    <div class="stat"><b>${s.thisYear}</b><span>за этот год</span></div>
    <div class="stat"><b>${s.avg ? s.avg.toFixed(1) : '–'}</b><span>средняя оценка из 5</span></div>
    <div class="stat"><b>${Math.round(s.hours)}</b><span>часов в дневнике</span></div>
    <div class="stat"><b>${s.playing}</b><span>играю сейчас</span></div>
    <div class="stat"><b>${topGenre ? esc(topGenre[0]) : '–'}</b><span>любимый жанр</span></div>
  </div>
  <h2>Пройдено по годам</h2>${bars(s.byYear, 8)}
  <h2>Жанры</h2>${bars(s.byGenre)}
  <h2>Платформы</h2>${bars(s.byPlat)}
  <h2>Достижения</h2>${ACH.map(([ic, t, d, f]) => `<div class="ach ${f(s) ? 'got' : ''}"><div class="ic">${ic}</div><div><b>${t}</b><small>${d}</small></div></div>`).join('')}`;
}

function renderMore() {
  return `<h1>Ещё</h1>
  <label class="lbl">Ключ RAWG для обложек (бесплатно на rawg.io/apidocs)</label>
  <input class="in" id="key" placeholder="Вставь ключ" value="${esc(S.settings.key)}">
  <div class="row"><button class="btn ghost" data-act="savekey">Сохранить ключ и загрузить обложки</button></div>
  <h2>Оформление</h2>
  <div class="row"><button class="btn ghost" data-act="theme">Тема: ${S.settings.theme === 'dark' ? 'тёмная' : 'светлая'} (сменить)</button></div>
  <h2>Резервная копия</h2>
  <div class="row"><button class="btn ghost" data-act="export">Экспорт в файл</button></div>
  <div class="row"><button class="btn ghost" data-act="import">Импорт из файла</button></div>
  <input type="file" id="file" accept=".json,application/json" hidden>
  <div class="mute small">Файл можно отправить себе в Telegram или сохранить в облако. Импорт заменяет текущие данные.</div>
  <h2>Данные</h2>
  <div class="row"><button class="btn ghost" data-act="addcat">Вернуть стартовый список игр</button></div>
  <div class="row"><button class="btn danger" data-act="reset">Удалить все данные</button></div>`;
}

function renderMain(keepScroll) {
  const m = $('#main'), sc = m.scrollTop;
  const focused = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.ui === 'q';
  m.innerHTML = { lib: renderLib, wish: renderWish, stats: renderStats, more: renderMore }[ui.tab]();
  if (keepScroll) m.scrollTop = sc;
  if (focused) { const i = $('[data-ui=q]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  $('#nav').innerHTML = [['lib', '🎮', 'Игры'], ['wish', '🔖', 'Хочу'], ['stats', '📊', 'Статистика'], ['more', '⚙', 'Ещё']]
    .map(([k, i, t]) => `<button class="${ui.tab === k ? 'on' : ''}" data-tab="${k}"><b>${i}</b>${t}</button>`).join('');
}
function refreshList() { // обновляем только список, чтобы не терять фокус в поиске
  const l = $('#list'); if (!l) return renderMain(true);
  const w = ui.tab === 'wish'; const L = filtered(w);
  l.innerHTML = w ? renderWish().match(/<div id="list">([\s\S]*)<\/div>\s*<button class="fab"/)[1] : listHtml(L, ui.group);
}

/* ---------- карточка игры ---------- */
const stars = (f, v) => `<span>${[1, 2, 3, 4, 5].map(i => `<button class="star ${i <= v ? 'on' : ''}" data-star="${f}" data-v="${i}">★</button>`).join('')}</span>`;
function renderSheet() {
  const el = $('#sheet'), g = byId(ui.open);
  if (!g) { el.classList.remove('on'); return; }
  const sc = el.scrollTop;
  el.innerHTML = `
  <div class="topbar"><button data-close="1">‹ Назад</button><span class="mute small">Сохраняется автоматически</span></div>
  <div class="head">${coverEl(g, true)}<div class="col">
    <input class="in" data-f="name" placeholder="Название" value="${esc(g.name)}">
    <div class="row"><input class="in" data-f="year" type="number" placeholder="Год" value="${esc(g.year)}">
    <input class="in" data-f="genre" placeholder="Жанр" value="${esc(g.genre)}"></div>
  </div></div>
  <div class="chips">${Object.entries(STATUS).map(([k, t]) => `<button class="chip ${g.status === k ? 'on' : ''}" data-setstatus="${k}">${t}</button>`).join('')}</div>
  ${g.status === 'wish' ? `<label class="lbl">Приоритет</label><div class="chips">${[[1, 'Низкий'], [2, 'Средний'], [3, 'Высокий']].map(([v, t]) => `<button class="chip ${g.priority === v ? 'on' : ''}" data-prio="${v}">${t}</button>`).join('')}</div>` : ''}

  <label class="lbl">Оценки</label>
  <div class="stars"><span class="n">Общая</span>${stars('rating', g.rating)}</div>
  <div class="stars"><span class="n">Сюжет</span>${stars('rs', g.rs)}</div>
  <div class="stars"><span class="n">Геймплей</span>${stars('rg', g.rg)}</div>
  <div class="stars"><span class="n">Музыка</span>${stars('rm', g.rm)}</div>

  <div class="row"><div><label class="lbl">Начал</label><input class="in" type="date" data-f="start" value="${esc(g.start)}"></div>
  <div><label class="lbl">Закончил</label><input class="in" type="date" data-f="end" value="${esc(g.end)}"></div></div>
  <div class="row"><div><label class="lbl">Часов</label><input class="in" type="number" inputmode="decimal" data-f="hours" value="${esc(g.hours)}"></div>
  <div><label class="lbl">Платформа</label><select class="in" data-f="platform">${PLATFORMS.map(p => `<option ${g.platform === p ? 'selected' : ''} value="${p}">${p || '—'}</option>`).join('')}</select></div></div>

  <label class="lbl">Серия</label><input class="in" data-f="series" placeholder="Например: Red Dead" value="${esc(g.series)}">
  <label class="lbl">Теги через запятую</label><input class="in" data-f="tags" placeholder="сюжетная, любимое, вестерн" value="${esc(g.tags.join(', '))}">

  <label class="lbl">Концовка</label><input class="in" data-f="ending" placeholder="Какую получил, какие остались" value="${esc(g.ending)}">
  <label class="lbl">Лучший персонаж</label><input class="in" data-f="favChar" value="${esc(g.favChar)}">

  <label class="lbl">Чек-лист</label>
  ${[['platinum', 'Платина'], ['full', '100%'], ['dlc', 'DLC пройдены'], ['side', 'Побочки сделаны']].map(([k, t]) =>
    `<label class="check"><input type="checkbox" data-c="${k}" ${g.checks[k] ? 'checked' : ''}>${t}</label>`).join('')}

  <label class="lbl">Заметки и любимые моменты (без спойлеров)</label>
  <textarea class="in" data-f="notes">${esc(g.notes)}</textarea>
  <details ${g.spoiler ? 'open' : ''}><summary>Заметки со спойлерами</summary><textarea class="in" data-f="spoiler">${esc(g.spoiler)}</textarea></details>

  <label class="lbl">Любимые цитаты</label>
  ${g.quotes.map((q, i) => `<div class="quote"><span>${esc(q)}</span><button data-delq="${i}">✕</button></div>`).join('')}
  <div class="row"><input class="in" id="newq" placeholder="Новая цитата"><button class="btn ghost" style="flex:none;width:auto;margin:0" data-addq="1">Добавить</button></div>

  <label class="lbl">Скриншоты</label>
  <div class="shots">${g.shots.map((s, i) => `<div class="shot" style="background-image:url('${s}')"><button data-dels="${i}">✕</button></div>`).join('')}</div>
  <button class="btn ghost" data-addshot="1">Добавить скриншот</button>
  <input type="file" id="shotfile" accept="image/*" multiple hidden>

  <label class="lbl">Обложка (ссылка)</label><input class="in" data-f="cover" placeholder="https://…" value="${esc(g.cover)}">
  <button class="btn danger" style="margin-top:22px" data-delgame="1">Удалить игру</button>`;
  el.classList.add('on'); el.scrollTop = sc;
}

function resizeImage(file) {
  return new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- добавление игры ---------- */
function openAdd() {
  const m = $('#modal');
  m.innerHTML = `<div class="panel"><h2 style="margin-top:0">Добавить игру</h2>
    <input class="search" id="addq" placeholder="Название игры" autocomplete="off">
    <div id="addres"></div>
    <button class="btn" data-manual="1">Добавить с таким названием</button>
    <button class="btn ghost" data-closemodal="1">Отмена</button></div>`;
  m.classList.add('on');
  setTimeout(() => $('#addq').focus(), 50);
}
let addTimer;
function onAddInput(v) {
  clearTimeout(addTimer);
  const box = $('#addres');
  if (!S.settings.key.trim()) { box.innerHTML = '<div class="mute small" style="padding:8px 2px">Чтобы искать игры в базе с обложками, добавь ключ RAWG во вкладке «Ещё».</div>'; return; }
  if (v.trim().length < 2) { box.innerHTML = ''; return; }
  addTimer = setTimeout(async () => {
    try {
      const d = await rawg(`games?search=${encodeURIComponent(v)}&page_size=6`);
      window._res = d.results;
      box.innerHTML = d.results.map((r, i) => `<div class="res" data-pick="${i}">
        <div class="cover" style="${r.background_image ? `background-image:url('${esc(r.background_image)}')` : 'background:var(--panel2)'}"></div>
        <div class="meta"><b>${esc(r.name)}</b><div class="sub" style="margin:0">${esc((r.released || '').slice(0, 4))} ${esc((r.genres || []).map(x => x.name).join(', '))}</div></div></div>`).join('')
        || '<div class="mute small">Ничего не найдено</div>';
    } catch (e) { box.innerHTML = '<div class="mute small">Не удалось найти. Проверь интернет и ключ.</div>'; }
  }, 400);
}
function addAndOpen(o) {
  const g = newGame(o); S.games.unshift(g); save();
  $('#modal').classList.remove('on'); renderMain(true); ui.open = g.id; renderSheet();
}

/* ---------- прочее ---------- */
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); }
function confirmBox(text, ok) {
  const m = $('#modal');
  m.innerHTML = `<div class="panel"><p>${text}</p><button class="btn danger" data-yes="1">Да</button><button class="btn ghost" data-closemodal="1">Отмена</button></div>`;
  m.classList.add('on'); confirmBox.ok = ok;
}
function pickRandom() {
  const pool = S.games.filter(g => g.status === 'wish').flatMap(g => Array(g.priority).fill(g));
  if (!pool.length) return toast('В списке «хочу пройти» пусто');
  const g = pool[Math.floor(Math.random() * pool.length)];
  const m = $('#modal');
  m.innerHTML = `<div class="panel"><h2 style="margin-top:0">Сегодня играем в…</h2>
    <div class="card" data-open="${g.id}" data-closemodal="1">${coverEl(g)}<div class="meta"><b>${esc(g.name)}</b><div class="sub">${esc([g.year, g.genre].filter(Boolean).join(', '))}</div></div></div>
    <button class="btn" data-setplay="${g.id}">Начать играть</button>
    <button class="btn ghost" data-random="1">Другая</button>
    <button class="btn ghost" data-closemodal="1">Закрыть</button></div>`;
  m.classList.add('on');
}
function plug(n) { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]; }
async function exportData() {
  const json = JSON.stringify({ app: 'game-diary', v: 1, date: today(), state: S });
  const name = `game-diary-${today()}.json`;
  const FS = plug('Filesystem'), SH = plug('Share');
  try {
    if (FS && SH) {
      const r = await FS.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      await SH.share({ title: 'Дневник игр', url: r.uri, dialogTitle: 'Сохранить копию' });
      return;
    }
  } catch (e) { if (String(e).includes('cancel')) return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click();
}
function importData(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result); const st = d.state || d;
      if (!Array.isArray(st.games)) throw 0;
      S = { games: st.games.map(g => newGame(g)), settings: Object.assign({ key: '', theme: 'dark' }, st.settings) };
      save(); applyTheme(); renderMain(); toast('Данные загружены');
    } catch (e) { toast('Это не файл дневника игр'); }
  };
  fr.readAsText(file);
}
const applyTheme = () => document.documentElement.dataset.theme = S.settings.theme;

/* ---------- события ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-open],[data-pick]'); if (!t) return;
  const d = t.dataset, g = byId(ui.open);
  if (d.tab) { ui.tab = d.tab; renderMain(); $('#main').scrollTop = 0; return; }
  if (d.status) { ui.status = d.status; renderMain(true); return; }
  if (d.tag !== undefined && d.tag !== '') { ui.tag = ui.tag === d.tag ? '' : d.tag; renderMain(true); return; }
  if (d.group) { ui.group = !ui.group; renderMain(true); return; }
  if (d.add) return openAdd();
  if (d.random) return pickRandom();
  if (d.setplay) { const x = byId(d.setplay); x.status = 'playing'; x.start = x.start || today(); x.updated = Date.now(); save(); $('#modal').classList.remove('on'); renderMain(true); ui.open = x.id; renderSheet(); return; }
  if (d.closemodal) { $('#modal').classList.remove('on'); if (!d.open) return; }
  if (d.open) { ui.open = d.open; renderSheet(); return; }
  if (d.close) { ui.open = null; renderSheet(); renderMain(true); return; }
  if (d.manual) { const n = $('#addq').value.trim(); if (!n) return toast('Введи название'); const c = CATALOG.find(x => x.name.toLowerCase() === n.toLowerCase()); return addAndOpen(c ? { name: c.name, year: c.year, genre: c.genre, series: c.series } : { name: n }); }
  if (d.pick !== undefined) {
    const r = window._res[+d.pick];
    return addAndOpen({ name: r.name, year: +(r.released || '').slice(0, 4) || '', genre: (r.genres && r.genres[0] ? r.genres[0].name : ''), cover: r.background_image || '', coverTried: true });
  }
  if (d.yes) { $('#modal').classList.remove('on'); confirmBox.ok && confirmBox.ok(); return; }
  if (d.act) {
    if (d.act === 'savekey') { S.settings.key = $('#key').value.trim(); save(); toast('Ключ сохранён'); S.games.forEach(x => { if (!x.cover) x.coverTried = false; }); fetchCovers(); }
    if (d.act === 'theme') { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); renderMain(true); }
    if (d.act === 'export') exportData();
    if (d.act === 'import') $('#file').click();
    if (d.act === 'addcat') { const have = new Set(S.games.map(x => x.name)); CATALOG.forEach(c => { if (!have.has(c.name)) S.games.push(newGame({ name: c.name, year: c.year, genre: c.genre, series: c.series, status: c.status })); }); save(); toast('Готово'); }
    if (d.act === 'reset') confirmBox('Удалить все игры и заметки? Это нельзя отменить.', () => { S.games = []; save(); renderMain(); toast('Всё удалено'); });
    return;
  }
  if (!g) return;
  g.updated = Date.now();
  if (d.setstatus) {
    g.status = d.setstatus;
    if (g.status === 'playing' && !g.start) g.start = today();
    if (g.status === 'done' && !g.end) g.end = today();
  } else if (d.prio) g.priority = +d.prio;
  else if (d.star) g[d.star] = g[d.star] === +d.v ? 0 : +d.v;
  else if (d.addq) { const i = $('#newq'); if (i.value.trim()) g.quotes.push(i.value.trim()); }
  else if (d.delq !== undefined) g.quotes.splice(+d.delq, 1);
  else if (d.dels !== undefined) g.shots.splice(+d.dels, 1);
  else if (d.addshot) { $('#shotfile').click(); return; }
  else if (d.delgame) { confirmBox(`Удалить «${esc(g.name)}»?`, () => { S.games = S.games.filter(x => x.id !== g.id); ui.open = null; save(); renderSheet(); renderMain(true); }); return; }
  else return;
  save(); renderSheet();
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'addq') return onAddInput(t.value);
  if (t.dataset.ui === 'q') { ui.q = t.value; return refreshList(); }
  const g = byId(ui.open); if (!g) return;
  if (t.dataset.f) {
    const f = t.dataset.f;
    g[f] = f === 'tags' ? t.value.split(',').map(x => x.trim()).filter(Boolean) : t.value;
    g.updated = Date.now(); save();
  }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.ui && t.dataset.ui !== 'q') { ui[t.dataset.ui] = t.value; return renderMain(true); }
  if (t.id === 'file' && t.files[0]) return importData(t.files[0]);
  const g = byId(ui.open);
  if (t.id === 'shotfile' && g) {
    for (const f of t.files) g.shots.push(await resizeImage(f));
    g.updated = Date.now(); save(); renderSheet(); t.value = ''; return;
  }
  if (t.dataset.c && g) { g.checks[t.dataset.c] = t.checked; g.updated = Date.now(); save(); }
  if (t.dataset.f === 'platform' && g) { g.platform = t.value; save(); }
});

/* ---------- старт ---------- */
(async function init() {
  await DB.open();
  const st = await DB.get('state');
  if (st) S = Object.assign(S, st, { settings: Object.assign({ key: '', theme: 'dark' }, st.settings) });
  else seed();
  S.games = S.games.map(g => newGame(g));
  applyTheme(); renderMain();
  fetchCovers();
  const App = plug('App');
  if (App) App.addListener('backButton', () => {
    if ($('#modal').classList.contains('on')) $('#modal').classList.remove('on');
    else if (ui.open) { ui.open = null; renderSheet(); renderMain(true); }
    else if (ui.tab !== 'lib') { ui.tab = 'lib'; renderMain(); }
    else App.exitApp();
  });
})();

// 观察记录 · 应用入口（无框架、无构建，纯 ES Module）
import * as db from './db.js';
import { icon } from './icons.js';
import { toast, escapeHTML as esc, confirmDialog, openModal, closeModal, progressDialog } from './ui.js';
import { compressPhoto, shrinkBlob, objectURL, releaseObjectURLs } from './image.js';
import {
  fmtHomeDate, fmtTime, fmtDayLabel, fmtDateTime, toLocalInput, fromLocalInput,
  startOfMonth, endOfToday, dateKey
} from './date.js';
import { buildDocx, DOCX_MIME } from './docx.js';

const app = document.getElementById('app');

const DIMENSIONS = [
  { key: 'rule', name: '规则与安全', color: '#C96F4A', hint: '他遵守或违反了哪些规则？有没有提醒同伴？' },
  { key: 'task', name: '任务执行', color: '#6E8FB0', hint: '任务是什么？先做了什么？遇到困难怎么办？' },
  { key: 'peer', name: '同伴互动', color: '#7E9B76', hint: '和谁？说了什么？合作、分享还是冲突？' },
  { key: 'learn', name: '学习品质', color: '#9A86A8', hint: '对什么好奇？专注多久？失败后还继续吗？' }
];
const DIM_MAP = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]));

const ASSETS = {
  bg: 'assets/bg.jpg',
  emptyNoObject: 'assets/illust-no-object.webp',
  emptyRecords: 'assets/illust-empty.webp',
  about: 'assets/illust-about.webp',
  exportDone: 'assets/illust-export.webp',
  avatarBoy: 'assets/avatar-boy.webp',
  avatarGirl: 'assets/avatar-girl.webp'
};

// ---------------- 通用 UI 片段 ----------------

function tabbar(active) {
  const items = [
    ['record', '记录', 'notebook', '#/'],
    ['search', '查找', 'search', '#/search'],
    ['export', '导出', 'upload', '#/export'],
    ['settings', '设置', 'sliders', '#/settings']
  ];
  return `<nav class="tabbar">${items.map(([key, label, ico, href]) => `
    <a class="tab ${active === key ? 'is-active' : ''}" href="${href}">
      ${icon(ico, 'tab-icon')}<span>${label}</span>
    </a>`).join('')}</nav>`;
}

function fab(href, label = '新记录') {
  return `<a class="fab" href="${href}" aria-label="${label}">${icon('plus', 'fab-icon')}</a>`;
}

function dimTag(key) {
  const d = DIM_MAP[key] || { name: '未分类', color: '#9A9A96' };
  return `<span class="dim-tag" style="--c:${d.color}"><i></i>${d.name}</span>`;
}

function emptyBlock(image, title, text, action = '') {
  return `<div class="empty-state">
    ${image ? `<img class="empty-illust" src="${image}" alt="" onerror="this.remove()">` : ''}
    <h2 class="empty-title">${esc(title)}</h2>
    <p class="empty-text">${esc(text)}</p>
    ${action}
  </div>`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// ---------------- 路由 ----------------

function parseRoute() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#/, '') || '/');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart);

  if (segments.length === 0) return { name: 'home' };
  if (segments[0] === 'object' && segments[1]) return { name: 'library', id: segments[1] };
  if (segments[0] === 'record') {
    return { name: 'record', editId: query.get('edit') || '', subjectId: query.get('subject') || '' };
  }
  if (segments[0] === 'detail' && segments[1]) return { name: 'detail', id: segments[1] };
  if (['search', 'export', 'settings'].includes(segments[0])) return { name: segments[0] };
  return { name: 'home' };
}

let rendering = false;

async function render() {
  if (rendering) return;
  rendering = true;
  releaseObjectURLs();
  closeModal();
  const route = parseRoute();
  let page;
  try {
    page = await PAGES[route.name](route);
  } catch (error) {
    console.error(error);
    page = {
      html: `<div class="app-shell"><div class="page-scroll"><div class="empty-state">
        <h2 class="empty-title">页面加载失败</h2>
        <p class="empty-text">${esc(error.message || '未知错误')}</p>
        <a class="btn-secondary" href="#/">返回首页</a>
      </div></div></div>`
    };
  }
  app.innerHTML = page.html;
  if (page.mount) {
    try { page.mount(); } catch (error) { console.error(error); }
  }
  const scroller = app.querySelector('.page-scroll');
  if (scroller) scroller.scrollTop = 0;
  rendering = false;
}

// ---------------- 首页 ----------------

function subjectCard(subject) {
  const initial = (subject.code || '?').slice(0, 1);
  const avatar = subject.avatar === 'girl' ? ASSETS.avatarGirl : ASSETS.avatarBoy;
  return `<article class="subject-card" data-id="${subject.id}">
    <div class="subject-avatar">
      <span class="avatar-letter">${esc(initial)}</span>
      <img src="${avatar}" alt="" onerror="this.remove()">
    </div>
    <div class="subject-code">${esc(subject.code)}</div>
    <input class="subject-note" data-id="${subject.id}" value="${esc(subject.note || '')}"
      placeholder="添加备注…" maxlength="40" enterkeyhint="done">
  </article>`;
}

async function homePage() {
  const [subjects, records] = await Promise.all([db.listSubjects(), db.listAllRecords()]);
  const body = subjects.length
    ? `<div class="section-label">观察对象</div>
       <div class="subject-list">${subjects.map(subjectCard).join('')}</div>`
    : emptyBlock(ASSETS.emptyNoObject, '还没有观察对象', '先添加一个观察对象，用代号区分就好，比如“对象A”。',
      `<button class="btn-secondary" data-action="add-subject">新增观察对象</button>`);

  const newHref = subjects.length === 1 ? `#/record?subject=${subjects[0].id}` : '#/record';

  return {
    html: `<div class="app-shell">
      <div class="page-scroll home-page">
        <header class="home-header">
          <h1 class="home-title">观察记录</h1>
          <div class="home-meta">
            <span>${fmtHomeDate()}</span>
            <span>${subjects.length} 个观察对象 · 共 ${records.length} 条记录</span>
          </div>
        </header>
        ${body}
      </div>
      ${fab(newHref)}
      ${tabbar('record')}
    </div>`,
    mount() {
      const page = app.querySelector('.home-page');

      page.querySelectorAll('.subject-note').forEach(input => {
        let timer = null;
        input.addEventListener('click', event => event.stopPropagation());
        input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
        input.addEventListener('input', () => {
          clearTimeout(timer);
          timer = setTimeout(async () => {
            const subject = await db.getSubject(input.dataset.id);
            if (subject) {
              subject.note = input.value.trim();
              await db.saveSubject(subject);
            }
          }, 500);
        });
      });

      page.querySelectorAll('.subject-card').forEach(card => {
        card.addEventListener('click', event => {
          if (event.target.closest('input')) return;
          go(`#/object/${card.dataset.id}`);
        });
      });

      const addButton = page.querySelector('[data-action="add-subject"]');
      if (addButton) addButton.addEventListener('click', () => openSubjectDialog({ onDone: render }));
    }
  };
}

// ---------------- 记录库 ----------------

async function loadPhotos(records) {
  const map = new Map();
  await Promise.all(records.map(async record => {
    if (!record.photoId) return;
    const photo = await db.getPhoto(record.photoId);
    if (photo) map.set(record.photoId, photo);
  }));
  return map;
}

function groupByDay(records) {
  const groups = [];
  let current = null;
  for (const record of records) {
    const key = dateKey(record.observedAt);
    if (!current || current.key !== key) {
      current = { key, label: fmtDayLabel(record.observedAt), records: [] };
      groups.push(current);
    }
    current.records.push(record);
  }
  return groups;
}

function recordCard(record, photo) {
  const thumb = photo ? objectURL(photo.thumb || photo.blob) : '';
  return `<a class="record-card" href="#/detail/${record.id}">
    <div class="record-thumb">${thumb ? `<img src="${thumb}" alt="">` : icon('image', 'thumb-placeholder')}</div>
    <div class="record-main">
      <div class="record-top">${dimTag(record.dimension)}<time>${fmtTime(record.observedAt)}</time></div>
      <p class="record-desc">${esc(record.description)}</p>
    </div>
  </a>`;
}

async function libraryPage({ id }) {
  const subject = await db.getSubject(id);
  if (!subject) {
    return {
      html: `<div class="app-shell"><div class="page-scroll"><div class="empty-state">
        <h2 class="empty-title">找不到这个观察对象</h2>
        <a class="btn-secondary" href="#/">返回首页</a>
      </div></div></div>`
    };
  }

  const records = await db.listRecords({ subjectId: id });
  const photos = await loadPhotos(records);
  const groups = groupByDay(records);

  const listHtml = records.length
    ? groups.map(group => `<div class="day-label">${group.label}</div>
        ${group.records.map(record => recordCard(record, photos.get(record.photoId))).join('')}`).join('')
    : emptyBlock(ASSETS.emptyRecords, '还没有记录', '拍下这个对象的一个瞬间，写一句话就好。',
        `<a class="btn-secondary" href="#/record?subject=${subject.id}">记录第一条</a>`);

  return {
    html: `<div class="app-shell">
      <div class="page-scroll">
        <header class="sub-header">
          <button class="icon-btn" data-back aria-label="返回">${icon('back', 'icon')}</button>
          <h1 class="sub-title">${esc(subject.code)}<span class="sub-count">${records.length} 条</span></h1>
          <span class="sub-header-spacer"></span>
        </header>
        <div class="record-list">${listHtml}</div>
      </div>
      ${fab(`#/record?subject=${subject.id}`)}
      ${tabbar('record')}
    </div>`,
    mount() {
      app.querySelector('[data-back]').addEventListener('click', () => go('#/'));
    }
  };
}

// ---------------- 搜索 ----------------

async function searchPage() {
  const [subjects, records] = await Promise.all([db.listSubjects(), db.listAllRecords()]);
  const photos = await loadPhotos(records);
  const state = { keyword: '', dimension: '', subjectId: '' };

  return {
    html: `<div class="app-shell">
      <div class="page-scroll">
        <header class="simple-header">
          <h1>查找</h1>
        </header>
        <div class="search-wrap">
          ${icon('search', 'search-icon')}
          <input id="search-input" type="search" placeholder="搜索描述文字" autocomplete="off">
        </div>
        <div class="chip-row" id="dim-filter">
          <button class="chip is-selected" data-dim="">全部</button>
          ${DIMENSIONS.map(d => `<button class="chip" data-dim="${d.key}">${d.name}</button>`).join('')}
        </div>
        <div class="filter-row">
          <select id="subject-filter" class="select">
            <option value="">全部对象</option>
            ${subjects.map(s => `<option value="${s.id}">${esc(s.code)}</option>`).join('')}
          </select>
          <span class="result-count" id="result-count"></span>
        </div>
        <div class="record-list" id="search-results"></div>
      </div>
      ${tabbar('search')}
    </div>`,
    mount() {
      const input = app.querySelector('#search-input');
      const results = app.querySelector('#search-results');
      const countEl = app.querySelector('#result-count');

      const paint = () => {
        const list = records.filter(record => {
          if (state.dimension && record.dimension !== state.dimension) return false;
          if (state.subjectId && record.subjectId !== state.subjectId) return false;
          if (state.keyword && !record.description.toLowerCase().includes(state.keyword.toLowerCase())) return false;
          return true;
        });
        countEl.textContent = `${list.length} 条`;

        if (!list.length) {
          results.innerHTML = `<div class="empty-state compact">
            <h2 class="empty-title">没有找到记录</h2>
            <p class="empty-text">换个关键词试试</p>
          </div>`;
          return;
        }

        let html = '';
        let lastKey = '';
        for (const record of list) {
          const key = dateKey(record.observedAt);
          if (key !== lastKey) {
            lastKey = key;
            html += `<div class="day-label">${fmtDayLabel(record.observedAt)}</div>`;
          }
          const photo = photos.get(record.photoId);
          const thumb = photo ? objectURL(photo.thumb || photo.blob) : '';
          html += `<a class="record-card" href="#/detail/${record.id}">
            <div class="record-thumb">${thumb ? `<img src="${thumb}" alt="">` : icon('image', 'thumb-placeholder')}</div>
            <div class="record-main">
              <div class="record-top">${dimTag(record.dimension)}
                <span class="record-subject">${esc(record.subjectCode || '')}</span>
                <time>${fmtTime(record.observedAt)}</time>
              </div>
              <p class="record-desc">${esc(record.description)}</p>
            </div>
          </a>`;
        }
        results.innerHTML = html;
      };

      input.addEventListener('input', () => { state.keyword = input.value.trim(); paint(); });

      app.querySelectorAll('#dim-filter .chip').forEach(chip => {
        chip.addEventListener('click', () => {
          app.querySelectorAll('#dim-filter .chip').forEach(c => c.classList.remove('is-selected'));
          chip.classList.add('is-selected');
          state.dimension = chip.dataset.dim;
          paint();
        });
      });

      app.querySelector('#subject-filter').addEventListener('change', event => {
        state.subjectId = event.target.value;
        paint();
      });

      paint();
    }
  };
}

// ---------------- 记录详情 ----------------

async function detailPage({ id }) {
  const record = await db.getRecord(id);
  if (!record) {
    return {
      html: `<div class="app-shell"><div class="page-scroll"><div class="empty-state">
        <h2 class="empty-title">找不到这条记录</h2>
        <a class="btn-secondary" href="#/">返回首页</a>
      </div></div></div>`
    };
  }
  const photo = record.photoId ? await db.getPhoto(record.photoId) : null;
  const imageUrl = photo ? objectURL(photo.blob) : '';

  return {
    html: `<div class="app-shell">
      <div class="page-scroll">
        <header class="sub-header">
          <button class="icon-btn" data-back aria-label="返回">${icon('back', 'icon')}</button>
          <h1 class="sub-title">记录详情</h1>
          <button class="icon-btn" data-edit aria-label="编辑">${icon('edit', 'icon')}</button>
        </header>
        <div class="detail-photo">${imageUrl ? `<img src="${imageUrl}" alt="">` : icon('image', 'detail-placeholder')}</div>
        <div class="detail-meta">
          ${dimTag(record.dimension)}
          <span class="detail-subject">${esc(record.subjectCode || '')}</span>
          <span class="detail-time">${fmtDateTime(record.observedAt)}</span>
        </div>
        <p class="detail-text">${esc(record.description)}</p>
        <button class="text-danger" data-delete>删除这条记录</button>
      </div>
    </div>`,
    mount() {
      app.querySelector('[data-back]').addEventListener('click', () => go(`#/object/${record.subjectId}`));
      app.querySelector('[data-edit]').addEventListener('click', () => go(`#/record?edit=${record.id}`));
      app.querySelector('[data-delete]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: '删除这条记录？',
          message: '照片和文字都会删除，无法恢复。',
          confirmText: '删除',
          danger: true
        });
        if (!ok) return;
        await db.deleteRecord(record.id);
        if (record.photoId) await db.deletePhoto(record.photoId);
        toast('已删除');
        go(`#/object/${record.subjectId}`);
      });
    }
  };
}

// ---------------- 记录页 ----------------

function photoAreaHTML(photo) {
  if (!photo) {
    return `<button type="button" class="photo-empty" data-pick>
      ${icon('camera', 'photo-icon')}
      <span>拍一张照片</span>
      <span class="photo-sub">点这里打开相机，也可以从相册选择</span>
    </button>`;
  }
  return `<img class="photo-img" src="${objectURL(photo.blob)}" alt="">
    <button type="button" class="photo-retake" data-pick>重拍</button>`;
}

async function recordPage(route) {
  const record = route.editId ? await db.getRecord(route.editId) : null;
  let subjects = await db.listSubjects();

  const state = {
    id: record ? record.id : db.uid(),
    photo: null,
    observedAt: record ? record.observedAt : new Date().toISOString(),
    dimension: record ? record.dimension : '',
    subjectId: record ? record.subjectId : (route.subjectId || (subjects.length === 1 ? subjects[0].id : '')),
    description: record ? record.description : '',
    saving: false
  };

  if (record && record.photoId) {
    const photo = await db.getPhoto(record.photoId);
    if (photo) state.photo = { ...photo, existing: true };
  }

  const subjectChips = () => subjects.map(subject => `
    <button type="button" class="chip ${subject.id === state.subjectId ? 'is-selected' : ''}" data-subject="${subject.id}">
      ${esc(subject.code)}
    </button>`).join('') + `<button type="button" class="chip chip-add" data-add-subject>＋ 新增</button>`;

  const dimHint = () => {
    const dim = DIM_MAP[state.dimension];
    return dim ? `<p class="field-hint" id="dim-hint">${dim.hint}</p>` : `<p class="field-hint" id="dim-hint">先选一个观察维度</p>`;
  };

  const dimGrid = () => DIMENSIONS.map(dim => `
    <button type="button" class="dim-option ${state.dimension === dim.key ? 'is-selected' : ''}"
      data-dim="${dim.key}" style="--c:${dim.color}">
      <span class="dim-dot"></span>${dim.name}
    </button>`).join('');

  const backTarget = record ? `#/object/${record.subjectId}` : (state.subjectId ? `#/object/${state.subjectId}` : '#/');

  return {
    html: `<div class="app-shell record-shell">
      <div class="page-scroll">
        <header class="form-header">
          <button class="text-btn" data-cancel>取消</button>
          <span class="form-title">${record ? '编辑记录' : '新记录'}</span>
          <span class="form-spacer"></span>
        </header>
        <div class="record-form">
          <div class="photo-area" id="photo-area">${photoAreaHTML(state.photo)}</div>
          <input id="photo-input" type="file" accept="image/*" capture="environment" hidden>

          <div class="field">
            <div class="field-label">观察时间</div>
            <label class="time-row">
              ${icon('clock', 'time-icon')}
              <input id="time-input" type="datetime-local" value="${toLocalInput(state.observedAt)}">
            </label>
          </div>

          <div class="field">
            <div class="field-label">观察维度</div>
            <div class="dim-grid" id="dim-grid">${dimGrid()}</div>
            ${dimHint()}
          </div>

          <div class="field">
            <div class="field-label">对象代号</div>
            <div class="chip-row" id="subject-chips">${subjectChips()}</div>
          </div>

          <div class="field">
            <div class="field-label">简单描述</div>
            <textarea id="description" rows="5" maxlength="1000"
              placeholder="说说看到了什么……">${esc(state.description)}</textarea>
            <p class="field-hint">客观描述看到、听到的就好；点键盘上的麦克风可以直接说话</p>
          </div>
        </div>
      </div>
      <div class="save-bar">
        <button class="btn-primary" id="save-button">保存记录</button>
      </div>
    </div>`,
    mount() {
      const photoArea = app.querySelector('#photo-area');
      const photoInput = app.querySelector('#photo-input');
      const saveButton = app.querySelector('#save-button');
      const description = app.querySelector('#description');
      const timeInput = app.querySelector('#time-input');

      const bindPhotoArea = () => {
        const pick = photoArea.querySelector('[data-pick]');
        if (pick) pick.addEventListener('click', () => photoInput.click());
      };

      const paintPhotoArea = () => {
        photoArea.innerHTML = photoAreaHTML(state.photo);
        bindPhotoArea();
      };

      photoInput.addEventListener('change', async () => {
        const file = photoInput.files && photoInput.files[0];
        photoInput.value = '';
        if (!file) return;
        photoArea.innerHTML = `<div class="photo-busy"><span class="spinner"></span>正在处理照片…</div>`;
        try {
          const processed = await compressPhoto(file);
          state.photo = { ...processed, existing: false };
          paintPhotoArea();
        } catch (error) {
          console.error(error);
          toast('照片处理失败，换一张试试');
          paintPhotoArea();
        }
      });

      bindPhotoArea();

      timeInput.addEventListener('change', () => {
        state.observedAt = fromLocalInput(timeInput.value);
      });

      app.querySelector('#dim-grid').addEventListener('click', event => {
        const button = event.target.closest('[data-dim]');
        if (!button) return;
        state.dimension = button.dataset.dim;
        app.querySelectorAll('#dim-grid .dim-option').forEach(item => item.classList.toggle('is-selected', item === button));
        app.querySelector('#dim-hint').replaceWith(
          Object.assign(document.createElement('p'), { className: 'field-hint', id: 'dim-hint' })
        );
        const hint = app.querySelector('#dim-hint');
        hint.textContent = DIM_MAP[state.dimension].hint;
      });

      app.querySelector('#subject-chips').addEventListener('click', event => {
        const add = event.target.closest('[data-add-subject]');
        if (add) {
          openSubjectDialog({
            onDone: async selectedId => {
              subjects = await db.listSubjects();
              if (selectedId) state.subjectId = selectedId;
              app.querySelector('#subject-chips').innerHTML = subjectChips();
            }
          });
          return;
        }
        const chip = event.target.closest('[data-subject]');
        if (!chip) return;
        state.subjectId = chip.dataset.subject;
        app.querySelectorAll('#subject-chips .chip').forEach(item => item.classList.toggle('is-selected', item === chip));
      });

      description.addEventListener('input', () => { state.description = description.value; });

      const doSave = async () => {
        if (state.saving) return;
        const subject = subjects.find(item => item.id === state.subjectId);
        if (!state.photo) { toast('先拍一张照片'); return; }
        if (!state.dimension) { toast('选一个观察维度'); return; }
        if (!subject) { toast('选一个对象代号'); return; }
        state.description = description.value;
        if (!state.description.trim()) { toast('写一句描述'); return; }

        state.saving = true;
        saveButton.disabled = true;
        saveButton.textContent = '保存中…';

        try {
          let photoId = state.photo.id || '';
          if (!photoId) {
            photoId = db.uid();
            await db.savePhoto({
              id: photoId,
              blob: state.photo.blob,
              thumb: state.photo.thumb,
              width: state.photo.width,
              height: state.photo.height,
              bytes: state.photo.bytes
            });
          }
          const now = new Date().toISOString();
          await db.saveRecord({
            id: record ? record.id : db.uid(),
            subjectId: subject.id,
            subjectCode: subject.code,
            observedAt: state.observedAt,
            dimension: state.dimension,
            description: state.description.trim(),
            photoId,
            photoBytes: state.photo.bytes || 0,
            createdAt: record ? record.createdAt : now,
            updatedAt: now
          });
          if (record && record.photoId && record.photoId !== photoId) {
            await db.deletePhoto(record.photoId);
          }
          toast('已保存');
          go(`#/object/${subject.id}`);
        } catch (error) {
          console.error(error);
          toast('保存失败，请重试');
          state.saving = false;
          saveButton.disabled = false;
          saveButton.textContent = '保存记录';
        }
      };

      saveButton.addEventListener('click', doSave);
      app.querySelector('[data-cancel]').addEventListener('click', () => go(backTarget));
    }
  };
}

// ---------------- 导出 ----------------

function rangeText(from, to) {
  const f = new Date(from);
  const t = new Date(to);
  const y = f.getFullYear() === t.getFullYear();
  const left = `${f.getFullYear()}年${f.getMonth() + 1}月${f.getDate()}日`;
  const right = y ? `${t.getMonth() + 1}月${t.getDate()}日` : `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日`;
  return `${left} — ${right}`;
}

async function shareFile(blob, filename) {
  const file = new File([blob], filename, { type: DOCX_MIME });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportPage() {
  const [subjects, records] = await Promise.all([db.listSubjects(), db.listAllRecords()]);
  const state = {
    range: 'all',
    from: dateKey(startOfMonth()),
    to: dateKey(endOfToday()),
    subjectId: '',
    dimensions: new Set(DIMENSIONS.map(d => d.key))
  };

  const recalc = () => {
    const list = filterRecords(records, state);
    const bytes = list.reduce((sum, record) => sum + (record.photoBytes || 350 * 1024), 0) + list.length * 24 * 1024;
    return { list, size: bytes / 1024 / 1024 };
  };

  return {
    html: `<div class="app-shell">
      <div class="page-scroll">
        <header class="simple-header">
          <h1>导出</h1>
          <p>生成 Word 文档：照片 + 文字，按观察维度分章</p>
        </header>

        <section class="card-section">
          <h2>时间范围</h2>
          <div class="seg" id="range-seg">
            <button type="button" data-range="all" class="is-selected">全部</button>
            <button type="button" data-range="month">本月</button>
            <button type="button" data-range="custom">自定义</button>
          </div>
          <div class="custom-range" id="custom-range" hidden>
            <input type="date" id="range-from" value="${state.from}">
            <span>至</span>
            <input type="date" id="range-to" value="${state.to}">
          </div>
        </section>

        <section class="card-section">
          <h2>对象代号</h2>
          <div class="chip-row" id="export-subjects">
            <button type="button" class="chip is-selected" data-subject="">全部</button>
            ${subjects.map(s => `<button type="button" class="chip" data-subject="${s.id}">${esc(s.code)}</button>`).join('')}
          </div>
        </section>

        <section class="card-section">
          <h2>观察维度</h2>
          <div class="check-list" id="export-dims">
            ${DIMENSIONS.map(dim => `<button type="button" class="check-row is-checked" data-dim="${dim.key}">
              <span class="check-box">${icon('check', 'check-icon')}</span>${dim.name}
            </button>`).join('')}
          </div>
        </section>

        <p class="export-summary" id="export-summary"></p>
        <button class="btn-primary generate-button" id="generate-button">生成 Word 文档</button>
        <p class="hint center">生成后可直接发送到微信，或存到“文件”App</p>
      </div>
      ${tabbar('export')}
    </div>`,
    mount() {
      const summary = app.querySelector('#export-summary');
      const generateButton = app.querySelector('#generate-button');
      const customRange = app.querySelector('#custom-range');
      const fromInput = app.querySelector('#range-from');
      const toInput = app.querySelector('#range-to');

      const updateSummary = () => {
        const { list, size } = recalc();
        const dimCount = new Set(list.map(item => item.dimension)).size;
        summary.innerHTML = list.length
          ? `将导出 <b>${list.length}</b> 条记录 · ${dimCount} 个维度 · 约 ${size.toFixed(1)} MB`
          : '当前范围内没有记录';
        generateButton.disabled = list.length === 0;
      };

      app.querySelector('#range-seg').addEventListener('click', event => {
        const button = event.target.closest('[data-range]');
        if (!button) return;
        app.querySelectorAll('#range-seg button').forEach(item => item.classList.toggle('is-selected', item === button));
        state.range = button.dataset.range;
        customRange.hidden = state.range !== 'custom';
        updateSummary();
      });

      fromInput.addEventListener('change', () => { state.from = fromInput.value; updateSummary(); });
      toInput.addEventListener('change', () => { state.to = toInput.value; updateSummary(); });

      app.querySelector('#export-subjects').addEventListener('click', event => {
        const chip = event.target.closest('[data-subject]');
        if (!chip) return;
        app.querySelectorAll('#export-subjects .chip').forEach(item => item.classList.toggle('is-selected', item === chip));
        state.subjectId = chip.dataset.subject;
        updateSummary();
      });

      app.querySelector('#export-dims').addEventListener('click', event => {
        const row = event.target.closest('[data-dim]');
        if (!row) return;
        const key = row.dataset.dim;
        if (state.dimensions.has(key)) state.dimensions.delete(key);
        else state.dimensions.add(key);
        row.classList.toggle('is-checked', state.dimensions.has(key));
        updateSummary();
      });

      generateButton.addEventListener('click', () => generateWord(state, records, generateButton));
      updateSummary();
    }
  };
}

function filterRecords(records, state) {
  let list = records.filter(record => state.dimensions.has(record.dimension));
  if (state.subjectId) list = list.filter(record => record.subjectId === state.subjectId);
  if (state.range === 'month') {
    const from = startOfMonth();
    list = list.filter(record => new Date(record.observedAt) >= from);
  } else if (state.range === 'custom') {
    if (state.from) {
      const from = new Date(`${state.from}T00:00:00`);
      list = list.filter(record => new Date(record.observedAt) >= from);
    }
    if (state.to) {
      const to = new Date(`${state.to}T23:59:59.999`);
      list = list.filter(record => new Date(record.observedAt) <= to);
    }
  }
  return list;
}

async function generateWord(state, allRecords, button) {
  const list = filterRecords(allRecords, state);
  if (!list.length) { toast('当前范围内没有记录'); return; }

  const allSubjects = await db.listSubjects();
  const selectedSubject = state.subjectId ? allSubjects.find(item => item.id === state.subjectId) : null;
  const ordered = [...list].sort((a, b) => {
    const ai = DIMENSIONS.findIndex(dim => dim.key === a.dimension);
    const bi = DIMENSIONS.findIndex(dim => dim.key === b.dimension);
    if (ai !== bi) return ai - bi;
    return String(a.observedAt).localeCompare(String(b.observedAt));
  });

  const times = ordered.map(record => record.observedAt).sort();
  const minDate = new Date(times[0]);
  const maxDate = new Date(times[times.length - 1]);
  const filename = `观察记录${selectedSubject ? `_${fileSafe(selectedSubject.code)}` : ''}_${dateKey(minDate)}至${dateKey(maxDate)}.docx`;

  button.disabled = true;
  const progress = progressDialog('正在生成 Word 文档', `准备中…`);
  progress.update('正在整理记录…', 2);

  try {
    const chapters = [];
    let index = 0;

    for (const dim of DIMENSIONS) {
      const dimensionRecords = ordered.filter(record => record.dimension === dim.key);
      if (!dimensionRecords.length) continue;
      const chapter = { title: getChapterTitle(dim.key), records: [] };

      for (const record of dimensionRecords) {
        index += 1;
        progress.update(`正在处理第 ${index} / ${ordered.length} 条记录…`, Math.round(index / ordered.length * 90));

        let image = null;
        if (record.photoId) {
          const photo = await db.getPhoto(record.photoId);
          if (photo) {
            const shrunk = await shrinkBlob(photo.blob);
            image = {
              bytes: new Uint8Array(await shrunk.arrayBuffer()),
              width: photo.width || 1200,
              height: photo.height || 900
            };
          }
        }

        chapter.records.push({
          meta: `${fmtDateTime(record.observedAt)} ｜ ${record.subjectCode || ''}`,
          description: record.description,
          image
        });
      }
      chapters.push(chapter);
    }

    progress.update('正在写入文件…', 94);
    const recorder = await db.getMeta('recorder', '');
    const blob = buildDocx({
      rangeText: rangeText(minDate, maxDate),
      recorder,
      total: ordered.length,
      chapters
    });

    progress.update('正在打开分享…', 100);
    await shareFile(blob, filename);
    progress.close();
    toast('Word 文档已生成');
  } catch (error) {
    console.error(error);
    progress.close();
    toast('生成失败，请减少范围后重试');
  } finally {
    button.disabled = false;
  }
}

function getChapterTitle(key) {
  const order = ['一', '二', '三', '四'];
  const dim = DIM_MAP[key];
  return `${order[DIMENSIONS.findIndex(item => item.key === key)]}、${dim.name}`;
}

function fileSafe(text) {
  return String(text).replace(/[\\/:*?"<>|]/g, '').trim();
}

// ---------------- 设置 ----------------

async function settingsPage() {
  const [subjects, records, storage] = await Promise.all([
    db.listSubjects(),
    db.listAllRecords(),
    db.storageEstimate()
  ]);
  const recorder = await db.getMeta('recorder', '');
  const counts = new Map();
  records.forEach(record => counts.set(record.subjectId, (counts.get(record.subjectId) || 0) + 1));

  return {
    html: `<div class="app-shell">
      <div class="page-scroll">
        <header class="simple-header">
          <h1>设置</h1>
        </header>

        <div class="section-label">观察对象</div>
        <div class="list-group" id="subject-settings">
          ${subjects.map(subject => `
            <button type="button" class="setting-row" data-subject="${subject.id}">
              <span class="row-avatar">
                <span class="avatar-letter">${esc((subject.code || '?').slice(0, 1))}</span>
                <img src="${subject.avatar === 'girl' ? ASSETS.avatarGirl : ASSETS.avatarBoy}" alt="" onerror="this.remove()">
              </span>
              <span class="row-main">
                <span class="row-title">${esc(subject.code)}</span>
                <span class="row-sub">${counts.get(subject.id) || 0} 条记录${subject.note ? ` · ${esc(subject.note)}` : ''}</span>
              </span>
              ${icon('chevron', 'row-chevron')}
            </button>`).join('')}
          <button type="button" class="setting-row setting-row-add" data-action="add-subject">
            <span class="row-add-icon">${icon('plus', 'icon')}</span>
            <span class="row-main"><span class="row-title accent">新增对象代号</span></span>
          </button>
        </div>
        <p class="hint">代号只用来区分观察对象，导出的 Word 里也只有代号。</p>

        <div class="section-label">数据</div>
        <div class="list-group">
          <div class="setting-row static">
            <span class="row-main"><span class="row-title">存储占用</span></span>
            <span class="row-value">${formatBytes(storage.usage)}</span>
          </div>
          <div class="setting-row static">
            <span class="row-main"><span class="row-title">记录总数</span></span>
            <span class="row-value">${records.length} 条</span>
          </div>
        </div>

        <div class="section-label">记录人</div>
        <div class="list-group">
          <button type="button" class="setting-row" data-action="recorder">
            <span class="row-main"><span class="row-title">记录人（可选）</span><span class="row-sub">显示在导出的 Word 副标题</span></span>
            <span class="row-value">${esc(recorder || '未填写')}</span>
          </button>
        </div>

        <div class="section-label">关于</div>
        <div class="list-group">
          <div class="setting-row static">
            <span class="row-main"><span class="row-title">版本</span><span class="row-sub">数据只存在这台手机上</span></span>
            <span class="row-value">1.0</span>
          </div>
        </div>
        <p class="hint">在 iPhone 上用 Safari 打开，点“分享 → 添加到主屏幕”，之后就能离线使用。建议定期把导出的 Word 存到电脑或网盘。</p>
      </div>
      ${tabbar('settings')}
    </div>`,
    mount() {
      app.querySelector('[data-action="add-subject"]').addEventListener('click', () => {
        openSubjectDialog({ onDone: render });
      });

      app.querySelector('#subject-settings').addEventListener('click', event => {
        const row = event.target.closest('[data-subject]');
        if (!row) return;
        const subject = subjects.find(item => item.id === row.dataset.subject);
        if (subject) openSubjectDialog({ subject, onDone: render });
      });

      app.querySelector('[data-action="recorder"]').addEventListener('click', async () => {
        const close = openModal(`
          <h3 class="modal-title">记录人</h3>
          <label class="modal-label" for="recorder-input">姓名（显示在 Word 副标题，可留空）</label>
          <input id="recorder-input" class="modal-input" type="text" maxlength="20"
            value="${esc(recorder)}" placeholder="例如：王老师">
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-cancel>取消</button>
            <button type="button" class="btn btn-primary" data-save>保存</button>
          </div>`, {
          static: true,
          onMount(modal) {
            const input = modal.querySelector('#recorder-input');
            input.focus();
            input.select();
            const submit = async () => {
              await db.setMeta('recorder', input.value.trim());
              closeModal();
              render();
            };
            modal.querySelector('[data-save]').addEventListener('click', submit);
            modal.querySelector('[data-cancel]').addEventListener('click', closeModal);
            input.addEventListener('keydown', event => { if (event.key === 'Enter') submit(); });
          }
        });
      });
    }
  };
}

// ---------------- 对象代号弹窗 ----------------

function openSubjectDialog({ subject = null, onDone } = {}) {
  const isEdit = Boolean(subject);
  const initial = {
    id: subject ? subject.id : db.uid(),
    code: subject ? subject.code : '',
    avatar: subject ? (subject.avatar || 'boy') : 'boy',
    note: subject ? (subject.note || '') : ''
  };

  let avatar = initial.avatar;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    closeModal();
  };

  const { modal } = openModal(`
    <h3 class="modal-title">${isEdit ? '编辑观察对象' : '新增观察对象'}</h3>
    <label class="modal-label" for="subject-code">对象代号</label>
    <input id="subject-code" class="modal-input" type="text" maxlength="12"
      value="${esc(initial.code)}" placeholder="例如：对象A" autocomplete="off">
    <label class="modal-label">头像</label>
    <div class="avatar-choices" id="avatar-choices">
      ${[['boy', '男孩', ASSETS.avatarBoy], ['girl', '女孩', ASSETS.avatarGirl]].map(([key, label, src]) => `
        <button type="button" class="avatar-choice ${avatar === key ? 'is-selected' : ''}" data-avatar="${key}">
          <img src="${src}" alt="" onerror="this.remove()">
          <span class="avatar-choice-label">${label}</span>
        </button>`).join('')}
    </div>
    <label class="modal-label" for="subject-note">备注（可选）</label>
    <input id="subject-note" class="modal-input" type="text" maxlength="40"
      value="${esc(initial.note)}" placeholder="例如：中班男孩 · 同伴交往">
    <div class="modal-actions">
      ${isEdit
        ? `<button type="button" class="btn btn-ghost danger-text" data-delete>删除</button>`
        : ''}
      <button type="button" class="btn btn-ghost" data-cancel>取消</button>
      <button type="button" class="btn btn-primary" data-save>保存</button>
    </div>`, {
    static: true,
    onMount(modalEl) {
      const codeInput = modalEl.querySelector('#subject-code');
      const noteInput = modalEl.querySelector('#subject-note');
      codeInput.focus();
      codeInput.select();

      modalEl.querySelectorAll('[data-avatar]').forEach(button => {
        button.addEventListener('click', () => {
          avatar = button.dataset.avatar;
          modalEl.querySelectorAll('[data-avatar]').forEach(item => item.classList.toggle('is-selected', item === button));
        });
      });

      modalEl.querySelector('[data-cancel]').addEventListener('click', finish);

      modalEl.querySelector('[data-save]').addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (!code) { toast('给对象起个代号'); return; }
        if (code.length > 12) { toast('代号短一点，12 个字以内'); return; }

        const exists = await db.listSubjects();
        const duplicate = exists.find(item => item.code === code && item.id !== initial.id);
        if (duplicate) { toast('这个代号已经用过了'); return; }

        const nextSort = exists.length ? Math.max(...exists.map(item => item.sort || 0)) + 1 : 0;
        const record = {
          id: initial.id,
          code,
          avatar,
          note: noteInput.value.trim(),
          sort: subject ? (subject.sort ?? 0) : nextSort,
          createdAt: subject ? subject.createdAt : new Date().toISOString()
        };
        await db.saveSubject(record);

        if (isEdit && subject.code !== code) {
          const related = await db.listRecords({ subjectId: record.id });
          await Promise.all(related.map(item => {
            item.subjectCode = code;
            return db.saveRecord(item);
          }));
        }

        finish();
        toast('已保存');
        if (onDone) onDone(record.id);
      });

      const deleteButton = modalEl.querySelector('[data-delete]');
      if (deleteButton) {
        deleteButton.addEventListener('click', async () => {
          const related = await db.listRecords({ subjectId: initial.id });
          if (related.length) {
            toast(`还有 ${related.length} 条记录，先处理记录再删除`);
            return;
          }
          const ok = await confirmDialog({
            title: '删除这个对象？',
            message: '删除后不能恢复。',
            confirmText: '删除',
            danger: true
          });
          if (!ok) { openSubjectDialog({ subject, onDone }); return; }
          await db.deleteSubject(initial.id);
          finish();
          toast('已删除');
          if (onDone) onDone('');
        });
      }
    }
  });
}

// ---------------- 页面表 ----------------

const PAGES = {
  home: homePage,
  library: libraryPage,
  search: searchPage,
  detail: detailPage,
  record: recordPage,
  export: exportPage,
  settings: settingsPage
};

// ---------------- 启动 ----------------

window.addEventListener('hashchange', render);

(async function boot() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(error => console.warn('SW 注册失败', error));
  }
  if (new URLSearchParams(location.search).has('demo')) {
    const { seedDemo } = await import('./demo.js');
    try { await seedDemo(); } catch (error) { console.error(error); }
  }
  await render();
})();



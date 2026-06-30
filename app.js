/* =========================================================
   暑假修行册 · 哪吒与敖丙
   纯原生 JS，单一全局状态 + localStorage 持久化
   ========================================================= */

(function () {
  'use strict';

  const STORAGE_KEY = 'kidsSchedule';
  const VERSION = 1;

  // -------- 工具函数 --------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uid(prefix = 'id') {
    return prefix + '_' + Math.random().toString(36).slice(2, 9);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function fromISO(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayISO() { return toISO(new Date()); }

  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function daysBetween(a, b) {
    return Math.round((fromISO(b) - fromISO(a)) / 86400000);
  }

  function formatChinese(iso) {
    const d = fromISO(iso);
    const dow = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${dow}`;
  }

  // -------- 默认数据 --------
  function defaultState() {
    return {
      version: VERSION,
      settings: {
        startDate: todayISO(),
        endDate: '',
        childName: '小修行者'
      },
      template: [
        { id: uid('t'), time: '07:00', title: '起床洗漱', weight: 1, icon: '☀️' },
        { id: uid('t'), time: '07:30', title: '早餐', weight: 1, icon: '🍳' },
        { id: uid('t'), time: '08:00', title: '晨读英语 30 分钟', weight: 3, icon: '📖' },
        { id: uid('t'), time: '09:00', title: '暑假作业 60 分钟', weight: 3, icon: '📝' },
        { id: uid('t'), time: '10:30', title: '户外运动 30 分钟', weight: 2, icon: '🏃' },
        { id: uid('t'), time: '12:00', title: '午餐', weight: 1, icon: '🍚' },
        { id: uid('t'), time: '13:00', title: '午休', weight: 2, icon: '💤' },
        { id: uid('t'), time: '14:30', title: '阅读 30 分钟', weight: 3, icon: '📚' },
        { id: uid('t'), time: '16:00', title: '兴趣特长练习', weight: 2, icon: '🎨' },
        { id: uid('t'), time: '17:30', title: '家务 / 自由活动', weight: 1, icon: '🧹' },
        { id: uid('t'), time: '19:00', title: '晚餐', weight: 1, icon: '🍲' },
        { id: uid('t'), time: '20:00', title: '复盘日记', weight: 2, icon: '✍️' },
        { id: uid('t'), time: '21:00', title: '洗漱睡觉', weight: 1, icon: '🌙' }
      ],
      records: {},
      rewards: {
        catalog: [
          { id: uid('r'), name: '一根冰淇淋', cost: 8, icon: '🍦' },
          { id: uid('r'), name: '一本新书', cost: 20, icon: '📕' },
          { id: uid('r'), name: '看一场电影', cost: 30, icon: '🎬' },
          { id: uid('r'), name: '游乐园一日游', cost: 60, icon: '🎢' }
        ],
        redeemed: []
      }
    };
  }

  // -------- 状态管理 --------
  let state = loadState();
  let currentDate = todayISO();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      return migrate(data);
    } catch (e) {
      console.warn('读取失败，使用默认数据', e);
      return defaultState();
    }
  }

  function migrate(data) {
    if (!data || typeof data !== 'object') return defaultState();
    const base = defaultState();
    return {
      version: VERSION,
      settings: Object.assign({}, base.settings, data.settings || {}),
      template: Array.isArray(data.template) && data.template.length ? data.template : base.template,
      records: data.records && typeof data.records === 'object' ? data.records : {},
      rewards: {
        catalog: Array.isArray(data.rewards?.catalog) && data.rewards.catalog.length ? data.rewards.catalog : base.rewards.catalog,
        redeemed: Array.isArray(data.rewards?.redeemed) ? data.rewards.redeemed : []
      }
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('保存失败：浏览器存储已满');
    }
  }

  // -------- 星级计算 --------
  function computeStars(record) {
    if (!record || !record.tasks) return 0;
    const totalWeight = state.template.reduce((s, t) => s + (t.weight || 1), 0);
    if (totalWeight === 0) return 0;
    const completedWeight = state.template.reduce((s, t) => {
      const entry = record.tasks[t.id];
      return s + (entry && entry.done ? (t.weight || 1) : 0);
    }, 0);
    const rate = completedWeight / totalWeight;
    if (rate >= 0.9) return 5;
    if (rate >= 0.75) return 4;
    if (rate >= 0.55) return 3;
    if (rate >= 0.30) return 2;
    if (rate > 0) return 1;
    return 0;
  }

  function getRecord(iso) {
    return state.records[iso];
  }

  function ensureRecord(iso) {
    if (!state.records[iso]) {
      state.records[iso] = { tasks: {}, note: '', stars: 0 };
    }
    return state.records[iso];
  }

  function updateStars(iso) {
    const rec = state.records[iso];
    if (!rec) return;
    rec.stars = computeStars(rec);
  }

  // -------- Tab 切换 --------
  function initTabs() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        $$('.tab-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        $$('.tab-panel').forEach((p) => {
          p.classList.toggle('active', p.id === 'panel-' + tab);
        });
        if (tab === 'today') renderToday();
        if (tab === 'dates') renderCalendar();
        if (tab === 'template') renderTemplate();
        if (tab === 'rewards') renderRewards();
      });
    });
  }

  // -------- 今日 --------
  function renderToday() {
    const dateInput = $('#currentDate');
    dateInput.value = currentDate;

    $('#welcomeText').textContent = `${state.settings.childName || '小修行者'}，今日修行 · ${formatChinese(currentDate)}`;

    const record = ensureRecord(currentDate);
    const tpl = [...state.template].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    const list = $('#taskList');
    list.innerHTML = '';
    if (tpl.length === 0) {
      list.innerHTML = '<div class="empty-hint">还没有作息项，请到「模板」页添加。</div>';
    }

    tpl.forEach((t) => {
      const entry = record.tasks[t.id] || { done: false, note: '' };
      const card = document.createElement('div');
      card.className = 'task-card' + (entry.done ? ' done' : '');
      card.innerHTML = `
        <div class="task-time">${escapeHtml(t.time || '')}</div>
        <div class="task-title"><span class="task-icon">${escapeHtml(t.icon || '✨')}</span>${escapeHtml(t.title || '')}</div>
        <div class="task-meta"><span class="weight-badge">权重 ${t.weight || 1}</span></div>
        <button class="check-btn${entry.done ? ' done' : ''}" aria-label="打卡">${entry.done ? '✓' : '○'}</button>
        <textarea class="task-note" rows="1" placeholder="完成情况备注（例如：读了《西游记》第三回）">${escapeHtml(entry.note || '')}</textarea>
      `;

      const checkBtn = card.querySelector('.check-btn');
      const noteEl = card.querySelector('.task-note');

      checkBtn.addEventListener('click', () => {
        const rec = ensureRecord(currentDate);
        const cur = rec.tasks[t.id] || { done: false, note: noteEl.value || '' };
        cur.done = !cur.done;
        cur.note = noteEl.value;
        rec.tasks[t.id] = cur;
        updateStars(currentDate);
        saveState();
        // 视觉反馈
        if (cur.done) emitFlames(checkBtn);
        // 局部更新
        card.classList.toggle('done', cur.done);
        checkBtn.classList.toggle('done', cur.done);
        checkBtn.textContent = cur.done ? '✓' : '○';
        renderStarsPreview();
        // 满星雪花
        if (rec.stars === 5) emitSnowflakes();
      });

      noteEl.addEventListener('input', () => {
        const rec = ensureRecord(currentDate);
        const cur = rec.tasks[t.id] || { done: false, note: '' };
        cur.note = noteEl.value;
        rec.tasks[t.id] = cur;
        saveState();
      });

      list.appendChild(card);
    });

    $('#dayNote').value = record.note || '';

    renderStarsPreview();
  }

  function renderStarsPreview() {
    const rec = ensureRecord(currentDate);
    rec.stars = computeStars(rec);
    const stars = rec.stars;
    const total = state.template.length;
    const done = Object.values(rec.tasks).filter((e) => e && e.done).length;

    const preview = $('#starsPreview');
    const filled = '⭐'.repeat(stars);
    const empty = '☆'.repeat(Math.max(0, 5 - stars));
    preview.textContent = filled + empty;

    const text = $('#completionText');
    if (total === 0) text.textContent = '请先添加作息项';
    else if (stars === 5) text.textContent = `已完成 ${done}/${total} 项 · 今日修行圆满 🔥`;
    else if (stars === 0) text.textContent = `已完成 ${done}/${total} 项 · 加油，开始第一项吧！`;
    else text.textContent = `已完成 ${done}/${total} 项 · 当日 ${stars} 星`;
  }

  function initToday() {
    $('#currentDate').addEventListener('change', (e) => {
      currentDate = e.target.value || todayISO();
      renderToday();
    });
    $('#prevDayBtn').addEventListener('click', () => {
      currentDate = addDays(currentDate, -1);
      renderToday();
    });
    $('#nextDayBtn').addEventListener('click', () => {
      currentDate = addDays(currentDate, 1);
      renderToday();
    });
    $('#todayBtn').addEventListener('click', () => {
      currentDate = todayISO();
      renderToday();
    });
    $('#dayNote').addEventListener('input', (e) => {
      const rec = ensureRecord(currentDate);
      rec.note = e.target.value;
      saveState();
    });
  }

  // -------- 日历 --------
  function renderCalendar() {
    const cal = $('#calendar');
    cal.innerHTML = '';

    const startISO = state.settings.startDate || todayISO();
    const endISO = state.settings.endDate || todayISO();
    if (daysBetween(startISO, endISO) < 0) {
      cal.innerHTML = '<div class="empty-hint">结束日期早于开始日期，请到「模板」页调整。</div>';
      return;
    }

    // 周标题
    const dows = ['一', '二', '三', '四', '五', '六', '日'];
    dows.forEach((d) => {
      const cell = document.createElement('div');
      cell.className = 'cal-dow';
      cell.textContent = d;
      cal.appendChild(cell);
    });

    // 起始日所在周的周一开始
    const start = fromISO(startISO);
    const startDow = (start.getDay() + 6) % 7; // 周一 = 0
    for (let i = 0; i < startDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-cell empty';
      cal.appendChild(empty);
    }

    const totalDays = daysBetween(startISO, endISO) + 1;
    for (let i = 0; i < totalDays; i++) {
      const iso = addDays(startISO, i);
      const rec = getRecord(iso);
      const stars = rec ? rec.stars : 0;
      const cell = document.createElement('div');
      cell.className = 'cal-cell s' + stars;
      if (iso === todayISO()) cell.classList.add('today');
      if (iso === currentDate) cell.classList.add('current');
      cell.innerHTML = `
        <div class="cal-day">${fromISO(iso).getDate()}</div>
        <div class="cal-stars">${stars > 0 ? '⭐'.repeat(stars) : '·'}</div>
      `;
      cell.title = `${iso} ${stars} 星`;
      cell.addEventListener('click', () => {
        currentDate = iso;
        switchTab('today');
      });
      cal.appendChild(cell);
    }
  }

  function switchTab(name) {
    const btn = $(`.tab-btn[data-tab="${name}"]`);
    if (btn) btn.click();
  }

  // -------- 模板 / 设置 --------
  function renderTemplate() {
    $('#childName').value = state.settings.childName || '';
    $('#startDate').value = state.settings.startDate || '';
    $('#endDate').value = state.settings.endDate || '';

    const list = $('#templateList');
    list.innerHTML = '';

    if (state.template.length === 0) {
      list.innerHTML = '<div class="empty-hint">还没有作息项，点击下方按钮添加。</div>';
    }

    state.template.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'template-row';
      row.innerHTML = `
        <input type="time" value="${escapeHtml(t.time || '')}" data-field="time" />
        <input type="text" class="icon-input" value="${escapeHtml(t.icon || '')}" data-field="icon" maxlength="2" />
        <input type="text" value="${escapeHtml(t.title || '')}" data-field="title" placeholder="任务名称" />
        <select data-field="weight">
          ${[1, 2, 3, 4, 5].map((w) => `<option value="${w}" ${w === Number(t.weight) ? 'selected' : ''}>权重 ${w}</option>`).join('')}
        </select>
        <button class="del-btn" title="删除">×</button>
      `;
      row.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('change', () => {
          const f = el.dataset.field;
          if (f === 'weight') t.weight = Number(el.value);
          else t[f] = el.value;
          state.template[idx] = t;
          // 权重变化要重算所有星
          Object.keys(state.records).forEach(updateStars);
          saveState();
        });
        el.addEventListener('input', () => {
          if (el.dataset.field !== 'weight') {
            const f = el.dataset.field;
            t[f] = el.value;
            state.template[idx] = t;
            saveState();
          }
        });
      });
      row.querySelector('.del-btn').addEventListener('click', () => {
        if (!confirm(`确定删除「${t.title}」？已有记录不会被删，但此项今后不再显示。`)) return;
        state.template.splice(idx, 1);
        Object.keys(state.records).forEach(updateStars);
        saveState();
        renderTemplate();
      });
      list.appendChild(row);
    });
  }

  function initTemplate() {
    $('#childName').addEventListener('input', (e) => {
      state.settings.childName = e.target.value.slice(0, 12);
      saveState();
    });
    $('#startDate').addEventListener('change', (e) => {
      const v = e.target.value;
      if (!v) { toast('开始日期不能为空'); e.target.value = state.settings.startDate; return; }
      state.settings.startDate = v;
      saveState();
    });
    $('#endDate').addEventListener('change', (e) => {
      state.settings.endDate = e.target.value || '';
      saveState();
    });
    $('#addTaskBtn').addEventListener('click', () => {
      state.template.push({ id: uid('t'), time: '12:00', title: '新作息', weight: 1, icon: '✨' });
      // 按时间排序展示
      state.template.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      saveState();
      renderTemplate();
    });
  }

  // -------- 奖励 --------
  function totalStars() {
    return Object.values(state.records).reduce((s, r) => s + (r.stars || 0), 0);
  }

  function spentStars() {
    return state.rewards.redeemed.reduce((s, r) => s + (r.cost || 0), 0);
  }

  function availableStars() {
    return totalStars() - spentStars();
  }

  function renderRewards() {
    $('#totalStars').innerHTML = `${totalStars()} <span class="star-emoji">⭐</span>`;
    $('#availableStars').innerHTML = `${availableStars()} <span class="star-emoji">⭐</span>`;

    const list = $('#rewardList');
    list.innerHTML = '';
    if (state.rewards.catalog.length === 0) {
      list.innerHTML = '<div class="empty-hint">还没有奖励，点击下方按钮添加。</div>';
    }
    const avail = availableStars();
    state.rewards.catalog.forEach((r, idx) => {
      const card = document.createElement('div');
      card.className = 'reward-card';
      card.innerHTML = `
        <div class="r-icon">${escapeHtml(r.icon || '🎁')}</div>
        <div class="r-name">${escapeHtml(r.name || '')}</div>
        <div class="r-cost">${r.cost} ⭐</div>
        <div class="r-actions">
          <button class="mini-btn edit">改</button>
          <button class="mini-btn del">删</button>
        </div>
      `;
      const redeemBtn = document.createElement('button');
      redeemBtn.className = 'redeem-btn';
      redeemBtn.textContent = '兑换';
      redeemBtn.disabled = avail < r.cost;
      redeemBtn.addEventListener('click', () => {
        if (availableStars() < r.cost) { toast('星星不够哦~'); return; }
        if (!confirm(`兑换「${r.name}」，花费 ${r.cost} ⭐？`)) return;
        state.rewards.redeemed.unshift({
          rewardId: r.id,
          name: r.name,
          icon: r.icon,
          cost: r.cost,
          date: todayISO()
        });
        saveState();
        renderRewards();
        emitSnowflakes(20);
        toast(`已兑换 ${r.name}！`);
      });
      card.appendChild(redeemBtn);

      card.querySelector('.edit').addEventListener('click', () => editReward(idx));
      card.querySelector('.del').addEventListener('click', () => {
        if (!confirm(`删除奖励「${r.name}」？历史记录不受影响。`)) return;
        state.rewards.catalog.splice(idx, 1);
        saveState();
        renderRewards();
      });
      list.appendChild(card);
    });

    const rl = $('#redeemedList');
    rl.innerHTML = '';
    if (state.rewards.redeemed.length === 0) {
      rl.innerHTML = '<div class="empty-hint">还没有兑换记录。</div>';
    } else {
      state.rewards.redeemed.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'redeemed-item';
        item.innerHTML = `
          <span>${escapeHtml(r.icon || '🎁')} ${escapeHtml(r.name)}</span>
          <span>${r.date} · -${r.cost} ⭐</span>
        `;
        rl.appendChild(item);
      });
    }
  }

  function editReward(idx) {
    const r = state.rewards.catalog[idx];
    openModal({
      title: '编辑奖励',
      fields: [
        { key: 'icon', label: '图标（emoji）', value: r.icon || '🎁' },
        { key: 'name', label: '奖励名称', value: r.name || '' },
        { key: 'cost', label: '所需星星', value: r.cost || 1, type: 'number', min: 1 }
      ],
      onOk: (vals) => {
        state.rewards.catalog[idx] = Object.assign({}, r, {
          icon: vals.icon || '🎁',
          name: vals.name || '未命名奖励',
          cost: Math.max(1, Number(vals.cost) || 1)
        });
        saveState();
        renderRewards();
      }
    });
  }

  function initRewards() {
    $('#addRewardBtn').addEventListener('click', () => {
      openModal({
        title: '添加新奖励',
        fields: [
          { key: 'icon', label: '图标（emoji）', value: '🎁' },
          { key: 'name', label: '奖励名称', value: '' },
          { key: 'cost', label: '所需星星', value: 10, type: 'number', min: 1 }
        ],
        onOk: (vals) => {
          if (!vals.name) { toast('请填写奖励名称'); return false; }
          state.rewards.catalog.push({
            id: uid('r'),
            icon: vals.icon || '🎁',
            name: vals.name,
            cost: Math.max(1, Number(vals.cost) || 1)
          });
          saveState();
          renderRewards();
        }
      });
    });
  }

  // -------- 模态 --------
  function openModal({ title, fields, onOk }) {
    const backdrop = $('#modalBackdrop');
    $('#modalTitle').textContent = title;
    const body = $('#modalBody');
    body.innerHTML = '';
    fields.forEach((f) => {
      const wrap = document.createElement('label');
      wrap.innerHTML = `${escapeHtml(f.label)}`;
      const input = document.createElement('input');
      input.type = f.type || 'text';
      if (f.min != null) input.min = f.min;
      input.value = f.value;
      input.dataset.key = f.key;
      wrap.appendChild(input);
      body.appendChild(wrap);
    });
    backdrop.hidden = false;

    const close = () => { backdrop.hidden = true; };

    const okHandler = () => {
      const vals = {};
      body.querySelectorAll('input').forEach((i) => { vals[i.dataset.key] = i.value; });
      const res = onOk(vals);
      if (res !== false) close();
    };
    const cancelHandler = () => close();

    $('#modalOk').onclick = okHandler;
    $('#modalCancel').onclick = cancelHandler;
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
  }

  // -------- 特效 --------
  function emitFlames(target) {
    const layer = $('#fxLayer');
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'flame-particle';
      p.style.left = (cx - 7) + 'px';
      p.style.top = (cy - 7) + 'px';
      const dx = (Math.random() - 0.5) * 80;
      p.style.setProperty('--dx', dx + 'px');
      p.style.animationDelay = (Math.random() * 80) + 'ms';
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  function emitSnowflakes(count = 40) {
    const layer = $('#fxLayer');
    const flakes = ['❄', '❅', '❆', '✦', '✧'];
    for (let i = 0; i < count; i++) {
      const f = document.createElement('div');
      f.className = 'snowflake';
      f.textContent = flakes[Math.floor(Math.random() * flakes.length)];
      f.style.left = Math.random() * 100 + 'vw';
      f.style.fontSize = (12 + Math.random() * 20) + 'px';
      f.style.setProperty('--sx', ((Math.random() - 0.5) * 200) + 'px');
      f.style.animationDuration = (3 + Math.random() * 3) + 's';
      f.style.animationDelay = (Math.random() * 1.5) + 's';
      layer.appendChild(f);
      setTimeout(() => f.remove(), 6500);
    }
  }

  // -------- Toast --------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
  }

  // -------- 导入导出 / 重置 --------
  function initFooter() {
    $('#exportBtn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kids-schedule-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('已导出到下载文件夹');
    });

    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          state = migrate(data);
          saveState();
          renderToday();
          toast('导入成功');
        } catch (err) {
          toast('文件格式错误');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('确认清空所有数据并恢复默认？此操作不可撤销。')) return;
      state = defaultState();
      saveState();
      currentDate = todayISO();
      renderToday();
      toast('已重置为默认');
    });
  }

  // -------- 工具 --------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------- 启动 --------
  function init() {
    // 如果当前日期早于设置的开始日期，把 currentDate 调整为开始日期
    if (state.settings.startDate && todayISO() < state.settings.startDate) {
      currentDate = state.settings.startDate;
    }
    initTabs();
    initToday();
    initTemplate();
    initRewards();
    initFooter();
    renderToday();
    // 首次保存，确保 storage 中存在键
    saveState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

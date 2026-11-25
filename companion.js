(() => {
  'use strict';

  const source = document.getElementById('open-reader');
  const reader = document.querySelector('.ks-reader');
  if (!source || !reader) return;

  const prefix = 'kanshan.pet.';
  function preference(name) {
    try { return localStorage.getItem(prefix + name); } catch { return null; }
  }
  function save(name, value) {
    try { localStorage.setItem(prefix + name, String(value)); } catch { /* Keep this session's choice. */ }
  }

  source.innerHTML = '<span class="ks-pet-sprite" aria-hidden="true"></span><b class="ks-pet-label" aria-hidden="true">陪读</b>';
  source.title = '刘看山 · 点一下进入陪读，横拖或用左右键换边';
  source.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');

  const pet = document.createElement('div');
  pet.className = 'ks-pet';
  pet.innerHTML = `
    <button type="button" class="ks-pet-button" aria-label="刘看山陪读设置" title="刘看山陪读设置"
      aria-expanded="false" aria-controls="ks-pet-panel"><span class="ks-pet-sprite" aria-hidden="true"></span></button>
    <section class="ks-pet-panel" id="ks-pet-panel" aria-labelledby="ks-pet-heading" hidden>
      <h2 class="ks-pet-heading" id="ks-pet-heading">刘看山陪读</h2>
      <button type="button" class="ks-pet-resume">接着这句读</button>
      <button type="button" class="ks-pet-reminders" aria-pressed="false" title="超过本页预计阅读时间两分钟时提醒一次">
        <span class="ks-pet-option-label">专注提醒</span><span class="ks-pet-option-value" aria-hidden="true"></span></button>
      <button type="button" class="ks-pet-quiet" aria-pressed="false">
        <span class="ks-pet-option-label">安静模式</span><span class="ks-pet-option-value" aria-hidden="true"></span></button>
      <button type="button" class="ks-pet-preview">演示提醒</button>
    </section>
    <div class="ks-pet-bubble" hidden><span role="status"></span>
      <button type="button" class="ks-pet-dismiss" aria-label="收起气泡" title="收起气泡">×</button></div>
    <span class="ks-pet-pop" aria-hidden="true" hidden></span>`;
  reader.querySelector('.ks-footer').append(pet);
  const find = name => pet.querySelector('.ks-pet-' + name);
  const button = find('button'), panel = find('panel'), bubble = find('bubble'), pop = find('pop');
  const remindersButton = find('reminders'), quietButton = find('quiet');
  const status = bubble.querySelector('[role="status"]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let reminders = preference('reminders') === 'true';
  let quiet = preference('quiet') === 'true';
  let reading = false, following = false, contentsOpen = false;
  let signature = null, budget = 0, elapsed = 0, startedAt = null, notified = false;
  let clockTimer, poseTimer, blinkTimer;
  const still = () => quiet || reduceMotion.matches;

  function rest() {
    clearTimeout(poseTimer);
    clearTimeout(blinkTimer);
    pop.hidden = true;
    pet.dataset.pose = following ? 'read' : 'idle';
    source.dataset.pose = 'idle';
    delete pet.dataset.action;
    delete source.dataset.action;
    if (!document.hidden && !still() && !(reading && (following || !panel.hidden || !bubble.hidden))) {
      blinkTimer = setTimeout(() => play('blink', 160), 14000);
    }
  }
  function play(pose, duration, action = pose) {
    rest();
    if (still() || document.hidden) return;
    clearTimeout(blinkTimer);
    const target = reading ? pet : source;
    target.dataset.pose = pose;
    target.dataset.action = action;
    if (pose === 'hop') pop.hidden = false;
    poseTimer = setTimeout(rest, duration);
  }
  function renderPreferences() {
    const reduced = still();
    pet.dataset.quiet = source.dataset.quiet = String(reduced);
    remindersButton.setAttribute('aria-pressed', String(reminders));
    remindersButton.querySelector('.ks-pet-option-value').textContent = reminders ? '开' : '关';
    quietButton.setAttribute('aria-pressed', String(reduced));
    quietButton.disabled = reduceMotion.matches;
    quietButton.title = reduceMotion.matches ? '已跟随系统减少动态效果' : '保留陪读功能，停止看山动画';
    quietButton.querySelector('.ks-pet-option-value').textContent = reduceMotion.matches ? '跟随系统' : reduced ? '开' : '关';
  }

  // Charge only active reading time. Relayout changes the budget for the visible
  // prose, while only an actual navigation starts the clock from zero.
  function stopClock() {
    clearTimeout(clockTimer);
    if (startedAt !== null) elapsed += performance.now() - startedAt;
    startedAt = null;
  }
  function syncClock() {
    stopClock();
    if (!reading || !reminders || notified || document.hidden || !panel.hidden || contentsOpen) return;
    startedAt = performance.now();
    clockTimer = setTimeout(() => {
      stopClock();
      if (!document.hidden && reading && !contentsOpen && panel.hidden && reminders) showReminder();
    }, Math.max(0, budget - elapsed));
  }
  function setPage(detail) {
    signature = detail.signature;
    const units = (detail.text || '').match(/\p{Script=Han}|[\p{Script=Latin}\p{N}]+/gu);
    budget = 120000 + Math.ceil((units?.length || 0) * 60000 / 450);
  }
  function hideReminder() {
    const returnFocus = bubble.contains(document.activeElement) && reading && reader.open;
    bubble.hidden = true;
    status.textContent = '';
    if (returnFocus) button.focus({preventScroll: true});
  }
  function showReminder() {
    stopClock();
    notified = true;
    bubble.hidden = false;
    status.textContent = '要接着这页读吗？';
    play('blow', 850);
  }
  function setPanel(open, returnFocus = true) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      hideReminder();
      play('wave', 700);
      find('resume').disabled = reader.querySelector('.ks-follow').disabled;
      panel.querySelector('button:enabled').focus({preventScroll: true});
    } else {
      if (returnFocus) button.focus({preventScroll: true});
      rest();
    }
    syncClock();
  }

  button.addEventListener('click', () => setPanel(panel.hidden));
  remindersButton.addEventListener('click', () => {
    reminders = !reminders;
    save('reminders', reminders);
    stopClock();
    elapsed = 0;
    notified = false;
    hideReminder();
    renderPreferences();
    syncClock();
  });
  quietButton.addEventListener('click', () => {
    quiet = !quiet;
    save('quiet', quiet);
    renderPreferences();
    rest();
  });
  find('resume').addEventListener('click', () => {
    setPanel(false);
    const follow = reader.querySelector('.ks-follow');
    if (follow.getAttribute('aria-pressed') !== 'true') follow.click();
    follow.focus({preventScroll: true});
  });
  find('preview').addEventListener('click', () => {
    setPanel(false);
    showReminder();
  });
  find('dismiss').addEventListener('click', () => {
    hideReminder();
    rest();
  });
  pet.addEventListener('keydown', event => {
    if (panel.hidden || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setPanel(false);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const options = Array.from(panel.querySelectorAll('button:enabled'));
      let next = options.indexOf(document.activeElement) + (event.key === 'ArrowUp' ? -1 : 1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      options[Math.max(0, Math.min(next, options.length - 1))].focus();
    }
    // Do not send menu keystrokes to pagination, font sizing or sentence tracking.
    event.stopPropagation();
  });
  reader.addEventListener('cancel', event => {
    if (!panel.hidden) { event.preventDefault(); setPanel(false); }
  });
  for (const eventName of ['pointerdown', 'focusin']) {
    reader.addEventListener(eventName, event => {
      if (!panel.hidden && !pet.contains(event.target)) setPanel(false, false);
    });
  }

  document.addEventListener('ks:reader', event => {
    const detail = event.detail;
    switch (detail.type) {
      case 'open':
        stopClock();
        reading = true;
        following = detail.following;
        contentsOpen = false;
        elapsed = 0;
        notified = false;
        setPage(detail);
        syncClock();
        play('wave', 700);
        break;
      case 'close':
        stopClock();
        reading = false;
        following = false;
        hideReminder();
        setPanel(false, false);
        break;
      case 'turn': {
        if (!reading) break;
        const hadBubble = !bubble.hidden;
        hideReminder();
        stopClock();
        elapsed = 0;
        notified = false;
        following = detail.following;
        setPage(detail);
        pet.dataset.direction = detail.direction < 0 ? 'left' : 'right';
        play(hadBubble ? 'hop' : 'read', hadBubble ? 680 : 450, hadBubble ? 'hop' : 'turn');
        syncClock();
        break;
      }
      case 'page':
        if (reading && signature !== detail.signature) { setPage(detail); syncClock(); }
        break;
      case 'follow':
        following = detail.following;
        rest();
        break;
      case 'contents':
        contentsOpen = detail.open;
        syncClock();
        break;
    }
  });
  reduceMotion.addEventListener('change', () => { renderPreferences(); rest(); });
  document.addEventListener('visibilitychange', () => { syncClock(); rest(); });
  let lastGreeting = -Infinity;
  function greet() {
    if (reading || performance.now() - lastGreeting < 4000) return;
    lastGreeting = performance.now();
    play('wave', 700);
  }
  source.addEventListener('pointerenter', greet);
  source.addEventListener('focus', greet);

  function enableDocking() {
    const root = document.documentElement;
    root.dataset.ksPetDock = preference('dock') === 'left' ? 'left' : 'right';
    let gesture = null, suppressClickUntil = 0;
    function dock(side) {
      root.dataset.ksPetDock = side;
      save('dock', side);
    }
    function release() {
      if (!gesture) return;
      if (source.hasPointerCapture(gesture.id)) source.releasePointerCapture(gesture.id);
      gesture = null;
      delete source.dataset.dragging;
      source.style.removeProperty('--ks-pet-drag-x');
    }
    source.addEventListener('keydown', event => {
      if (event.altKey || event.metaKey || event.ctrlKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      dock(event.key === 'ArrowLeft' ? 'left' : 'right');
    });
    source.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClickUntil = 0;
      gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, box: source.getBoundingClientRect()};
    });
    window.addEventListener('pointermove', event => {
      if (gesture?.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!source.dataset.dragging) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (Math.abs(dy) >= Math.abs(dx)) { release(); return; }
        source.setPointerCapture(event.pointerId);
        source.dataset.dragging = 'true';
      }
      const limit = document.documentElement.clientWidth - gesture.box.right;
      source.style.setProperty('--ks-pet-drag-x', Math.max(-gesture.box.left, Math.min(limit, dx)) + 'px');
    }, {passive:true});
    window.addEventListener('pointerup', event => {
      if (gesture?.id !== event.pointerId) return;
      if (source.dataset.dragging) {
        const center = gesture.box.left + gesture.box.width / 2 + event.clientX - gesture.x;
        dock(center < document.documentElement.clientWidth / 2 ? 'left' : 'right');
        suppressClickUntil = performance.now() + 700;
      }
      release();
    });
    window.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) release(); });
    window.addEventListener('blur', release);
    document.addEventListener('click', event => {
      if (source.contains(event.target) && event.detail > 0 && performance.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }
  enableDocking();
  renderPreferences();
  rest();
})();

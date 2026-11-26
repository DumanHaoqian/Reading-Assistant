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

  const pet = document.createElement('div');
  pet.className = 'ks-pet';
  pet.innerHTML = `
    <button type="button" class="ks-pet-button" aria-label="刘看山陪读设置" title="刘看山陪读设置"
      aria-expanded="false" aria-controls="ks-pet-panel"><span class="ks-pet-sprite" aria-hidden="true"></span></button>
    <section class="ks-pet-panel" id="ks-pet-panel" aria-labelledby="ks-pet-heading" hidden>
      <h2 class="ks-pet-heading" id="ks-pet-heading">刘看山陪读</h2>
      <div class="ks-pet-menu">
      <button type="button" class="ks-pet-resume">接着这句读</button>
      <button type="button" class="ks-pet-nuzzle">摸摸头</button>
      <button type="button" class="ks-pet-reminders" aria-pressed="false" title="超过本页预计阅读时间两分钟时提醒一次">
        <span class="ks-pet-option-label">专注提醒</span><span class="ks-pet-option-value" aria-hidden="true"></span></button>
      <button type="button" class="ks-pet-quiet" aria-pressed="false">
        <span class="ks-pet-option-label">安静模式</span><span class="ks-pet-option-value" aria-hidden="true"></span></button>
      <button type="button" class="ks-pet-preview">预览提醒</button>
      <button type="button" class="ks-pet-customize" aria-controls="ks-pet-appearance">设置刘看山<span aria-hidden="true">›</span></button>
      </div>
      <div class="ks-pet-appearance" id="ks-pet-appearance" hidden>
        <div class="ks-pet-look" aria-hidden="true"><span><img src="assets/kanshan/official-idle-poster.webp" alt=""></span></div>
        <div class="ks-pet-sizing" role="group" aria-label="刘看山大小">
          <span>大小</span>
          <button type="button" class="ks-pet-smaller" aria-label="缩小刘看山">−</button>
          <output aria-label="刘看山大小"></output>
          <button type="button" class="ks-pet-larger" aria-label="放大刘看山">+</button>
        </div>
        <button type="button" class="ks-pet-mirror" aria-pressed="false">左右镜像<span class="ks-pet-option-value" aria-hidden="true"></span></button>
        <button type="button" class="ks-pet-back">返回陪读菜单</button>
      </div>
    </section>
    <div class="ks-pet-bubble" hidden><span role="status"></span>
      <button type="button" class="ks-pet-dismiss" aria-label="收起气泡" title="收起气泡">×</button></div>
    <span class="ks-pet-pop" aria-hidden="true" hidden></span>`;
  reader.querySelector('.ks-footer').append(pet);
  const find = name => pet.querySelector('.ks-pet-' + name);
  const button = find('button'), panel = find('panel'), bubble = find('bubble'), pop = find('pop');
  const remindersButton = find('reminders'), quietButton = find('quiet');
  const appearance = find('appearance'), customize = find('customize');
  const smaller = find('smaller'), larger = find('larger'), mirror = find('mirror');
  const status = bubble.querySelector('[role="status"]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let reminders = preference('reminders') === 'true';
  let quiet = preference('quiet') === 'true';
  const petAppearance = window.KanshanAppearance;
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

  function renderAppearance() {
    const { size: petSize, mirrored, sizes } = petAppearance;
    pet.toggleAttribute('data-enlarged', petSize > 100);
    pet.toggleAttribute('data-large', petSize > 150);
    smaller.disabled = petSize === sizes[0];
    larger.disabled = petSize === sizes[sizes.length - 1];
    appearance.querySelector('output').textContent = petSize + '%';
    mirror.setAttribute('aria-pressed', String(mirrored));
    mirror.querySelector('.ks-pet-option-value').textContent = mirrored ? '朝左 ←' : '朝右 →';
    updateGaze();
  }
  function showAppearance(open) {
    delete panel.dataset.pinned;
    find('menu').hidden = open;
    appearance.hidden = !open;
    find('heading').textContent = open ? '设置刘看山' : '刘看山陪读';
    if (open) {
      // Keep repeated +/- clicks under the pointer as the character changes size.
      const box = panel.getBoundingClientRect();
      panel.style.setProperty('--ks-appearance-x', box.left + 'px');
      panel.style.setProperty('--ks-appearance-y', box.top + 'px');
      panel.style.setProperty('--ks-appearance-height', panel.scrollHeight + 2 + 'px');
      panel.dataset.pinned = 'true';
    }
  }
  customize.addEventListener('click', () => {
    showAppearance(true);
    (smaller.disabled ? larger : smaller).focus();
  });
  function backToMenu() {
    showAppearance(false);
    customize.focus();
  }
  find('back').addEventListener('click', backToMenu);
  for (const [control, direction] of [[smaller, -1], [larger, 1]]) {
    control.addEventListener('click', () => {
      const { sizes, size } = petAppearance;
      petAppearance.setSize(sizes[sizes.indexOf(size) + direction]);
      if (control.disabled) (control === smaller ? larger : smaller).focus();
    });
  }
  const previewFigure = find('look').firstElementChild;
  function stopPreviewHop() {
    for (const animation of previewFigure.getAnimations()) animation.cancel();
  }
  mirror.addEventListener('click', () => {
    petAppearance.flip();
    stopPreviewHop();
    if (still()) return;
    const distance = petAppearance.mirrored ? -18 : 18;
    previewFigure.animate([
      { transform: 'translate(0, 0)' },
      { transform: 'translate(' + distance + 'px, -7px)', offset: .42 },
      { transform: 'translate(0, 0)' },
    ], { duration: 420, easing: 'ease-in-out' });
  });

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
    showAppearance(false);
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
  find('nuzzle').addEventListener('click', () => {
    setPanel(false);
    if (still()) {
      pet.dataset.pose = 'nuzzle';
      poseTimer = setTimeout(rest, 1150);
    } else play('nuzzle', 1150);
  });
  find('dismiss').addEventListener('click', () => {
    hideReminder();
    rest();
  });
  pet.addEventListener('keydown', event => {
    if (panel.hidden || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (appearance.hidden) setPanel(false);
      else backToMenu();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const options = Array.from((appearance.hidden ? find('menu') : appearance).querySelectorAll('button:enabled'));
      let next = options.indexOf(document.activeElement) + (event.key === 'ArrowUp' ? -1 : 1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = options.length - 1;
      options[Math.max(0, Math.min(next, options.length - 1))].focus();
    }
    // Do not send menu keystrokes to pagination, font sizing or sentence tracking.
    event.stopPropagation();
  });
  reader.addEventListener('cancel', event => {
    if (!panel.hidden) {
      event.preventDefault();
      if (appearance.hidden) setPanel(false);
      else backToMenu();
    }
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
  reduceMotion.addEventListener('change', () => { stopPreviewHop(); renderPreferences(); rest(); });
  document.addEventListener('visibilitychange', () => { syncClock(); rest(); });
  let lastGreeting = -Infinity;
  function greet() {
    if (reading || performance.now() - lastGreeting < 4000) return;
    lastGreeting = performance.now();
    play('wave', 700);
  }
  source.addEventListener('pointerenter', greet);
  source.addEventListener('focus', greet);

  // A single pass across the face is ordinary pointing. Wait for two deliberate reversals.
  for (const handle of [source, button]) {
    let stroke = null, lastRub = -Infinity;
    handle.addEventListener('pointerleave', () => { stroke = null; });
    handle.addEventListener('pointermove', event => {
      if (event.buttons || event.pointerType === 'touch' || still() || !panel.hidden || !bubble.hidden) {
        stroke = null;
        return;
      }
      const time = performance.now();
      if (time - lastRub < 2500) return;
      const face = handle.querySelector('.ks-pet-sprite').getBoundingClientRect();
      const physicalX = (event.clientX - face.left) / face.width;
      const x = petAppearance.mirrored ? 1 - physicalX : physicalX;
      const y = (event.clientY - face.top) / face.height;
      if (x < .32 || x > .76 || y < .17 || y > .50) { stroke = null; return; }
      if (!stroke || time - stroke.time > 700) stroke = { edge: x, direction: 0, turns: 0 };
      stroke.time = time;
      const delta = x - stroke.edge;
      if (stroke.direction && Math.sign(delta) === stroke.direction) stroke.edge = x;
      else if (Math.abs(delta) >= .13) {
        if (stroke.direction) stroke.turns++;
        stroke.direction = Math.sign(delta);
        stroke.edge = x;
        if (stroke.turns === 2) {
          lastRub = time;
          stroke = null;
          play('nuzzle', 1150);
        }
      }
    }, { passive: true });
  }

  const updateGaze = window.KanshanCharacter.attach({ source, pet });
  window.KanshanPosition.attach({
    source, pet, button, onMove: updateGaze,
    onDragStart(host) {
      if (host === pet && !panel.hidden) setPanel(false, false);
    },
  });
  renderPreferences();
  document.addEventListener('ks:appearance', renderAppearance);
  renderAppearance();
  rest();
})();

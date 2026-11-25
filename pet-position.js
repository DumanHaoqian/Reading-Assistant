(() => {
  'use strict';

  const inset = 6;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  function viewport() {
    const view = window.visualViewport;
    return {
      left: view?.offsetLeft || 0,
      top: view?.offsetTop || 0,
      width: Math.min(document.documentElement.clientWidth, view?.width || innerWidth),
      height: Math.min(document.documentElement.clientHeight, view?.height || innerHeight),
    };
  }

  function readPosition(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      if ([value?.x, value?.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) return value;
    } catch { /* Storage may be unavailable or contain an older value. */ }
    return null;
  }

  function attach({ source, pet, button, onMove, onDragStart }) {
    function makeMovable(host, handle, surface) {
      const key = 'kanshan.pet.position.' + surface;
      const inReader = surface === 'reader';
      const description = inReader
        ? '点一下打开陪读设置，拖动可自由移动。用 Alt 加方向键移动位置。'
        : '点一下进入陪读，拖动可自由移动。用方向键移动位置。';
      handle.title = '刘看山 · ' + description;
      handle.setAttribute('aria-description', description);
      handle.setAttribute('aria-keyshortcuts', Object.keys(arrows).map(k => (inReader ? 'Alt+' : '') + k).join(' '));
      const panel = host.querySelector('.ks-pet-panel');
      const bubble = host.querySelector('.ks-pet-bubble');
      let saved = readPosition(key), gesture = null, suppressClick = false, landingTimer, tiltTimer;

      function bounds() {
        const view = viewport();
        const left = view.left + inset, top = view.top + inset;
        return {
          view, left, top,
          rangeX: Math.max(0, view.width - host.offsetWidth - 2 * inset),
          rangeY: Math.max(0, view.height - host.offsetHeight - 2 * inset),
        };
      }

      function place(x, y, area) {
        const left = clamp(x, area.left, area.left + area.rangeX);
        const top = clamp(y, area.top, area.top + area.rangeY);
        const { view } = area;
        const nearLeft = left + host.offsetWidth / 2 < view.left + view.width / 2;
        const nearTop = top + host.offsetHeight / 2 < view.top + view.height / 2;
        host.style.setProperty('--ks-pet-x', left + 'px');
        host.style.setProperty('--ks-pet-y', top + 'px');
        host.dataset.side = nearLeft ? 'left' : 'right';
        host.dataset.half = nearTop ? 'top' : 'bottom';
        // Align the nearest edge by default, then clamp the open panel or bubble
        // itself. At the middle of a narrow screen either alignment could clip.
        for (const [name, popup] of [['panel', panel], ['bubble', bubble]]) {
          if (!popup || popup.hidden) continue;
          const width = popup.offsetWidth;
          const preferred = nearLeft ? left : left + host.offsetWidth - width;
          const popupLeft = clamp(preferred, area.left, view.left + view.width - inset - width);
          host.style.setProperty('--ks-' + name + '-left', (popupLeft - left) + 'px');
        }
        const room = nearTop ? view.top + view.height - inset - (top + host.offsetHeight) : top - area.top;
        host.style.setProperty('--ks-panel-max-height', Math.max(0, room - 8) + 'px');
        onMove?.(host);
        return {
          x: area.rangeX ? (left - area.left) / area.rangeX : 0,
          y: area.rangeY ? (top - area.top) / area.rangeY : 0,
        };
      }
      function persist(position) {
        saved = position;
        try { localStorage.setItem(key, JSON.stringify(position)); } catch { /* Retain it for this visit. */ }
      }
      function restore() {
        if (!host.getClientRects().length) return;
        if (gesture?.moved) {
          moveToPointer(gesture.x, gesture.y);
        } else if (saved) {
          host.dataset.positioned = 'true';
          const area = bounds();
          place(area.left + saved.x * area.rangeX, area.top + saved.y * area.rangeY, area);
        } else {
          delete host.dataset.positioned;
          delete host.dataset.side;
          delete host.dataset.half;
          onMove?.(host);
        }
      }
      function moveToPointer(x, y) {
        gesture.x = x;
        gesture.y = y;
        gesture.position = place(x - gesture.grabX, y - gesture.grabY, bounds());
      }
      function stop(commit) {
        if (!gesture) return;
        const ended = gesture;
        gesture = null;
        if (handle.hasPointerCapture(ended.id)) handle.releasePointerCapture(ended.id);
        delete host.dataset.dragging;
        clearTimeout(tiltTimer);
        host.style.removeProperty('--ks-carry-tilt');
        if (!ended.moved) return;
        suppressClick = true;
        if (commit) {
          persist(ended.position);
          host.dataset.landing = 'true';
          landingTimer = setTimeout(() => delete host.dataset.landing, 450);
        } else restore();
      }

      handle.addEventListener('pointerdown', event => {
        if (gesture || !event.isPrimary || event.button !== 0) return;
        // Suppress native image/text dragging beneath a freely moving button.
        event.preventDefault();
        const box = host.getBoundingClientRect();
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
          grabX: event.clientX - box.left, grabY: event.clientY - box.top, moved: false };
        suppressClick = false;
        clearTimeout(landingTimer);
        delete host.dataset.landing;
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener('pointermove', event => {
        if (gesture?.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
        if (!gesture.moved) {
          if (Math.hypot(dx, dy) < 6) return;
          gesture.moved = true;
          host.dataset.positioned = 'true';
          host.dataset.dragging = 'true';
          onDragStart?.(host);
        }
        if (dx || dy) {
          const tilt = 8 * dx / Math.hypot(dx, dy);
          host.style.setProperty('--ks-carry-tilt', tilt.toFixed(1) + 'deg');
          clearTimeout(tiltTimer);
          tiltTimer = setTimeout(() => host.style.setProperty('--ks-carry-tilt', '0deg'), 125);
        }
        moveToPointer(event.clientX, event.clientY);
      });
      handle.addEventListener('pointerup', event => {
        if (gesture?.id !== event.pointerId) return;
        if (!gesture.moved) handle.focus({ preventScroll: true, focusVisible: false });
        const touchTap = !gesture.moved && event.pointerType === 'touch';
        if (gesture.moved) moveToPointer(event.clientX, event.clientY);
        stop(true);
        // Some touch browsers withhold the first native click immediately after
        // dragging. Activate taps once and consume any deferred compatibility click.
        if (touchTap) {
          event.preventDefault();
          suppressClick = true;
          handle.click();
        }
      });
      for (const type of ['pointercancel', 'lostpointercapture']) {
        handle.addEventListener(type, event => { if (gesture?.id === event.pointerId) stop(false); });
      }
      handle.addEventListener('click', event => {
        if (suppressClick && event.detail > 0) {
          suppressClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      handle.addEventListener('dragstart', event => event.preventDefault());
      handle.addEventListener('keydown', event => {
        if (gesture || !Object.hasOwn(arrows, event.key) || event.altKey !== inReader || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        const [dx, dy] = arrows[event.key];
        const step = event.shiftKey ? 48 : 16;
        const box = host.getBoundingClientRect();
        host.dataset.positioned = 'true';
        persist(place(box.left + dx * step, box.top + dy * step, bounds()));
      });

      // Carry the previous source page's left-side choice into free positioning.
      if (!inReader && !saved) {
        try {
          if (localStorage.getItem('kanshan.pet.dock') === 'left') {
            const box = host.getBoundingClientRect();
            host.dataset.positioned = 'true';
            persist(place(viewport().left + Math.max(inset, innerWidth - box.right), box.top, bounds()));
          }
        } catch { /* Start at the default corner. */ }
      }
      window.addEventListener('blur', () => stop(false));
      window.addEventListener('resize', restore);
      window.visualViewport?.addEventListener('resize', restore);
      window.visualViewport?.addEventListener('scroll', restore);
      const observer = new ResizeObserver(restore);
      for (const node of [host, panel, bubble]) if (node) observer.observe(node);
      document.addEventListener('ks:reader', ({ detail }) => {
        if (detail.type === 'open' || detail.type === 'close') {
          stop(false);
          requestAnimationFrame(restore);
        }
      });
      restore();
    }

    makeMovable(source, source, 'source');
    makeMovable(pet, button, 'reader');
  }

  window.KanshanPosition = { attach };
})();

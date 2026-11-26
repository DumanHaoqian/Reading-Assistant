(() => {
  'use strict';

  const art = window.KanshanOfficialArt;
  const directory = 'assets/kanshan/';
  if (!art || !window.KanshanBook) {
    window.KanshanCharacter = {
      attach({source, pet}) {
        for (const host of [source, pet]) {
          const image = new Image();
          const dress = () => { image.src = window.KanshanAppearance.poster; };
          dress();
          document.addEventListener('ks:appearance', dress);
          image.alt = '';
          image.className = 'ks-fox';
          host.querySelector('.ks-pet-sprite').replaceChildren(image);
        }
        return () => {};
      },
    };
    return;
  }
  const { size, columns, fps, clips } = art;
  const frameTime = 1000 / fps;

  // The body, near eye and occasional far eye all come from the same official frame.
  function makeFace(host, id) {
    function eyePattern(side) {
      return `<pattern id="${id}-patch-${side}" patternUnits="userSpaceOnUse">
        <use href="#${id}-eyes" class="ks-patch-${side}"/></pattern>`;
    }
    function eye(side) {
      return `<g class="ks-fox-eye" visibility="hidden">
        <rect class="ks-fox-sclera" fill="none"/>
        <rect class="ks-fox-pupil" fill="url(#${id}-patch-${side})"/>
      </g>`;
    }
    const sprite = host.querySelector('.ks-pet-sprite');
    sprite.innerHTML = `<svg class="ks-fox" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="${id}-frame"><rect width="${size}" height="${size}"/></clipPath>
        <clipPath id="${id}-upper"><rect width="${size}" height="114.5"/></clipPath>
        <clipPath id="${id}-lower"><rect y="114" width="${size}" height="${size - 114}"/></clipPath>
        <image id="${id}-eyes" preserveAspectRatio="none"/>
        ${eyePattern(0)}${eyePattern(1)}
      </defs>
      <g class="ks-fox-motion"><g class="ks-fox-body">
        <g class="ks-fox-base" style="--ks-lower-clip:url(#${id}-lower);--ks-sleeves-mask:url(#${id}-book-sleeves)">
          <g clip-path="url(#${id}-frame)">
            <g class="ks-fox-anchor"><g id="${id}-art">
              <image class="ks-fox-image" width="${size}" height="${size}" href="${window.KanshanAppearance.poster}" preserveAspectRatio="none"/>
              <image class="ks-fox-garment" display="none" preserveAspectRatio="none"/>
            </g></g>
          </g>
        </g>
        <g class="ks-fox-head">
          <use class="ks-fox-reading-upper" href="#${id}-art" clip-path="url(#${id}-upper)"/>
          ${eye(0)}${eye(1)}
        </g>
        ${window.KanshanBook.markup(id)}
      </g></g></svg>`;
    const svg = sprite.firstElementChild;
    return {
      host, svg, head: svg.querySelector('.ks-fox-head'), anchor: svg.querySelector('.ks-fox-anchor'),
      book: window.KanshanBook.bind(svg),
      image: svg.querySelector('.ks-fox-image'), garment: svg.querySelector('.ks-fox-garment'),
      eyesImage: svg.querySelector('#' + id + '-eyes'),
      eyes: Array.from(svg.querySelectorAll('.ks-fox-eye'), (socket, side) => ({
        socket, box: socket.querySelector('.ks-fox-sclera'), pupil: socket.querySelector('.ks-fox-pupil'),
        pattern: svg.querySelector('#' + id + '-patch-' + side), patch: svg.querySelector('.ks-patch-' + side),
      })),
    };
  }

  function attach({ source, pet }) {
    const reader = pet.closest('dialog');
    const faces = [makeFace(source, 'ks-source'), makeFace(pet, 'ks-reader')];
    const ready = new Map();
    let face = faces[0], activeClip = 'idle', requested = '', previousAction, cursor;
    let began = performance.now(), pausedAt = null, timer, gazeFrame = 0, movingUntil = 0;
    let turn, turnFrame, lastTurnSerial;

    function holdingBook() {
      return face.host.dataset.pose === 'read' && !face.host.hasAttribute('data-dragging') &&
        (!face.svg.dataset.clip || face.svg.dataset.clip === 'idle');
    }
    function stopTurn() {
      if (!turn) return;
      cancelAnimationFrame(turnFrame);
      turn.face.book.setTurn(0, 1);
      turn.face.head.style.removeProperty('transform');
      turn = null;
      updateGaze();
    }
    function stepTurn(now) {
      const progress = Math.max(0, Math.min(1, turn.start +
        (now - turn.began) / window.KanshanBook.turnDuration * turn.velocity));
      turn.progress = progress;
      face.book.setTurn(progress, turn.side);
      // Lower the chin toward the raised paper, keeping the paws and feet planted.
      const bend = Math.sin(Math.PI * progress) ** 2;
      const lean = -1.7 - 1.3 * turn.side * Math.sin(2 * Math.PI * progress);
      face.head.style.transform = `skewX(${lean}deg) scaleY(${.96 - .036 * bend})`;
      updateGaze();
      if ((turn.velocity > 0 && progress === 1) || (turn.velocity < 0 && progress === 0)) stopTurn();
      else turnFrame = requestAnimationFrame(stepTurn);
    }
    function startTurn(side) {
      const now = performance.now();
      if (turn) {
        // A quick reversal lays the same sheet back down from its visible position.
        // Repeated turns in the same direction share the gesture already in progress.
        const velocity = side === turn.side ? 1 : -1;
        if (velocity === turn.velocity) return;
        turn.start = turn.progress;
        turn.began = now;
        turn.velocity = velocity;
      } else {
        turn = { face, side, velocity: 1, start: 0, progress: 0, began: now };
        stepTurn(now);
      }
    }

    function dress(item) {
      const name = item.svg.dataset.clip;
      if (!name) {
        item.image.setAttribute('href', window.KanshanAppearance.poster);
        return;
      }
      const outfit = window.KanshanAppearance.outfit;
      if (outfit === 'original') {
        item.garment.setAttribute('display', 'none');
        item.garment.removeAttribute('href');
      } else {
        item.garment.setAttribute('href', directory + 'wardrobe-' + outfit + '-' + name + '.webp');
        item.garment.removeAttribute('display');
      }
    }
    document.addEventListener('ks:appearance', () => faces.forEach(dress));

    function updateEyes() {
      gazeFrame = 0;
      if (document.hidden) return;
      for (const { socket, pupil, bounds } of face.eyes) {
        if (!bounds) continue;
        const reading = face.svg.hasAttribute('data-book-open');
        let x = 0, y = reading ? 1.7 : 0;
        if (cursor) {
          const matrix = socket.getScreenCTM();
          if (!matrix || !matrix.a || !matrix.d) continue;
          const local = cursor.matrixTransform(matrix.inverse());
          const dx = local.x - bounds[2] / 2, dy = local.y - bounds[3] / 2;
          const distance = Math.max(18, Math.hypot(dx, dy));
          x = 2.5 * dx / distance;
          y = 2 * dy / distance;
        }
        if (turn) {
          const glance = Math.sin(Math.PI * turn.progress) ** 2;
          x += (turn.side * Math.cos(Math.PI * turn.progress) * 1.9 - x) * glance;
          y += (2 - y) * glance;
        }
        pupil.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      }
      if (cursor && performance.now() < movingUntil) updateGaze();
    }
    function updateGaze() {
      if (!gazeFrame && !document.hidden) gazeFrame = requestAnimationFrame(updateEyes);
    }
    function render(clip, name, index) {
      const cols = columns;
      if (face.svg.dataset.clip !== name) {
        for (const layer of [face.image, face.garment]) {
          layer.setAttribute('width', cols * size);
          layer.setAttribute('height', Math.ceil(clip.frames.length / cols) * size);
        }
        face.image.setAttribute('href', clip.atlas);
        face.eyesImage.setAttribute('width', cols * clip.eyeCell);
        face.eyesImage.setAttribute('height', clip.eyeRows * clip.eyeCell);
        face.eyesImage.setAttribute('href', clip.eyes);
        for (const {pattern} of face.eyes) {
          pattern.setAttribute('width', clip.eyeCell);
          pattern.setAttribute('height', clip.eyeCell);
        }
        face.svg.dataset.clip = name;
        face.svg.toggleAttribute('data-book-open', holdingBook());
        dress(face);
      } else if (Number(face.svg.dataset.frame) === index) return;
      face.svg.dataset.frame = index;
      const cellX = (index % cols) * size, cellY = Math.floor(index / cols) * size;
      for (const layer of [face.image, face.garment]) {
        layer.setAttribute('x', -cellX);
        layer.setAttribute('y', -cellY);
      }
      // Use the fitted frame-zero grip below the book and the live idle frame above it.
      face.anchor.setAttribute('transform', `translate(${cellX} ${cellY})`);
      face.eyes.forEach((eye, side) => {
        const bounds = side ? clip.farEyes?.[index] : clip.frames[index];
        eye.bounds = bounds;
        eye.socket.setAttribute('visibility', bounds ? 'visible' : 'hidden');
        if (!bounds) return;
        const [x, y, width, height, slot = index] = bounds;
        eye.socket.setAttribute('transform', `translate(${x} ${y})`);
        for (const rect of [eye.box, eye.pupil]) {
          rect.setAttribute('width', width);
          rect.setAttribute('height', height);
        }
        eye.patch.setAttribute('x', -(slot % cols) * clip.eyeCell);
        eye.patch.setAttribute('y', -Math.floor(slot / cols) * clip.eyeCell);
      });
      updateGaze();
    }
    function paint() {
      clearTimeout(timer);
      if (document.hidden || ready.get(activeClip) !== true) return;
      const clip = clips[activeClip];
      const elapsed = Math.max(0, performance.now() - began);
      const still = face.host.dataset.quiet === 'true';
      const index = still ? 0 : Math.floor(elapsed / frameTime);
      if (index >= clip.frames.length && activeClip !== 'idle' && !face.host.hasAttribute('data-dragging')) {
        // Keep the last displayed frame while a different requested action decodes.
        if (requested !== activeClip && ready.get(requested) !== true) return;
        choose('idle');
        return;
      }
      render(clip, activeClip, index % clip.frames.length);
      if (!still) timer = setTimeout(paint, frameTime - elapsed % frameTime);
    }
    function load(url) {
      const image = new Image();
      image.src = url;
      return image.decode();
    }
    function choose(name, restart = false) {
      requested = name;
      if (ready.get(name) !== true) {
        if (!ready.has(name)) {
          const clip = clips[name];
          ready.set(name, false);
          Promise.all([load(clip.atlas), load(clip.eyes)]).then(() => {
            ready.set(name, true);
            if (requested === name) choose(name, true);
          }).catch(() => ready.delete(name));
        }
        return;
      }
      if (restart || name !== activeClip) began = pausedAt ?? performance.now();
      activeClip = name;
      paint();
    }
    function synchronize() {
      const next = faces[reader.open ? 1 : 0];
      const changed = face !== next;
      if (changed) stopTurn();
      face = next;
      if (changed) previousAction = undefined;
      const { quiet, action, dragging, pose } = face.host.dataset;
      const state = dragging ? 'carry' : action || (pose === 'read' ? 'read' : 'idle');
      const transition = state !== previousAction;
      const previous = previousAction;
      previousAction = state;
      if (state !== 'turn' || quiet === 'true' || document.hidden) stopTurn();
      if (quiet === 'true') choose('idle');
      else if (state === 'carry' || state === 'nuzzle') choose('sway', transition);
      else if (state === 'wave') choose('wave', transition);
      else if (previous === 'carry' || state !== 'idle' || changed || !requested) choose('idle');
      // Keep short greeting/nuzzle triggers playing through the authored return pose.
      else paint();
      face.svg.toggleAttribute('data-book-open', holdingBook());
      const serial = face.host.dataset.turnSerial;
      if (!document.hidden && quiet !== 'true' && state === 'turn' && serial !== lastTurnSerial) {
        lastTurnSerial = serial;
        startTurn(face.host.dataset.direction === 'left' ? -1 : 1);
      }
      updateGaze();
    }
    for (const item of faces) {
      new MutationObserver(synchronize).observe(item.host, {
        attributes: true, attributeFilter: ['data-action','data-pose','data-dragging','data-quiet','data-turn-serial'],
      });
      const moving = () => { movingUntil = performance.now() + 700; updateGaze(); };
      item.host.addEventListener('animationstart', moving);
      item.host.addEventListener('transitionstart', moving);
    }
    function point(event) {
      cursor = event.pointerType === 'touch' ? null : new DOMPoint(event.clientX, event.clientY);
      updateGaze();
    }
    function resetEyes() { cursor = null; updateGaze(); }
    for (const type of ['pointermove', 'pointerdown']) window.addEventListener(type, point, {capture:true, passive:true});
    window.addEventListener('pointerout', event => { if (!event.relatedTarget) resetEyes(); });
    window.addEventListener('blur', resetEyes);
    window.addEventListener('resize', updateGaze);
    document.addEventListener('scroll', updateGaze, {capture:true, passive:true});
    document.addEventListener('ks:reader', synchronize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopTurn();
        pausedAt = performance.now();
        clearTimeout(timer);
        cancelAnimationFrame(gazeFrame);
        gazeFrame = 0;
        cursor = null;
      } else {
        if (pausedAt !== null) began += performance.now() - pausedAt;
        pausedAt = null;
        synchronize();
      }
    });
    synchronize();
    return updateGaze;
  }

  window.KanshanCharacter = { attach };
})();

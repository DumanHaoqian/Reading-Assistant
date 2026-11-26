(() => {
  'use strict';

  const art = window.KanshanOfficialArt;
  const directory = 'assets/kanshan/';
  if (!art) {
    window.KanshanCharacter = {
      attach({source, pet}) {
        for (const host of [source, pet]) {
          const image = new Image();
          image.src = directory + 'official-idle-poster.webp';
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
        <image id="${id}-eyes" preserveAspectRatio="none"/>
        ${eyePattern(0)}${eyePattern(1)}
      </defs>
      <g class="ks-fox-motion"><g class="ks-fox-body">
        <g clip-path="url(#${id}-frame)">
          <image class="ks-fox-image" width="${size}" height="${size}" href="${directory}official-idle-poster.webp" preserveAspectRatio="none"/>
        </g>
        ${eye(0)}${eye(1)}
        <g class="ks-fox-book" stroke-linejoin="round" stroke-width="1.8">
          <g transform="translate(98 134) scale(1.8 1.04) translate(-97 -134)">
          <path d="M77 124Q86 122 96 127Q106 121 117 121L116 139Q106 139 97 145Q86 140 78 141Z" fill="#f5e8c9" stroke="#4b607c"/>
          <path d="M76 126Q87 125 96 130Q107 124 118 124L117 141Q106 142 97 147Q88 142 77 143Z" fill="#496c9d" stroke="#384e69"/>
          <path d="M96 130L97 146" stroke="#c3d3e4"/>
          <path class="ks-fox-leaf" d="M96 127Q105 120 116 121L112 129Q103 130 96 135Z" fill="#fff3d7" stroke="#b5a894" stroke-width="1"/>
          </g>
        </g>
      </g></g></svg>`;
    const svg = sprite.firstElementChild;
    return {
      host, svg, image: svg.querySelector('.ks-fox-image'), eyesImage: svg.querySelector('#' + id + '-eyes'),
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

    function updateEyes() {
      gazeFrame = 0;
      if (document.hidden) return;
      for (const { socket, pupil, bounds } of face.eyes) {
        if (!bounds) continue;
        let x = 0, y = 0;
        if (cursor) {
          const matrix = socket.getScreenCTM();
          if (!matrix || !matrix.a || !matrix.d) continue;
          const local = cursor.matrixTransform(matrix.inverse());
          const dx = local.x - bounds[2] / 2, dy = local.y - bounds[3] / 2;
          const distance = Math.max(18, Math.hypot(dx, dy));
          x = 2.5 * dx / distance;
          y = 2 * dy / distance;
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
        face.image.setAttribute('width', cols * size);
        face.image.setAttribute('height', Math.ceil(clip.frames.length / cols) * size);
        face.image.setAttribute('href', clip.atlas);
        face.eyesImage.setAttribute('width', cols * clip.eyeCell);
        face.eyesImage.setAttribute('height', clip.eyeRows * clip.eyeCell);
        face.eyesImage.setAttribute('href', clip.eyes);
        for (const {pattern} of face.eyes) {
          pattern.setAttribute('width', clip.eyeCell);
          pattern.setAttribute('height', clip.eyeCell);
        }
        face.svg.dataset.clip = name;
      } else if (Number(face.svg.dataset.frame) === index) return;
      face.svg.dataset.frame = index;
      face.image.setAttribute('x', -(index % cols) * size);
      face.image.setAttribute('y', -Math.floor(index / cols) * size);
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
      face = next;
      if (changed) previousAction = undefined;
      const { quiet, action, dragging, pose } = face.host.dataset;
      const state = dragging ? 'carry' : action || (pose === 'read' ? 'read' : 'idle');
      const transition = state !== previousAction;
      const previous = previousAction;
      previousAction = state;
      if (quiet === 'true') choose('idle');
      else if (state === 'carry' || state === 'nuzzle') choose('sway', transition);
      else if (state === 'wave') choose('wave', transition);
      else if (previous === 'carry' || state !== 'idle' || changed || !requested) choose('idle');
      // Keep short greeting/nuzzle triggers playing through the authored return pose.
      else paint();
      updateGaze();
    }
    for (const item of faces) {
      new MutationObserver(synchronize).observe(item.host, {
        attributes: true, attributeFilter: ['data-action','data-pose','data-dragging','data-quiet'],
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

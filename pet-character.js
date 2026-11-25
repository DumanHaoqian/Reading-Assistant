(() => {
  'use strict';

  // Each eye has a stationary socket. The pupil, including its catchlight, moves inside it.
  function eye(x, y) {
    return `<g class="ks-fox-eye" transform="translate(${x} ${y})">
      <g class="ks-fox-open-eye">
        <ellipse class="ks-fox-sclera" rx="7.3" ry="7.6" fill="#fff" stroke="#b2a5a0" stroke-width="1.1"/>
        <path d="M-5.1 -5.2Q-.8 -9.1 4.4 -5.9" fill="none" stroke="#635954" stroke-width="1.6"/>
        <g class="ks-fox-pupil" transform="translate(0 0)" stroke="none">
          <ellipse rx="3.65" ry="4.45" fill="#27313b"/>
          <circle cx="-1.05" cy="-1.55" r="1.35" fill="#fff"/>
        </g>
      </g>
      <path class="ks-fox-closed-eye" d="M-5.2 .8Q0 4.4 5.2 .4" fill="none" stroke="#484349" stroke-width="2.4"/>
    </g>`;
  }

  function character(id) {
    const coat = `url(#${id}-coat)`, scarf = `url(#${id}-blue)`, dark = `url(#${id}-nose)`;
    return `<svg class="ks-fox" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}-coat" x1="0" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox">
          <stop stop-color="#fffdf6"/><stop offset=".58" stop-color="#fffdf8"/><stop offset="1" stop-color="#dee6ed"/>
        </linearGradient>
        <linearGradient id="${id}-blue" x1="0" x2=".85" y1="0" y2="1" gradientUnits="objectBoundingBox">
          <stop stop-color="#6d9cff"/><stop offset=".48" stop-color="#467be1"/><stop offset="1" stop-color="#2955a9"/>
        </linearGradient>
        <linearGradient id="${id}-nose" x1="0" x2=".55" y1="0" y2="1" gradientUnits="objectBoundingBox">
          <stop stop-color="#424552"/><stop offset="1" stop-color="#20242d"/>
        </linearGradient>
      </defs>
      <ellipse class="ks-fox-shadow" cx="67" cy="117.8" rx="35" ry="4" fill="#314c69" opacity=".14"/>
      <g class="ks-fox-motion">
        <g class="ks-fox-body" stroke="#393e49" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
          <g class="ks-fox-tail">
            <path d="M74 100C91 98 103 88 105 78C106 73 110 73 113 78C126 97 113 117 91 115C82 115 76 111 74 106Z" fill="${coat}"/>
            <path d="M112 82C117 101 105 111 85 110C94 116 112 112 116 99Q119 90 112 82Z" fill="#d2dde9" stroke="none"/>
            <path d="M99 89Q102 89 104 92L107 88L110 91" fill="none" stroke="#b9c8d6" stroke-width="1.6"/>
          </g>
          <g class="ks-fox-legs">
            <path d="M43 94C42 99 41 105 41 110C37 111 35 115 39 117C44 120 54 118 56 113L59 99" fill="${coat}"/>
            <path d="M66 97L65 112C64 117 70 119 77 117C82 116 83 113 80 110L82 96" fill="${coat}"/>
          </g>
          <path d="M44 75C38 84 36 96 41 105C46 112 69 115 81 107C88 100 89 83 82 74Z" fill="${coat}"/>
          <path d="M83 86C86 101 78 108 62 109C76 114 94 104 83 86Z" fill="#d4dfea" stroke="none"/>
          <g class="ks-fox-head">
            <g class="ks-fox-ear-far">
              <path d="M26 36C25 28 25 14 29 8C31 4 35 8 46.5 23.5L49 29" fill="${coat}"/>
              <path d="M31 26Q29 15 31.3 12.8Q35 15.8 39.5 22.7Z" fill="#eabcb6" stroke="none"/>
            </g>
            <g class="ks-fox-ear-near">
              <path d="M68 25C75 18 85 5 91 6.8C96 8.3 96 27 92.7 38.5" fill="${coat}"/>
              <path d="M77 25Q84 15 90 12C92 16 91 23 89 30Z" fill="#eabcb6" stroke="none"/>
            </g>
            <path d="M25.8 34C32 28 43 23 54 23Q61 22 69.5 23C79 23 89 28 92.8 37C96 43 98 48 97.8 53L101 57L96.8 59L98.5 62C94 76 82 83 62 84C44 85 25 80 18 69C13 61 15 54 21 49Q21 40 25.8 34Z" fill="${coat}" stroke="none"/>
            <path d="M93.6 47C97 62 89 75 72 80C87 78 96 69 96 63L93 61L97 57L94 55Z" fill="#d6e0ea" stroke="none"/>
            <path d="M26 34Q21 40 21 49C14 55 14 63 18 69C26 81 45 85 62 84C82 83 94 76 98.5 62L96.8 59L101 57L97.8 53Q98 46 92.8 37M46.3 23.7Q57 21.7 69.5 23" fill="none"/>
            <g class="ks-fox-cheeks" fill="#efbeb7" opacity=".78" stroke="none">
              <ellipse cx="28.8" cy="59.5" rx="6.2" ry="3.6"/>
              <ellipse cx="84.3" cy="60.4" rx="6.7" ry="3.6"/>
            </g>
            <path class="ks-fox-blush" d="M26 60.4L27.6 58.2M30 60.8L31.7 58.3M81.2 61.4L82.9 58.9M85.4 61.6L87.1 59.1" fill="none" stroke="#cb807e" stroke-width="1.25"/>
            <path d="M33.5 39Q36 36 40 37M69 36Q73 34.8 76 37.3" fill="none" stroke="#796f70" stroke-width="1.9"/>
            ${eye(37, 47.4)}${eye(69.7, 47.4)}
            <g transform="translate(0 3)">
              <path class="ks-fox-smile" d="M46.4 64.1Q46 70.3 51.5 70.4Q55.4 70.2 57.1 66.9" fill="none" stroke="#4a4140" stroke-width="1.9"/>
              <ellipse class="ks-fox-o-mouth" cx="53" cy="69" rx="2.5" ry="3" fill="#514349" stroke="none"/>
              <path d="M34.3 59.2C34 54.7 39.3 52.7 44.9 52.7C52.7 52.7 56 56.1 53.2 60.5C50.8 64.4 47 66.2 44.5 65.7C39.2 64.9 34.6 62.8 34.3 59.2Z" fill="${dark}" stroke="#292d36" stroke-width="1.45"/>
              <path d="M38.6 56.9Q40.8 55.4 43.2 55.6" fill="none" stroke="#8b929f" stroke-width="1.8"/>
            </g>
          </g>
          <g class="ks-fox-scarf">
            <g class="ks-fox-ribbons" fill="${scarf}" stroke="#364a73" stroke-width="1.9">
              <path d="M82 80Q94 65 103 70Q102 78 88 83Z"/>
              <path d="M83 80Q99 76 104 84Q95 89 83 84Z"/>
            </g>
            <path d="M35.7 76.6C51 83.3 70 83 84.5 75.9L84.4 83.5Q77.7 86.9 70.3 88L59 97Q49 92.8 41.1 85.5Q37.6 82.2 35.7 76.6Z" fill="${scarf}" stroke="#35486d" stroke-width="2"/>
            <path d="M43 81Q60 87 78 81" fill="none" stroke="#a9c9ff" stroke-width="1.5"/>
            <path d="M54 89.8L58.8 92.8L61.3 90.8" fill="none" stroke="#b7d1ff" stroke-width="1.25"/>
          </g>
          <g class="ks-fox-arm ks-fox-arm-far">
            <path d="M40 85C36 86 32 92 33 98C33.6 102 38 102.3 40.6 98L44 91" fill="${coat}"/>
          </g>
          <g class="ks-fox-arm ks-fox-arm-near">
            <path d="M78 86.5C83 87 84 94 81.6 100.2C79.8 105.1 73.8 106.3 72.8 101.7Q72 98.9 73.7 95.1L74.3 92.6" fill="${coat}"/>
          </g>
          <g class="ks-fox-wave-paw">
            <path d="M77 88C81 90 86 84 89 78C91 73 94 65 99.3 65.3C104.8 65.7 106 71.2 103.6 77.3Q100.1 87.4 93 94Q85.6 101.1 79.1 97.4" fill="${coat}"/>
            <ellipse cx="98" cy="73.1" rx="3.2" ry="3.9" fill="#e5aaa1" stroke="none"/>
          </g>
          <g class="ks-fox-book">
            <path d="M35 89Q46 86 57 93Q67 86 79 86L80 103Q68 103 60 110Q47 104 37 104Z" fill="#fff1cc" stroke-width="1.5"/>
            <path d="M33.5 91Q45 90 57 96Q68 89.7 81 89L80.5 105Q69 105 59.6 112Q45 106 35.4 107Z" fill="#4374b4" stroke="#344a61" stroke-width="1.9"/>
            <path d="M57.6 96.2L59.5 111.2M63.8 96.6L70.7 93.9" stroke="#c0d8e9" stroke-width="1.45"/>
            <path class="ks-fox-leaf" d="M57.2 94.4Q62.1 86.1 75.8 85.7L74.8 92.6Q63.4 94.3 58 98Z" fill="#fff8df" stroke="#ada084" stroke-width="1.1"/>
            <path d="M35.3 94.4C29.6 95.2 31.3 101.7 35.8 102.9C41.8 104.5 41.8 97.8 35.3 94.4ZM79 94.2C85 93.1 86.2 100.6 80.4 103.1C74.4 105.4 72.8 97.8 79 94.2Z" fill="${coat}" stroke-width="1.8"/>
          </g>
        </g>
      </g>
    </svg>`;
  }

  function attach({ source, pet }) {
    const reader = pet.closest('dialog');
    const faces = [source, pet].map((host, index) => {
      const sprite = host.querySelector('.ks-pet-sprite');
      sprite.innerHTML = character('ks-fox-' + index);
      const eyes = Array.from(sprite.querySelectorAll('.ks-fox-eye'), socket => ({
        socket, pupil: socket.querySelector('.ks-fox-pupil'),
      }));
      return {host, eyes};
    });
    let cursor = null;
    let frame = 0;
    let movingUntil = 0;

    function orientEyes() {
      frame = 0;
      if (document.hidden) return;
      const face = faces[reader?.open ? 1 : 0];
      for (const {socket, pupil} of face.eyes) {
        let x = 0, y = 0;
        if (cursor) {
          // Screen -> socket coordinates includes the book layout, dragging, and head tilt.
          const matrix = socket.getScreenCTM();
          if (!matrix || !(matrix.a * matrix.d - matrix.b * matrix.c)) continue;
          const target = cursor.matrixTransform(matrix.inverse());
          const radius = Math.max(22, Math.hypot(target.x, target.y));
          x = 3.4 * target.x / radius;
          y = 2.8 * target.y / radius;
        }
        pupil.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      }
      if (cursor && performance.now() < movingUntil) updateGaze();
    }
    function updateGaze() {
      if (!frame) frame = requestAnimationFrame(orientEyes);
    }
    function point(event) {
      cursor = event.pointerType === 'touch' ? null : new DOMPoint(event.clientX, event.clientY);
      updateGaze();
    }
    function restEyes() { cursor = null; updateGaze(); }
    // A stationary pointer is still a target as the head leans into a pat or lands.
    function trackMovingHead(event) {
      if (event.target.matches('.ks-fox-motion, .ks-fox-body, .ks-fox-head')) {
        movingUntil = performance.now() + (event.type === 'transitionstart' ? 250 : 1200);
        updateGaze();
      }
    }
    for (const {host} of faces) {
      host.addEventListener('animationstart', trackMovingHead);
      host.addEventListener('transitionstart', trackMovingHead);
    }
    for (const type of ['pointermove', 'pointerdown']) {
      window.addEventListener(type, point, {capture:true, passive:true});
    }
    window.addEventListener('pointerout', event => { if (!event.relatedTarget) restEyes(); });
    window.addEventListener('blur', restEyes);
    window.addEventListener('resize', updateGaze);
    document.addEventListener('scroll', updateGaze, {capture:true, passive:true});
    document.addEventListener('ks:reader', updateGaze);
    document.addEventListener('visibilitychange', () => { if (document.hidden) restEyes(); else updateGaze(); });
    return updateGaze;
  }

  window.KanshanCharacter = { attach };
})();

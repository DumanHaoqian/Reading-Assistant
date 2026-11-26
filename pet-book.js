(() => {
  'use strict';

  // Coordinates match the 192 px official resting pose. The spine joins the
  // far edge beside Kanshan's chest to the near edge between the two paws.
  const strips = 10;
  const turnDuration = 980;
  const pi = Math.PI;
  const fmt = point => point.map(n => n.toFixed(2)).join(' ');

  // Integrating the local tangent preserves the length of a sheet as it curls.
  // The near corner leads the far one when a paw picks up the page.
  function paperRow(turn, depth) {
    const phase = pi * turn;
    const bend = Math.sin(phase);
    const right = (1 + Math.cos(phase)) * .5;
    const width = (35 + 2.5 * depth) * (1 - right) + (32.5 + 6 * depth) * right;
    const startX = 100 - 1.7 * depth, startY = 126.5 + 12.5 * depth;
    let x = startX, height = 0;
    const result = [[startX, startY]];
    for (let i = 1; i <= strips; i++) {
      const u = (i - .5) / strips;
      const angle = phase + bend * ((1.7 * u - .72) + .66 * (depth - .5));
      x += width / strips * Math.cos(angle);
      height += width / strips * Math.sin(angle);
      const edge = i / strips;
      const arch = (6.3 + 1.9 * right) * edge + 1.65 * Math.sin(pi * edge);
      result.push([x, startY - height * .89 - arch]);
    }
    return result;
  }
  function curve(points) {
    let path = 'M' + fmt(points[0]);
    for (let i = 1; i < points.length - 1; i++) {
      const end = points[i].map((n, j) => (n + points[i + 1][j]) / 2);
      path += 'Q' + fmt(points[i]) + ' ' + fmt(end);
    }
    return path + 'L' + fmt(points[points.length - 1]);
  }
  function surface(far, near) {
    // Corners stay crisp while the top and bottom edges each describe a curve.
    return curve(far) + curve(near.slice().reverse()).replace('M', 'L') + 'Z';
  }
  function print(turn) {
    return [.26, .47, .68].map((depth, i) => curve(paperRow(turn, depth).slice(2, i === 2 ? 7 : 9))).join('');
  }
  function markup(id) {
    const url = name => 'url(#' + id + '-book-' + name + ')';
    const gradient = (name, stops, coords = '') => '<linearGradient id="' + id + '-book-' + name + '" ' + coords + '>' +
      stops.map(([offset, color]) => '<stop offset="' + offset + '" stop-color="' + color + '"/>').join('') + '</linearGradient>';
    const left = surface(paperRow(1, 0), paperRow(1, 1));
    const right = surface(paperRow(0, 0), paperRow(0, 1));
    // The lowered paws in the official idle frame extend below a held book.
    // Trim just their tips and reveal the sliver of tail they formerly covered.
    const leftTip = 'M55.3 134.3Q60 136.3 65.4 134.7Q70.7 138.5 70.4 144.3L67.6 146.5L65.5 150.7H54.7Z';
    const rightTip = 'M134.4 135Q137.9 137.5 142.6 133.7L143 149.4H131.6Q135.5 141.7 134.4 135Z';
    return `<g class="ks-fox-book" stroke="none" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        ${gradient('cloth', [[0,'#62839b'],[.22,'#476e8e'],[.6,'#355978'],[1,'#28455e']], 'x2=".34" y2="1"')}
        ${gradient('left-paper', [[0,'#f5eedb'],[.47,'#fffaf0'],[.86,'#ede3ce'],[1,'#b6a68e']])}
        ${gradient('right-paper', [[0,'#ac9b83'],[.1,'#e7dac2'],[.38,'#f5edda'],[1,'#fffaf0']])}
        ${gradient('leaf-front', [[0,'#c6b99e'],[.22,'#eee4ce'],[.61,'#fffdf3'],[1,'#f2e8d1']])}
        ${gradient('leaf-back', [[0,'#fbf5e4'],[.32,'#fffdf5'],[.83,'#e2d5bb'],[1,'#beb09a']])}
        <radialGradient id="${id}-book-paw" cx=".38" cy=".24" r=".85">
          <stop stop-color="#353432"/><stop offset=".57" stop-color="#191918"/><stop offset="1" stop-color="#0b0c0d"/>
        </radialGradient>
        <radialGradient id="${id}-book-contact"><stop stop-color="#453e37" stop-opacity=".4"/><stop offset="1" stop-color="#453e37" stop-opacity="0"/></radialGradient>
        <mask id="${id}-book-sleeves" maskUnits="userSpaceOnUse" x="0" y="0" width="192" height="192">
          <rect width="192" height="192" fill="white"/><path d="${leftTip}${rightTip}" fill="black"/>
        </mask>
        <clipPath id="${id}-book-tail"><path d="${leftTip}"/></clipPath>
        <clipPath id="${id}-book-spread"><path d="${left}${right}"/></clipPath>
      </defs>
      <path d="M48 132Q55.7 124 65.8 130.5Q67.1 140.6 56.9 145.2Q50.1 145.8 47.2 141.6Z" fill="#cdccca" clip-path="${url('tail')}"/>
      <ellipse cx="98" cy="141" rx="40" ry="9.2" fill="${url('contact')}"/>
      <path d="M62 120.2Q80 118.1 99.8 125Q116.8 116.7 133.7 116.6L139.2 131.1L137.3 140.6Q116 141.9 100.1 148.5Q98.4 149.5 95.7 148.3Q80.9 143.2 60.8 142L58.9 133.4Z" fill="${url('cloth')}" stroke="#2b445a" stroke-width="1.05"/>
      <path class="ks-book-spine" d="M98 138.3Q98.8 144.2 97.7 148.1" fill="none" stroke="#9db0b9" stroke-width="1.45"/>
      <path d="M61 140.4Q81.6 141.6 96.1 146.6M101.1 146.2Q117.4 139.3 136.9 139" fill="none" stroke="#7390a4" stroke-width=".66" opacity=".8"/>
      <path d="M62.8 120.4Q84 120.3 100 126.5Q116.5 118.3 132.5 118.3L137.3 132.5Q117.9 132.8 98.4 141.9Q77.2 134.1 60.8 134Z" fill="#c8baa2" stroke="#967f69" stroke-width=".55"/>
      <path d="M62.3 132.9Q78.5 132.4 98.3 140.5Q117.1 131.7 136.7 131.6" stroke="#f4e9cf" stroke-width=".75" fill="none"/>
      <path d="${left}" fill="${url('left-paper')}" stroke="#d3c7b0" stroke-width=".46"/>
      <path d="${right}" fill="${url('right-paper')}" stroke="#d3c7b0" stroke-width=".46"/>
      <path d="${print(0)}${print(1)}" fill="none" stroke="#a99d87" opacity=".67" stroke-width=".73"/>
      <path d="M113.8 133.2l1.5.1 1.8 4.5-1.9-.35-.95 1.3-1.5-5.25Z" fill="#ad6748"/>
      <g class="ks-book-sheet-group" display="none">
        <path class="ks-book-sheet-shadow" clip-path="${url('spread')}" fill="#584b40"/>
        <path class="ks-book-sheet" stroke="#baad96" stroke-width=".48" fill="${url('leaf-front')}"/>
        <path class="ks-book-sheet-print" stroke="#ac9d83" stroke-width=".61" opacity=".63" fill="none"/>
      </g>
      <g fill="${url('paw')}">
        <path class="ks-book-grip-left"/>
        <path class="ks-book-grip-right"/>
      </g>
    </g>`;
  }
  // The palm stays joined to its original forearm. The tip of the mitt rolls
  // over the page corner at pickup; the other paw catches the landing sheet.
  function grip(side, inward, rise) {
    const root = side === 1 ? 61 : 138;
    const hand = (across, down) => fmt([root + side * across, down]);
    const tip = (across, down) => hand(across + inward, down - rise);
    return 'M' + hand(-3.7,137) + 'Q' + hand(-4.6,133.6) + ' ' + tip(-1.8,132.1) +
      'Q' + tip(1.6,129.8) + ' ' + tip(4.7,130.9) + 'Q' + tip(6.4,132.1) + ' ' + tip(5.1,134.2) +
      'Q' + tip(4.2,135.6) + ' ' + tip(1.1,136.1) + 'Q' + hand(1.4,139.7) + ' ' + hand(-1.9,141.4) +
      'Q' + hand(-4.8,143.1) + ' ' + hand(-3.7,137) + 'Z';
  }
  function bind(svg) {
    const group = svg.querySelector('.ks-fox-book');
    const sheetGroup = group.querySelector('.ks-book-sheet-group');
    const sheet = group.querySelector('.ks-book-sheet');
    const ink = group.querySelector('.ks-book-sheet-print');
    const shadow = group.querySelector('.ks-book-sheet-shadow');
    const leftPaw = group.querySelector('.ks-book-grip-left');
    const rightPaw = group.querySelector('.ks-book-grip-right');
    const front = sheet.getAttribute('fill'), back = front.replace('leaf-front', 'leaf-back');
    function setTurn(progress, sign = 1) {
      const p = Math.min(1, Math.max(0, progress));
      const reverse = sign < 0;
      const pickup = Math.sin(pi * Math.min(1, p / .36)) ** 2;
      const catchPage = Math.sin(pi * Math.max(0, (p - .69) / .31)) ** 2;
      const lead = [6.7 * pickup, 10.7 * pickup], support = [2.2 * catchPage, 3 * catchPage];
      leftPaw.setAttribute('d', grip(1, ...(reverse ? lead : support)));
      rightPaw.setAttribute('d', grip(-1, ...(reverse ? support : lead)));
      if (p === 0 || p === 1) {
        sheetGroup.setAttribute('display', 'none');
        return;
      }
      // The initial hold gives the paw a moment to lift the free corner.
      const t = Math.max(0, Math.min(1, (p - .045) / .91));
      const swept = t * t * (3 - 2 * t);
      const turn = reverse ? 1 - swept : swept;
      const far = paperRow(turn, 0), near = paperRow(turn, 1);
      sheetGroup.removeAttribute('display');
      sheet.setAttribute('d', surface(far, near));
      sheet.setAttribute('fill', turn < .5 ? front : back);
      ink.setAttribute('d', print(turn));
      // Project the lifted sheet back onto the stationary leaves. The contact
      // shadow is strongest near the binding and disappears into either stack.
      const lift = Math.sin(pi * turn);
      const projected = (point, i, y) => [
        point[0] + 5 * lift * i / strips,
        y - 5.7 * i / strips + 1.1 * lift,
      ];
      shadow.setAttribute('d', surface(far.map((a,i) => projected(a,i,126.5)), near.map((a,i) => projected(a,i,139))));
      shadow.setAttribute('opacity', (.21 * lift).toFixed(3));
    }
    setTurn(0);
    return {setTurn};
  }
  window.KanshanBook = {markup, bind, turnDuration};
})();

(() => {
  'use strict';

  const reader = document.createElement('dialog');
  reader.className = 'ks-reader ks-marked';
  reader.setAttribute('aria-label', '看山陪读双页阅读器');
  const chevron = d => `<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
  reader.innerHTML = `
    <header class="ks-tools"><span class="ks-brand">知乎</span><span class="ks-title"></span>
      <button type="button" class="ks-exit">返回原文</button></header>
    <div class="ks-stage">
      <div class="ks-spread"></div>
      <button class="ks-turn ks-prev" aria-label="往前翻页">${chevron('m15 5-7 7 7 7')}</button>
      <button class="ks-turn ks-next" aria-label="往后翻页">${chevron('m9 5 7 7-7 7')}</button>
    </div>
    <footer class="ks-footer"><span class="ks-counter" aria-live="polite"></span>
      <button class="ks-mark" aria-pressed="true">重点标记</button>
      <div class="ks-font" role="group" aria-label="阅读字号"><span>字号</span>
        <button class="ks-smaller" aria-label="减小字号" aria-keyshortcuts="-" title="减小字号（−）">减小</button>
        <output aria-label="当前字号"></output>
        <button class="ks-larger" aria-label="增大字号" aria-keyshortcuts="+" title="增大字号（+）">增大</button></div>
    </footer>
    <div class="ks-body ks-probe" aria-hidden="true"></div>`;
  document.body.append(reader);
  const get = selector => reader.querySelector(selector);
  const spread = get('.ks-spread');
  for (let i = 0; i < 2; i++) {
    const leaf = document.createElement('section');
    leaf.className = 'ks-leaf';
    leaf.innerHTML = '<div class="ks-running"></div><div class="ks-body"></div><div class="ks-folio"></div>';
    spread.append(leaf);
  }
  const leaves = [...spread.children];
  const pageBody = leaves[0].querySelector('.ks-body');
  const probe = get('.ks-probe');
  const compact = matchMedia('(max-width:700px)');
  const step = () => compact.matches ? 1 : 2;
  const protectedContent = 'img,svg,math,video,iframe,canvas,table,pre,code,figure,.katex,mjx-container,[data-formula]';
  const fontPreference = 'kanshan.reader.font-size';
  const minFontSize = 12, maxFontSize = 28, defaultFontSize = 16;
  let source, blocks = [], pages = [], first = 0, frame = 0, fontSize = defaultFontSize;
  let anchor = { block: 0, offset: 0 };
  let previousOverflow, previousFocus;
  let markedInSource = false;
  const loadedMedia = new Set();

  // Character offsets refer to the original DOM, independent of layout, zoom and highlights.
  function textNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let node; (node = walker.nextNode());) if (node.length) nodes.push(node);
    return nodes;
  }
  function textPoint(nodes, offset) {
    for (let i = 0; i < nodes.length; i++) {
      if (offset < nodes[i].length || i === nodes.length - 1)
        return [nodes[i], Math.min(offset, nodes[i].length)];
      offset -= nodes[i].length;
    }
  }
  function offsetWithin(root, node, offset) {
    if (!node || !root.contains(node)) return 0;
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);
    return range.toString().length;
  }
  function caretAt(x,y) {
    if (document.caretPositionFromPoint) {
      const caret = document.caretPositionFromPoint(x,y);
      if (caret) return [caret.offsetNode, caret.offset];
    }
    const range = document.caretRangeFromPoint?.(x,y);
    return range && [range.startContainer,range.startOffset];
  }
  function currentSourceAnchor() {
    // Pick the first readable line below the site's header; a second-column entry button
    // must not change which source line the reader was looking at.
    const header = document.querySelector('body > header');
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const readingTop = Math.min(innerHeight * .25,Math.max(16,headerBottom+12));
    // A contents link can deliberately leave extra space above the heading
    // (scroll-padding plus scroll-margin). Honour that landing, not the previous line.
    const targetIndex = blocks.findIndex(({node}) => node.id && '#'+encodeURIComponent(node.id) === location.hash);
    if (targetIndex >= 0) {
      const target = blocks[targetIndex].node;
      const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const scrollMargin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      if (Math.abs(target.getBoundingClientRect().top-scrollPadding-scrollMargin) <= 8)
        return {block:targetIndex,offset:0};
    }
    for (let i = 0; i < blocks.length; i++) {
      const rect = blocks[i].node.getBoundingClientRect();
      if (!rect.height || rect.bottom <= readingTop) continue;
      if (rect.top >= readingTop) return {block:i, offset:0};
      const x = Math.min(rect.right - 2, Math.max(rect.left + 3, 3));
      for (let y = readingTop; y < Math.min(rect.bottom,innerHeight); y += 5) {
        const hit = caretAt(x,y);
        if (hit && blocks[i].node.contains(hit[0]))
          return {block:i, offset:offsetWithin(blocks[i].node,...hit)};
      }
      return {block:i, offset:0};
    }
    return {block:Math.max(0,blocks.length-1), offset:0};
  }
  function localHighlights(element) {
    if (markedInSource) return;
    const pattern = /D-OPSD|OPSD|反向散度|反向 KL|自蒸馏|蒸馏|采样|分布|监督信号|不再|并非/gi;
    let remaining = 2;
    for (const node of textNodes(element)) {
      if (!remaining) break;
      if (node.parentElement.closest('code,pre,math,svg,figure,.katex,mjx-container,mark,script,style,.formula')) continue;
      pattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let match, tail = 0;
      while (remaining && (match = pattern.exec(node.data))) {
        fragment.append(node.data.slice(tail,match.index));
        const mark = document.createElement('mark'); mark.textContent = match[0];
        fragment.append(mark);
        tail = pattern.lastIndex;
        remaining--;
      }
      if (tail) {fragment.append(node.data.slice(tail)); node.replaceWith(fragment)}
    }
  }
  function makeFragment(piece, display) {
    const block = blocks[piece.block];
    let clone;
    if (piece.start === 0 && piece.end === block.length) clone = block.node.cloneNode(true);
    else {
      clone = block.node.cloneNode(false);
      const range = document.createRange();
      range.setStart(...textPoint(block.nodes,piece.start));
      range.setEnd(...textPoint(block.nodes,piece.end));
      clone.append(range.cloneContents());
    }
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    for (const img of clone.querySelectorAll('img')) img.loading = 'eager';
    if (display) {
      clone.dataset.ksBlock = piece.block;
      clone.dataset.ksOffset = piece.start;
      localHighlights(clone);
    }
    return clone;
  }
  function pageContaining(position) {
    const index = pages.findIndex(page => page.some(p => p.block === position.block
      && position.offset >= p.start && (position.offset < p.end || p.end === blocks[p.block].length)));
    return index < 0 ? 0 : index;
  }
  function paint(direction = 0) {
    first = Math.floor(pageContaining(anchor)/step()) * step();
    for (let side=0; side<2; side++) {
      const number = first + side;
      const body = leaves[side].querySelector('.ks-body');
      const pieces = pages[number] || [];
      body.replaceChildren(...pieces.map(piece => makeFragment(piece,true)));
      body.scrollTop = 0;
      leaves[side].querySelector('.ks-folio').textContent = pieces.length ? '—　'+(number+1)+'　—' : '';
    }
    const end = Math.min(first + step(),pages.length);
    get('.ks-counter').textContent = '第 '+(first+1)+(end>first+1?'–'+end:'')+' / '+pages.length+' 页';
    get('.ks-prev').disabled = first === 0;
    get('.ks-next').disabled = end >= pages.length;
    spread.classList.remove('ks-forward','ks-back');
    if (direction) {void spread.offsetWidth; spread.classList.add(direction>0?'ks-forward':'ks-back')}
  }
  function paginate() {
    frame = 0;
    if (!reader.open || !blocks.length) return;
    // Match the actual page box, including its scrollbar gutter and fractional CSS pixels.
    const box = getComputedStyle(pageBody);
    probe.style.width = box.width;
    probe.style.height = box.height;
    const height = probe.clientHeight;
    if (!probe.clientWidth || !height) return;
    probe.replaceChildren();
    const result = [];
    let page = [];
    function flush() {
      if (page.length) result.push(page);
      page = []; probe.replaceChildren();
    }
    function fits(piece) {
      const el = makeFragment(piece,false);
      probe.append(el);
      const fitsHere = probe.scrollHeight <= height;
      el.remove();
      return fitsHere;
    }
    for (let index=0; index<blocks.length; index++) {
      const block = blocks[index];
      let start = 0;
      for (;;) {
        const whole = {block:index,start,end:block.length};
        if (fits(whole)) {page.push(whole);probe.append(makeFragment(whole,false));break}
        if (!block.splittable) {
          if (page.length) {flush();continue}
          // Oversize figures, formulae and tables stay intact. This page can scroll.
          page.push(whole);flush();break;
        }
        let lo=start+1, hi=block.length-1, best=start;
        while (lo<=hi) {
          const mid=Math.floor((lo+hi)/2);
          if (fits({block:index,start,end:mid})) {best=mid;lo=mid+1}
          else hi=mid-1;
        }
        if (best>start && /[\uD800-\uDBFF]/.test(block.text[best-1])) best--;
        // Keep an English word together when a bilingual paragraph crosses a page.
        const wordChar = /[\p{Script=Latin}\d]/u;
        if (best > start && wordChar.test(block.text.charAt(best))) {
          let boundary = best;
          while (boundary > start && wordChar.test(block.text.charAt(boundary - 1))) boundary--;
          if (boundary > start || page.length) best = boundary;
        }
        if (best===start) {
          if (page.length) {flush();continue}
          page.push(whole);flush();break;
        }
        page.push({block:index,start,end:best});
        flush();start=best;
      }
    }
    flush();
    pages=result;
    paint();
  }
  function queueLayout() {if (reader.open && !frame) frame=requestAnimationFrame(paginate)}
  function savedFontSize() {
    try {
      const value = Number(localStorage.getItem(fontPreference));
      if (Number.isInteger(value) && value >= minFontSize && value <= maxFontSize) return value;
    } catch { /* The reader also works when site storage is disabled. */ }
    return defaultFontSize;
  }
  function updateFont(size, remember = true) {
    fontSize = Math.min(maxFontSize, Math.max(minFontSize, size));
    reader.style.setProperty('--ks-text-size',fontSize+'px');
    get('.ks-font output').textContent = fontSize+' px';
    get('.ks-smaller').disabled = fontSize===minFontSize;
    get('.ks-larger').disabled = fontSize===maxFontSize;
    if (remember) {
      try {localStorage.setItem(fontPreference, String(fontSize))} catch { /* Keep the preference in memory. */ }
    }
    queueLayout();
  }
  function turn(direction) {
    const next=first+direction*step();
    if (!pages[next]) return;
    anchor={block:pages[next][0].block,offset:pages[next][0].start};paint(direction);
  }
  function restoreSource(position) {
    const block=blocks[position.block];if (!block?.node.isConnected) return;
    let rect=block.node.getBoundingClientRect();
    if (block.nodes.length && position.offset<=block.length) {
      const start=Math.min(position.offset,Math.max(0,block.length-1));
      const range=document.createRange();
      range.setStart(...textPoint(block.nodes,start));range.setEnd(...textPoint(block.nodes,Math.min(start+1,block.length)));
      const char=range.getBoundingClientRect();if (char.height>0) rect=char;
    }
    window.scrollBy({top:rect.top-innerHeight*.34,behavior:'instant'});
  }
  function openReader() {
    source = document.getElementById('article-body');
    if (!source || reader.open) return;
    blocks = [...source.children].filter(el =>
      !el.hidden && !el.matches('script,style,template,button') && el.getClientRects().length
    ).map(node => {
      const text=node.textContent || '';
      return {node,text,length:text.length,nodes:textNodes(node),
        splittable:text.length>1 && node.matches('p,blockquote,div,section')
          && !node.matches('.formula,.katex-display') && !node.querySelector(protectedContent+',h1,h2,h3,h4')};
    });
    if (!blocks.length) return;
    anchor=currentSourceAnchor();
    markedInSource=!!source.querySelector('mark');
    const title=document.querySelector('h1')?.textContent?.trim() || '知乎回答';
    const byline=document.querySelector('[data-reader-author]');
    leaves[0].querySelector('.ks-running').textContent=byline?.dataset.readerAuthor || byline?.textContent?.trim() || '知乎回答';
    leaves[1].querySelector('.ks-running').textContent=title;
    get('.ks-title').textContent=title;
    previousFocus=document.activeElement;previousOverflow=document.documentElement.style.overflow;
    reader.showModal();document.documentElement.style.overflow='hidden';
    paginate();
    document.fonts?.ready.then(queueLayout);
  }
  document.addEventListener('click',event=>{
    if (event.target.closest('#open-reader')) {event.preventDefault();openReader()}
  });
  get('.ks-exit').onclick=()=>reader.close();
  reader.addEventListener('close',()=>{
    cancelAnimationFrame(frame);frame=0;document.documentElement.style.overflow=previousOverflow;
    const position={...anchor};
    previousFocus?.focus({preventScroll:true});
    requestAnimationFrame(()=>{if (!reader.open) restoreSource(position)});
  });
  get('.ks-prev').onclick=()=>turn(-1);get('.ks-next').onclick=()=>turn(1);
  get('.ks-smaller').onclick=()=>updateFont(fontSize-1);get('.ks-larger').onclick=()=>updateFont(fontSize+1);
  get('.ks-mark').onclick=()=>{
    const marked=reader.classList.toggle('ks-marked');
    get('.ks-mark').setAttribute('aria-pressed',String(marked));
  };
  reader.addEventListener('keydown',event=>{
    if (event.altKey||event.metaKey||event.ctrlKey) return;
    const larger = event.key==='+' || (event.key==='=' && event.shiftKey);
    if (larger || event.key==='-' || event.key==='−') {
      event.preventDefault();updateFont(fontSize+(larger?1:-1));return;
    }
    if (event.shiftKey) return;
    if (['ArrowLeft','ArrowRight'].includes(event.key)) {event.preventDefault();turn(event.key==='ArrowRight'?1:-1)}
  });
  // Clicking a line on the right-hand page makes that exact line the return position.
  spread.addEventListener('click',event=>{
    const el=event.target.closest('[data-ks-block]');if (!el) return;
    const hit=caretAt(event.clientX,event.clientY);
    anchor={block:Number(el.dataset.ksBlock),offset:Number(el.dataset.ksOffset)+(hit?offsetWithin(el,...hit):0)};
  });
  let gesture;
  spread.addEventListener('touchstart',e=>{
    const scroller=e.target.closest('pre,table,.equation,.formula,.katex-display');
    gesture=e.touches.length===1 && !(scroller && scroller.scrollWidth>scroller.clientWidth+1)
      ? [e.touches[0].clientX,e.touches[0].clientY] : null;
  },{passive:true});
  spread.addEventListener('touchend',e=>{
    if (!gesture) return;
    const dx=e.changedTouches[0].clientX-gesture[0],dy=e.changedTouches[0].clientY-gesture[1];
    gesture=null;
    if (Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.6) turn(dx<0?1:-1);
  },{passive:true});
  spread.addEventListener('touchcancel',()=>{gesture=null});
  reader.addEventListener('load',event=>{
    const url=event.target.currentSrc;
    if (url && !loadedMedia.has(url)) {loadedMedia.add(url);queueLayout()}
  },true);
  // A long figure may scroll inside a page without changing the book's dimensions.
  new ResizeObserver(queueLayout).observe(pageBody, {box:'border-box'});
  compact.addEventListener('change',queueLayout);
  window.addEventListener('storage', event => {
    if (event.key === fontPreference || event.key === null) updateFont(savedFontSize(), false);
  });
  updateFont(savedFontSize(), false);
})();

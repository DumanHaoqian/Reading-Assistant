(() => {
  'use strict';

  const reader = document.createElement('dialog');
  reader.className = 'ks-reader ks-marked';
  reader.setAttribute('aria-label', '看山陪读双页阅读器');
  reader.setAttribute('aria-describedby', 'ks-article-title');
  const icon = d => `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="${d}"/></svg>`;
  reader.innerHTML = `
    <header class="ks-tools">
      <span class="ks-imprint"><img class="ks-brand" src="assets/zhihu-logo.png" alt="知乎"><span class="ks-product">看山陪读</span></span>
      <span class="ks-title" id="ks-article-title"></span>
      <button type="button" class="ks-exit" aria-keyshortcuts="Escape" title="返回原文（Esc）">${icon('m10 6-6 6 6 6M4 12h16')}返回原文</button>
    </header>
    <div class="ks-stage">
      <div class="ks-volume">
        <div class="ks-spread"></div>
        <button type="button" class="ks-contents-toggle" aria-expanded="false" aria-controls="ks-contents" aria-label="章节目录" title="章节目录">
          ${icon('M5 6h2m3 0h9M5 12h2m3 0h9M5 18h2m3 0h9')}<span class="ks-contents-label">目录</span>
        </button>
        <nav class="ks-contents" id="ks-contents" aria-labelledby="ks-contents-title" hidden>
          <h2 class="ks-contents-title" id="ks-contents-title">章节目录</h2><ol class="ks-contents-list"></ol>
        </nav>
      </div>
      <button class="ks-turn ks-prev" aria-label="往前翻页" aria-keyshortcuts="ArrowLeft" title="往前翻页（←）">${icon('M15 5 L8 12 L15 19')}</button>
      <button class="ks-turn ks-next" aria-label="往后翻页" aria-keyshortcuts="ArrowRight" title="往后翻页（→）">${icon('M9 5 L16 12 L9 19')}</button>
    </div>
    <footer class="ks-footer">
      <div class="ks-progress"><span class="ks-counter-box"><span class="ks-counter" aria-live="polite"></span></span>
        <input class="ks-progress-slider" type="range" min="1" max="1" value="1"
          aria-label="阅读进度" title="拖动跳页，也可以用左右方向键微调" disabled>
      </div>
      <div class="ks-modes" role="group" aria-label="阅读标记">
        <button class="ks-mark" aria-pressed="true">${icon('m5 15 9-10 5 5-9 10-5-5Zm0 0-2 6 7-1M11 8l5 5')}<span>重点</span></button>
        <button class="ks-follow" aria-label="跟读" aria-pressed="false" title="点选当前句，用上下键逐句移动">${icon('M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M7 12h10')}跟读</button>
        <span class="ks-sentence-nav" role="group" aria-label="逐句移动" hidden>
          <button class="ks-sentence-prev" aria-label="上一句" aria-keyshortcuts="ArrowUp" title="上一句（↑）">${icon('M12 20V4 M5 11 L12 4 L19 11')}</button>
          <button class="ks-sentence-next" aria-label="下一句" aria-keyshortcuts="ArrowDown" title="下一句（↓）">${icon('M12 4V20 M5 13 L12 20 L19 13')}</button>
        </span>
      </div>
      <div class="ks-font" role="group" aria-label="阅读字号"><span>字号</span>
        <button class="ks-smaller" aria-label="减小字号" aria-keyshortcuts="-" title="减小字号（−）">−</button>
        <output aria-label="当前字号"></output>
        <button class="ks-larger" aria-label="增大字号" aria-keyshortcuts="+" title="增大字号（+）">+</button></div>
    </footer>
    <div class="ks-body ks-probe" aria-hidden="true"></div>`;
  document.body.append(reader);
  const get = selector => reader.querySelector(selector);
  const spread = get('.ks-spread');
  const progressSlider = get('.ks-progress-slider');
  const contents = get('.ks-contents');
  const contentsToggle = get('.ks-contents-toggle');
  const contentsList = get('.ks-contents-list');
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
  let sentences = [], currentSentence = -1, following = false;
  let chapters = [];
  let companionActive = false;
  let visibleSpread = { signature: '', text: '' };
  let lastExit = null, sourceMoved = false, sourceY = window.scrollY;
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', {granularity:'sentence'}) : null;
  const followHighlight = 'ks-follow-sentence';
  const loadedMedia = new Set();

  function notifyCompanion(type, extra = {}) {
    if (companionActive) {
      document.dispatchEvent(new CustomEvent('ks:reader', {
        detail: { type, ...visibleSpread, following, ...extra },
      }));
    }
  }

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
  function textRange(nodes,start,end) {
    const range=document.createRange();
    range.setStart(...textPoint(nodes,start));
    range.setEnd(...textPoint(nodes,end));
    return range;
  }
  function indexSentences() {
    const result=[];
    blocks.forEach((block,index)=>{
      let offset=0, lastGroup=null, runStart=0, run='';
      function finishRun() {
        const segments=segmenter ? segmenter.segment(run) : Array.from(
          run.matchAll(/[^。！？!?]+(?:[。！？!?]+[”’」』）)]*)?|[。！？!?]+/gu),
          match=>({index:match.index,segment:match[0]}));
        for (const part of segments) {
          if (!part.segment.trim()) continue;
          const start=runStart+part.index+(part.segment.length-part.segment.trimStart().length);
          const end=runStart+part.index+part.segment.trimEnd().length;
          result.push({block:index,start,end});
        }
        run='';lastGroup=null;
      }
      for (const node of block.nodes) {
        const parent=node.parentElement;
        const excluded=parent.closest('table,pre,svg,script,style,.equation,.formula,.katex-display');
        const group=parent.closest('p,li,figcaption,h1,h2,h3,h4,h5,h6,blockquote') || block.node;
        if (excluded || (parent.closest('figure') && !parent.closest('figcaption'))) {
          if (run) finishRun();
        } else {
          if (group!==lastGroup) {if (run) finishRun();runStart=offset;lastGroup=group}
          // Protect punctuation inside inline formulae and URLs while preserving UTF-16 offsets.
          const literal=parent.closest('math,code,.katex,mjx-container') ||
            (parent.closest('a') && /^https?:\/\//i.test(parent.closest('a').textContent.trim()));
          run+=literal ? node.data.replace(/[^\s]/g,'x') : node.data;
        }
        offset+=node.length;
      }
      if (run) finishRun();
    });
    return result;
  }
  function sentenceAt(position) {
    return sentences.findIndex(s=>s.block===position.block && s.start<=position.offset && position.offset<s.end);
  }
  function chooseVisibleSentence() {
    currentSentence=sentenceAt(anchor);
    if (currentSentence>=0) return;
    const startPage=Math.floor(pageContaining(anchor)/step())*step();
    for (const page of pages.slice(startPage,startPage+step())) for (const piece of page) {
      if (piece.block<anchor.block) continue;
      const from=piece.block===anchor.block ? Math.max(anchor.offset,piece.start) : piece.start;
      if (from>=piece.end) continue;
      const index=sentences.findIndex(s=>s.block===piece.block && s.start<piece.end && s.end>from);
      if (index===-1) continue;
      currentSentence=index;
      anchor={block:piece.block,offset:Math.max(from,sentences[index].start)};
      return;
    }
  }
  function adjacentSentence(direction) {
    if (currentSentence>=0) return currentSentence+direction;
    // A spread consisting entirely of tables or figures can sit between two sentences.
    const next=sentences.findIndex(s=>s.block>anchor.block ||
      (s.block===anchor.block && s.start>=anchor.offset));
    return (next<0 ? sentences.length : next)+(direction<0 ? -1 : 0);
  }
  function renderFollow(showSource=false) {
    if (!window.CSS?.highlights) return;
    CSS.highlights.delete(followHighlight);
    const sentence=sentences[currentSentence];
    get('.ks-sentence-prev').disabled=!sentences[adjacentSentence(-1)];
    get('.ks-sentence-next').disabled=!sentences[adjacentSentence(1)];
    if (!following || !sentence) return;
    let ranges=[];
    if (showSource) {
      ranges=[textRange(blocks[sentence.block].nodes,sentence.start,sentence.end)];
    } else {
      for (const leaf of leaves.slice(0,step())) {
        const piece=leaf.querySelector('[data-ks-block="'+sentence.block+'"]');
        if (!piece) continue;
        const base=Number(piece.dataset.ksOffset), end=base+piece.textContent.length;
        const a=Math.max(sentence.start,base), b=Math.min(sentence.end,end);
        if (b<=a) continue;
        const nodes=textNodes(piece);
        ranges.push(textRange(nodes,a-base,b-base));
        // An indivisible block (e.g. prose around math) can scroll inside a book page.
        const body=leaf.querySelector('.ks-body');
        if (body.scrollHeight>body.clientHeight && anchor.offset>=a && anchor.offset<b) {
          const local=anchor.offset-base;
          const line=textRange(nodes,local,local+1).getBoundingClientRect(), box=body.getBoundingClientRect();
          if (line.top<box.top || line.bottom>box.bottom) body.scrollTop+=line.top-box.top-body.clientHeight*.25;
        }
      }
    }
    if (ranges.length) CSS.highlights.set(followHighlight,new Highlight(...ranges));
  }
  function pinKey() {
    return 'kanshan.reader.sentence:'+location.pathname+':'+(new URLSearchParams(location.search).get('sample')||'d-opsd');
  }
  function pinQuote(position) {
    const block = blocks[position.block];
    if (!block || position.offset < 0 || position.offset > block.length) return null;
    const sentence = sentences[sentenceAt(position)];
    if (sentence) return block.text.slice(sentence.start, sentence.end);
    // A new page can also begin with a figure, table or space between sentences.
    return JSON.stringify([block.node.localName, block.text.slice(0, 96), block.node.querySelector('img')?.getAttribute('src')]);
  }
  function rememberPin() {
    try {
      localStorage.setItem(pinKey(),JSON.stringify({...anchor,quote:pinQuote(anchor),sourceY:scrollY}));
    } catch { /* The in-document return position also works without storage. */ }
  }
  function resumePin() {
    const key=pinKey();
    if (lastExit?.key===key) return Math.abs(scrollY-lastExit.sourceY)<=16 ? lastExit.position : null;
    if (sourceMoved || location.hash) return null;
    let pin;
    try {pin=JSON.parse(localStorage.getItem(key))} catch {return null}
    if (!pin || !Number.isInteger(pin.block) || !Number.isInteger(pin.offset)) return null;
    if (typeof pin.quote!=='string' || pinQuote(pin)!==pin.quote) return null;
    const unchanged=Math.abs(scrollY-pin.sourceY)<=16;
    return unchanged || scrollY<1 ? {block:pin.block,offset:pin.offset} : null;
  }
  function moveSentence(direction) {
    const index=adjacentSentence(direction),next=sentences[index];if (!following || !next) return;
    currentSentence=index;
    anchor={block:next.block,offset:next.start};
    const page=pageContaining(anchor);
    if (page<first || page>=first+step()) paint(direction);
    else renderFollow();
    rememberPin();
  }
  function makeFragment(piece, display) {
    const block = blocks[piece.block];
    let clone;
    if (piece.start === 0 && piece.end === block.length) clone = block.node.cloneNode(true);
    else {
      clone = block.node.cloneNode(false);
      const range=textRange(block.nodes,piece.start,piece.end);
      let content=range.cloneContents();
      // cloneContents omits its common ancestor, which can itself be a semantic mark or a link.
      let common=range.commonAncestorContainer;
      if (common.nodeType===Node.TEXT_NODE) common=common.parentElement;
      while (common && common!==block.node) {
        const shell=common.cloneNode(false);
        shell.append(content);content=shell;common=common.parentElement;
      }
      clone.append(content);
    }
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
    for (const img of clone.querySelectorAll('img')) img.loading = 'eager';
    if (display) {
      clone.dataset.ksBlock = piece.block;
      clone.dataset.ksOffset = piece.start;
    }
    return clone;
  }
  function pageContaining(position) {
    const index = pages.findIndex(page => page.some(p => p.block === position.block
      && position.offset >= p.start && (position.offset < p.end || p.end === blocks[p.block].length)));
    return index < 0 ? 0 : index;
  }
  function chapterAt(block) {
    return chapters.findLast(chapter => chapter.block <= block);
  }
  function updateChapterSelection() {
    const active = chapterAt(anchor.block);
    for (const chapter of chapters) {
      if (chapter === active) chapter.button.setAttribute('aria-current', 'location');
      else chapter.button.removeAttribute('aria-current');
    }
  }
  function setContents(open, restoreFocus = true) {
    contents.hidden = !open;
    contentsToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      updateChapterSelection();
      const current = contentsList.querySelector('[aria-current]') || contentsList.querySelector('button');
      current?.focus();
    } else if (restoreFocus) contentsToggle.focus({preventScroll:true});
    notifyCompanion('contents', { open });
  }
  function buildContents() {
    chapters = [];
    contentsList.replaceChildren();
    blocks.forEach(({node, text}, block) => {
      if (!node.matches('h1,h2,h3,h4,h5,h6') || !text.trim()) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.ksChapter = String(block);
      button.textContent = text.trim();
      button.addEventListener('click', () => {
        const previous = first;
        anchor = {block, offset:0};
        if (following) chooseVisibleSentence();
        const destination = Math.floor(pageContaining(anchor) / step()) * step();
        paint(Math.sign(destination - previous));
        rememberPin();
        setContents(false);
      });
      const item = document.createElement('li');
      item.append(button);
      contentsList.append(item);
      chapters.push({block, title:button.textContent, button});
    });
    contentsToggle.hidden = !chapters.length;
    setContents(false, false);
  }
  function paint(direction = 0) {
    first = Math.floor(pageContaining(anchor)/step()) * step();
    for (let side=0; side<2; side++) {
      const number = first + side;
      const body = leaves[side].querySelector('.ks-body');
      const pieces = pages[number] || [];
      body.replaceChildren(...pieces.map(piece => makeFragment(piece,true)));
      body.scrollTop = 0;
      leaves[side].querySelector('.ks-folio').textContent = pieces.length ? String(number+1).padStart(2,'0') : '';
      if (side === 1) {
        const chapter = pieces.length && (chapterAt(pieces[0].block) || chapterAt(pieces[pieces.length-1].block));
        leaves[side].querySelector('.ks-running').textContent = pieces.length ? chapter?.title || get('.ks-title').textContent : '';
      }
    }
    const end = Math.min(first + step(),pages.length);
    // Original text offsets keep a page's clock stable across repeated layout passes.
    const firstPiece = pages[first]?.[0];
    const lastPiece = pages[end - 1]?.at(-1);
    if (firstPiece && lastPiece) {
      const signature = [firstPiece.block, firstPiece.start, lastPiece.block, lastPiece.end].join(':');
      if (visibleSpread.signature !== signature) {
        const text = leaves.slice(0, end - first).map(leaf => leaf.querySelector('.ks-body').innerText).join('\n');
        visibleSpread = { signature, text };
      }
    }
    const pageLabel = '第 '+(first+1)+(end>first+1?'–'+end:'')+' / '+pages.length+' 页';
    get('.ks-counter').textContent = pageLabel;
    // Reserve the widest folio number so the slider does not move under the pointer.
    const widest = String(pages.length);
    get('.ks-counter-box').dataset.sizingLabel = '第 '+widest+(step() === 2 ? '–'+widest : '')+' / '+widest+' 页';
    const spreadCount = Math.ceil(pages.length / step());
    const currentSpread = first / step() + 1;
    progressSlider.disabled = spreadCount <= 1;
    progressSlider.min = spreadCount > 1 ? 1 : 0;
    progressSlider.max = spreadCount;
    progressSlider.value = currentSpread;
    progressSlider.setAttribute('aria-valuetext', pageLabel);
    const fraction = spreadCount > 1 ? (currentSpread - 1) / (spreadCount - 1) : 1;
    progressSlider.style.setProperty('--ks-progress', (fraction * 100) + '%');
    updateChapterSelection();
    get('.ks-prev').disabled = first === 0;
    get('.ks-next').disabled = end >= pages.length;
    renderFollow();
    spread.classList.remove('ks-forward','ks-back');
    if (direction) {void spread.offsetWidth; spread.classList.add(direction>0?'ks-forward':'ks-back')}
    notifyCompanion(direction ? 'turn' : 'page', { direction });
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
  function showPage(next, direction) {
    if (!pages[next] || next === first) return;
    anchor={block:pages[next][0].block,offset:pages[next][0].start};
    if (following) chooseVisibleSentence();
    paint(direction);
  }
  function turn(direction) {
    showPage(first+direction*step(), direction);
    rememberPin();
  }
  let scrubStart = null;
  progressSlider.addEventListener('input', () => {
    if (scrubStart === null) scrubStart = first;
    showPage((progressSlider.valueAsNumber - 1) * step(), 0);
  });
  progressSlider.addEventListener('change', () => {
    // Scrub without a flip animation; acknowledge the completed turn just once.
    if (scrubStart !== null && scrubStart !== first) {
      notifyCompanion('turn', {direction:Math.sign(first - scrubStart)});
      rememberPin();
    }
    scrubStart = null;
  });
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
    buildContents();
    sentences=indexSentences();
    anchor=resumePin() || currentSourceAnchor();
    currentSentence=sentenceAt(anchor);
    get('.ks-follow').disabled=!sentences.length || !window.CSS?.highlights || !window.Highlight;
    const mark = get('.ks-mark');
    mark.disabled = !source.querySelector('mark[data-ks-key]');
    mark.querySelector('span').textContent = mark.disabled ? '无重点' : '重点';
    mark.title = mark.disabled ? '本文未提取到重点' : '标出与文章主题相关的原句或短语';
    const marked = !mark.disabled && reader.classList.contains('ks-marked');
    mark.setAttribute('aria-pressed', String(marked));
    document.documentElement.classList.toggle('ks-source-marked',marked);
    const title=document.querySelector('h1')?.textContent?.trim() || '知乎回答';
    const byline=document.querySelector('[data-reader-author]');
    leaves[0].querySelector('.ks-running').textContent=byline?.dataset.readerAuthor || byline?.textContent?.trim() || '知乎回答';
    get('.ks-title').textContent=title;
    get('.ks-title').title=title;
    previousFocus=document.activeElement===document.body ? document.querySelector('#open-reader') : document.activeElement;
    previousOverflow=document.documentElement.style.overflow;
    visibleSpread = { signature: '', text: '' };
    reader.showModal();document.documentElement.style.overflow='hidden';
    paginate();
    if (following) {chooseVisibleSentence();renderFollow()}
    companionActive = true;
    notifyCompanion('open');
    document.fonts?.ready.then(queueLayout);
  }
  document.addEventListener('click',event=>{
    if (event.target.closest('#open-reader')) {event.preventDefault();openReader()}
  });
  get('.ks-exit').onclick=()=>reader.close();
  contentsToggle.addEventListener('click', () => setContents(contents.hidden));
  reader.addEventListener('pointerdown', event => {
    if (!contents.hidden && !contents.contains(event.target) && !contentsToggle.contains(event.target)) setContents(false);
  });
  reader.addEventListener('focusin', event => {
    if (!contents.hidden && !contents.contains(event.target) && event.target !== contentsToggle) setContents(false, false);
  });
  reader.addEventListener('cancel', event => {
    if (!contents.hidden) {
      event.preventDefault();
      setContents(false);
    }
  });
  reader.addEventListener('close',()=>{
    notifyCompanion('close');
    companionActive = false;
    cancelAnimationFrame(frame);frame=0;document.documentElement.style.overflow=previousOverflow;
    const position={...anchor};
    lastExit={key:pinKey(),position,sourceY:scrollY};
    previousFocus?.focus({preventScroll:true});
    renderFollow(true);
    requestAnimationFrame(()=>{
      if (reader.open) return;
      restoreSource(position);
      sourceY=scrollY;lastExit.sourceY=sourceY;sourceMoved=false;rememberPin();
    });
  });
  window.addEventListener('scroll',()=>{
    if (!reader.open && Math.abs(scrollY-sourceY)>16) sourceMoved=true;
  },{passive:true});
  get('.ks-prev').onclick=()=>turn(-1);get('.ks-next').onclick=()=>turn(1);
  get('.ks-smaller').onclick=()=>updateFont(fontSize-1);get('.ks-larger').onclick=()=>updateFont(fontSize+1);
  get('.ks-mark').onclick=()=>{
    const marked=reader.classList.toggle('ks-marked');
    get('.ks-mark').setAttribute('aria-pressed',String(marked));
    document.documentElement.classList.toggle('ks-source-marked',marked);
  };
  get('.ks-follow').onclick=()=>{
    following=!following;
    reader.classList.toggle('ks-following',following);
    get('.ks-follow').setAttribute('aria-pressed',String(following));
    get('.ks-sentence-nav').hidden=!following;
    if (following) chooseVisibleSentence();
    renderFollow();rememberPin();
    notifyCompanion('follow');
  };
  get('.ks-sentence-prev').onclick=()=>moveSentence(-1);
  get('.ks-sentence-next').onclick=()=>moveSentence(1);
  reader.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey ||
      event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (!contents.hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setContents(false);
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const current = chapters.findIndex(chapter => chapter.button === document.activeElement);
        const next = Math.min(chapters.length-1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
        chapters[next]?.button.focus();
      }
      return;
    }
    const larger = event.key==='+' || (event.key==='=' && event.shiftKey);
    if (larger || event.key==='-' || event.key==='−') {
      event.preventDefault();updateFont(fontSize+(larger?1:-1));return;
    }
    if (event.shiftKey) return;
    if (following && (event.key==='ArrowUp' || event.key==='ArrowDown')) {
      event.preventDefault();moveSentence(event.key==='ArrowUp'?-1:1);return;
    }
    if (['ArrowLeft','ArrowRight'].includes(event.key)) {event.preventDefault();turn(event.key==='ArrowRight'?1:-1)}
  });
  // Clicking a line on the right-hand page makes that exact line the return position.
  spread.addEventListener('click',event=>{
    if (event.target.closest('a,button,input,textarea,select')) return;
    if (window.getSelection()?.toString()) return;
    const el=event.target.closest('[data-ks-block]');if (!el) return;
    const hit=caretAt(event.clientX,event.clientY);
    if (!hit || !el.contains(hit[0])) return;
    const base=Number(el.dataset.ksOffset);
    const offset=Math.min(Math.max(0,el.textContent.length-1),offsetWithin(el,...hit));
    const point={block:Number(el.dataset.ksBlock),offset:base+offset};
    if (following) {
      const index=sentenceAt(point);
      if (index<0 || event.target.closest('img,svg,math,mjx-container,.katex,canvas,video,iframe,table,pre')) return;
      currentSentence=index;
    }
    anchor=point;
    if (following) {renderFollow();rememberPin()}
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
  if (new URLSearchParams(location.search).get('reader') === '1') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.querySelector('#sample-library[open]')) requestAnimationFrame(openReader);
    }, {once: true});
  }
})();

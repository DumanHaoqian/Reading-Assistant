(() => {
  'use strict';

  const screenshotCards = [
    {title:'超分辨率图像重建原理是什么？',author:'叫我Alonzo就好了',cover:'assets/home/super-resolution.webp',excerpt:'超分究竟在做什么？很简单——把图像长宽放大 4 倍，每 16 个像素，就有 15 个原图里根本没有出现过。这就是超分。要想看懂这个课题在做什么，只需要顺着两条主线往下捋：一条是这个任务的基…',upvotes:4,favorites:6},
    {title:'雄激素性脱发自救：科学降低 DHT，让萎缩毛囊重新长出粗硬头发',author:'我又可以了',excerpt:'先说原因：脱发跟饮食、洗发水、熬夜没一点关系！《cell》已经实锤：雄脱 90% 源于 DHT 攻击毛囊，导致毛囊萎缩、头发变细变软，最终脱…',upvotes:1487,comments:227,favorites:2094,likes:101},
    {title:'男朋友要被裁员了，我该怎么相处？',author:'往事随风1',excerpt:'去年被裁员，gap 了整整一个月，见识到了我老婆的两幅面孔 被裁员前：孩子的早饭我起来做，家用电器有问题都是我来搞 我家女孩，说出来也不怕大家笑…',upvotes:'1.5 万',comments:1632,favorites:1393,likes:446},
    {title:'为什么现在文科被贬得近乎“一文不值”？',author:'阿磊',excerpt:'看到大家都在骂文科我就放心了。真的，因为我学文科，…'}
  ];
  const offlineCards = [
    {sampleId:'d-opsd',title:'如何评价 D-OPSD，少步扩散模型为什么会在继续微调后丢失少步生成能力？',author:'叫我Alonzo就好了',excerpt:'经过步数蒸馏的扩散模型可以用少量去噪步骤生成图像，但继续在加噪真实图像上进行常规监督微调，可能使训练状态偏离模型自身的少步采样分布。',cover:'assets/figure-1.png',upvotes:13,favorites:16},
    {sampleId:'su-yang',title:'2022 岁末总结',author:'苏洋',excerpt:'苏洋回顾 2022 年的开源项目、技术写作、职业选择与日常生活。',url:'https://zhuanlan.zhihu.com/p/595291507',upvotes:144},
    {sampleId:'atr',title:'ATR（飞机公司）/ ATR (aircraft manufacturer)',author:'辽观 译编',excerpt:'从分布在意大利和法国的工厂，到 ATR 42 的第一次飞行。',url:'https://zhuanlan.zhihu.com/p/714444577',upvotes:1},
    {sampleId:'lu-xun',title:'我们现在怎样做父亲',author:'鲁迅',excerpt:'1919 年，鲁迅从父子关系谈到长者对下一代的责任。',url:'https://zhuanlan.zhihu.com/p/628096341'}
  ];
  const captured = Array.isArray(window.ZHIHU_FEED) ? window.ZHIHU_FEED.filter(row => row && row.title) : [];
  function headline(text) {
    return text.replace(/[ \s？?！!，,。：“”「」"《》]/gu,'').toLowerCase();
  }
  // A question may have multiple answers; match the byline before using a screenshot thumbnail.
  function sameArticle(card, other) {
    return (card.url && card.url === other.url) ||
      (card.author && other.author && headline(card.title) === headline(other.title) &&
       headline(card.author) === headline(other.author));
  }
  const recommendations = captured.length ? captured.map(card => {
    const reference = screenshotCards.find(other => sameArticle(card,other));
    return reference && !card.cover ? {...card,cover:reference.cover} : card;
  }) : screenshotCards;
  const cards = [...recommendations, ...offlineCards.filter(card => !recommendations.some(other => sameArticle(card,other)))];
  const bodies = new Map((window.ZHIHU_OFFLINE_ARTICLES || []).map(article => [article.id,article.bodyHtml]));
  const localSources = new Map();
  for (const card of cards) {
    if (!card.sampleId || !sourceUrl(card)) continue;
    const source = new URL(card.url);
    localSources.set(source.origin + source.pathname,destination(card));
  }
  const terms = [
    ['美军受控引爆5吨劣化叠氮…',487,'热'], ['余文乐自曝躯体化严重到…',486,'热'], ['DeepSeek 调整 API 定价',363,'热'],
    ['「画地为牢」名场面完整…',360,'新'], ['蔡磊已进渐冻症终末期',358,'新'], ['年轻人开始劝父母卖县城…',356,'热'],
    ['上海大学生宿舍坠亡两日…',344,'热'], ['黄仁勋恢复英伟达总裁 CE…',336,'热'], ['网传 Anthropic 称因数分…',296,'热'], ['付鹏称小红书美女关注资…',280,'热']
  ];
  const stream = document.getElementById('recommendations');
  const searchForm = document.getElementById('home-search');
  const note = document.getElementById('search-note');
  const status = document.getElementById('home-status');
  const pet = document.querySelector('.home-pet');
  const petIcon = pet.querySelector('img');
  const nativeIcon = petIcon.getAttribute('src');
  function renderPetAppearance() {
    const { size, mirrored } = window.KanshanAppearance;
    const customized = size !== 100 || mirrored;
    pet.classList.toggle('customized', customized);
    petIcon.setAttribute('src', customized ? 'assets/kanshan/official-idle-poster.webp' : nativeIcon);
  }
  renderPetAppearance();
  document.addEventListener('ks:appearance', renderPetAppearance);
  let statusTimer;
  const preferences = new Map();
  try {
    for (const item of JSON.parse(localStorage.getItem('kanshan.feed.preferences') || '[]')) preferences.set(...item);
  } catch { /* Preferences remain available in memory when storage is restricted. */ }

  function el(name, value, className) {
    const node = document.createElement(name);
    if (value != null) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function sourceUrl(card) {
    try {
      const url = new URL(card.url);
      if (/^https?:$/.test(url.protocol)) return url.href;
    } catch { /* Screenshot-only titles can be looked up on Zhihu. */ }
    return '';
  }
  function searchUrl(text) { return 'https://www.zhihu.com/search?type=content&q=' + encodeURIComponent(text); }
  function destination(card) { return card.sampleId ? 'index.html?sample=' + encodeURIComponent(card.sampleId) : sourceUrl(card) || searchUrl(card.title); }
  function link(text, url, className) {
    const a = el('a',text,className);
    a.href = url;
    return a;
  }
  function stateKey(card) { return card.sampleId || sourceUrl(card) || card.title + ' / ' + (card.author || ''); }
  function save() {
    try { localStorage.setItem('kanshan.feed.preferences', JSON.stringify([...preferences])); } catch { /* In-memory preferences still apply. */ }
  }
  function tell(text) {
    clearTimeout(statusTimer);
    status.textContent = text;
    statusTimer = setTimeout(() => { status.textContent = ''; }, 1700);
  }
  async function share(card) {
    const url = new URL(destination(card), location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      tell('链接已复制');
    } catch {
      const input = document.getElementById('share-url');
      input.value = url;
      document.getElementById('share-dialog').showModal();
      input.select();
    }
  }

  function showCard(card) {
    const id = stateKey(card);
    const prefs = preferences.get(id) || {};
    const dest = destination(card);
    const article = el('article',null,'feed-card');
    if (card.sampleId) article.dataset.sampleId = card.sampleId;
    const heading = el('h2');
    heading.append(link(card.title, dest));
    const summary = el('div',null,'feed-summary');
    if (card.cover && (/^assets\//.test(card.cover) || /^https?:\/\//i.test(card.cover))) {
      const thumb = link(null,dest,'feed-thumb');
      thumb.setAttribute('aria-hidden','true');
      thumb.tabIndex = -1;
      const image = el('img');
      image.alt = '';
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => thumb.remove(), {once:true});
      image.src = card.cover;
      thumb.append(image);
      summary.append(thumb);
    }
    const intro = el('div',null,'feed-intro');
    const preview = el('span',null,'preview-text');
    const lead = link(null, dest, 'preview-link');
    if (card.author) lead.append(el('span', card.author + '： '));
    lead.append(document.createTextNode(card.excerpt || ''));
    if (lead.textContent) preview.append(lead);
    const body = bodies.get(card.sampleId);
    const expand = body ? el('button','阅读全文 ﹀','expand-card') :
      link(card.sampleId || sourceUrl(card) ? '阅读全文 ﹀' : '去知乎查找 ›', dest);
    if (body) {
      expand.type = 'button';
      expand.setAttribute('aria-expanded','false');
    }
    preview.append(' ',expand);
    intro.append(preview);
    summary.append(intro);
    const bar = el('div',null,'feed-controls');
    function control(action, label, text, icon, style) {
      const button = el('button',null,style);
      button.type = 'button';
      button.dataset.action = action;
      button.setAttribute('aria-label',label);
      if (icon) button.append(el('i',null,'ic '+icon+'-ic'));
      button.append(el('span',text, action === 'share' ? 'share-text' : ''));
      bar.append(button);
      return button;
    }
    function tally(base, selected, fallback='') {
      if (!selected) return base ?? fallback;
      if (base == null || base === '') return 1;
      const digits = String(base).replaceAll(',','');
      if (!/^\d+$/.test(digits)) return base;
      const count = Number(digits) + 1;
      return String(base).includes(',') ? count.toLocaleString('en-US') : count;
    }
    const up = control('up','赞同','赞同 '+tally(card.upvotes,prefs.vote===1),null,'vote');
    const down = control('down','反对','',null,'vote down');
    const comment = link(null, card.sampleId === 'd-opsd' ? dest+'#comments' : sourceUrl(card) || dest);
    comment.setAttribute('aria-label','查看评论');
    comment.append(el('i',null,'ic comment-ic'),el('span',card.comments!=null ? card.comments+' 条评论' : '添加评论'));
    bar.append(comment);
    const favorite = control('favorite','收藏',tally(card.favorites,prefs.favorite,'收藏'),'collect');
    const like = control('like','喜欢',tally(card.likes,prefs.like,'喜欢'),'heart');
    control('share','分享','分享','share');
    const more = control('more','更多操作','···');
    more.setAttribute('aria-expanded','false');
    for (const [button,pressed] of [[up,prefs.vote===1],[down,prefs.vote===-1],[favorite,prefs.favorite],[like,prefs.like]]) button.setAttribute('aria-pressed',String(!!pressed));
    const extra = el('div',null,'card-more');
    extra.hidden = true;
    extra.append(link(sourceUrl(card) ? '查看原文' : '在知乎中查找',sourceUrl(card) || searchUrl(card.title)));
    const hide = el('button','不感兴趣');
    hide.type = 'button';
    hide.addEventListener('click',() => {
      const next = article.nextElementSibling || article.previousElementSibling;
      preferences.set(id,{...prefs,hidden:true});save(); article.remove();
      next?.querySelector('h2 a')?.focus();
    });
    extra.append(hide);
    if (body) {
      const collapse = control('collapse','收起全文','收起 ﹀',null,'collapse-card');
      collapse.hidden = true;
      let full;
      expand.addEventListener('click',() => {
        full = el('section',null,'inline-answer');
        full.setAttribute('aria-label',(card.author || '')+'的全文');
        const byline = el('div',null,'inline-byline');
        byline.append(el('b',card.author),link('打开阅读页 ›',dest));
        const content = el('div',null,'inline-body');
        window.renderZhihuBody(content,body,{resolveLink: url => localSources.get(url)});
        full.append(byline,content);
        summary.after(full);
        article.classList.add('expanded');
        expand.setAttribute('aria-expanded','true');
        summary.hidden = true;
        collapse.hidden = false;
        byline.querySelector('a').focus({preventScroll:true});
        updatePet();
      });
      collapse.addEventListener('click',() => {
        const above = article.getBoundingClientRect().top < document.querySelector('.topbar').offsetHeight;
        full.remove(); full = null;
        article.classList.remove('expanded');
        collapse.hidden = true;
        summary.hidden = false;
        expand.setAttribute('aria-expanded','false');
        if (above) article.scrollIntoView({block:'start'});
        expand.focus({preventScroll:true});
        updatePet();
      });
    }
    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'more') {
        extra.hidden = !extra.hidden;
        more.setAttribute('aria-expanded',String(!extra.hidden));
      } else if (action === 'share') {
        share(card);
      } else if (['up','down','favorite','like'].includes(action)) {
        if (action === 'up' || action === 'down') {
          const vote = action === 'up' ? 1 : -1;
          prefs.vote = prefs.vote === vote ? 0 : vote;
        } else prefs[action] = !prefs[action];
        preferences.set(id,prefs); save();
        up.setAttribute('aria-pressed',String(prefs.vote===1));
        down.setAttribute('aria-pressed',String(prefs.vote===-1));
        up.querySelector('span').textContent = '赞同 '+tally(card.upvotes,prefs.vote===1);
        favorite.setAttribute('aria-pressed',String(!!prefs.favorite));
        favorite.querySelector('span').textContent = tally(card.favorites,prefs.favorite,'收藏');
        like.setAttribute('aria-pressed',String(!!prefs.like));
        like.querySelector('span').textContent = tally(card.likes,prefs.like,'喜欢');
      }
    });
    article.append(heading,summary,bar,extra);
    return article;
  }

  function updatePet() {
    const top = document.querySelector('.topbar').offsetHeight;
    const nodes = stream.querySelectorAll('.feed-card[data-sample-id]');
    let current = nodes[0], best = 0;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.top >= innerHeight) break;
      const visible = Math.min(rect.bottom,innerHeight) - Math.max(rect.top,top);
      if (visible <= 0) continue;
      if (node.classList.contains('expanded')) { current = node; break; }
      if (visible > best) { current = node; best = visible; }
    }
    pet.hidden = !current;
    if (current) {
      pet.classList.toggle('reading-card',current.classList.contains('expanded'));
      pet.href = 'index.html?sample='+encodeURIComponent(current.dataset.sampleId)+'&reader=1';
      pet.title = '陪读 · ' + current.querySelector('h2').textContent;
      pet.setAttribute('aria-label',pet.title);
    }
  }
  let petFrame;
  function schedulePet() {
    if (!petFrame) petFrame = requestAnimationFrame(() => {petFrame = 0;updatePet();});
  }
  window.addEventListener('scroll',schedulePet,{passive:true});
  window.addEventListener('resize',schedulePet);
  pet.addEventListener('click',updatePet);

  function render(query) {
    const needle = query.toLocaleLowerCase();
    const filtered = cards.filter(card => !preferences.get(stateKey(card))?.hidden && [card.title,card.author,card.excerpt].some(text => String(text || '').toLocaleLowerCase().includes(needle)));
    stream.replaceChildren(...filtered.map(showCard));
    note.hidden = !query;
    if (query) note.querySelector('span').textContent = '“' + query + '”的搜索结果 · ' + filtered.length;
    if (!filtered.length) {
      const empty = el('div','未找到相关内容　','feed-empty');
      if (query) empty.append(link('去知乎搜索', searchUrl(query)));
      stream.append(empty);
    }
    schedulePet();
  }
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    render(searchForm.elements.q.value.trim());
    (note.hidden ? stream : note).scrollIntoView({block:'start'});
  });
  note.querySelector('button').addEventListener('click',() => {searchForm.reset();render('');});
  render('');
  let hotOffset = 0;
  function renderHot() {
    const list = document.getElementById('hot-terms');
    list.replaceChildren(...terms.map((_,i) => {
      const [title, heat, badge] = terms[(hotOffset+i)%terms.length];
      const item = el('li');
      item.append(link(title,searchUrl(title.replace(/…$/u,''))),el('small',heat+' 万'),el('em',badge,badge==='新'?'new':''));
      return item;
    }));
  }
  document.getElementById('refresh-hot').addEventListener('click',() => {hotOffset=(hotOffset+3)%terms.length;renderHot();});
  renderHot();
  const icons = {
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m4 17 5-4 3 2 5-5 4 4"/>',
    video:'<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="m10 8 6 4-6 4z"/>',
    poll:'<path d="M3 21h18M5 21V10h4v11m1 0V3h4v18m1 0V7h4v14"/>',
    bell:'<path fill="currentColor" d="M4 16c2-2 2-4 2-7a6 6 0 0 1 12 0c0 3 0 5 2 7l1 2H3zm5 4h6a3 3 0 0 1-6 0z"/>',
    message:'<path fill="currentColor" d="M21 10a9 7.5 0 0 1-9 7.5 11 11 0 0 1-3-.4L4 20l1-5a7 7 0 0 1-2-5 9 7.5 0 1 1 18 0z"/>'
  };
  for (const node of document.querySelectorAll('.tool-icon')) node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">'+icons[node.dataset.icon]+'</svg>';
})();

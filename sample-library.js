(() => {
  'use strict';

  const original = {
    id: 'd-opsd',
    title: document.getElementById('question-title').textContent,
    author: document.querySelector('[data-reader-author]').textContent,
    kind: '知乎回答',
  };
  const samples = [original, ...(window.READING_SAMPLES || []).filter(Boolean)];
  const requestedId = new URLSearchParams(location.search).get('sample') || original.id;
  const selected = samples.find(sample => sample.id === requestedId);

  function element(tag, text, className) {
    const item = document.createElement(tag);
    if (text != null) item.textContent = text;
    if (className) item.className = className;
    return item;
  }

  function pageURL(id) {
    const url = new URL(location.href);
    url.searchParams.set('sample', id);
    url.hash = '';
    return url.href;
  }

  function appendParagraph(article, text, highlights = []) {
    const paragraph = element('p');
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    const phrases = highlights.filter(Boolean).sort((a, b) => b.length - a.length);
    // The copy stays as text nodes. Marks refer only to supplied phrases in this paragraph.
    for (const [index, part] of parts.entries()) {
      if (index % 2) { paragraph.append(element('mark', part)); continue; }
      let offset = 0;
      while (offset < part.length) {
        let matchAt = -1;
        let match = '';
        for (const phrase of phrases) {
          const at = part.indexOf(phrase, offset);
          if (at >= 0 && (matchAt < 0 || at < matchAt)) { matchAt = at; match = phrase; }
        }
        if (matchAt < 0) { paragraph.append(part.slice(offset)); break; }
        paragraph.append(part.slice(offset, matchAt), element('mark', match));
        offset = matchAt + match.length;
      }
    }
    article.append(paragraph);
  }

  function sourceLink(title, url) {
    if (!/^https?:\/\//i.test(url || '')) return null;
    const link = element('a', title);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function appendTable(article, data, heading) {
    const table = element('table', null, 'sample-table');
    if (heading) table.setAttribute('aria-label', heading);
    const head = table.createTHead().insertRow();
    for (const header of data.headers) {
      const cell = element('th', header);
      cell.scope = 'col';
      head.append(cell);
    }
    const body = table.createTBody();
    for (const values of data.rows) {
      const row = body.insertRow();
      for (const value of values) row.insertCell().textContent = value;
    }
    article.append(table);
  }

  function renderArticle(sample) {
    document.title = sample.title + ' · 看山陪读';
    document.body.classList.add('sample-view');
    document.querySelector('.scroll-title').textContent = sample.title;
    const brand = document.querySelector('.topbar .brand');
    brand.setAttribute('aria-label', '返回文章标题');
    brand.after(element('span', '专栏', 'sample-masthead'));
    const menuButton = element('button', '切换样本', 'sample-menu-button');
    menuButton.type = 'button';
    menuButton.dataset.openSamples = '';
    menuButton.setAttribute('aria-haspopup', 'dialog');
    document.querySelector('.top-actions').replaceChildren(menuButton);
    document.getElementById('question').remove();
    const page = element('main', null, 'sample-layout');
    page.innerHTML = `
      <header id="question" class="sample-heading">
        <div class="sample-context"><button type="button" data-open-samples>阅读样本</button><span aria-hidden="true">/</span><span class="sample-kind"></span></div>
        <h1 id="question-title"></h1><div class="sample-byline"></div>
        <div class="sample-details"></div>
        <p class="sample-description"></p>
      </header>
      <aside class="sample-toc"><div class="sample-toc-inner">
        <div class="sample-toc-head"><b>文章目录</b><button id="toc-toggle" aria-controls="toc-links" aria-expanded="true">收起</button></div>
        <nav id="toc-links" aria-label="文章目录"></nav>
      </div></aside>
      <div class="sample-paper">
        <article id="article-body" aria-labelledby="question-title"></article>
        <footer class="sample-end"><button type="button" data-open-samples>选择其他样本 ›</button><button type="button" id="tool-reader">打开双页陪读</button></footer>
      </div>`;
    document.querySelector('main.layout').replaceWith(page);
    page.querySelector('h1').textContent = sample.title;
    page.querySelector('.sample-kind').textContent = sample.kind;
    const author = element('span', sample.author);
    author.dataset.readerAuthor = sample.author;
    const byline = page.querySelector('.sample-byline');
    byline.append(author);
    const originalLink = sourceLink('查看来源 ↗', sample.url);
    if (originalLink) byline.append(originalLink);
    const details = page.querySelector('.sample-details');
    if (sample.column) details.append(element('span', '收录于 · ' + sample.column, 'sample-column'));
    if (Number.isInteger(sample.upvotes)) {
      details.append(element('span', sample.upvotes.toLocaleString('zh-CN') + ' 人赞同了该文章', 'sample-upvotes'));
    }
    if (!details.childElementCount) details.remove();
    const description = page.querySelector('.sample-description');
    if (sample.description) description.textContent = sample.description;
    else description.remove();
    const article = page.querySelector('#article-body');
    const toc = page.querySelector('#toc-links');
    sample.sections.forEach((section, index) => {
      if (section.heading) {
        const heading = element('h2', section.heading);
        heading.id = 'section-' + (index + 1);
        article.append(heading);
        const link = element('a', section.heading);
        link.href = '#' + heading.id;
        toc.append(link);
      }
      for (const text of section.paragraphs || []) appendParagraph(article, text, section.highlights);
      if (section.table) appendTable(article, section.table, section.heading);
    });
    if (sample.attribution || sample.sourceLinks?.length) {
      const sources = element('div', null, 'sample-sources');
      sources.append(element('h3', '来源与署名'));
      if (sample.attribution) sources.append(element('p', sample.attribution));
      const refs = element('ul');
      for (const ref of sample.sourceLinks || []) {
        const link = sourceLink(ref.label, ref.url);
        if (!link) continue;
        const item = element('li');
        item.append(link);
        refs.append(item);
      }
      if (refs.childElementCount) sources.append(refs);
      article.append(sources);
    }
    if (!toc.childElementCount) page.querySelector('.sample-toc').remove();
  }

  if (selected && selected !== original) renderArticle(selected);

  const library = element('dialog', null, 'sample-library');
  library.id = 'sample-library';
  library.setAttribute('aria-labelledby', 'library-title');
  library.innerHTML = `
    <div class="library-head"><h2 id="library-title">选择阅读样本</h2>
      <form method="dialog"><button aria-label="关闭样本列表" title="关闭" autofocus>×</button></form></div>
    <nav class="library-list" aria-label="阅读样本列表"></nav>`;
  const list = library.querySelector('.library-list');
  const current = selected || original;
  for (const sample of samples) {
    const link = element('a', null, 'library-link');
    link.href = pageURL(sample.id);
    const title = element('strong', sample.title);
    const meta = element('span', [sample.kind, sample.author].filter(Boolean).join(' · '), 'library-meta');
    if (sample.id === current.id) {
      link.setAttribute('aria-current', 'page');
      meta.append(element('span', '当前', 'library-active'));
    }
    link.append(meta, title);
    list.append(link);
  }
  document.body.append(library);
  const open = () => { if (!library.open) library.showModal(); };
  document.querySelectorAll('#open-samples,[data-open-samples]').forEach(button => button.addEventListener('click', open));
  library.addEventListener('click', event => {
    if (event.target !== library) return;
    const rect = library.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) library.close();
  });
  if (!selected) {
    const note = element('p', '这个样本链接已失效，请选择下方的文章。', 'library-note');
    list.before(note);
    open();
  }
})();

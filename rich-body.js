(() => {
  'use strict';

  function localImage(path) {
    if (typeof path !== 'string' || !path.startsWith('assets/')) return '';
    const resolved = new URL(path, location.href);
    return resolved.href.startsWith(new URL('assets/', location.href).href) ? resolved.href : '';
  }

  function renderZhihuBody(article, html, {toc, resolveLink} = {}) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const content = template.content;
    content.querySelectorAll('script,style,iframe,object,embed,svg,template,annotation-xml').forEach(node => node.remove());
    const tags = new Set('p h1 h2 h3 h4 h5 h6 b strong i em u s del sub sup mark kbd small br hr figure figcaption img ul ol li blockquote pre code a table caption thead tbody tfoot tr th td math mrow mi mn mo mtext mspace ms mfrac msqrt mroot mstyle msub msup msubsup munder mover munderover mtable mtr mtd mfenced menclose mpadded mmultiscripts mprescripts none semantics annotation'.split(' '));
    for (const node of content.querySelectorAll('*')) {
      const tag = node.localName;
      if (!tags.has(tag)) {
        node.replaceWith(...node.childNodes);
        continue;
      }
      for (const {name, value} of Array.from(node.attributes)) {
        if (tag === 'a' && name === 'href' && /^https?:\/\//i.test(value)) continue;
        if (tag === 'img' && (name === 'alt' || (name === 'src' && localImage(value)))) continue;
        if (tag === 'img' && name === 'class' && ['ee_img', 'ztext-math'].includes(value)) continue;
        if (tag === 'img' && ['width','height'].includes(name) && /^\d{1,5}$/.test(value)) continue;
        if (['td','th'].includes(tag) && ['colspan','rowspan'].includes(name) && /^\d{1,3}$/.test(value)) continue;
        if (tag === 'ol' && name === 'start' && /^\d+$/.test(value)) continue;
        if (node.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && ['display','mathvariant','aria-label'].includes(name)) continue;
        node.removeAttribute(name);
      }
      if (tag === 'img' && !node.hasAttribute('src')) node.remove();
      if (tag === 'a' && node.hasAttribute('href')) {
        if (!node.host) node.removeAttribute('href');
        else {
          const localHref = resolveLink?.(node.origin + node.pathname);
          if (localHref) node.href = localHref;
          else { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
        }
      }
      if (tag === 'table') node.className = 'sample-table';
    }
    // The paginator consumes top-level blocks. Preserve any loose text and inline runs.
    let paragraph;
    for (const node of Array.from(content.childNodes)) {
      if (node.nodeType === Node.COMMENT_NODE) continue;
      if (node.nodeType === Node.ELEMENT_NODE && node.matches('p,h1,h2,h3,h4,h5,h6,figure,ul,ol,blockquote,table,pre,hr')) {
        paragraph = null;
        article.append(node);
      } else if (paragraph || node.nodeType !== Node.TEXT_NODE || node.textContent.trim()) {
        if (!paragraph) { paragraph = document.createElement('p'); article.append(paragraph); }
        paragraph.append(node);
      }
    }
    if (!toc) return;
    for (const heading of article.querySelectorAll(':scope > :is(h1,h2,h3,h4,h5,h6)')) {
      heading.id = 'section-' + (toc.children.length + 1);
      const link = document.createElement('a');
      link.textContent = heading.textContent;
      link.href = '#' + heading.id;
      toc.append(link);
    }
  }

  window.zhihuLocalImageURL = localImage;
  window.renderZhihuBody = renderZhihuBody;
})();

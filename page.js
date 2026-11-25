(() => {
  'use strict';

  function setup() {
    const byId = id => document.getElementById(id);
    const article = byId('article-body');
    const question = byId('question');
    const toc = byId('toc-links');
    const links = [...(toc?.querySelectorAll('a[href^="#"]') ?? [])]
      .map(link => ({ link, section: byId(decodeURIComponent(link.hash.slice(1))) }))
      .filter(item => item.section);
    const header = document.querySelector('header');
    const headerHeight = () => header?.getBoundingClientRect().height || 0;

    // Keep icons and their accessible names intact when the visible label changes.
    function label(control, value) {
      const target = control.querySelector('[data-label]') || control;
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      let first;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.data.trim() || node.parentElement.closest('svg,.ic,.icon,[aria-hidden="true"]')) continue;
        if (!first) first = node;
        else node.data = '';
      }
      if (first) first.data = value;
      else target.append(document.createTextNode(value));
    }

    let nextFrame = 0;
    function refreshPosition() {
      nextFrame = 0;
      const headerBottom = headerHeight();
      if (question) document.body.classList.toggle('reading-scroll', question.getBoundingClientRect().bottom <= headerBottom + 1);
      let current;
      for (const item of links) {
        if (article?.hidden || !item.section.getClientRects().length) continue;
        if (item.section.getBoundingClientRect().top <= headerBottom + 32) current = item;
      }
      if (current && scrollY > 0 && innerHeight + scrollY >= document.documentElement.scrollHeight - 2) {
        current = links.at(-1);
      }
      for (const item of links) {
        if (current === item) item.link.setAttribute('aria-current', 'location');
        else item.link.removeAttribute('aria-current');
      }
    }
    function schedulePosition() {
      if (!nextFrame) nextFrame = requestAnimationFrame(refreshPosition);
    }
    addEventListener('scroll', schedulePosition, { passive: true });
    addEventListener('resize', schedulePosition);
    addEventListener('load', schedulePosition);
    const layoutObserver = new ResizeObserver(schedulePosition);
    if (question) layoutObserver.observe(question);
    if (article) layoutObserver.observe(article);

    function setArticleOpen(open) {
      if (!article) return;
      article.hidden = !open;
      const button = byId('collapse-answer');
      if (button) {
        button.setAttribute('aria-expanded', String(open));
        label(button, open ? '收起 ﹀' : '展开回答');
      }
      schedulePosition();
    }
    byId('collapse-answer')?.addEventListener('click', () => setArticleOpen(article.hidden));
    byId('open-reader')?.addEventListener('click', () => {
      if (article?.hidden) setArticleOpen(true);
    }, { capture: true });
    byId('tool-reader')?.addEventListener('click', () => byId('open-reader')?.click());
    for (const { link, section } of links) {
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        if (article?.hidden) setArticleOpen(true);
        if (!parseFloat(getComputedStyle(section).scrollMarginTop)) {
          section.style.scrollMarginTop = (headerHeight() + 12) + 'px';
        }
        schedulePosition();
      });
    }

    function disclosure(buttonId, panel, openLabel, closedLabel) {
      const button = byId(buttonId);
      if (!button || !panel) return;
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-expanded', String(!panel.hidden));
      button.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        button.setAttribute('aria-expanded', String(!panel.hidden));
        label(button, panel.hidden ? closedLabel : openLabel);
        schedulePosition();
      });
    }
    disclosure('toc-toggle', toc, '收起', '展开');
    disclosure('question-expand', byId('question-extra'), '收起', '…显示全部 ﹀');
    byId('to-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'instant' }));

    function pressed(control, state) {
      control.setAttribute('aria-pressed', String(state));
    }
    const vote = byId('vote');
    const down = byId('downvote');
    function setVote(state) {
      if (vote) {
        pressed(vote, state === 'up');
        label(vote, state === 'up' ? '▲ 已赞同 14' : '▲ 赞同 13');
        const total = document.querySelector('.agree-line');
        if (total) total.textContent = (state === 'up' ? '14' : '13') + ' 人赞同了该回答 ›';
      }
      if (down) pressed(down, state === 'down');
    }
    vote?.addEventListener('click', () => setVote(vote.getAttribute('aria-pressed') === 'true' ? '' : 'up'));
    down?.addEventListener('click', () => setVote(down.getAttribute('aria-pressed') === 'true' ? '' : 'down'));
    for (const [id, inactive, active] of [['save', '16', '17'], ['like', '喜欢', '已喜欢']]) {
      const button = byId(id);
      if (!button) continue;
      if (id === 'save') button.setAttribute('aria-label', '收藏，16 人收藏');
      button.addEventListener('click', () => {
        const state = button.getAttribute('aria-pressed') !== 'true';
        pressed(button, state);
        label(button, state ? active : inactive);
        if (id === 'save') button.setAttribute('aria-label', state ? '取消收藏，17 人收藏' : '收藏，16 人收藏');
      });
    }
    function bindFollow(selector, inactive, active, countSelector) {
      const buttons = [...document.querySelectorAll(selector)];
      if (!buttons.length) return;
      let on = buttons.some(b => b.getAttribute('aria-pressed') === 'true' || b.textContent.trim() === active);
      const count = document.querySelector(countSelector);
      const initialCount = count ? Number(count.textContent.replace(/,/g, '')) - Number(on) : 0;
      for (const button of buttons) {
        pressed(button, on);
        button.addEventListener('click', () => {
          on = !on;
          if (count) count.textContent = (initialCount + Number(on)).toLocaleString('zh-CN');
          for (const other of buttons) {
            pressed(other, on);
            label(other, on ? active : inactive);
          }
        });
      }
    }
    bindFollow('#follow-question,[data-follow-question]', '关注问题', '已关注', '.question-stats .stat-pair b');
    bindFollow('[data-follow-author]', '关注', '已关注', '.author-stats > :last-child b');

    const comments = byId('comments');
    const input = byId('comment-input');
    const openComments = [byId('comments-btn'), byId('question-comments')].filter(Boolean);
    for (const button of openComments) {
      button.setAttribute('aria-controls', 'comments');
      button.setAttribute('aria-expanded', String(comments && !comments.hidden));
      button.addEventListener('click', () => {
        if (!comments) return;
        if (article?.hidden && article.contains(comments)) setArticleOpen(true);
        comments.hidden = false;
        for (const opener of openComments) opener.setAttribute('aria-expanded', 'true');
        input?.focus({ preventScroll: true });
        comments.scrollIntoView({ block: 'center' });
      });
    }
    byId('comment-form')?.addEventListener('submit', event => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) { input.focus(); return; }
      const list = byId('comment-list');
      const entry = document.createElement(list.matches('ul,ol') ? 'li' : 'p');
      entry.textContent = message;
      list.append(entry);
      input.value = '';
      input.focus();
      notify('评论已添加到当前页面');
    });

    const feedback = byId('feedback');
    let timer;
    function notify(message) {
      if (!feedback) return;
      clearTimeout(timer);
      feedback.textContent = message;
      feedback.hidden = false;
      timer = setTimeout(() => { feedback.hidden = true; }, 2500);
    }
    async function copyLink() {
      try {
        await navigator.clipboard.writeText(location.href);
      } catch {
        const previous = document.activeElement;
        const field = document.createElement('textarea');
        field.value = location.href;
        field.style.cssText = 'position:fixed;inset:0 auto auto -9999px';
        document.body.append(field);
        field.select();
        let copied;
        try { copied = document.execCommand('copy'); }
        catch { copied = false; }
        finally { field.remove(); previous?.focus({ preventScroll: true }); }
        if (!copied) { notify('请从浏览器地址栏复制链接'); return; }
      }
      notify('已复制页面链接');
    }
    for (const button of document.querySelectorAll('#share-btn,[data-share]')) {
      button.addEventListener('click', copyLink);
    }
    for (const control of document.querySelectorAll('[data-notice]')) {
      control.addEventListener('click', () => notify(control.dataset.notice));
    }
    byId('hot-swap')?.addEventListener('click', () => {
      const list = document.querySelector('.hot-list');
      if (list?.firstElementChild) list.append(list.firstElementChild);
    });
    refreshPosition();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();

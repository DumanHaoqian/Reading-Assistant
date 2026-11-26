(() => {
  'use strict';

  const sizes = [75, 100, 125, 150];
  const sizeKey = 'kanshan.pet.size', mirrorKey = 'kanshan.pet.mirrored';
  let size = 100, mirrored = false;

  function render() {
    const root = document.documentElement;
    root.style.setProperty('--ks-pet-scale', String(size / 100));
    root.toggleAttribute('data-ks-pet-mirrored', mirrored);
    document.dispatchEvent(new Event('ks:appearance'));
  }
  function restore() {
    try {
      const saved = Number(localStorage.getItem(sizeKey));
      size = sizes.includes(saved) ? saved : 100;
      mirrored = localStorage.getItem(mirrorKey) === 'true';
    } catch { /* Keep this tab's preferences when storage is unavailable. */ }
    render();
  }
  function save(key, value) {
    try { localStorage.setItem(key, String(value)); } catch { /* Still apply immediately. */ }
    render();
  }
  window.KanshanAppearance = {
    get size() { return size; },
    get mirrored() { return mirrored; },
    sizes,
    setSize(value) {
      if (sizes.includes(value) && value !== size) {
        size = value;
        save(sizeKey, size);
      }
    },
    flip() {
      mirrored = !mirrored;
      save(mirrorKey, mirrored);
    },
  };
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === sizeKey || event.key === mirrorKey) restore();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  restore();
})();

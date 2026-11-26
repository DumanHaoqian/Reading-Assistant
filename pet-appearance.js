(() => {
  'use strict';

  const sizes = [75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
  const outfits = ['original', 'scarf', 'vest'];
  const sizeKey = 'kanshan.pet.size', mirrorKey = 'kanshan.pet.mirrored';
  const outfitKey = 'kanshan.pet.outfit';
  let size = 100, mirrored = false, outfit = 'original';

  function render() {
    const root = document.documentElement;
    root.style.setProperty('--ks-pet-scale', String(size / 100));
    root.toggleAttribute('data-ks-pet-mirrored', mirrored);
    root.dataset.ksOutfit = outfit;
    document.dispatchEvent(new Event('ks:appearance'));
  }
  function restore() {
    try {
      const saved = Number(localStorage.getItem(sizeKey));
      size = sizes.includes(saved) ? saved : 100;
      mirrored = localStorage.getItem(mirrorKey) === 'true';
      const savedOutfit = localStorage.getItem(outfitKey);
      outfit = outfits.includes(savedOutfit) ? savedOutfit : 'original';
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
    get outfit() { return outfit; },
    get poster() {
      return outfit === 'original'
        ? 'assets/kanshan/official-idle-poster.webp'
        : 'assets/kanshan/wardrobe-' + outfit + '-poster.webp';
    },
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
    setOutfit(value) {
      if (!outfits.includes(value) || value === outfit) return;
      outfit = value;
      save(outfitKey, outfit);
    },
  };
  window.addEventListener('storage', event => {
    if (event.key === null || [sizeKey, mirrorKey, outfitKey].includes(event.key)) restore();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  restore();
})();

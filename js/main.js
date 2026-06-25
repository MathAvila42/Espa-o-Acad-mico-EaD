function normalizeStr(str) {
  return str.toLowerCase()
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n');
}

const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
const categoryPillsEl = document.getElementById('category-pills');
const resultCountWrap = document.getElementById('result-count-wrap');
const resultCountEl = document.getElementById('result-count');
const faqSectionsEl = document.getElementById('faq-sections');
const noResultsEl = document.getElementById('no-results');
const quickLinksEl = document.getElementById('quick-links');

const onboardingOverlayEl = document.getElementById('onboarding-overlay');
const onboardingIconEl = document.getElementById('onboarding-icon');
const onboardingStepLabelEl = document.getElementById('onboarding-step-label');
const onboardingTitleEl = document.getElementById('onboarding-title');
const onboardingProgressEl = document.getElementById('onboarding-progress');
const onboardingBodyEl = document.getElementById('onboarding-body');
const onboardingDotsEl = document.getElementById('onboarding-dots');
const onboardingPrevBtn = document.getElementById('onboarding-prev');
const onboardingNextBtn = document.getElementById('onboarding-next');

let activeCategory = 'all';
let openItemIds = new Set();
let searchQuery = '';
let highlightedItem = null;
let showSuggestions = false;
let onboardingOpen = false;
let onboardingStep = 0;
let scrollDebounceTimer = null;

function getFilteredSections() {
  const q = normalizeStr(searchQuery.trim());
  return FAQ_DATA
    .filter((s) => activeCategory === 'all' || s.id === activeCategory)
    .map((s) => {
      const items = s.items
        .filter((item) => !q || normalizeStr(item.q).indexOf(q) !== -1 || (item.a && normalizeStr(item.a).indexOf(q) !== -1))
        .sort((a, b) => {
          if (a.essential && !b.essential) return -1;
          if (!a.essential && b.essential) return 1;
          return 0;
        })
        .map((item) => ({ ...item, domId: 'faq-' + item.id }));
      return { id: s.id, icon: s.icon, label: s.label, items };
    })
    .filter((s) => s.items.length > 0);
}

function getSuggestions() {
  const q = normalizeStr(searchQuery.trim());
  const results = [];
  if (!q) return results;
  for (const s of FAQ_DATA) {
    for (const item of s.items) {
      if (results.length >= 8) return results;
      if (normalizeStr(item.q).indexOf(q) !== -1 || (item.a && normalizeStr(item.a).indexOf(q) !== -1)) {
        results.push({ id: item.id, catId: s.id, q: item.q, catLabel: s.label, catIcon: s.icon, essential: !!item.essential });
      }
    }
  }
  return results;
}

function renderPills() {
  categoryPillsEl.innerHTML = CATEGORIES.map((cat) => `
    <button class="pill${cat.id === activeCategory ? ' is-active' : ''}" data-id="${cat.id}" type="button" aria-pressed="${cat.id === activeCategory}">
      <span>${cat.icon}</span><span>${cat.label}</span>
    </button>
  `).join('');
  categoryPillsEl.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.id;
      openItemIds = new Set();
      searchQuery = '';
      searchInput.value = '';
      renderPills();
      renderFaqArea();
      renderSuggestions();
    });
  });
}

function renderQuickLinks() {
  quickLinksEl.innerHTML = QUICK_LINKS.map((link) => `
    <a class="quick-link" href="${link.href}">
      <span class="quick-link__icon">${link.icon}</span>
      <span class="quick-link__label">${link.label}</span>
      <span class="quick-link__arrow">›</span>
    </a>
  `).join('');
}

function renderFaqItem(item) {
  const isOpen = openItemIds.has(item.id);
  const isHighlighted = highlightedItem === item.id;
  const classes = ['faq-item'];
  if (isOpen) classes.push('is-open');
  if (isHighlighted) classes.push('is-highlighted');
  return `
    <div class="${classes.join(' ')}" id="${item.domId}">
      <button class="faq-item__toggle" data-id="${item.id}" type="button" aria-expanded="${isOpen}" aria-controls="${item.domId}-answer">
        <div class="faq-item__content">
          ${item.essential ? '<div><span class="faq-item__essential">★ Essencial</span></div>' : ''}
          <span class="faq-item__question">${item.q}</span>
        </div>
        <span class="faq-item__chevron">›</span>
      </button>
      <div class="faq-item__answer" id="${item.domId}-answer"><p>${item.a}</p></div>
    </div>
  `;
}

function renderFaqCategory(section) {
  return `
    <div class="faq-category">
      <div class="faq-category__header">
        <span class="faq-category__icon">${section.icon}</span>
        <h2 class="faq-category__title">${section.label}</h2>
        <span class="faq-category__count">${section.items.length}</span>
      </div>
      ${section.items.map(renderFaqItem).join('')}
    </div>
  `;
}

function attachFaqItemListeners() {
  faqSectionsEl.querySelectorAll('.faq-item__toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (openItemIds.has(id)) {
        openItemIds.delete(id);
      } else {
        openItemIds.add(id);
      }
      renderFaqArea();
    });
  });
}

function renderFaqArea() {
  const q = searchQuery.trim();
  const hasSearch = normalizeStr(q).length > 0;
  const sections = getFilteredSections();
  const totalCount = sections.reduce((n, s) => n + s.items.length, 0);

  resultCountWrap.hidden = !hasSearch;
  if (hasSearch) {
    resultCountEl.textContent = `${totalCount} resultado${totalCount !== 1 ? 's' : ''} para "${q}"`;
  }

  noResultsEl.hidden = sections.length !== 0;
  faqSectionsEl.innerHTML = sections.map(renderFaqCategory).join('');
  attachFaqItemListeners();
}

function renderSuggestions() {
  const suggestions = getSuggestions();
  const visible = showSuggestions && suggestions.length > 0;
  searchSuggestions.hidden = !visible;
  if (!visible) {
    searchSuggestions.innerHTML = '';
    return;
  }
  searchSuggestions.innerHTML = suggestions.map((sug) => `
    <button class="suggestion" data-id="${sug.id}" data-cat="${sug.catId}" type="button" role="option">
      <span class="suggestion__icon">${sug.catIcon}</span>
      <div class="suggestion__body">
        <div class="suggestion__question">${sug.q}</div>
        <div class="suggestion__category">${sug.catLabel}</div>
      </div>
      ${sug.essential ? '<span class="suggestion__essential">★</span>' : ''}
    </button>
  `).join('');
  searchSuggestions.querySelectorAll('.suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      showSuggestions = false;
      goToQuestion(btn.dataset.id, btn.dataset.cat);
    });
  });
}

function goToQuestion(id, catId) {
  activeCategory = catId;
  openItemIds = new Set([id]);
  highlightedItem = id;
  searchQuery = '';
  searchInput.value = '';

  renderPills();
  renderFaqArea();
  renderSuggestions();

  setTimeout(() => {
    const el = document.getElementById('faq-' + id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
  }, 100);

  setTimeout(() => {
    highlightedItem = null;
    renderFaqArea();
  }, 2500);
}

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  activeCategory = 'all';

  renderPills();
  renderFaqArea();
  renderSuggestions();

  clearTimeout(scrollDebounceTimer);
  if (normalizeStr(searchQuery.trim()).length >= 2) {
    scrollDebounceTimer = setTimeout(() => {
      const el = document.getElementById('faq-sections');
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 100, behavior: 'smooth' });
    }, 150);
  }
});

searchInput.addEventListener('focus', () => {
  showSuggestions = true;
  renderSuggestions();
});

searchInput.addEventListener('blur', () => {
  setTimeout(() => {
    showSuggestions = false;
    renderSuggestions();
  }, 180);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const sections = getFilteredSections();
  const firstItem = sections[0] && sections[0].items[0];
  if (!firstItem) return;

  openItemIds = new Set([firstItem.id]);
  highlightedItem = firstItem.id;
  renderFaqArea();

  setTimeout(() => {
    const el = document.getElementById('faq-' + firstItem.id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
  }, 120);

  setTimeout(() => {
    highlightedItem = null;
    renderFaqArea();
  }, 2500);
});

function renderOnboarding() {
  const stepCount = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[onboardingStep] || ONBOARDING_STEPS[0];
  const isLastStep = onboardingStep === stepCount - 1;

  onboardingIconEl.textContent = step.icon;
  onboardingStepLabelEl.textContent = `Passo ${onboardingStep + 1} de ${stepCount}`;
  onboardingTitleEl.textContent = step.title;
  onboardingProgressEl.style.width = Math.round(((onboardingStep + 1) / stepCount) * 100) + '%';

  const bulletsHtml = step.bullets.map((b) => `
    <div class="modal__bullet">
      <div class="modal__bullet-icon">${b.icon}</div>
      <div class="modal__bullet-body">
        <div class="modal__bullet-title">${b.title}</div>
        <div class="modal__bullet-text">${b.text}</div>
      </div>
    </div>
  `).join('');
  const noteHtml = step.note ? `
    <div class="modal__note">
      <span class="modal__note-icon">💡</span>
      <p class="modal__note-text">${step.note}</p>
    </div>
  ` : '';
  onboardingBodyEl.innerHTML = bulletsHtml + noteHtml + '<div class="modal__spacer"></div>';

  onboardingDotsEl.innerHTML = ONBOARDING_STEPS.map((_, i) => `
    <button class="dot${i === onboardingStep ? ' is-active' : ''}" data-step="${i}" type="button" aria-current="${i === onboardingStep ? 'step' : 'false'}" aria-label="Ir para o passo ${i + 1}"></button>
  `).join('');
  onboardingDotsEl.querySelectorAll('.dot').forEach((btn) => {
    btn.addEventListener('click', () => {
      onboardingStep = Number(btn.dataset.step);
      renderOnboarding();
    });
  });

  onboardingPrevBtn.hidden = onboardingStep === 0;
  onboardingNextBtn.textContent = isLastStep ? 'Começar agora ✓' : 'Próximo →';
}

function openOnboarding() {
  onboardingOpen = true;
  onboardingStep = 0;
  onboardingOverlayEl.hidden = false;
  renderOnboarding();
}

function closeOnboarding() {
  onboardingOpen = false;
  onboardingOverlayEl.hidden = true;
}

document.getElementById('open-onboarding').addEventListener('click', openOnboarding);
document.getElementById('close-onboarding').addEventListener('click', closeOnboarding);

onboardingPrevBtn.addEventListener('click', () => {
  onboardingStep = Math.max(0, onboardingStep - 1);
  renderOnboarding();
});

onboardingNextBtn.addEventListener('click', () => {
  const stepCount = ONBOARDING_STEPS.length;
  if (onboardingStep === stepCount - 1) {
    localStorage.setItem('onboarding-completed', '1');
    applyOnboardingCompletedBadge();
    closeOnboarding();
  } else {
    onboardingStep = Math.min(stepCount - 1, onboardingStep + 1);
    renderOnboarding();
  }
});

function applyOnboardingCompletedBadge() {
  const titleEl = document.querySelector('.guide-card__title');
  if (!titleEl) return;
  const hasBadge = titleEl.querySelector('.guide-card__badge');
  if (localStorage.getItem('onboarding-completed') === '1' && !hasBadge) {
    titleEl.insertAdjacentHTML('beforeend', ' <span class="guide-card__badge">✓ Concluído</span>');
  }
}
applyOnboardingCompletedBadge();

onboardingOverlayEl.addEventListener('click', (e) => {
  if (e.target === onboardingOverlayEl) closeOnboarding();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && onboardingOpen) {
    closeOnboarding();
    return;
  }
  if (e.key === 'Escape' && document.activeElement === searchInput && searchQuery) {
    searchQuery = '';
    searchInput.value = '';
    activeCategory = 'all';
    renderPills();
    renderFaqArea();
    renderSuggestions();
    return;
  }
  if (e.key === '/' && !onboardingOpen) {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      searchInput.focus();
    }
  }
});

renderQuickLinks();
renderPills();
renderFaqArea();

import { getUniqueGroups } from './playlist.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

const failedLogoUrls = new Set();
const loadedLogoUrls = new Set();
const DEFAULT_VIRTUAL_ITEM_HEIGHT = 68;
const VIRTUAL_OVERSCAN = 8;

function normalizeLogoUrl(raw = '') {
  const value = String(raw).trim();
  if (!value) return '';
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('/')) {
    return value;
  }

  // Many playlists include bare filenames like "logo.png" that 404 on this app.
  return '';
}

function animateListSwap(listEl, callback) {
  listEl.classList.add('is-updating');
  callback();
  requestAnimationFrame(() => {
    listEl.classList.remove('is-updating');
  });
}

function applyStagger(container, selector, max = 18) {
  const nodes = container.querySelectorAll(selector);
  nodes.forEach((node, index) => {
    node.style.setProperty('--stagger', String(Math.min(index, max)));
  });
}

export function createRenderer({ state, elements, onPlayChannel }) {
  const { categoryList, channelList, searchInput } = elements;
  let channelTopSpacer = null;
  let channelBottomSpacer = null;
  let channelWindow = null;
  let virtualStart = -1;
  let virtualEnd = -1;
  let virtualItemHeight = DEFAULT_VIRTUAL_ITEM_HEIGHT;
  let virtualItemHeightMeasured = false;
  let scrollRaf = 0;
  let delegatedEventsBound = false;

  function focusWithoutScroll(element) {
    if (!element) return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }

  function updateVirtualItemHeight() {
    if (virtualItemHeightMeasured) return false;

    const sample = channelWindow?.querySelector('.channel-item');
    if (!sample) return false;

    const style = window.getComputedStyle(sample);
    const marginBottom = parseFloat(style.marginBottom || '0') || 0;
    const measured = Math.round(sample.getBoundingClientRect().height + marginBottom);
    const nextHeight = Math.max(44, measured);

    virtualItemHeightMeasured = true;
    if (Math.abs(nextHeight - virtualItemHeight) < 1) return false;
    virtualItemHeight = nextHeight;
    return true;
  }

  function selectCategory(group) {
    state.selectedGroup = group;
    filterChannels(searchInput.value, group);
    renderCategories();
  }

  function focusCategoryByIndex(index) {
    const items = categoryList.querySelectorAll('.category-item');
    if (!items.length) return null;
    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    state.focusedCategoryIndex = safeIndex;
    const item = items[safeIndex];
    focusWithoutScroll(item);
    return item;
  }

  function focusPreferredCategory() {
    const items = categoryList.querySelectorAll('.category-item');
    if (!items.length) return null;

    let target = state.focusedCategoryIndex;
    if (target < 0 || target >= items.length) {
      const active = categoryList.querySelector('.category-item.active');
      target = active ? parseInt(active.dataset.index || '0', 10) : 0;
    }
    return focusCategoryByIndex(target);
  }

  function renderCategories() {
    const groups = getUniqueGroups(state.channels);
    let html =
      '<div class="category-section"><span class="category-section-title">Categories</span>';
    html += `<div class="category-item ${!state.selectedGroup ? 'active' : ''}" data-index="0" data-value="" tabindex="0" role="button">All</div>`;
    groups.forEach((group, index) => {
      const active = state.selectedGroup === group;
      const idx = index + 1;
      html += `<div class="category-item ${active ? 'active' : ''}" data-index="${idx}" data-value="${escapeAttr(group)}" tabindex="0" role="button">${escapeHtml(group)}</div>`;
    });
    html += '</div>';

    animateListSwap(categoryList, () => {
      categoryList.innerHTML = html;
    });
    applyStagger(categoryList, '.category-item', 14);

    categoryList.querySelectorAll('.category-item').forEach((item) => {
      const value = item.dataset.value;
      const idx = parseInt(item.dataset.index || '0', 10);
      const select = () => {
        state.focusedCategoryIndex = idx;
        selectCategory(value);
      };
      item.addEventListener('click', select);
      item.addEventListener('focus', () => {
        state.focusedCategoryIndex = idx;
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
    });
  }

  function filterChannels(search = '', group = '') {
    const prevFocusedChannel =
      state.focusedChannelIndex >= 0 ? state.filteredChannels[state.focusedChannelIndex] : null;
    let filtered = state.channels;

    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (channel) =>
          channel.name?.toLowerCase().includes(query) ||
          channel.group?.toLowerCase().includes(query)
      );
    }

    if (group) {
      filtered = filtered.filter((channel) => channel.group === group);
    }

    state.filteredChannels = filtered;

    const activeIdx = state.activeChannel
      ? state.filteredChannels.findIndex((channel) => channel.url === state.activeChannel.url)
      : -1;

    if (activeIdx >= 0) {
      state.focusedChannelIndex = activeIdx;
    } else if (prevFocusedChannel) {
      const prevIdx = state.filteredChannels.findIndex(
        (channel) => channel.url === prevFocusedChannel.url
      );
      state.focusedChannelIndex = prevIdx >= 0 ? prevIdx : -1;
    } else {
      state.focusedChannelIndex = -1;
    }

    renderChannelList(state.filteredChannels);
  }

  function ensureVirtualChannelList() {
    if (channelTopSpacer && channelBottomSpacer && channelWindow) {
      return;
    }

    channelList.innerHTML = `
      <div class="channel-virtual-spacer" data-role="top"></div>
      <div class="channel-virtual-window" data-role="window"></div>
      <div class="channel-virtual-spacer" data-role="bottom"></div>
    `;

    channelTopSpacer = channelList.querySelector('[data-role="top"]');
    channelBottomSpacer = channelList.querySelector('[data-role="bottom"]');
    channelWindow = channelList.querySelector('[data-role="window"]');

    if (!delegatedEventsBound) {
      delegatedEventsBound = true;

      channelList.addEventListener(
        'scroll',
        () => {
          if (scrollRaf) return;
          scrollRaf = requestAnimationFrame(() => {
            scrollRaf = 0;
            renderVisibleChannels();
          });
        },
        { passive: true }
      );

      channelList.addEventListener('click', (event) => {
        const item = event.target.closest('.channel-item');
        if (!item) return;
        state.focusedChannelIndex = parseInt(item.dataset.index, 10);
        onPlayChannel(item.dataset.url, item.dataset.name, item);
      });

      channelList.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const item = event.target.closest('.channel-item');
        if (!item) return;
        event.preventDefault();
        state.focusedChannelIndex = parseInt(item.dataset.index, 10);
        onPlayChannel(item.dataset.url, item.dataset.name, item);
      });
    }
  }

  function renderVisibleChannels(force = false) {
    ensureVirtualChannelList();

    const total = state.filteredChannels.length;
    if (!total) {
      channelTopSpacer.style.height = '0px';
      channelBottomSpacer.style.height = '0px';
      channelWindow.innerHTML = '';
      virtualStart = 0;
      virtualEnd = 0;
      return;
    }

    const viewportHeight = channelList.clientHeight || 400;
    const scrollTop = channelList.scrollTop;
    const start = Math.max(0, Math.floor(scrollTop / virtualItemHeight) - VIRTUAL_OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / virtualItemHeight) + VIRTUAL_OVERSCAN * 2;
    const end = Math.min(total, start + visibleCount);

    if (!force && start === virtualStart && end === virtualEnd) {
      return;
    }

    virtualStart = start;
    virtualEnd = end;
    channelTopSpacer.style.height = `${start * virtualItemHeight}px`;
    channelBottomSpacer.style.height = `${(total - end) * virtualItemHeight}px`;

    channelWindow.innerHTML = state.filteredChannels
      .slice(start, end)
      .map((channel, offset) => {
        const index = start + offset;
        const isActive = state.activeChannel?.url === channel.url;
        const channelNumber = channel.number || index + 1;
        const channelUrl = channel.url || '';
        const channelName = channel.name || 'Channel';
        const channelGroup = channel.group || '';
        const channelLogo = normalizeLogoUrl(channel.logo || '');
        const canLoadLogo = channelLogo && !failedLogoUrls.has(channelLogo);
        const isLogoLoaded = canLoadLogo && loadedLogoUrls.has(channelLogo);
        return `
    <div class="channel-item ${isActive ? 'active' : ''}" data-url="${escapeAttr(channelUrl)}" data-name="${escapeAttr(channelName)}" data-index="${index}" tabindex="0" role="button">
      <div class="channel-number">${channelNumber}</div>
      <div class="channel-logo-wrap" aria-hidden="true">
        <div class="channel-logo-fallback" title="Logo unavailable">TV</div>
        ${
          canLoadLogo
            ? `<img class="channel-logo channel-logo-img ${isLogoLoaded ? 'loaded' : ''}" src="${escapeAttr(channelLogo)}" data-logo-url="${escapeAttr(channelLogo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
            : ''
        }
      </div>
      <div class="channel-info">
        <div class="channel-name">${escapeHtml(channelName || 'Unknown')}</div>
        <div class="channel-group">${escapeHtml(channelGroup)}</div>
      </div>
    </div>
  `;
      })
      .join('');

    if (updateVirtualItemHeight()) {
      virtualStart = -1;
      virtualEnd = -1;
      renderVisibleChannels(true);
      return;
    }

    if (!document.body.classList.contains('perf-lite')) {
      applyStagger(channelWindow, '.channel-item', 22);
    }

    channelWindow.querySelectorAll('.channel-item').forEach((item) => {
      const logoWrap = item.querySelector('.channel-logo-wrap');
      const logo = item.querySelector('.channel-logo-img[data-logo-url]');
      if (!logo) return;

      logo.addEventListener(
        'load',
        () => {
          const loadedUrl = logo.dataset.logoUrl;
          if (loadedUrl) loadedLogoUrls.add(loadedUrl);
          logoWrap?.classList.add('loaded');
          logo.classList.add('loaded');
        },
        { once: true }
      );

      logo.addEventListener(
        'error',
        () => {
          const failedUrl = logo.dataset.logoUrl;
          if (failedUrl) failedLogoUrls.add(failedUrl);
          if (failedUrl) loadedLogoUrls.delete(failedUrl);
          logoWrap?.classList.remove('loaded');
          logo.style.display = 'none';
          logo.removeAttribute('data-logo-url');
        },
        { once: true }
      );
    });
  }

  function renderChannelList(_list) {
    ensureVirtualChannelList();
    virtualItemHeightMeasured = false;
    virtualStart = -1;
    virtualEnd = -1;
    channelList.classList.add('is-updating');
    renderVisibleChannels(true);
    requestAnimationFrame(() => {
      channelList.classList.remove('is-updating');
    });
  }

  function focusChannelByIndex(index) {
    const total = state.filteredChannels.length;
    if (!total) return null;
    const safeIndex = Math.max(0, Math.min(index, total - 1));
    state.focusedChannelIndex = safeIndex;

    const top = safeIndex * virtualItemHeight;
    const bottom = top + virtualItemHeight;
    const viewportTop = channelList.scrollTop;
    const viewportBottom = viewportTop + channelList.clientHeight;

    if (top < viewportTop) {
      channelList.scrollTop = top;
    } else if (bottom > viewportBottom) {
      channelList.scrollTop = Math.max(0, bottom - channelList.clientHeight);
    }

    renderVisibleChannels(true);

    const item = channelList.querySelector(`.channel-item[data-index="${safeIndex}"]`);
    if (!item) return null;
    focusWithoutScroll(item);
    return item;
  }

  function ensureChannelVisible(channel) {
    const matchesCurrentGroup = !state.selectedGroup || channel.group === state.selectedGroup;
    const query = (searchInput.value || '').trim().toLowerCase();
    const matchesCurrentSearch =
      !query ||
      channel.name?.toLowerCase().includes(query) ||
      channel.group?.toLowerCase().includes(query);

    if (!matchesCurrentGroup) state.selectedGroup = '';
    if (!matchesCurrentSearch) searchInput.value = '';

    renderCategories();
    filterChannels(searchInput.value, state.selectedGroup);
  }

  return {
    ensureChannelVisible,
    filterChannels,
    focusCategoryByIndex,
    focusChannelByIndex,
    focusPreferredCategory,
    renderCategories,
    renderChannelList,
    selectCategory,
  };
}

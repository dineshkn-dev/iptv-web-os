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
    item.focus();
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  function renderChannelList(list) {
    animateListSwap(channelList, () => {
      channelList.innerHTML = list
        .map((channel, index) => {
          const isActive = state.activeChannel?.url === channel.url;
          const channelNumber = channel.number || index + 1;
          const channelUrl = channel.url || '';
          const channelName = channel.name || 'Channel';
          const channelGroup = channel.group || '';
          const channelLogo = channel.logo || '';
          return `
    <div class="channel-item ${isActive ? 'active' : ''}" data-url="${escapeAttr(channelUrl)}" data-name="${escapeAttr(channelName)}" data-index="${index}" tabindex="0" role="button">
      <div class="channel-number">${channelNumber}</div>
      <img class="channel-logo" src="${escapeAttr(channelLogo)}" alt="" onerror="this.style.display='none'">
      <div class="channel-info">
        <div class="channel-name">${escapeHtml(channelName || 'Unknown')}</div>
        <div class="channel-group">${escapeHtml(channelGroup)}</div>
      </div>
    </div>
  `;
        })
        .join('');
    });
    applyStagger(channelList, '.channel-item', 22);

    channelList.querySelectorAll('.channel-item').forEach((item) => {
      const play = () => {
        state.focusedChannelIndex = parseInt(item.dataset.index, 10);
        onPlayChannel(item.dataset.url, item.dataset.name, item);
      };
      item.addEventListener('click', play);
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          play();
        }
      });
    });
  }

  function focusChannelByIndex(index) {
    const items = channelList.querySelectorAll('.channel-item');
    if (!items.length) return null;
    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    state.focusedChannelIndex = safeIndex;
    const item = items[safeIndex];
    item.focus();
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

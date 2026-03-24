const BASE_PLAYLIST_URL = 'm3u-links/playlist.m3u8';

const video = document.getElementById('video');
const channelList = document.getElementById('channelList');
const categoryList = document.getElementById('categoryList');
const searchInput = document.getElementById('search');
const placeholder = document.getElementById('placeholder');
const loading = document.getElementById('loading');
const errorEl = document.getElementById('error');
const nowPlaying = document.getElementById('nowPlaying');
const channelToast = document.getElementById('channelToast');
const videoControls = document.getElementById('videoControls');
const videoContainer = document.getElementById('videoContainer');

let channels = [];
let filteredChannels = [];
let hls = null;
let activeChannel = null;
let focusedChannelIndex = -1;
let focusedCategoryIndex = 0;
let controlsTimeout = null;
let selectedGroup = '';
let numberBuffer = '';
let numberBufferTimer = null;

const numberZap = document.createElement('div');
numberZap.id = 'numberZap';
numberZap.className = 'number-zap';
videoContainer.appendChild(numberZap);

function animateListSwap(listEl, callback) {
  listEl.classList.add('is-updating');
  callback();
  requestAnimationFrame(() => {
    listEl.classList.remove('is-updating');
  });
}

function applyStagger(container, selector, max = 18) {
  const nodes = container.querySelectorAll(selector);
  nodes.forEach((node, i) => {
    node.style.setProperty('--stagger', String(Math.min(i, max)));
  });
}

function parseM3U(text) {
  const lines = text.split('\n');
  const result = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      current = { raw: line };
      const nameMatch = line.match(/,(.+)$/);
      if (nameMatch) current.name = nameMatch[1].trim();
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      if (logoMatch) current.logo = logoMatch[1];
      const groupMatch = line.match(/group-title="([^"]*)"/);
      if (groupMatch) current.group = groupMatch[1].split(';')[0];
    } else if (current && line && !line.startsWith('#')) {
      current.url = line;
      result.push(current);
      current = null;
    }
  }
  return result;
}

function getUniqueGroups() {
  const set = new Set();
  channels.forEach(c => {
    if (c.group) set.add(c.group);
  });
  return Array.from(set).sort();
}

function selectCategory(group) {
  selectedGroup = group;
  filterChannels(searchInput.value, group);
  renderCategories();
}

function focusCategoryByIndex(index) {
  const items = categoryList.querySelectorAll('.category-item');
  if (!items.length) return null;
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  focusedCategoryIndex = safeIndex;
  const item = items[safeIndex];
  item.focus();
  item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return item;
}

function focusPreferredCategory() {
  const items = categoryList.querySelectorAll('.category-item');
  if (!items.length) return null;

  let target = focusedCategoryIndex;
  if (target < 0 || target >= items.length) {
    const active = categoryList.querySelector('.category-item.active');
    target = active ? parseInt(active.dataset.index || '0', 10) : 0;
  }
  return focusCategoryByIndex(target);
}

function renderCategories() {
  const groups = getUniqueGroups();
  let html = '<div class="category-section"><span class="category-section-title">Categories</span>';
  html += `<div class="category-item ${!selectedGroup ? 'active' : ''}" data-index="0" data-value="" tabindex="0" role="button">All</div>`;
  groups.forEach(g => {
    const active = selectedGroup === g;
    const idx = groups.indexOf(g) + 1;
    html += `<div class="category-item ${active ? 'active' : ''}" data-index="${idx}" data-value="${g}" tabindex="0" role="button">${g}</div>`;
  });
  html += '</div>';

  animateListSwap(categoryList, () => {
    categoryList.innerHTML = html;
  });
  applyStagger(categoryList, '.category-item', 14);

  categoryList.querySelectorAll('.category-item').forEach(item => {
    const value = item.dataset.value;
    const idx = parseInt(item.dataset.index || '0', 10);
    const select = () => {
      focusedCategoryIndex = idx;
      selectCategory(value);
    };
    item.addEventListener('click', select);
    item.addEventListener('focus', () => {
      focusedCategoryIndex = idx;
    });
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });
}

function filterChannels(search = '', group = '') {
  const prevFocusedChannel = focusedChannelIndex >= 0 ? filteredChannels[focusedChannelIndex] : null;
  let filtered = channels;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c => 
      c.name?.toLowerCase().includes(q) || c.group?.toLowerCase().includes(q)
    );
  }
  if (group) {
    filtered = filtered.filter(c => c.group === group);
  }
  filteredChannels = filtered;

  // Keep focus stable when changing category/search if the channel still exists.
  const activeIdx = activeChannel
    ? filteredChannels.findIndex(c => c.url === activeChannel.url)
    : -1;
  if (activeIdx >= 0) {
    focusedChannelIndex = activeIdx;
  } else if (prevFocusedChannel) {
    const prevIdx = filteredChannels.findIndex(c => c.url === prevFocusedChannel.url);
    focusedChannelIndex = prevIdx >= 0 ? prevIdx : -1;
  } else {
    focusedChannelIndex = -1;
  }

  renderChannelList(filteredChannels);
}

function renderChannelList(list) {
  animateListSwap(channelList, () => {
    channelList.innerHTML = list.map((ch, i) => {
      const isActive = activeChannel?.url === ch.url;
      const channelNumber = ch.number || i + 1;
      return `
    <div class="channel-item ${isActive ? 'active' : ''}" data-url="${ch.url}" data-name="${ch.name || 'Channel'}" data-index="${i}" tabindex="0" role="button">
      <div class="channel-number">${channelNumber}</div>
      <img class="channel-logo" src="${ch.logo || ''}" alt="" onerror="this.style.display='none'">
      <div class="channel-info">
        <div class="channel-name">${ch.name || 'Unknown'}</div>
        <div class="channel-group">${ch.group || ''}</div>
      </div>
    </div>
  `;
    }).join('');
  });
  applyStagger(channelList, '.channel-item', 22);

  channelList.querySelectorAll('.channel-item').forEach(item => {
    const play = () => {
      playChannel(item.dataset.url, item.dataset.name, item);
      focusedChannelIndex = parseInt(item.dataset.index, 10);
    };
    item.addEventListener('click', play);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        play();
      }
    });
  });
}

function focusChannelByIndex(index) {
  const item = channelList.querySelector(`.channel-item[data-index="${index}"]`);
  if (!item) return null;
  item.focus();
  item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return item;
}

function showNumberZap(value, invalid = false) {
  numberZap.textContent = value;
  numberZap.classList.toggle('invalid', invalid);
  numberZap.classList.add('visible');
}

function clearNumberZap() {
  numberBuffer = '';
  clearTimeout(numberBufferTimer);
  numberZap.classList.remove('visible', 'invalid');
}

function ensureChannelVisible(channel) {
  const matchesCurrentGroup = !selectedGroup || channel.group === selectedGroup;
  const query = (searchInput.value || '').trim().toLowerCase();
  const matchesCurrentSearch = !query || channel.name?.toLowerCase().includes(query) || channel.group?.toLowerCase().includes(query);

  if (!matchesCurrentGroup) selectedGroup = '';
  if (!matchesCurrentSearch) searchInput.value = '';

  renderCategories();
  filterChannels(searchInput.value, selectedGroup);
}

function zapToChannel(number) {
  if (!Number.isInteger(number) || number <= 0) {
    showNumberZap(`${number}`, true);
    clearTimeout(numberBufferTimer);
    numberBufferTimer = setTimeout(() => {
      clearNumberZap();
    }, 900);
    return false;
  }

  const ch = channels.find(c => c.number === number);
  if (!ch) {
    showNumberZap(`${number}`, true);
    clearTimeout(numberBufferTimer);
    numberBufferTimer = setTimeout(() => {
      clearNumberZap();
    }, 900);
    return false;
  }

  ensureChannelVisible(ch);
  const index = filteredChannels.findIndex(item => item.url === ch.url);
  if (index < 0) {
    showNumberZap(`${number}`, true);
    clearTimeout(numberBufferTimer);
    numberBufferTimer = setTimeout(() => {
      clearNumberZap();
    }, 900);
    return false;
  }

  const item = focusChannelByIndex(index);
  playChannel(ch.url, ch.name || `Channel ${number}`, item);
  showControlsTemporarily();
  clearTimeout(numberBufferTimer);
  numberBufferTimer = setTimeout(() => {
    clearNumberZap();
  }, 900);
  return true;
}

function handleNumberKey(digit) {
  numberBuffer = `${numberBuffer}${digit}`.replace(/^0+/, '');
  if (!numberBuffer) numberBuffer = '0';
  showNumberZap(numberBuffer, false);
  clearTimeout(numberBufferTimer);
  numberBufferTimer = setTimeout(() => {
    const parsed = parseInt(numberBuffer, 10);
    zapToChannel(parsed);
    numberBuffer = '';
  }, 1400);
}

function showChannelToast(name) {
  channelToast.textContent = name;
  channelToast.classList.remove('visible');
  // Force reflow for re-triggering CSS animation
  void channelToast.offsetWidth;
  channelToast.classList.add('visible');
  clearTimeout(channelToast._tid);
  channelToast._tid = setTimeout(() => channelToast.classList.remove('visible'), 2500);
}

function playChannel(url, name, el) {
  activeChannel = { url, name };
  if (el && el.dataset.index != null) focusedChannelIndex = parseInt(el.dataset.index, 10);
  channelList.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  showChannelToast(name);
  placeholder.classList.add('hidden');
  loading.classList.add('visible');
  errorEl.classList.remove('visible');
  video.classList.remove('playing');

  if (hls) {
    hls.destroy();
    hls = null;
  }

  const isHLS = url.includes('.m3u8') || url.includes('m3u8');
  video.src = '';

  if (isHLS && typeof Hls !== 'undefined' && Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      loading.classList.remove('visible');
      video.classList.add('playing');
      video.play().catch(() => {});
      showControlsTemporarily();
    });
    hls.on(Hls.Events.ERROR, (e, data) => {
      if (data.fatal) {
        loading.classList.remove('visible');
        errorEl.textContent = `Stream error: ${data.type}`;
        errorEl.classList.add('visible');
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHLS) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      loading.classList.remove('visible');
      video.classList.add('playing');
      video.play().catch(() => {});
      showControlsTemporarily();
    });
  } else {
    video.src = url;
    video.addEventListener('loadeddata', () => {
      loading.classList.remove('visible');
      video.classList.add('playing');
      video.play().catch(() => {});
      showControlsTemporarily();
    });
  }

  video.onerror = () => {
    loading.classList.remove('visible');
    errorEl.textContent = 'Failed to load stream. Channel may be offline.';
    errorEl.classList.add('visible');
  };

  nowPlaying.innerHTML = `<span style="color:#2b82e0">▸</span> Now playing: <strong>${name}</strong>`;
}

function scrollActiveChannelIntoView() {
  requestAnimationFrame(() => {
    const active = channelList.querySelector('.channel-item.active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      active.focus();
    }
  });
}

function playPrevChannel() {
  if (filteredChannels.length === 0) return;
  const currentIdx = activeChannel ? filteredChannels.findIndex(ch => ch.url === activeChannel.url) : -1;
  focusedChannelIndex = currentIdx <= 0 ? filteredChannels.length - 1 : currentIdx - 1;
  const ch = filteredChannels[focusedChannelIndex];
  const item = focusChannelByIndex(focusedChannelIndex);
  playChannel(ch.url, ch.name || 'Channel', item);
}

function playNextChannel() {
  if (filteredChannels.length === 0) return;
  const currentIdx = activeChannel ? filteredChannels.findIndex(ch => ch.url === activeChannel.url) : -1;
  focusedChannelIndex = currentIdx >= filteredChannels.length - 1 ? 0 : currentIdx + 1;
  const ch = filteredChannels[focusedChannelIndex];
  const item = focusChannelByIndex(focusedChannelIndex);
  playChannel(ch.url, ch.name || 'Channel', item);
}

function setupVideoControls() {
  document.getElementById('btnChPrev').addEventListener('click', playPrevChannel);
  document.getElementById('btnChNext').addEventListener('click', playNextChannel);
  document.getElementById('btnPlayPause').addEventListener('click', () => {
    if (video.paused) video.play();
    else video.pause();
  });
  document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    videoContainer.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function showControlsTemporarily() {
  videoControls.classList.add('visible');
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    if (video.paused) return;
    videoControls.classList.remove('visible');
  }, 3000);
}

searchInput.addEventListener('input', () => {
  filterChannels(searchInput.value, selectedGroup);
});

async function loadBasePlaylist() {
  selectedGroup = '';
  try {
    loading.classList.add('visible');
    const res = await fetch(encodeURI(BASE_PLAYLIST_URL));
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    channels = parseM3U(text).map((channel, index) => ({
      ...channel,
      number: index + 1,
    }));
    renderCategories();
    filterChannels();
    document.body.classList.add('app-ready');
    loading.classList.remove('visible');
  } catch (err) {
    renderCategories();
    loading.classList.remove('visible');
    errorEl.textContent = 'Failed to load base playlist: ' + err.message;
    errorEl.classList.add('visible');
    errorEl.style.position = 'relative';
  }
}

document.addEventListener('keydown', (e) => {
  const inChannelList = channelList.contains(document.activeElement);
  const inCategoryList = categoryList.contains(document.activeElement);
  const inControls = videoControls.contains(document.activeElement);
  const onVideoContainer = document.activeElement === videoContainer;
  const inInput = document.activeElement === searchInput;

  if (inInput) return;

  const isDigit = /^[0-9]$/.test(e.key);
  if (isDigit) {
    e.preventDefault();
    handleNumberKey(e.key);
    return;
  }

  const channelItems = channelList.querySelectorAll('.channel-item');
  const categoryItems = categoryList.querySelectorAll('.category-item');
  const controlButtons = Array.from(videoControls.querySelectorAll('.ctrl-btn'));
  const preferredControl = controlButtons[1] || controlButtons[0] || null;
  const currentChannel = inChannelList ? document.activeElement.closest('.channel-item') : null;
  const currentCategory = inCategoryList ? document.activeElement.closest('.category-item') : null;
  const currentControl = inControls ? document.activeElement.closest('.ctrl-btn') : null;
  const channelIdx = currentChannel ? parseInt(currentChannel.dataset.index, 10) : -1;
  const categoryIdx = currentCategory ? Array.from(categoryItems).indexOf(currentCategory) : -1;
  const controlIdx = currentControl ? controlButtons.indexOf(currentControl) : -1;

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      if (inChannelList && channelIdx > 0) {
        const prev = channelItems[channelIdx - 1];
        prev.focus();
        prev.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (inCategoryList && categoryIdx > 0) {
        focusCategoryByIndex(categoryIdx - 1);
      } else if (inControls && channelItems.length > 0) {
        const target = focusedChannelIndex >= 0 ? focusedChannelIndex : 0;
        focusChannelByIndex(target);
      } else if (!inChannelList && !inCategoryList && !inControls && channelItems.length > 0) {
        const target = focusedChannelIndex > 0 ? focusedChannelIndex - 1 : 0;
        focusChannelByIndex(target);
      } else if (video.classList.contains('playing') && !inChannelList && !inCategoryList && !inControls) {
        playPrevChannel();
        showControlsTemporarily();
      }
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (inChannelList && channelIdx >= 0 && channelIdx < channelItems.length - 1) {
        const next = channelItems[channelIdx + 1];
        next.focus();
        next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (inCategoryList && categoryIdx >= 0 && categoryIdx < categoryItems.length - 1) {
        focusCategoryByIndex(categoryIdx + 1);
      } else if (onVideoContainer && preferredControl) {
        preferredControl.focus();
      } else if (!inChannelList && !inCategoryList && !inControls && channelItems.length > 0) {
        const target = focusedChannelIndex >= 0 && focusedChannelIndex < channelItems.length - 1 ? focusedChannelIndex + 1 : 0;
        focusChannelByIndex(target);
      } else if (video.classList.contains('playing') && !inChannelList && !inCategoryList && !inControls) {
        playNextChannel();
        showControlsTemporarily();
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (inControls && controlIdx > 0) {
        controlButtons[controlIdx - 1].focus();
      } else if (inControls && channelItems.length > 0) {
        const target = focusedChannelIndex >= 0 ? focusedChannelIndex : 0;
        focusChannelByIndex(target);
      } else if (onVideoContainer && preferredControl) {
        preferredControl.focus();
      } else if (inChannelList && categoryItems.length > 0) {
        focusPreferredCategory();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (inCategoryList && channelItems.length > 0) {
        const target = focusedChannelIndex >= 0 ? focusedChannelIndex : 0;
        focusChannelByIndex(target);
      } else if (inChannelList && preferredControl) {
        preferredControl.focus();
      } else if (inControls && controlIdx >= 0 && controlIdx < controlButtons.length - 1) {
        controlButtons[controlIdx + 1].focus();
      } else if (inChannelList) {
        videoContainer?.focus();
      } else if (onVideoContainer && preferredControl) {
        preferredControl.focus();
      }
      break;
    case 'ChannelDown':
    case 'PageDown':
      e.preventDefault();
      if (video.classList.contains('playing') || filteredChannels.length > 0) {
        playPrevChannel();
        showControlsTemporarily();
      }
      break;
    case 'ChannelUp':
    case 'PageUp':
      e.preventDefault();
      if (video.classList.contains('playing') || filteredChannels.length > 0) {
        playNextChannel();
        showControlsTemporarily();
      }
      break;
    case ' ':
    case 'Enter':
      if (numberBuffer) {
        e.preventDefault();
        const parsed = parseInt(numberBuffer, 10);
        zapToChannel(parsed);
        numberBuffer = '';
        return;
      }
      if (currentCategory) {
        e.preventDefault();
        currentCategory.click();
      } else if (currentControl) {
        e.preventDefault();
        currentControl.click();
      } else if (onVideoContainer) {
        e.preventDefault();
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        showControlsTemporarily();
      } else if (currentChannel) {
        e.preventDefault();
        playChannel(currentChannel.dataset.url, currentChannel.dataset.name, currentChannel);
      } else if (channelItems.length > 0) {
        e.preventDefault();
        const idx = focusedChannelIndex >= 0 ? focusedChannelIndex : 0;
        const item = focusChannelByIndex(idx);
        if (item) playChannel(item.dataset.url, item.dataset.name, item);
      }
      break;
    case 'Backspace':
      if (numberBuffer) {
        e.preventDefault();
        numberBuffer = numberBuffer.slice(0, -1);
        if (!numberBuffer) {
          clearNumberZap();
        } else {
          showNumberZap(numberBuffer, false);
        }
      }
      break;
    case 'Escape':
      if (numberBuffer) {
        clearNumberZap();
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      break;
    case 'Home':
      e.preventDefault();
      if (channelItems.length > 0) focusChannelByIndex(0);
      break;
    case 'End':
      e.preventDefault();
      if (channelItems.length > 0) focusChannelByIndex(channelItems.length - 1);
      break;
    case 'f':
    case 'F':
      if (!inInput) {
        e.preventDefault();
        toggleFullscreen();
      }
      break;
  }

  if (video.classList.contains('playing') && ['ArrowUp','ArrowDown','ChannelUp','ChannelDown',' '].includes(e.key)) {
    showControlsTemporarily();
  }
});

videoContainer.addEventListener('click', () => {
  videoContainer.focus();
  showControlsTemporarily();
});
videoContainer.addEventListener('mousemove', () => showControlsTemporarily());
videoContainer.addEventListener('keydown', () => showControlsTemporarily());

setupVideoControls();

// Bootstrap: load the single base playlist and render categories.
(async () => {
  await loadBasePlaylist();
})();

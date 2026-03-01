const PLAYLISTS = {
  'south-indian': { url: 'https://raw.githubusercontent.com/dineshkn-dev/mylinks/main/south_indian_playlist.m3u', label: 'South Indian', type: 'link' },
  'sports-all': { url: 'm3u-links/1-IPTV Sports All Channels List.m3u', label: 'Sports – All Channels', type: 'local' },
  'sports-m3u': { url: 'm3u-links/4-IPTV Sports List M3u Channels.m3u', label: 'Sports – M3U Channels', type: 'local' },
  'sports-being': { url: 'm3u-links/ONLY BEING SPORTS Channel 1, to 17.m3u', label: 'Sports – Being Sports', type: 'local' },
};

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
let controlsTimeout = null;
let selectedPlaylistId = null;
let selectedGroup = '';

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

function selectCategory(type, value) {
  if (type === 'playlist') {
    selectedPlaylistId = value;
    selectedGroup = '';
    loadPlaylist(value);
  } else if (type === 'group') {
    selectedGroup = value;
    filterChannels(searchInput.value, value);
    renderCategories();
  }
}

function renderCategories() {
  const groups = getUniqueGroups();
  let html = '';

  html += '<div class="category-section"><span class="category-section-title">Link</span>';
  html += `<div class="category-item ${selectedPlaylistId === 'south-indian' && !selectedGroup ? 'active' : ''}" data-type="playlist" data-value="south-indian" tabindex="0" role="button">South Indian</div>`;
  html += '</div>';

  html += '<div class="category-section"><span class="category-section-title">Local</span>';
  ['sports-all', 'sports-m3u', 'sports-being'].forEach(id => {
    const active = selectedPlaylistId === id && !selectedGroup;
    html += `<div class="category-item ${active ? 'active' : ''}" data-type="playlist" data-value="${id}" tabindex="0" role="button">${PLAYLISTS[id].label}</div>`;
  });
  html += '</div>';

  if (groups.length > 0) {
    html += '<div class="category-section"><span class="category-section-title">Groups</span>';
    html += `<div class="category-item ${!selectedGroup ? 'active' : ''}" data-type="group" data-value="" tabindex="0" role="button">All</div>`;
    groups.forEach(g => {
      const active = selectedGroup === g;
      html += `<div class="category-item ${active ? 'active' : ''}" data-type="group" data-value="${g}" tabindex="0" role="button">${g}</div>`;
    });
    html += '</div>';
  }

  categoryList.innerHTML = html;

  categoryList.querySelectorAll('.category-item').forEach(item => {
    const type = item.dataset.type;
    const value = item.dataset.value;
    const select = () => selectCategory(type, value);
    item.addEventListener('click', select);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });
}

function filterChannels(search = '', group = '') {
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
  focusedChannelIndex = -1;
  renderChannelList(filtered);
}

function renderChannelList(list) {
  channelList.innerHTML = list.map((ch, i) => `
    <div class="channel-item" data-url="${ch.url}" data-name="${ch.name || 'Channel'}" data-index="${i}" tabindex="0" role="button">
      <img class="channel-logo" src="${ch.logo || ''}" alt="" onerror="this.style.display='none'">
      <div class="channel-info">
        <div class="channel-name">${ch.name || 'Unknown'}</div>
        <div class="channel-group">${ch.group || ''}</div>
      </div>
    </div>
  `).join('');

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

function showChannelToast(name) {
  channelToast.textContent = name;
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

  nowPlaying.textContent = `Now playing: ${name}`;
}

function playPrevChannel() {
  if (filteredChannels.length === 0) return;
  focusedChannelIndex = focusedChannelIndex <= 0 ? filteredChannels.length - 1 : focusedChannelIndex - 1;
  const ch = filteredChannels[focusedChannelIndex];
  const el = channelList.querySelector(`[data-index="${focusedChannelIndex}"]`);
  playChannel(ch.url, ch.name || 'Channel', el);
  el?.focus();
}

function playNextChannel() {
  if (filteredChannels.length === 0) return;
  focusedChannelIndex = focusedChannelIndex >= filteredChannels.length - 1 ? 0 : focusedChannelIndex + 1;
  const ch = filteredChannels[focusedChannelIndex];
  const el = channelList.querySelector(`[data-index="${focusedChannelIndex}"]`);
  playChannel(ch.url, ch.name || 'Channel', el);
  el?.focus();
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

async function loadPlaylist(id) {
  const pl = PLAYLISTS[id];
  if (!pl) return;
  selectedPlaylistId = id;
  selectedGroup = '';
  try {
    loading.classList.add('visible');
    const fetchUrl = pl.url.startsWith('http') ? pl.url : encodeURI(pl.url);
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    channels = parseM3U(text);
    renderCategories();
    filterChannels();
    loading.classList.remove('visible');
  } catch (err) {
    loading.classList.remove('visible');
    errorEl.textContent = 'Failed to load playlist: ' + err.message;
    errorEl.classList.add('visible');
    errorEl.style.position = 'relative';
  }
}

document.addEventListener('keydown', (e) => {
  const inChannelList = channelList.contains(document.activeElement);
  const inCategoryList = categoryList.contains(document.activeElement);
  const inInput = document.activeElement === searchInput;

  if (inInput) return;

  const channelItems = channelList.querySelectorAll('.channel-item');
  const categoryItems = categoryList.querySelectorAll('.category-item');
  const currentChannel = inChannelList ? document.activeElement.closest('.channel-item') : null;
  const currentCategory = inCategoryList ? document.activeElement.closest('.category-item') : null;
  const channelIdx = currentChannel ? parseInt(currentChannel.dataset.index, 10) : -1;
  const categoryIdx = currentCategory ? Array.from(categoryItems).indexOf(currentCategory) : -1;

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      if (inChannelList && channelIdx > 0) {
        const prev = channelItems[channelIdx - 1];
        prev.focus();
        prev.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (inCategoryList && categoryIdx > 0) {
        categoryItems[categoryIdx - 1].focus();
        categoryItems[categoryIdx - 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (video.classList.contains('playing') && !inChannelList && !inCategoryList) {
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
        categoryItems[categoryIdx + 1].focus();
        categoryItems[categoryIdx + 1].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (video.classList.contains('playing') && !inChannelList && !inCategoryList) {
        playNextChannel();
        showControlsTemporarily();
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (inChannelList && categoryItems.length > 0) {
        categoryItems[0].focus();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (inCategoryList && channelItems.length > 0) {
        channelItems[0].focus();
      } else if (inChannelList) {
        videoContainer?.focus();
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
      if (currentChannel) {
        e.preventDefault();
        playChannel(currentChannel.dataset.url, currentChannel.dataset.name, currentChannel);
      }
      break;
    case 'Escape':
      if (document.fullscreenElement) document.exitFullscreen?.();
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
videoContainer.addEventListener('keydown', () => showControlsTemporarily());

setupVideoControls();
renderCategories();
loadPlaylist('south-indian');

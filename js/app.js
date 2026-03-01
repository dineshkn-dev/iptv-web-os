const PLAYLISTS = {
  'south-indian': 'https://raw.githubusercontent.com/dineshkn-dev/mylinks/main/south_indian_playlist.m3u',
  'sports-all': 'm3u-links/1-IPTV Sports All Channels List.m3u',
  'sports-m3u': 'm3u-links/4-IPTV Sports List M3u Channels.m3u',
  'sports-being': 'm3u-links/ONLY BEING SPORTS Channel 1, to 17.m3u',
};

const video = document.getElementById('video');
const channelList = document.getElementById('channelList');
const groupsContainer = document.getElementById('groups');
const searchInput = document.getElementById('search');
const playlistSelect = document.getElementById('playlist');
const placeholder = document.getElementById('placeholder');
const loading = document.getElementById('loading');
const errorEl = document.getElementById('error');
const nowPlaying = document.getElementById('nowPlaying');

let channels = [];
let hls = null;
let activeChannel = null;

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

function renderGroups() {
  const groups = getUniqueGroups();
  groupsContainer.innerHTML = groups.map(g => 
    `<button class="group-btn" data-group="${g}">${g}</button>`
  ).join('');

  groupsContainer.querySelectorAll('.group-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      groupsContainer.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterChannels(searchInput.value, btn.dataset.group);
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
  renderChannelList(filtered);
}

function renderChannelList(list) {
  channelList.innerHTML = list.map(ch => `
    <div class="channel-item" data-url="${ch.url}" data-name="${ch.name || 'Channel'}">
      <img class="channel-logo" src="${ch.logo || ''}" alt="" onerror="this.style.display='none'">
      <div class="channel-info">
        <div class="channel-name">${ch.name || 'Unknown'}</div>
        <div class="channel-group">${ch.group || ''}</div>
      </div>
    </div>
  `).join('');

  channelList.querySelectorAll('.channel-item').forEach(item => {
    item.addEventListener('click', () => playChannel(item.dataset.url, item.dataset.name, item));
  });
}

function playChannel(url, name, el) {
  activeChannel = { url, name };
  channelList.querySelectorAll('.channel-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
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
    });
  } else {
    video.src = url;
    video.addEventListener('loadeddata', () => {
      loading.classList.remove('visible');
      video.classList.add('playing');
      video.play().catch(() => {});
    });
  }

  video.onerror = () => {
    loading.classList.remove('visible');
    errorEl.textContent = 'Failed to load stream. Channel may be offline.';
    errorEl.classList.add('visible');
  };

  nowPlaying.textContent = `Now playing: ${name}`;
}

searchInput.addEventListener('input', () => {
  const activeGroup = groupsContainer.querySelector('.group-btn.active');
  filterChannels(searchInput.value, activeGroup?.dataset.group || '');
});

async function loadPlaylist() {
  const id = playlistSelect.value;
  const url = PLAYLISTS[id];
  if (!url) return;
  try {
    loading.classList.add('visible');
    const fetchUrl = url.startsWith('http') ? url : encodeURI(url);
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    channels = parseM3U(text);
    renderGroups();
    filterChannels();
    loading.classList.remove('visible');
  } catch (err) {
    loading.classList.remove('visible');
    errorEl.textContent = 'Failed to load playlist: ' + err.message;
    errorEl.classList.add('visible');
    errorEl.style.position = 'relative';
  }
}

playlistSelect.addEventListener('change', loadPlaylist);
loadPlaylist();

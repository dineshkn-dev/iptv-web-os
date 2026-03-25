import { setupNavigation } from './modules/navigation.js';
import { fetchBasePlaylist } from './modules/playlist.js';
import { createPlayerController } from './modules/player.js';
import { createRenderer } from './modules/render.js';
import { createAppState } from './modules/state.js';

const elements = {
  video: document.getElementById('video'),
  channelList: document.getElementById('channelList'),
  categoryList: document.getElementById('categoryList'),
  searchInput: document.getElementById('search'),
  placeholder: document.getElementById('placeholder'),
  loading: document.getElementById('loading'),
  errorEl: document.getElementById('error'),
  nowPlaying: document.getElementById('nowPlaying'),
  channelToast: document.getElementById('channelToast'),
  videoControls: document.getElementById('videoControls'),
  videoContainer: document.getElementById('videoContainer'),
};

const numberZap = document.createElement('div');
numberZap.id = 'numberZap';
numberZap.className = 'number-zap';
elements.videoContainer.appendChild(numberZap);
elements.numberZap = numberZap;

const state = createAppState();
let searchDebounceTimer = null;

let player;

const renderer = createRenderer({
  state,
  elements,
  onPlayChannel: (...args) => player.playChannel(...args),
});

player = createPlayerController({
  state,
  elements,
  focusChannelByIndex: renderer.focusChannelByIndex,
});

setupNavigation({
  state,
  elements,
  renderer,
  player,
});

player.setupVideoControls();
player.bindPlayerSurfaceInteractions();

elements.searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderer.filterChannels(elements.searchInput.value, state.selectedGroup);
  }, 180);
});

async function init() {
  state.selectedGroup = '';
  try {
    elements.loading.classList.add('visible');
    state.channels = await fetchBasePlaylist();

    const isWebOs = /web0s|webos|netcast|smarttv|hbbtv/i.test(navigator.userAgent);
    const usePerformanceLite = isWebOs || state.channels.length > 500;
    state.performanceLite = usePerformanceLite;
    document.body.classList.toggle('perf-lite', usePerformanceLite);

    renderer.renderCategories();
    renderer.filterChannels();
    document.body.classList.add('app-ready');
    elements.loading.classList.remove('visible');
  } catch (err) {
    renderer.renderCategories();
    elements.loading.classList.remove('visible');
    elements.errorEl.textContent = 'Failed to load base playlist: ' + err.message;
    elements.errorEl.classList.add('visible');
    elements.errorEl.style.position = 'relative';
  }
}

init();

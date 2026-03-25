export function createPlayerController({ state, elements, focusChannelByIndex }) {
  const {
    video,
    channelList,
    placeholder,
    loading,
    errorEl,
    nowPlaying,
    channelToast,
    videoControls,
    videoContainer,
  } = elements;

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildErrorMarkup(message, channelName) {
    const safeMessage = escapeHtml(message || 'Playback failed.');
    const safeChannel = escapeHtml(channelName || state.activeChannel?.name || 'Unknown channel');
    return `
      <div class="error-title">Playback Error</div>
      <div class="error-message">${safeMessage}</div>
      <div class="error-meta">Channel: ${safeChannel}</div>
      <div class="error-hint">Try another channel. Some streams are temporarily unavailable.</div>
    `;
  }

  function showChannelToast(name) {
    channelToast.textContent = name;
    channelToast.classList.remove('visible');
    void channelToast.offsetWidth;
    channelToast.classList.add('visible');
    clearTimeout(channelToast._tid);
    channelToast._tid = setTimeout(() => channelToast.classList.remove('visible'), 2500);
  }

  function toggleFullscreen() {
    videoContainer.classList.add('is-fs-transitioning');
    document.addEventListener(
      'fullscreenchange',
      () => videoContainer.classList.remove('is-fs-transitioning'),
      { once: true }
    );
    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function showControlsTemporarily() {
    videoControls.classList.add('visible');
    clearTimeout(state.controlsTimeout);
    state.controlsTimeout = setTimeout(() => {
      if (video.paused) return;
      videoControls.classList.remove('visible');
    }, 3000);
  }

  function handlePlaybackReady() {
    loading.classList.remove('visible');
    video.classList.add('playing');
    showControlsTemporarily();
  }

  function clearPlayerError() {
    errorEl.classList.remove('visible');
    errorEl.innerHTML = '';
  }

  function handlePlaybackFailure(message, channelName) {
    loading.classList.remove('visible');
    errorEl.innerHTML = buildErrorMarkup(message, channelName);
    errorEl.classList.add('visible');
  }

  function destroyHlsInstance() {
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
  }

  function playChannel(url, name, el) {
    state.activeChannel = { url, name };
    if (el && el.dataset.index != null) {
      state.focusedChannelIndex = parseInt(el.dataset.index, 10);
    }

    channelList
      .querySelectorAll('.channel-item')
      .forEach((item) => item.classList.remove('active'));
    if (el) el.classList.add('active');

    showChannelToast(name);
    placeholder.classList.add('hidden');
    loading.classList.add('visible');
    clearPlayerError();
    video.classList.remove('playing');

    destroyHlsInstance();

    const isHlsUrl = url.includes('.m3u8') || url.includes('m3u8');
    video.src = '';

    if (isHlsUrl && typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
      state.hls = new window.Hls({
        enableWorker: true,
      });
      state.hls.loadSource(url);
      state.hls.attachMedia(video);
      state.hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        // Start the decoder pipeline immediately so segments buffer in the background.
        // Only reveal the video once the browser has decoded enough frames to display.
        video.play().catch(() => {});
        video.addEventListener('canplay', handlePlaybackReady, { once: true });
      });
      state.hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          handlePlaybackFailure(`Stream error: ${data.type}`, name);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHlsUrl) {
      video.src = url;
      video.play().catch(() => {});
      video.addEventListener('canplay', handlePlaybackReady, { once: true });
    } else {
      video.src = url;
      video.addEventListener('canplay', handlePlaybackReady, { once: true });
    }

    video.onerror = () => {
      handlePlaybackFailure('Failed to load stream. Channel may be offline.', name);
    };

    nowPlaying.textContent = `Now playing: ${name}`;
  }

  function playPrevChannel() {
    if (state.filteredChannels.length === 0) return;
    const currentIdx = state.activeChannel
      ? state.filteredChannels.findIndex((channel) => channel.url === state.activeChannel.url)
      : -1;
    state.focusedChannelIndex =
      currentIdx <= 0 ? state.filteredChannels.length - 1 : currentIdx - 1;
    const channel = state.filteredChannels[state.focusedChannelIndex];
    const item = focusChannelByIndex(state.focusedChannelIndex);
    playChannel(channel.url, channel.name || 'Channel', item);
  }

  function playNextChannel() {
    if (state.filteredChannels.length === 0) return;
    const currentIdx = state.activeChannel
      ? state.filteredChannels.findIndex((channel) => channel.url === state.activeChannel.url)
      : -1;
    state.focusedChannelIndex =
      currentIdx >= state.filteredChannels.length - 1 ? 0 : currentIdx + 1;
    const channel = state.filteredChannels[state.focusedChannelIndex];
    const item = focusChannelByIndex(state.focusedChannelIndex);
    playChannel(channel.url, channel.name || 'Channel', item);
  }

  function setupVideoControls() {
    document.getElementById('btnChPrev').addEventListener('click', playPrevChannel);
    document.getElementById('btnChNext').addEventListener('click', playNextChannel);
    document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);
  }

  function bindPlayerSurfaceInteractions() {
    videoContainer.addEventListener('click', () => {
      videoContainer.focus();
      showControlsTemporarily();
    });
    videoContainer.addEventListener('mousemove', showControlsTemporarily);
    videoContainer.addEventListener('keydown', showControlsTemporarily);
  }

  return {
    bindPlayerSurfaceInteractions,
    playChannel,
    playNextChannel,
    playPrevChannel,
    setupVideoControls,
    showControlsTemporarily,
    toggleFullscreen,
  };
}

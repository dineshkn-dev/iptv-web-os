export function createPlayerController({
  state,
  elements,
  focusChannelByIndex,
  scheduleUiDim,
  wakeUiFromNavigation,
  clearUiDimTimer,
  setUiDimmed,
}) {
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

  function showChannelToast(name) {
    channelToast.textContent = name;
    channelToast.classList.remove('visible');
    void channelToast.offsetWidth;
    channelToast.classList.add('visible');
    clearTimeout(channelToast._tid);
    channelToast._tid = setTimeout(() => channelToast.classList.remove('visible'), 2500);
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
    clearTimeout(state.controlsTimeout);
    wakeUiFromNavigation();
    state.controlsTimeout = setTimeout(() => {
      if (video.paused) return;
      videoControls.classList.remove('visible');
    }, 3000);
  }

  function handlePlaybackReady() {
    loading.classList.remove('visible');
    video.classList.add('playing');
    video.play().catch(() => {});
    scheduleUiDim();
    showControlsTemporarily();
  }

  function clearPlayerError() {
    errorEl.classList.remove('visible');
  }

  function handlePlaybackFailure(message) {
    loading.classList.remove('visible');
    clearUiDimTimer();
    setUiDimmed(false);
    errorEl.textContent = message;
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

    channelList.querySelectorAll('.channel-item').forEach(item => item.classList.remove('active'));
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
        lowLatencyMode: true,
      });
      state.hls.loadSource(url);
      state.hls.attachMedia(video);
      state.hls.on(window.Hls.Events.MANIFEST_PARSED, handlePlaybackReady);
      state.hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          handlePlaybackFailure(`Stream error: ${data.type}`);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHlsUrl) {
      video.src = url;
      video.addEventListener('loadedmetadata', handlePlaybackReady, { once: true });
    } else {
      video.src = url;
      video.addEventListener('loadeddata', handlePlaybackReady, { once: true });
    }

    video.onerror = () => {
      handlePlaybackFailure('Failed to load stream. Channel may be offline.');
    };

    nowPlaying.innerHTML = `<span style="color:var(--accent-soft)">▸</span> Now playing: <strong>${name}</strong>`;
  }

  function playPrevChannel() {
    if (state.filteredChannels.length === 0) return;
    const currentIdx = state.activeChannel
      ? state.filteredChannels.findIndex(channel => channel.url === state.activeChannel.url)
      : -1;
    state.focusedChannelIndex = currentIdx <= 0 ? state.filteredChannels.length - 1 : currentIdx - 1;
    const channel = state.filteredChannels[state.focusedChannelIndex];
    const item = focusChannelByIndex(state.focusedChannelIndex);
    playChannel(channel.url, channel.name || 'Channel', item);
  }

  function playNextChannel() {
    if (state.filteredChannels.length === 0) return;
    const currentIdx = state.activeChannel
      ? state.filteredChannels.findIndex(channel => channel.url === state.activeChannel.url)
      : -1;
    state.focusedChannelIndex = currentIdx >= state.filteredChannels.length - 1 ? 0 : currentIdx + 1;
    const channel = state.filteredChannels[state.focusedChannelIndex];
    const item = focusChannelByIndex(state.focusedChannelIndex);
    playChannel(channel.url, channel.name || 'Channel', item);
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

  function bindPlayerSurfaceInteractions() {
    videoContainer.addEventListener('click', () => {
      videoContainer.focus();
      showControlsTemporarily();
    });
    videoContainer.addEventListener('mousemove', showControlsTemporarily);
    videoContainer.addEventListener('keydown', showControlsTemporarily);

    video.addEventListener('play', () => scheduleUiDim());
    video.addEventListener('pause', () => {
      clearUiDimTimer();
      setUiDimmed(false);
    });
    video.addEventListener('ended', () => {
      clearUiDimTimer();
      setUiDimmed(false);
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        clearUiDimTimer();
        setUiDimmed(false);
      } else {
        scheduleUiDim();
      }
    });
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

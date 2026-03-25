export function setupNavigation({ state, elements, renderer, player, wakeUiFromNavigation }) {
  const {
    video,
    channelList,
    categoryList,
    searchInput,
    videoControls,
    videoContainer,
    numberZap,
  } = elements;

  function showNumberZap(value, invalid = false) {
    numberZap.textContent = value;
    numberZap.classList.toggle('invalid', invalid);
    numberZap.classList.add('visible');
  }

  function clearNumberZap() {
    state.numberBuffer = '';
    clearTimeout(state.numberBufferTimer);
    numberZap.classList.remove('visible', 'invalid');
  }

  function zapToChannel(number) {
    if (!Number.isInteger(number) || number <= 0) {
      showNumberZap(`${number}`, true);
      clearTimeout(state.numberBufferTimer);
      state.numberBufferTimer = setTimeout(clearNumberZap, 900);
      return false;
    }

    const channel = state.channels.find((item) => item.number === number);
    if (!channel) {
      showNumberZap(`${number}`, true);
      clearTimeout(state.numberBufferTimer);
      state.numberBufferTimer = setTimeout(clearNumberZap, 900);
      return false;
    }

    renderer.ensureChannelVisible(channel);
    const index = state.filteredChannels.findIndex((item) => item.url === channel.url);
    if (index < 0) {
      showNumberZap(`${number}`, true);
      clearTimeout(state.numberBufferTimer);
      state.numberBufferTimer = setTimeout(clearNumberZap, 900);
      return false;
    }

    const item = renderer.focusChannelByIndex(index);
    player.playChannel(channel.url, channel.name || `Channel ${number}`, item);
    player.showControlsTemporarily();
    clearTimeout(state.numberBufferTimer);
    state.numberBufferTimer = setTimeout(clearNumberZap, 900);
    return true;
  }

  function handleNumberKey(digit) {
    state.numberBuffer = `${state.numberBuffer}${digit}`.replace(/^0+/, '');
    if (!state.numberBuffer) state.numberBuffer = '0';
    showNumberZap(state.numberBuffer, false);
    clearTimeout(state.numberBufferTimer);
    state.numberBufferTimer = setTimeout(() => {
      const parsed = parseInt(state.numberBuffer, 10);
      zapToChannel(parsed);
      state.numberBuffer = '';
    }, 1400);
  }

  document.addEventListener('keydown', (event) => {
    const inChannelList = channelList.contains(document.activeElement);
    const inCategoryList = categoryList.contains(document.activeElement);
    const inControls = videoControls.contains(document.activeElement);
    const onVideoContainer = document.activeElement === videoContainer;
    const inInput = document.activeElement === searchInput;

    if (inInput) return;

    const isDigit = /^[0-9]$/.test(event.key);
    if (isDigit) {
      event.preventDefault();
      handleNumberKey(event.key);
      return;
    }

    const channelItems = channelList.querySelectorAll('.channel-item');
    const categoryItems = categoryList.querySelectorAll('.category-item');
    const controlButtons = Array.from(videoControls.querySelectorAll('.ctrl-btn'));
    const preferredControl = controlButtons[1] || controlButtons[0] || null;
    const currentChannel = inChannelList ? document.activeElement.closest('.channel-item') : null;
    const currentCategory = inCategoryList
      ? document.activeElement.closest('.category-item')
      : null;
    const currentControl = inControls ? document.activeElement.closest('.ctrl-btn') : null;
    const channelIdx = currentChannel ? parseInt(currentChannel.dataset.index, 10) : -1;
    const categoryIdx = currentCategory ? Array.from(categoryItems).indexOf(currentCategory) : -1;
    const controlIdx = currentControl ? controlButtons.indexOf(currentControl) : -1;

    if (inChannelList || inCategoryList) {
      wakeUiFromNavigation();
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (inChannelList && channelIdx > 0) {
          renderer.focusChannelByIndex(channelIdx - 1);
        } else if (inCategoryList && categoryIdx > 0) {
          renderer.focusCategoryByIndex(categoryIdx - 1);
        } else if (inControls && channelItems.length > 0) {
          const target = state.focusedChannelIndex >= 0 ? state.focusedChannelIndex : 0;
          renderer.focusChannelByIndex(target);
        } else if (!inChannelList && !inCategoryList && !inControls && channelItems.length > 0) {
          const target = state.focusedChannelIndex > 0 ? state.focusedChannelIndex - 1 : 0;
          renderer.focusChannelByIndex(target);
        } else if (
          video.classList.contains('playing') &&
          !inChannelList &&
          !inCategoryList &&
          !inControls
        ) {
          player.playPrevChannel();
          player.showControlsTemporarily();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (inChannelList && channelIdx >= 0 && channelIdx < channelItems.length - 1) {
          renderer.focusChannelByIndex(channelIdx + 1);
        } else if (inCategoryList && categoryIdx >= 0 && categoryIdx < categoryItems.length - 1) {
          renderer.focusCategoryByIndex(categoryIdx + 1);
        } else if (onVideoContainer && preferredControl) {
          preferredControl.focus();
        } else if (!inChannelList && !inCategoryList && !inControls && channelItems.length > 0) {
          const target =
            state.focusedChannelIndex >= 0 && state.focusedChannelIndex < channelItems.length - 1
              ? state.focusedChannelIndex + 1
              : 0;
          renderer.focusChannelByIndex(target);
        } else if (
          video.classList.contains('playing') &&
          !inChannelList &&
          !inCategoryList &&
          !inControls
        ) {
          player.playNextChannel();
          player.showControlsTemporarily();
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (inControls && controlIdx > 0) {
          controlButtons[controlIdx - 1].focus();
        } else if (inControls && channelItems.length > 0) {
          const target = state.focusedChannelIndex >= 0 ? state.focusedChannelIndex : 0;
          renderer.focusChannelByIndex(target);
        } else if (onVideoContainer && preferredControl) {
          preferredControl.focus();
        } else if (inChannelList && categoryItems.length > 0) {
          renderer.focusPreferredCategory();
        }
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (inCategoryList && channelItems.length > 0) {
          const target = state.focusedChannelIndex >= 0 ? state.focusedChannelIndex : 0;
          renderer.focusChannelByIndex(target);
        } else if (inChannelList && preferredControl) {
          preferredControl.focus();
        } else if (inControls && controlIdx >= 0 && controlIdx < controlButtons.length - 1) {
          controlButtons[controlIdx + 1].focus();
        } else if (inChannelList) {
          videoContainer.focus();
        } else if (onVideoContainer && preferredControl) {
          preferredControl.focus();
        }
        break;
      case 'ChannelDown':
      case 'PageDown':
        event.preventDefault();
        if (video.classList.contains('playing') || state.filteredChannels.length > 0) {
          player.playPrevChannel();
          player.showControlsTemporarily();
        }
        break;
      case 'ChannelUp':
      case 'PageUp':
        event.preventDefault();
        if (video.classList.contains('playing') || state.filteredChannels.length > 0) {
          player.playNextChannel();
          player.showControlsTemporarily();
        }
        break;
      case ' ':
      case 'Enter':
        if (state.numberBuffer) {
          event.preventDefault();
          const parsed = parseInt(state.numberBuffer, 10);
          zapToChannel(parsed);
          state.numberBuffer = '';
          return;
        }
        if (currentCategory) {
          event.preventDefault();
          currentCategory.click();
        } else if (currentControl) {
          event.preventDefault();
          currentControl.click();
        } else if (onVideoContainer) {
          event.preventDefault();
          if (video.paused) video.play().catch(() => {});
          else video.pause();
          player.showControlsTemporarily();
        } else if (currentChannel) {
          event.preventDefault();
          player.playChannel(
            currentChannel.dataset.url,
            currentChannel.dataset.name,
            currentChannel
          );
        } else if (channelItems.length > 0) {
          event.preventDefault();
          const idx = state.focusedChannelIndex >= 0 ? state.focusedChannelIndex : 0;
          const item = renderer.focusChannelByIndex(idx);
          if (item) player.playChannel(item.dataset.url, item.dataset.name, item);
        }
        break;
      case 'Backspace':
        if (state.numberBuffer) {
          event.preventDefault();
          state.numberBuffer = state.numberBuffer.slice(0, -1);
          if (!state.numberBuffer) {
            clearNumberZap();
          } else {
            showNumberZap(state.numberBuffer, false);
          }
        }
        break;
      case 'Escape':
        if (state.numberBuffer) {
          clearNumberZap();
        } else if (document.fullscreenElement) {
          document.exitFullscreen?.();
        }
        break;
      case 'Home':
        event.preventDefault();
        if (channelItems.length > 0) renderer.focusChannelByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        if (channelItems.length > 0) renderer.focusChannelByIndex(channelItems.length - 1);
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        player.toggleFullscreen();
        break;
      default:
        break;
    }

    if (
      video.classList.contains('playing') &&
      ['ArrowUp', 'ArrowDown', 'ChannelUp', 'ChannelDown', ' '].includes(event.key)
    ) {
      player.showControlsTemporarily();
    }
  });

  document.addEventListener('focusin', (event) => {
    if (
      categoryList.contains(event.target) ||
      channelList.contains(event.target) ||
      event.target === searchInput
    ) {
      wakeUiFromNavigation();
    }
  });

  categoryList.addEventListener('pointermove', wakeUiFromNavigation);
  channelList.addEventListener('pointermove', wakeUiFromNavigation);
  searchInput.addEventListener('focus', wakeUiFromNavigation);
}

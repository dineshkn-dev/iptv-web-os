export function createFocusMode({ elements }) {
  let uiDimTimeout = null;

  function isWindowedPlaybackActive() {
    return (
      elements.video.classList.contains('playing') &&
      !elements.video.paused &&
      !document.fullscreenElement
    );
  }

  function setUiDimmed(dimmed) {
    document.body.classList.toggle('playback-focus-mode', dimmed);
  }

  function clearUiDimTimer() {
    clearTimeout(uiDimTimeout);
    uiDimTimeout = null;
  }

  function scheduleUiDim(delay = 1600) {
    clearUiDimTimer();
    if (!isWindowedPlaybackActive()) {
      setUiDimmed(false);
      return;
    }

    uiDimTimeout = setTimeout(() => {
      if (isWindowedPlaybackActive()) {
        setUiDimmed(true);
      }
    }, delay);
  }

  function wakeUiFromNavigation() {
    if (!isWindowedPlaybackActive()) {
      setUiDimmed(false);
      return;
    }

    setUiDimmed(false);
    scheduleUiDim(2400);
  }

  return {
    clearUiDimTimer,
    scheduleUiDim,
    setUiDimmed,
    wakeUiFromNavigation,
  };
}

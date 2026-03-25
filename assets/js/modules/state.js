export function createAppState() {
  return {
    channels: [],
    filteredChannels: [],
    hls: null,
    activeChannel: null,
    focusedChannelIndex: -1,
    focusedCategoryIndex: 0,
    controlsTimeout: null,
    selectedGroup: '',
    numberBuffer: '',
    numberBufferTimer: null,
    performanceLite: false,
  };
}

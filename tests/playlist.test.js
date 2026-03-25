import { describe, expect, it } from 'vitest';
import { getUniqueGroups, parseM3U } from '../assets/js/modules/playlist.js';

describe('parseM3U', () => {
  it('parses channels with metadata and URLs', () => {
    const input = `#EXTM3U
#EXTINF:-1 tvg-logo="https://img.test/logo.png" group-title="News;EN",BBC World
https://stream.test/live/bbc.m3u8
#EXTINF:-1 group-title="Sports",ESPN
https://stream.test/live/espn.m3u8`;

    const channels = parseM3U(input);

    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({
      name: 'BBC World',
      logo: 'https://img.test/logo.png',
      group: 'News',
      url: 'https://stream.test/live/bbc.m3u8',
    });
    expect(channels[1]).toMatchObject({
      name: 'ESPN',
      group: 'Sports',
      url: 'https://stream.test/live/espn.m3u8',
    });
  });

  it('handles BOM and windows newlines', () => {
    const input = '\uFEFF#EXTM3U\r\n#EXTINF:-1,Channel One\r\nhttps://stream.test/one.m3u8\r\n';
    const channels = parseM3U(input);

    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('Channel One');
    expect(channels[0].url).toBe('https://stream.test/one.m3u8');
  });
});

describe('getUniqueGroups', () => {
  it('returns sorted unique groups and ignores missing groups', () => {
    const groups = getUniqueGroups([
      { group: 'Sports' },
      { group: 'News' },
      { group: 'Sports' },
      { name: 'No Group' },
    ]);

    expect(groups).toEqual(['News', 'Sports']);
  });
});

export const BASE_PLAYLIST_URL = 'data/playlist.m3u8';

export function parseM3U(text) {
  const lines = text.split('\n');
  const result = [];
  let current = null;

  for (let i = 0; i < lines.length; i += 1) {
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

export function getUniqueGroups(channels) {
  const set = new Set();
  channels.forEach(channel => {
    if (channel.group) set.add(channel.group);
  });
  return Array.from(set).sort();
}

export async function fetchBasePlaylist(url = BASE_PLAYLIST_URL) {
  const res = await fetch(encodeURI(url));
  if (!res.ok) throw new Error(res.statusText);
  const text = await res.text();
  return parseM3U(text).map((channel, index) => ({
    ...channel,
    number: index + 1,
  }));
}

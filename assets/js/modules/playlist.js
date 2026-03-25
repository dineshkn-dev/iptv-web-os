export const BASE_PLAYLIST_URL = 'data/playlist.m3u8';

const GROUP_ALIASES = {
  sport: 'Sports',
  sports: 'Sports',
  movie: 'Movies',
  movies: 'Movies',
  kid: 'Kids',
  kids: 'Kids',
  music: 'Music',
  news: 'News',
  documentary: 'Documentary',
  religious: 'Religious',
  religion: 'Religious',
  business: 'Business',
  general: 'General',
  undefined: 'General',
};

function normalizeGroupValue(raw = '') {
  return String(raw).split(';')[0].trim().replace(/\s+/g, ' ');
}

function isUndefinedLike(value = '') {
  return /^(undefined|uncategorized|unknown|none|null|n\/a|na|other|misc)$/i.test(value.trim());
}

function canonicalizeCategory(value = '') {
  const normalized = normalizeGroupValue(value);
  if (!normalized) return '';
  const alias = GROUP_ALIASES[normalized.toLowerCase()];
  return alias || normalized;
}

function inferCategoryFromName(name = '') {
  const value = name.toLowerCase();

  if (
    /(news|samachar|aaj tak|times now|republic|ndtv|lok sabha|rajya sabha|mirror now)/.test(value)
  ) {
    return 'News';
  }

  if (/(movie|movies|cinema|films?|pix|max|filmy|b4u|gold|action)/.test(value)) {
    return 'Movies';
  }

  if (/(kids|kid|cartoon|nick|pogo|disney|chintu|sonic|animax|jr\b|hungama|toon)/.test(value)) {
    return 'Kids';
  }

  if (/(music|mtv|9xm|sangeet|musix|masti|hits|jalwa|jukebox|dhol|chakde|vibe)/.test(value)) {
    return 'Music';
  }

  if (/(sports?|espn|eurosport|willow|cricket|football|ten )/.test(value)) {
    return 'Sports';
  }

  if (/(bhakti|aastha|sadhna|sai tv|prarthana|madha|gospel|harvest|namdhari|relig)/.test(value)) {
    return 'Religious';
  }

  if (/(history|discovery|nat geo|animal|documentary|science|investigation)/.test(value)) {
    return 'Documentary';
  }

  if (/(business|profit|et now|cnbc|market)/.test(value)) {
    return 'Business';
  }

  if (/(food|lifestyle|travel|fashion|shop)/.test(value)) {
    return 'Lifestyle';
  }

  if (/comedy/.test(value)) {
    return 'Comedy';
  }

  return 'General';
}

function recategorizeGroup(group, channelName) {
  const normalized = normalizeGroupValue(group);
  const inferred = inferCategoryFromName(channelName);

  if (!normalized || isUndefinedLike(normalized)) {
    return inferred;
  }

  const parts = normalized.split('-').map((part) => part.trim());
  if (parts.length === 2 && parts[0]) {
    const [prefix, suffix] = parts;
    if (isUndefinedLike(suffix)) {
      return `${prefix} - ${inferred}`;
    }
    return `${prefix} - ${canonicalizeCategory(suffix)}`;
  }

  return canonicalizeCategory(normalized);
}

export function parseM3U(text) {
  const lines = String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
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
      if (groupMatch) current.group = groupMatch[1];
    } else if (current && line && !line.startsWith('#')) {
      current.url = line;
      current.group = recategorizeGroup(current.group, current.name);
      result.push(current);
      current = null;
    }
  }

  return result;
}

export function getUniqueGroups(channels) {
  const set = new Set();
  channels.forEach((channel) => {
    if (channel.group) set.add(channel.group);
  });
  return Array.from(set).sort();
}

export function getGroupCounts(channels) {
  const counts = {};
  channels.forEach((channel) => {
    if (channel.group) counts[channel.group] = (counts[channel.group] || 0) + 1;
  });
  return counts;
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

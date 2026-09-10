// Count the same normalized images that the importer receives, across all pages.
// Limit parallel requests and cache briefly while a user browses the board list.
export function createPinterestImageCounter(fetchPage) {
  const cache = new Map();
  const waiting = [];
  let active = 0;
  const aborted = () => new DOMException('Aborted', 'AbortError');
  const take = signal => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    if (active < 2) { active++; resolve(); return; }
    const job = { resolve, reject, signal };
    job.cancel = () => {
      const index = waiting.indexOf(job);
      if (index >= 0) waiting.splice(index, 1);
      reject(aborted());
    };
    signal?.addEventListener('abort', job.cancel, { once: true });
    waiting.push(job);
  });
  const release = () => {
    const next = waiting.shift();
    if (next) {
      next.signal?.removeEventListener('abort', next.cancel);
      next.resolve();
    } else active--;
  };
  return async (board, { signal } = {}) => {
    const key = JSON.stringify([board.id, board.pinCount]);
    const saved = cache.get(key);
    if (signal?.aborted) throw aborted();
    if (saved && Date.now() - saved.at < 60000) return saved.count;
    await take(signal);
    try {
      const ids = new Set();
      const bookmarks = new Set();
      let bookmark = null;
      do {
        if (signal?.aborted) throw aborted();
        const page = await fetchPage({ mode: 'pins', boardId: board.id, bookmark }, { signal });
        if (signal?.aborted) throw aborted();
        for (const pin of page.pins || []) if (pin.url) ids.add(pin.id);
        bookmark = page.bookmark || null;
        if (bookmark && bookmarks.has(bookmark)) throw new Error('Repeated Pinterest bookmark');
        if (bookmark) bookmarks.add(bookmark);
      } while (bookmark);
      cache.set(key, { count: ids.size, at: Date.now() });
      return ids.size;
    } finally { release(); }
  };
}

export function pinterestBoardCountLabel(pinCount, imageCount, failed, de) {
  const pins = pinCount == null ? (de ? 'Pins: unbekannt' : 'Pins: unknown')
    : `${pinCount} ${pinCount === 1 ? 'Pin' : 'Pins'}`;
  const images = imageCount == null
    ? (failed ? (de ? 'Bildanzahl nicht verfügbar' : 'image count unavailable')
      : (de ? 'Bilder werden gezählt…' : 'counting images…'))
    : `${imageCount} ${de ? (imageCount === 1 ? 'Bild' : 'Bilder') : (imageCount === 1 ? 'image' : 'images')}`;
  return `${pins} (${images})`;
}

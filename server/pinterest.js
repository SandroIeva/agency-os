// Pinterest exposes carousel images under media.items instead of media.images.
// Give each image a stable selection key while keeping the original Pin ID.
export function pinterestPinImages(pin) {
  if (!pin?.id) return [];
  const media = pin.media;
  const multiple = Array.isArray(media?.items);
  const entries = multiple ? media.items : [media];
  return entries.flatMap((entry, index) => {
    const sizes = Object.entries(entry?.images || {})
      .filter(([, image]) => typeof image?.url === "string" && image.url)
      .map(([key, image]) => ({ ...image, cap: parseInt(key, 10) || 0 }));
    // Width can tie for 600x/1200x versions; prefer the larger named size.
    const best = sizes.sort((a, b) => (b.width || 0) - (a.width || 0) || b.cap - a.cap)[0];
    const url = best?.url || entry?.cover_image_url;
    if (!url) return [];
    return [{
      id: multiple ? `${pin.id}:${index}` : pin.id,
      pinId: pin.id,
      mediaIndex: multiple ? index : null,
      title: entry?.title || pin.title || null,
      description: entry?.description || pin.description || null,
      link: entry?.link || pin.link || null,
      url,
      width: best?.width || entry?.width || null,
      height: best?.height || entry?.height || null,
    }];
  });
}

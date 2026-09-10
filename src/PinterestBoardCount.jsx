import { useEffect, useRef, useState } from 'react';
import { pinterestBoardCountLabel } from './pinterestImageCounts.js';

export default function PinterestBoardCount({ board, countImages, appLanguage }) {
  const element = useRef(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      countImages(board, { signal: controller.signal }).then(count => {
        if (!controller.signal.aborted) setResult({ boardId: board.id, pinCount: board.pinCount, counter: countImages, count });
      }).catch(() => {
        if (!controller.signal.aborted) setResult({ boardId: board.id, pinCount: board.pinCount, counter: countImages, failed: true });
      });
    };
    // Hidden rows should not spend Pinterest requests before they are viewed.
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    });
    if (observer && element.current) observer.observe(element.current);
    else load();
    return () => { observer?.disconnect(); controller.abort(); };
  }, [board.id, board.pinCount, countImages]);
  const current = result?.boardId === board.id && result?.pinCount === board.pinCount && result?.counter === countImages ? result : null;
  return <span ref={element}>{pinterestBoardCountLabel(board.pinCount, current?.count, current?.failed, appLanguage === 'de')}</span>;
}

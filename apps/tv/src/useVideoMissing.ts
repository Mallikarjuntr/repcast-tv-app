import { useEffect, useState } from 'react';

/**
 * True once the phone's picture has been missing for `afterMs` while it's wanted: long enough that a
 * brief reconnect, or the video still starting, isn't mistaken for a network that can't carry it.
 */
export function useVideoMissing(showVideo: boolean, wanted: boolean, afterMs = 6000): boolean {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (showVideo || !wanted) {
      setMissing(false);
      return;
    }
    const timer = setTimeout(() => setMissing(true), afterMs);
    return () => clearTimeout(timer);
  }, [showVideo, wanted, afterMs]);
  return missing;
}

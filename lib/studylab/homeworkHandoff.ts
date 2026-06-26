// Hand-off for a snapped homework photo: the Hub stores it keyed by the new
// LearnSpace id, then the Workspace takes it on its first tutor turn. LearnSpaces
// open in a NEW TAB, so this must cross tabs — localStorage does (the image is
// downscaled first, so it stays well under the quota). It's removed on consume.
const KEY = (spaceId: string) => `studylab:hw:${spaceId}`

export function setHomeworkImage(spaceId: string, dataUrl: string): void {
  try {
    localStorage.setItem(KEY(spaceId), dataUrl)
  } catch {
    /* quota / unavailable — the space just opens without the photo */
  }
}

/** Return and remove the pending homework image for this space, if any. */
export function takeHomeworkImage(spaceId: string): string | null {
  try {
    const v = localStorage.getItem(KEY(spaceId))
    if (v) localStorage.removeItem(KEY(spaceId))
    return v
  } catch {
    return null
  }
}

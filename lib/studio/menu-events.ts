export const CLOSE_NOTIFICATIONS_EVENT = 'ss-close-notifications'

export function closeNotifications() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CLOSE_NOTIFICATIONS_EVENT))
}

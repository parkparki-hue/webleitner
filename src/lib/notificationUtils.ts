import { downloadTextFile } from './syncUtils';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestReminderPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function sendPracticeNotification(title: string, body: string): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'fa',
          tag: 'vazheban-study-reminder',
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
    });
    return true;
  } catch {
    return false;
  }
}

export function downloadCalendarReminderICS(timeHHMM: string): void {
  const [hourStr, minStr] = timeHHMM.split(':');
  const hour = String(Number(hourStr) || 20).padStart(2, '0');
  const min = String(Number(minStr) || 30).padStart(2, '0');

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vazheban Leitner PWA//FA',
    'BEGIN:VEVENT',
    `UID:vazheban-daily-${Date.now()}@local`,
    `DTSTAMP:${y}${m}${d}T${hour}${min}00`,
    `DTSTART:${y}${m}${d}T${hour}${min}00`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:مرور روزانه جعبه لایتنر (واژه‌بان)',
    'DESCRIPTION:زمان مرور لغات موعد رسیده در اپلیکیشن آفلاین واژه‌بان!',
    'BEGIN:VALARM',
    'TRIGGER:-PT5M',
    'ACTION:DISPLAY',
    'DESCRIPTION:یادآور مرور لایتنر',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  downloadTextFile('vazheban-daily-reminder.ics', ics, 'text/calendar;charset=utf-8');
}

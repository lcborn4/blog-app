/** True when the publish calendar day differs from the event date. */
export function postedDayDiffers(eventDate: string, publishedAt?: string | null): boolean {
  if (!publishedAt) return false;
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return false;
  const pad = (n: number) => String(n).padStart(2, '0');
  const publishedDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return publishedDay !== String(eventDate || '').slice(0, 10);
}

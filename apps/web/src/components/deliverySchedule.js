// Delivery uses the same Asia/Kolkata clock and slot starts as the API.
// UI hides elapsed dates/time slots; API revalidates during order submission.
export const deliverySlots = ["10 AM – 1 PM", "1 PM – 4 PM", "4 PM – 7 PM", "7 PM – 10 PM"];
const slotStarts = [600, 780, 960, 1140];

export function indiaNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now).filter(p => p.type !== "literal").map(p => [p.type,p.value]));
  return { date: parts.year+"-"+parts.month+"-"+parts.day, minutes:Number(parts.hour)*60+Number(parts.minute) };
}

export function addCalendarDays(day, days) {
  const date = new Date(day + "T00:00:00Z");
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

export function isBookableDate(day, now=new Date()) {
  const today=indiaNow(now).date;
  return /^\d{4}-\d{2}-\d{2}$/.test(day||"") &&
    !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10)===day &&
    day>=today && day<=addCalendarDays(today,31);
}

export function availableDeliverySlots(day, now=new Date(), minPrepMinutes=0) {
  if (!isBookableDate(day,now)) return [];
  const clock=indiaNow(now);
  if (day>clock.date) return [...deliverySlots];
  return deliverySlots.filter((_,index) => slotStarts[index] >= clock.minutes + minPrepMinutes);
}

// Once all of today's slots have started, remove today from the picker entirely.
export function firstAvailableDate(now=new Date()) {
  const today = indiaNow(now).date;
  return availableDeliverySlots(today,now).length ? today : addCalendarDays(today,1);
}

export type BusinessHour = { day: string; opensAt: string; closesAt: string };

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Dia da semana e minutos do dia no fuso da loja.
function localClock(now: Date, timezone: string): { dayIndex: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dayIndex, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

// Sem horarios cadastrados = sempre aberta. Turno que cruza a meia-noite conta no dia em que abre.
export function isStoreOpen(hours: unknown, timezone: string, now: Date = new Date()): boolean {
  if (!Array.isArray(hours) || hours.length === 0) return true;
  const { dayIndex, minutes } = localClock(now, timezone);
  const today = DAYS[dayIndex];
  const yesterday = DAYS[(dayIndex + 6) % 7];

  return (hours as BusinessHour[]).some((h) => {
    if (!h?.opensAt || !h?.closesAt) return false;
    const opens = toMinutes(h.opensAt);
    const closes = toMinutes(h.closesAt);
    if (opens < closes) return h.day === today && minutes >= opens && minutes < closes;
    // Cruza a meia-noite: parte da noite pertence ao dia, madrugada ao dia anterior.
    return (h.day === today && minutes >= opens) || (h.day === yesterday && minutes < closes);
  });
}

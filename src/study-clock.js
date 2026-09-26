// Conservative estimate: never turn an unattended or sleeping tab into hours
// of study. The caller checkpoints every ten seconds.
export function activeSeconds(clock, now, { visible, focused }) {
  if (
    !clock.enabled ||
    !clock.sessionId ||
    !visible ||
    !focused ||
    now < clock.accountedAt ||
    now - clock.accountedAt > 15000
  )
    return 0;
  return Math.max(
    0,
    Math.min(
      10,
      (Math.min(now, clock.lastInteraction + 90000) - clock.accountedAt) / 1000,
    ),
  );
}
export function timeSegments(start, end) {
  // Split at every second-boundary containing Miami midnight without assuming
  // a fixed UTC offset (daylight saving changes the local date boundary).
  const day = (value) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  if (day(start) === day(end))
    return [{ at: end, seconds: (end - start) / 1000 }];
  let low = start,
    high = end;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (day(middle) === day(start)) low = middle;
    else high = middle;
  }
  return [
    { at: high - 1, seconds: (high - start) / 1000 },
    { at: end, seconds: (end - high) / 1000 },
  ].filter((p) => p.seconds > 0);
}

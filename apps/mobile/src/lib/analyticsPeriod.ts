import { i18n } from '@budgetaiapp/shared';

import type { AnalyticsTimeframe } from './labels';

export type PeriodRange = {
  /** Inclusive start of the period, local midnight. */
  start: Date;
  /** Exclusive end of the period — local midnight of the day right after it. */
  end: Date;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Monday-start week, matching this app's European/Turkish audience.
function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const mondayOffset = (day.getDay() + 6) % 7;
  return addDays(day, -mondayOffset);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

/** The [start, end) window a timeframe + anchor date resolves to. */
export function getPeriodRange(timeframe: AnalyticsTimeframe, anchor: Date): PeriodRange {
  switch (timeframe) {
    case 'day': {
      const start = startOfDay(anchor);
      return { start, end: addDays(start, 1) };
    }
    case 'week': {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 7) };
    }
    case 'month': {
      const start = startOfMonth(anchor);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
    }
    case 'year': {
      const start = startOfYear(anchor);
      return { start, end: new Date(start.getFullYear() + 1, 0, 1) };
    }
  }
}

/** Moves the anchor one whole period forward or back, e.g. one month at a time. */
export function shiftAnchor(timeframe: AnalyticsTimeframe, anchor: Date, direction: 1 | -1): Date {
  switch (timeframe) {
    case 'day':
      return addDays(anchor, direction);
    case 'week':
      return addDays(anchor, direction * 7);
    case 'month':
      return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
    case 'year':
      return new Date(anchor.getFullYear() + direction, 0, 1);
  }
}

/** e.g. "Sun, Aug 23, 2026" / "Aug 18 – 24, 2026" / "August 2026" / "2026". */
export function formatPeriodLabel(timeframe: AnalyticsTimeframe, anchor: Date): string {
  switch (timeframe) {
    case 'day':
      return anchor.toLocaleDateString(i18n.locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    case 'week': {
      const start = startOfWeek(anchor);
      const end = addDays(start, 6);
      const spansMonths = start.getMonth() !== end.getMonth();
      const startLabel = start.toLocaleDateString(i18n.locale, {
        day: 'numeric',
        month: spansMonths ? 'short' : undefined,
      });
      const endLabel = end.toLocaleDateString(i18n.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${startLabel} – ${endLabel}`;
    }
    case 'month':
      return anchor.toLocaleDateString(i18n.locale, { month: 'long', year: 'numeric' });
    case 'year':
      return String(anchor.getFullYear());
  }
}

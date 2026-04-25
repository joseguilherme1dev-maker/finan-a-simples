import type {Bill} from '../types';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export type BillInstance = Bill & {instanceDate: string; isPaid: boolean};

export function expandBillsForMonth(bills: Bill[], month: Date): BillInstance[] {
  const key = monthKey(month);
  const dim = daysInMonth(month);

  const result: BillInstance[] = [];
  for (const b of bills) {
    if (b.repeat === 'none') {
      const bd = parseISODate(b.date);
      if (!isSameMonth(bd, month)) continue;
      const instanceDate = b.date;
      result.push({
        ...b,
        instanceDate,
        isPaid: (b.paidDates ?? []).includes(instanceDate),
      });
      continue;
    }

    const src = parseISODate(b.date);
    const day = Math.min(src.getDate(), dim);
    const instanceDate = `${key}-${pad2(day)}`;
    result.push({
      ...b,
      instanceDate,
      isPaid: (b.paidDates ?? []).includes(instanceDate),
    });
  }
  return result;
}


'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type DayOffCalendarProps = {
  value: string;
  todayKey: string;
  markedDates?: string[];
  onSelect: (date: string) => void;
};

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const total = year * 12 + (month - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

function firstWeekdayOffset(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthTitle(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function DayOffCalendar({ value, todayKey, markedDates = [], onSelect }: DayOffCalendarProps) {
  const [monthKey, setMonthKey] = useState('');

  useEffect(() => {
    if (!monthKey && todayKey) setMonthKey(monthKeyOf(todayKey));
  }, [todayKey, monthKey]);

  const marked = useMemo(() => new Set(markedDates), [markedDates]);
  const maxMonth = todayKey ? shiftMonthKey(monthKeyOf(todayKey), 11) : '';

  if (!monthKey || !todayKey) {
    return <div className="h-72 w-full animate-pulse rounded-2xl bg-white/[0.03]" />;
  }

  const [year, month] = monthKey.split('-').map(Number);
  const offset = firstWeekdayOffset(year, month);
  const totalDays = daysInMonth(year, month);
  const cells: Array<string | null> = [];
  for (let index = 0; index < offset; index += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(`${year}-${pad(month)}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const goMonth = (delta: number) => {
    const next = shiftMonthKey(monthKey, delta);
    if (next < monthKeyOf(todayKey) || (maxMonth && next > maxMonth)) return;
    setMonthKey(next);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Bulan sebelumnya" disabled={monthKey <= monthKeyOf(todayKey)} onClick={() => goMonth(-1)} className="rounded-lg bg-white/10 p-1.5 text-white/70 transition hover:bg-white/20 disabled:opacity-25">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-bold capitalize text-white/85">{monthTitle(monthKey)}</p>
        <button type="button" aria-label="Bulan berikutnya" disabled={!!maxMonth && monthKey >= maxMonth} onClick={() => goMonth(1)} className="rounded-lg bg-white/10 p-1.5 text-white/70 transition hover:bg-white/20 disabled:opacity-25">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((day) => <span key={day} className="py-1 text-[10px] font-bold uppercase text-white/35">{day}</span>)}
        {cells.map((dateKey, index) => {
          if (!dateKey) return <span key={`blank-${index}`} />;
          const past = dateKey < todayKey;
          const selected = dateKey === value;
          const isMarked = marked.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              disabled={past}
              onClick={() => onSelect(dateKey)}
              className={`relative mx-auto flex size-10 items-center justify-center rounded-xl text-sm transition ${selected ? 'bg-primary font-bold text-black' : past ? 'text-white/20' : isMarked ? 'text-primary hover:bg-primary/20' : 'text-white/80 hover:bg-white/10'}`}
            >
              {Number(dateKey.slice(8, 10))}
              {isMarked && !selected && <span className="absolute bottom-1 size-1 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
      {marked.size > 0 && (
        <p className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2 text-[10px] text-white/40">
          <span className="flex size-3 items-center justify-center rounded-full bg-primary/20"><span className="size-1 rounded-full bg-primary" /></span> Sudah ditandai libur
        </p>
      )}
    </div>
  );
}

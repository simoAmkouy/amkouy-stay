import { supabase } from '@/lib/supabase';
import { logAppError } from '@/utils/errors';
import type { PropertyWithOwner } from './properties';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarDay = {
  date: string;       // YYYY-MM-DD
  dayOfMonth: number; // 1–31
  dayOfWeek: number;  // 0=Sun … 6=Sat (JS convention)
  isToday: boolean;
  isWeekend: boolean;
};

export type CalendarReservationBlock = {
  id: string;
  code: string;
  guestName: string | null;
  status: string;
  checkIn: string;    // YYYY-MM-DD (original, not clamped)
  checkOut: string;   // YYYY-MM-DD (original, not clamped)
  startCol: number;   // 0-based column within the month grid (clamped)
  spanCols: number;   // number of day-columns this block spans (clamped)
  isStart: boolean;   // check-in falls within this month
  isEnd: boolean;     // check-out falls within this month
  totalAmount: number;
  propertyId: string;
};

export type CalendarCleaningMarker = {
  taskId: string;
  col: number;        // 0-based column
  status: string;
  propertyId: string;
};

export type CalendarMaintenanceMarker = {
  ticketId: string;
  col: number;
  priority: string;
  propertyId: string;
};

export type PropertyCalendarRow = {
  property: PropertyWithOwner;
  occupancyPct: number;
  monthRevenue: number;
  reservationBlocks: CalendarReservationBlock[];
  cleaningMarkers: CalendarCleaningMarker[];
  maintenanceMarkers: CalendarMaintenanceMarker[];
  hasConflict: boolean;
};

export type PortfolioCalendarData = {
  year: number;
  month: number; // 1–12
  days: CalendarDay[];
  rows: PropertyCalendarRow[];
  totalProperties: number;
  avgOccupancy: number;
  totalRevenue: number;
};

// Lean raw types to avoid circular imports with reservations.ts / cleaning-tasks.ts
type RawCalendarReservation = {
  id: string;
  reservation_code: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount: number;
  nights: number | null;
  guest: { full_name: string } | null;
};

type RawCleaningTask = {
  id: string;
  property_id: string;
  scheduled_date: string | null;
  status: string;
};

type RawMaintenanceTicket = {
  id: string;
  property_id: string;
  created_at: string;
  priority: string;
  status: string;
};

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

export function monthFirstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function monthLastDay(year: number, month: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;
  const count = getDaysInMonth(year, month);
  const days: CalendarDay[] = [];
  for (let d = 1; d <= count; d++) {
    const mm = String(month).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const date = `${year}-${mm}-${dd}`;
    const dow = new Date(year, month - 1, d).getDay();
    days.push({
      date,
      dayOfMonth: d,
      dayOfWeek: dow,
      isToday: date === today,
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

// Returns the first day-of-week of the month in Mon=0 … Sun=6 (ISO week) convention
export function getMonthStartWeekday(year: number, month: number): number {
  const dow = new Date(year, month - 1, 1).getDay(); // 0=Sun…6=Sat
  return dow === 0 ? 6 : dow - 1;
}

// Builds a 7-column week grid (null = padding before/after month days)
export function buildWeekRows(
  days: CalendarDay[],
  year: number,
  month: number
): (CalendarDay | null)[][] {
  const offset = getMonthStartWeekday(year, month);
  const grid: (CalendarDay | null)[] = [...Array(offset).fill(null), ...days];
  while (grid.length % 7 !== 0) grid.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));
  return weeks;
}

// ---------------------------------------------------------------------------
// Supabase queries — fetch all data overlapping the given month
// ---------------------------------------------------------------------------

export async function listCalendarReservations(
  year: number,
  month: number
): Promise<RawCalendarReservation[]> {
  const start = monthFirstDay(year, month);
  const end = monthLastDay(year, month);

  const { data, error } = await supabase
    .from('reservations')
    .select(
      'id, reservation_code, property_id, check_in_date, check_out_date, status, total_amount, nights, guest:guests(full_name)'
    )
    .is('deleted_at', null)
    .lte('check_in_date', end)
    .gte('check_out_date', start)
    .order('check_in_date', { ascending: true });

  if (error) {
    logAppError('portfolio-calendar.listCalendarReservations', error);
    throw error;
  }
  return (data ?? []) as unknown as RawCalendarReservation[];
}

export async function listCalendarCleaningTasks(
  year: number,
  month: number
): Promise<RawCleaningTask[]> {
  const start = monthFirstDay(year, month);
  const end = monthLastDay(year, month);

  const { data, error } = await supabase
    .from('cleaning_tasks')
    .select('id, property_id, scheduled_date, status')
    .is('deleted_at', null)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end);

  if (error) {
    logAppError('portfolio-calendar.listCalendarCleaningTasks', error);
    throw error;
  }
  return (data ?? []) as RawCleaningTask[];
}

export async function listCalendarMaintenanceTickets(
  year: number,
  month: number
): Promise<RawMaintenanceTicket[]> {
  const start = monthFirstDay(year, month);
  const end = monthLastDay(year, month) + 'T23:59:59Z';

  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select('id, property_id, created_at, priority, status')
    .is('deleted_at', null)
    .gte('created_at', start)
    .lte('created_at', end)
    .not('status', 'in', '(closed,cancelled)');

  if (error) {
    logAppError('portfolio-calendar.listCalendarMaintenanceTickets', error);
    throw error;
  }
  return (data ?? []) as RawMaintenanceTicket[];
}

// ---------------------------------------------------------------------------
// Calendar engine — pure functions, no side-effects
// ---------------------------------------------------------------------------

function buildReservationBlocksForProperty(
  reservations: RawCalendarReservation[],
  propertyId: string,
  year: number,
  month: number
): CalendarReservationBlock[] {
  const first = monthFirstDay(year, month);
  const last = monthLastDay(year, month);
  const daysCount = getDaysInMonth(year, month);

  return reservations
    .filter((r) => r.property_id === propertyId)
    .flatMap((r) => {
      // Clamp display window to month boundaries
      const dispStart = r.check_in_date >= first ? r.check_in_date : first;
      const startDay = parseInt(dispStart.split('-')[2], 10); // 1-based

      let spanCols: number;
      if (r.check_out_date > last) {
        // Reservation extends past month end — span through the last day
        spanCols = daysCount - startDay + 1;
      } else {
        const checkOutDay = parseInt(r.check_out_date.split('-')[2], 10);
        spanCols = checkOutDay - startDay; // checkout day is exclusive (guests depart that morning)
      }

      if (spanCols <= 0) return [];

      return [
        {
          id: r.id,
          code: r.reservation_code,
          guestName: (r.guest as unknown as { full_name: string } | null)?.full_name ?? null,
          status: r.status,
          checkIn: r.check_in_date,
          checkOut: r.check_out_date,
          startCol: startDay - 1, // 0-based
          spanCols,
          isStart: r.check_in_date >= first,
          isEnd: r.check_out_date <= last,
          totalAmount: r.total_amount,
          propertyId,
        },
      ];
    });
}

function buildCleaningMarkersForProperty(
  tasks: RawCleaningTask[],
  propertyId: string
): CalendarCleaningMarker[] {
  return tasks
    .filter((t) => t.property_id === propertyId && t.scheduled_date)
    .map((t) => ({
      taskId: t.id,
      col: parseInt(t.scheduled_date!.split('-')[2], 10) - 1,
      status: t.status,
      propertyId,
    }));
}

function buildMaintenanceMarkersForProperty(
  tickets: RawMaintenanceTicket[],
  propertyId: string
): CalendarMaintenanceMarker[] {
  return tickets
    .filter((t) => t.property_id === propertyId)
    .map((t) => ({
      ticketId: t.id,
      col: parseInt(t.created_at.split('T')[0].split('-')[2], 10) - 1,
      priority: t.priority,
      propertyId,
    }));
}

function computeOccupancyPct(
  blocks: CalendarReservationBlock[],
  daysInMonth: number
): number {
  const occupied = new Set<number>();
  for (const b of blocks) {
    if (b.status === 'cancelled' || b.status === 'no_show') continue;
    for (let c = b.startCol; c < b.startCol + b.spanCols; c++) {
      if (c >= 0 && c < daysInMonth) occupied.add(c);
    }
  }
  if (daysInMonth === 0) return 0;
  return Math.round((occupied.size / daysInMonth) * 1000) / 10; // 1 decimal
}

function computeMonthRevenue(
  reservations: RawCalendarReservation[],
  propertyId: string,
  year: number,
  month: number
): number {
  const first = monthFirstDay(year, month);
  const last = monthLastDay(year, month);

  return reservations
    .filter(
      (r) =>
        r.property_id === propertyId &&
        r.status !== 'cancelled' &&
        r.status !== 'no_show' &&
        r.check_in_date >= first &&
        r.check_in_date <= last
    )
    .reduce((sum, r) => sum + r.total_amount, 0);
}

function detectConflicts(blocks: CalendarReservationBlock[]): boolean {
  const active = blocks.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'no_show'
  );
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (
        a.startCol < b.startCol + b.spanCols &&
        b.startCol < a.startCol + a.spanCols
      ) {
        return true;
      }
    }
  }
  return false;
}

// Returns which block (if any) occupies a given date for the apartment calendar
export function getBlockForDate(
  date: string,
  blocks: CalendarReservationBlock[]
): CalendarReservationBlock | null {
  return (
    blocks.find(
      (b) =>
        date >= b.checkIn &&
        date < b.checkOut &&
        b.status !== 'cancelled' &&
        b.status !== 'no_show'
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------

export function buildPortfolioCalendarData(
  properties: PropertyWithOwner[],
  reservations: RawCalendarReservation[],
  cleaningTasks: RawCleaningTask[],
  maintenanceTickets: RawMaintenanceTicket[],
  year: number,
  month: number
): PortfolioCalendarData {
  const days = buildCalendarDays(year, month);
  const daysInMonth = days.length;

  const rows: PropertyCalendarRow[] = properties.map((p) => {
    const blocks = buildReservationBlocksForProperty(reservations, p.id, year, month);
    const cleaning = buildCleaningMarkersForProperty(cleaningTasks, p.id);
    const maintenance = buildMaintenanceMarkersForProperty(maintenanceTickets, p.id);
    return {
      property: p,
      occupancyPct: computeOccupancyPct(blocks, daysInMonth),
      monthRevenue: computeMonthRevenue(reservations, p.id, year, month),
      reservationBlocks: blocks,
      cleaningMarkers: cleaning,
      maintenanceMarkers: maintenance,
      hasConflict: detectConflicts(blocks),
    };
  });

  const totalProperties = rows.length;
  const avgOccupancy =
    totalProperties > 0
      ? Math.round(
          (rows.reduce((s, r) => s + r.occupancyPct, 0) / totalProperties) * 10
        ) / 10
      : 0;
  const totalRevenue = rows.reduce((s, r) => s + r.monthRevenue, 0);

  return { year, month, days, rows, totalProperties, avgOccupancy, totalRevenue };
}

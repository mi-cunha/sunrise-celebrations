import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SetupNotice } from "@/components/setup-notice";
import { requireUser } from "@/lib/auth";
import { contractedEventStatusLabel } from "@/lib/domain/contracted-event";
import { getBrazilHolidays, getCearaFortalezaHolidays, type CalendarHoliday } from "@/lib/holidays";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { CalendarEntryForm, DeleteCalendarEntryForm, type CalendarEntryForForm } from "./calendar-forms";

type EventRow = { id: string; title: string; status: string; event_date: string; event_type: string | null; leads: { name: string } | null };
type CalendarEntry = CalendarEntryForForm;
type DayItem = { id: string; title: string; kind: "evento" | "agenda" | "feriado"; subtitle: string; href?: string };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string; nova?: string }> }) {
  if (!hasSupabaseConfig()) return <SetupNotice />;
  const query = await searchParams;
  const today = new Date();
  const selected = parseMonth(query.mes) ?? { year: today.getFullYear(), month: today.getMonth() + 1 };
  const firstDate = `${selected.year}-${pad(selected.month)}-01`;
  const lastDay = new Date(selected.year, selected.month, 0).getDate();
  const lastDate = `${selected.year}-${pad(selected.month)}-${pad(lastDay)}`;
  const { supabase, permissions } = await requireUser();
  const canManage = permissions.some((permission) => permission === "gerencia" || permission === "direcao" || permission === "admin_owner");

  const [{ data: events, error: eventError }, { data: entries, error: entryError }, nationalHolidays] = await Promise.all([
    supabase.from("contracted_events").select("id,title,status,event_date,event_type,leads(name)").gte("event_date", firstDate).lte("event_date", lastDate).neq("status", "cancelado").order("event_date"),
    supabase.from("calendar_entries").select("id,title,entry_type,start_date,end_date,notes").lte("start_date", lastDate).gte("end_date", firstDate).order("start_date"),
    getBrazilHolidays(selected.year),
  ]);
  const eventRows = (events ?? []) as unknown as EventRow[];
  const calendarEntries = (entries ?? []) as CalendarEntry[];
  const holidays = [...nationalHolidays, ...getCearaFortalezaHolidays(selected.year)];
  const itemsByDate = buildDayItems(firstDate, lastDate, eventRows, calendarEntries, holidays);
  const previous = shiftMonth(selected.year, selected.month, -1);
  const next = shiftMonth(selected.year, selected.month, 1);
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.nova ?? "") && query.nova! >= firstDate && query.nova! <= lastDate ? query.nova : undefined;

  return (
    <AppShell title="Agenda">
      {(eventError || entryError) && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível carregar toda a agenda: {eventError?.message ?? entryError?.message}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><MonthLink value={previous} label="←" /><h2 className="min-w-52 text-center text-lg font-semibold capitalize">{monthLabel(selected.year, selected.month)}</h2><MonthLink value={next} label="→" /></div>
        <Link href="/agenda" className="rounded-lg border border-[#d9ded8] bg-white px-3 py-2 text-sm font-semibold text-[#083653]">Hoje</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs"><Legend color="bg-[#0f5f8f]" label="Evento" /><Legend color="bg-[#2f7d62]" label="Evento da casa/data" /><Legend color="bg-[#b7791f]" label="Feriado" /><Legend color="bg-[#b54747]" label="Bloqueio/manutenção" /></div>

      <section key={`${selected.year}-${selected.month}`} className="calendar-month-enter mt-4 overflow-x-auto rounded-lg border border-[#d9ded8] bg-white">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-[#d9ded8] bg-[#f7f4ed] text-center text-xs font-semibold uppercase tracking-wide text-[#5f7180]">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <div key={day} className="p-2">{day}</div>)}</div>
          <div className="grid grid-cols-7">{calendarCells(selected.year, selected.month).map((cell, index) => <CalendarDay key={index} date={cell} items={cell ? itemsByDate.get(cell) ?? [] : []} today={cell === localDate(today)} canManage={canManage} month={`${selected.year}-${pad(selected.month)}`} />)}</div>
        </div>
      </section>

      {canManage && <details id="nova-data" open={Boolean(requestedDate)} className="mt-5 rounded-lg border border-[#d9ded8] bg-white p-4"><summary className="cursor-pointer font-semibold text-[#083653]">{requestedDate ? `Adicionar compromisso em ${requestedDate.split("-").reverse().join("/")}` : "Adicionar data importante"}</summary><div className="mt-4 border-t border-[#d9ded8] pt-4"><CalendarEntryForm initialDate={requestedDate} /></div></details>}

      {calendarEntries.length > 0 && (
        <section className="mt-5 rounded-lg border border-[#d9ded8] bg-white p-4"><h2 className="font-semibold">Datas internas deste período</h2><div className="mt-3 divide-y divide-[#e8ece8]">{calendarEntries.map((entry) => (
          <details key={entry.id} className="py-3"><summary className="cursor-pointer text-sm font-semibold text-[#083653]">{entry.title} · {formatRange(entry.start_date, entry.end_date)}</summary>{canManage ? <div className="mt-3 rounded-lg bg-[#f8fbfd] p-3"><CalendarEntryForm entry={entry} /><div className="mt-3"><DeleteCalendarEntryForm id={entry.id} /></div></div> : entry.notes && <p className="mt-2 text-sm text-[#5f7180]">{entry.notes}</p>}</details>
        ))}</div></section>
      )}
    </AppShell>
  );
}

function CalendarDay({ date, items, today, canManage, month }: { date: string | null; items: DayItem[]; today: boolean; canManage: boolean; month: string }) {
  return <div className={`min-h-32 border-b border-r border-[#edf0ed] p-2 ${date ? "bg-white" : "bg-[#faf9f5]"}`}>
    {date && <><div className="mb-2 flex items-center justify-between">{canManage ? <Link href={`/agenda?mes=${month}&nova=${date}#nova-data`} title="Adicionar nesta data" className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold hover:ring-2 hover:ring-[#0f5f8f] ${today ? "bg-[#083653] text-white" : "text-[#5f7180]"}`}>{Number(date.slice(-2))}</Link> : <p className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${today ? "bg-[#083653] text-white" : "text-[#5f7180]"}`}>{Number(date.slice(-2))}</p>}{canManage && <Link href={`/agenda?mes=${month}&nova=${date}#nova-data`} title="Adicionar nesta data" className="flex h-7 w-7 items-center justify-center rounded-md text-lg text-[#0f5f8f] hover:bg-[#dcecf6]">+</Link>}</div><div className="space-y-1">{items.map((item) => item.href ? <Link key={item.id} href={item.href} title={item.subtitle} className={`block truncate rounded px-2 py-1 text-[11px] font-semibold ${itemClass(item)}`}>{item.title}</Link> : <div key={item.id} title={item.subtitle} className={`truncate rounded px-2 py-1 text-[11px] font-semibold ${itemClass(item)}`}>{item.title}</div>)}</div></>}
  </div>;
}

function buildDayItems(first: string, last: string, events: EventRow[], entries: CalendarEntry[], holidays: CalendarHoliday[]) {
  const map = new Map<string, DayItem[]>(); const add = (date: string, item: DayItem) => map.set(date, [...(map.get(date) ?? []), item]);
  events.forEach((event) => add(event.event_date, { id: `e-${event.id}`, title: event.leads?.name ?? event.title, kind: "evento", subtitle: `${event.event_type ?? "Evento"} · ${contractedEventStatusLabel(event.status)}`, href: `/eventos/${event.id}` }));
  entries.forEach((entry) => datesBetween(maxDate(entry.start_date, first), minDate(entry.end_date, last)).forEach((date) => add(date, { id: `a-${entry.id}-${date}`, title: entry.title, kind: "agenda", subtitle: entry.entry_type })));
  holidays.filter((holiday) => holiday.date >= first && holiday.date <= last).forEach((holiday) => add(holiday.date, { id: `h-${holiday.scope}-${holiday.date}`, title: holiday.name, kind: "feriado", subtitle: `Feriado ${holiday.scope}` }));
  return map;
}

function itemClass(item: DayItem) { if (item.kind === "evento") return "bg-[#dcecf6] text-[#083653]"; if (item.kind === "feriado") return "bg-amber-50 text-amber-800"; return item.subtitle === "bloqueio" || item.subtitle === "manutencao" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"; }
function calendarCells(year: number, month: number) { const firstWeekday = new Date(year, month - 1, 1).getDay(); const days = new Date(year, month, 0).getDate(); const cells: (string | null)[] = Array(firstWeekday).fill(null); for (let day = 1; day <= days; day++) cells.push(`${year}-${pad(month)}-${pad(day)}`); while (cells.length % 7) cells.push(null); return cells; }
function datesBetween(start: string, end: string) { const dates: string[] = []; const cursor = new Date(`${start}T12:00:00`); const finish = new Date(`${end}T12:00:00`); while (cursor <= finish) { dates.push(localDate(cursor)); cursor.setDate(cursor.getDate() + 1); } return dates; }
function parseMonth(value?: string) { const match = /^(\d{4})-(\d{2})$/.exec(value ?? ""); if (!match) return null; const year = Number(match[1]); const month = Number(match[2]); return month >= 1 && month <= 12 ? { year, month } : null; }
function shiftMonth(year: number, month: number, amount: number) { const date = new Date(year, month - 1 + amount, 1); return { year: date.getFullYear(), month: date.getMonth() + 1 }; }
function MonthLink({ value, label }: { value: { year: number; month: number }; label: string }) { return <Link href={`/agenda?mes=${value.year}-${pad(value.month)}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9ded8] bg-white font-semibold text-[#083653]">{label}</Link>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5 rounded-full border border-[#d9ded8] bg-white px-2.5 py-1"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>; }
function monthLabel(year: number, month: number) { return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)); }
function localDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function formatRange(start: string, end: string) { const format = (value: string) => value.split("-").reverse().join("/"); return start === end ? format(start) : `${format(start)} a ${format(end)}`; }
function pad(value: number) { return String(value).padStart(2, "0"); }
function maxDate(a: string, b: string) { return a > b ? a : b; } function minDate(a: string, b: string) { return a < b ? a : b; }

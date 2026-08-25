export type CalendarHoliday = {
  date: string;
  name: string;
  scope: "nacional" | "estadual" | "municipal";
};

export async function getBrazilHolidays(year: number): Promise<CalendarHoliday[]> {
  try {
    const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, { next: { revalidate: 86400 } });
    if (!response.ok) return [];
    const data = (await response.json()) as { date?: unknown; name?: unknown }[];
    return data
      .filter((item): item is { date: string; name: string } => typeof item.date === "string" && typeof item.name === "string")
      .map((item) => ({ date: item.date, name: item.name, scope: "nacional" }));
  } catch {
    return [];
  }
}

export function getCearaFortalezaHolidays(year: number): CalendarHoliday[] {
  const holidays: CalendarHoliday[] = [
    { date: `${year}-03-19`, name: "Dia de São José", scope: "estadual" },
    { date: `${year}-03-25`, name: "Data Magna do Ceará", scope: "estadual" },
    { date: `${year}-08-15`, name: "Nossa Senhora da Assunção", scope: "municipal" },
  ];
  holidays.push({ date: `${year}-04-13`, name: "Aniversário de Fortaleza", scope: "municipal" });
  return holidays;
}

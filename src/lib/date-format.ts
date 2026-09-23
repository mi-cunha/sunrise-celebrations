const SUNRISE_TIME_ZONE = "America/Sao_Paulo";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: SUNRISE_TIME_ZONE,
  }).format(new Date(value));
}

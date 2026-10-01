export function canManageCalendar(userPermissions: readonly string[]) {
  return userPermissions.includes("atendimento") || userPermissions.includes("gerencia") || userPermissions.includes("direcao") || userPermissions.includes("admin_owner");
}

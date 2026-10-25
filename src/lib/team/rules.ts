export type Role = "OWNER" | "MANAGER" | "ATTENDANT" | "KITCHEN" | "DELIVERY";
export type Member = { id: string; role: Role };

export const canManageTeam = (role: Role | null) => role === "OWNER" || role === "MANAGER";

// null = permitido; string = motivo da recusa. `newRole` ausente significa remover o membro.
export function checkMemberChange(
  actorRole: Role,
  members: Member[],
  targetId: string,
  newRole?: Role,
): string | null {
  const target = members.find((m) => m.id === targetId);
  if (!target) return "Membro nao encontrado";
  if (!canManageTeam(actorRole)) return "Sem permissao para gerenciar a equipe";
  // So donos mexem em donos e promovem a dono.
  if ((target.role === "OWNER" || newRole === "OWNER") && actorRole !== "OWNER") return "Somente o dono pode alterar donos";
  if (target.role === "OWNER" && newRole !== "OWNER") {
    const owners = members.filter((m) => m.role === "OWNER").length;
    if (owners <= 1) return "A loja precisa de pelo menos um dono";
  }
  return null;
}

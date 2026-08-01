export function getInitials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

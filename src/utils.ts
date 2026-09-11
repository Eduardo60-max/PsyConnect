export function avatarInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function getAvatarInitials(name?: string, maxLetters = 2): string {
  if (!name) return 'U';

  const trimmed = name.trim();
  if (!trimmed) return 'U';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`
      .toUpperCase()
      .slice(0, maxLetters);
  }

  return trimmed.slice(0, maxLetters).toUpperCase();
}

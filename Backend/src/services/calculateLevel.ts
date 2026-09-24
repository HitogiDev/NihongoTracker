const xpVar = 0.07; // This variable controls the amount of xp required per level
const xpDiff = 1.75; // This variable controls how fast the difference between levels grow

export function calculateLevel(xp: number) {
  return Math.floor(xp**(1 / xpDiff) * xpVar);
}

export function calculateXp(level: number) {
  return Math.floor((level / xpVar)**xpDiff);
}

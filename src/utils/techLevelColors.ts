import { withAlpha } from './colorUtils';

const TECH_LEVEL_COLORS: Record<number, string> = {
  0: '#e53935', // Red - primitive/dangerous
  1: '#fb8c00', // Orange - pre-industrial
  2: '#fdd835', // Yellow - industrial
  3: '#43a047', // Green - modern
  4: '#1e88e5', // Blue - advanced
  5: '#8e24aa', // Purple - pretech
};

export function getTechLevelColor(techLevel: number): string {
  return TECH_LEVEL_COLORS[techLevel] ?? '#888888';
}

export function getTechLevelGlow(techLevel: number, alpha = 0.5): string {
  return withAlpha(getTechLevelColor(techLevel), alpha);
}





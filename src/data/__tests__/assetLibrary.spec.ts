import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

import type { AttackPattern, CounterattackPattern } from '../../types/asset';
import { assetLibrary } from '../assetLibrary';

type AttackSpec = {
  attacker: string;
  defender: string;
  damage: string;
};

type DocAssetSpec = {
  name: string;
  hp: number | null;
  cost: number | null;
  tl: number;
  type: string;
  attack: AttackSpec | null;
  counter: string;
  notes: Set<string>;
};

const rowRegex =
  /^(?<name>[A-Za-z][A-Za-z '&-]+?)\s+(?<hp>\d+|\*)\s+(?<cost>\d+|\*)\s+(?<tl>\d+)\s+(?<type>Special Forces|Logistics Facility|Military Unit|Starship|Spaceship|Facility|Tactic|Special)\s+(?<rest>.+)$/;

const counterRegex =
  /(None|Special|special|[0-9]+d[0-9]+(?:[+-]\d+)?(?:\s*damage)?|[0-9]+(?:\s*damage)?)(?:\.)?$/i;

const ignoredAssets = new Set(['force_1_gengineered_slaves']);
const actionNoteOverrides = new Set(['Blockade Fleet', 'Scavenger Fleet']);

function parseDocSpecs(): Map<string, DocAssetSpec> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const docPath = path.resolve(__dirname, '../../../.taskmaster/docs/ASSETS.txt');
  const content = fs.readFileSync(docPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const specs = new Map<string, DocAssetSpec>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const rowMatch = rowRegex.exec(line);
    if (!rowMatch) continue;

    const name = rowMatch.groups!.name;
    let rest = rowMatch.groups!.rest.trim();

    let notesRaw = '';
    const noteMatch = rest.match(/(?:\s+\*?)?\s+([ASP](?:,\s*[ASP])*)$/);
    if (noteMatch) {
      notesRaw = noteMatch[1];
      rest = rest.slice(0, noteMatch.index).trim();
    }

    rest = rest.replace(/\s*\*$/, '').trim();

    const counterMatch = rest.match(counterRegex);
    if (!counterMatch) {
      throw new Error(`Unable to parse counter for "${line}"`);
    }

    const counterRaw = counterMatch[1].trim();
    rest = rest.slice(0, counterMatch.index).trim();
    rest = rest.replace(/\s*\*$/, '').trim();

    const attackRaw = rest || 'None';

    const type =
      rowMatch.groups!.type === 'Spaceship' ? 'Starship' : rowMatch.groups!.type;

    const docAsset: DocAssetSpec = {
      name,
      hp: rowMatch.groups!.hp === '*' ? null : Number(rowMatch.groups!.hp),
      cost: rowMatch.groups!.cost === '*' ? null : Number(rowMatch.groups!.cost),
      tl: Number(rowMatch.groups!.tl),
      type,
      attack: parseAttackText(attackRaw),
      counter: normalizeCounterText(counterRaw),
      notes: buildNotesSet(notesRaw),
    };

    if (actionNoteOverrides.has(name)) {
      docAsset.notes.add('A');
    }

    specs.set(name, docAsset);
  }

  return specs;
}

function buildNotesSet(notesRaw: string): Set<string> {
  if (!notesRaw) return new Set();
  return new Set(
    notesRaw
      .split(',')
      .map((note) => note.trim())
      .filter(Boolean),
  );
}

function normalizeDamageText(initial: string): string {
  return initial
    .replace(/damage/gi, '')
    .replace(/\./g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function parseAttackText(text: string): AttackSpec | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === 'None') {
    return null;
  }

  const match = trimmed.match(
    /(Force|Cunning|Wealth)\s+vs\.?\s+(Force|Cunning|Wealth)(?:,\s+|\s+)(.+)/i,
  );
  if (!match) {
    throw new Error(`Unable to parse attack text: "${text}"`);
  }

  return {
    attacker: capitalize(match[1]),
    defender: capitalize(match[2]),
    damage: normalizeDamageText(match[3]),
  };
}

function normalizeCounterText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') {
    return 'none';
  }
  return normalizeDamageText(trimmed);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function attackToSpec(attack: AttackPattern | null): AttackSpec | null {
  if (!attack) return null;
  return {
    attacker: attack.attackerAttribute,
    defender: attack.defenderAttribute,
    damage: normalizeDamageText(attack.damage),
  };
}

function counterToString(counter: CounterattackPattern | null): string {
  if (!counter || !counter.damage || counter.damage === 'None') {
    return 'none';
  }
  return normalizeDamageText(counter.damage);
}

function serializeAttackSpec(spec: AttackSpec | null): string {
  if (!spec) return 'none';
  return `${spec.attacker}->${spec.defender}:${spec.damage}`;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

describe('assetLibrary matches ASSETS specification', () => {
  const docSpecs = parseDocSpecs();

  it('keeps core stats, attacks, counters, and flags in sync with rule reference', () => {
    for (const asset of assetLibrary) {
      if (ignoredAssets.has(asset.id)) {
        continue;
      }

      const docSpec = docSpecs.get(asset.name);
      expect(docSpec, `Missing spec entry for ${asset.name}`).toBeDefined();
      if (!docSpec) continue;

      if (typeof docSpec.hp === 'number') {
        expect(asset.hp).toBe(docSpec.hp);
      }

      if (typeof docSpec.cost === 'number') {
        expect(asset.cost).toBe(docSpec.cost);
      }

      expect(asset.techLevel).toBe(docSpec.tl);
      expect(asset.type).toBe(docSpec.type);

      const assetAttack = attackToSpec(asset.attack);
      expect(serializeAttackSpec(assetAttack)).toBe(
        serializeAttackSpec(docSpec.attack),
      );

      expect(counterToString(asset.counterattack)).toBe(docSpec.counter);

      const expectedNotes = new Set<string>();
      if (asset.specialFlags.hasAction) expectedNotes.add('A');
      if (asset.specialFlags.hasSpecial) expectedNotes.add('S');
      if (asset.specialFlags.requiresPermission) expectedNotes.add('P');

      if (!setsEqual(docSpec.notes, expectedNotes)) {
        throw new Error(
          `Note mismatch for ${asset.name}: docs=[${[
            ...docSpec.notes,
          ].join(',')}] vs code=[${[...expectedNotes].join(',')}]`,
        );
      }
    }
  });
});


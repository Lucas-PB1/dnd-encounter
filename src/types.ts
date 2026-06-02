export interface SavedAttack {
  id?: string;
  name: string;
  attackMod: number;
  damageDice: string;
  damageMod: number;
}

export interface Combatant {
  id: string;
  name: string;
  type: 'player' | 'enemy';
  initiative: number;
  initiativeMod?: number;
  initiativeRollMode?: 'normal' | 'advantage' | 'disadvantage';
  currentHp: number;
  maxHp: number; // total group max HP (individualHp * groupSize)
  individualHp: number; // Max HP of each creature in the group
  groupSize: number; // how many creatures initially
  ac: number; // CA
  attackMod: number; // Attack modifier (e.g. +5)
  attacksPerCreature: number; // multiattacks (e.g. 2 for multiattack 2)
  isDefeated: boolean;
  attacksList?: SavedAttack[];
}

export interface AttackRoll {
  creatureIndex: number; // e.g. Orc 1
  attackIndex: number; // e.g. Ataque 1
  dieRoll: number; // 1d20 value
  rawRoll1?: number;
  rawRoll2?: number;
  rollMode?: 'normal' | 'advantage' | 'disadvantage';
  modifier: number;
  total: number;
  isCritSuccess: boolean; // roll == 20
  isCritFailure: boolean; // roll == 1
  targetAc?: number;
  isHit?: boolean;
  attackName?: string;
  damageRollText?: string;
  damageTotal?: number;
}

export interface AttackRollResult {
  id: string;
  attackerName: string;
  rolls: AttackRoll[];
  timestamp: string;
  targetAc?: number;
  targetName?: string;
  attackerCount?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'damage' | 'heal' | 'roll' | 'turn' | 'setup';
  message: string;
  combatantName?: string;
  rollResultId?: string;
}

export interface MonsterPreset {
  name: string;
  ac: number;
  individualHp: number;
  attackMod: number;
  attacksPerCreature: number;
  description: string;
  imageUrl?: string;
}

export interface CharacterTemplate {
  id: string;
  userId: string;
  name: string;
  type: 'player' | 'enemy';
  ac: number;
  individualHp: number;
  groupSize: number;
  attackMod: number;
  attacksPerCreature: number;
  description: string;
  initiative?: number;
  initiativeMod?: number;
  initiativeRollMode?: 'normal' | 'advantage' | 'disadvantage';
  attacksList?: SavedAttack[];
  createdAt: number;
  isAutoSaved?: boolean;
}


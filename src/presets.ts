import { MonsterPreset } from './types';

export const MONSTER_PRESETS: MonsterPreset[] = [
  {
    name: "Goblin",
    ac: 15,
    individualHp: 7,
    attackMod: 4,
    attacksPerCreature: 1,
    description: "Pequeno e sorrateiro, ataca à distância ou pelas costas."
  },
  {
    name: "Orc",
    ac: 13,
    individualHp: 15,
    attackMod: 5,
    attacksPerCreature: 1,
    description: "Guerreiro feroz com machado de batalha pesado."
  },
  {
    name: "Zumbi",
    ac: 8,
    individualHp: 22,
    attackMod: 3,
    attacksPerCreature: 1,
    description: "Lento, resistente e dotado de Frieza Morto-Viva."
  },
  {
    name: "Esqueleto",
    ac: 13,
    individualHp: 13,
    attackMod: 4,
    attacksPerCreature: 1,
    description: "Guerreiro ósseo vigilante com arco ou espada."
  },
  {
    name: "Lobo",
    ac: 13,
    individualHp: 11,
    attackMod: 4,
    attacksPerCreature: 1,
    description: "Caçador em matilha com mordida ágil e derrubada."
  },
  {
    name: "Ogro",
    ac: 11,
    individualHp: 59,
    attackMod: 6,
    attacksPerCreature: 1,
    description: "Gigante brutal que balança uma clava massiva."
  },
  {
    name: "Cavalheiro (Knight)",
    ac: 18,
    individualHp: 52,
    attackMod: 5,
    attacksPerCreature: 2,
    description: "Guerreiro blindado com espada longa e multiataque (2x)."
  },
  {
    name: "Dragão Vermelho Jovem",
    ac: 18,
    individualHp: 178,
    attackMod: 10,
    attacksPerCreature: 3,
    description: "Predador lendário que desfere mordida e duas garras (3x)."
  }
];

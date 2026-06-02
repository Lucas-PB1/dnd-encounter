import React, { useState, useEffect } from 'react';
import { Combatant, CharacterTemplate, LogEntry } from '../types';
import { db, sanitizeData } from '../lib/firebase';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { User, Swords, Shield, Heart, Plus, Trash2, Edit2, Sparkles, Check, Play, UserCheck, LogOut } from 'lucide-react';

interface CharacterConfigurationPanelProps {
  userId: string;
  onSetUserId: (name: string) => void;
  onAddCombatant: (combatant: Omit<Combatant, 'id' | 'isDefeated'>) => void;
  onLog: (message: string, type: LogEntry['type']) => void;
}

export default function CharacterConfigurationPanel({
  userId,
  onSetUserId,
  onAddCombatant,
  onLog
}: CharacterConfigurationPanelProps) {
  // Authentication & Profile identification
  const [usernameInput, setUsernameInput] = useState('');
  const [showRegisterForm, setShowRegisterForm] = useState(!userId);

  // Character templates in state
  const [characters, setCharacters] = useState<CharacterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [charName, setCharName] = useState('');
  const [charType, setCharType] = useState<'player' | 'enemy'>('player');
  const [charAc, setCharAc] = useState<number>(10);
  const [charHp, setCharHp] = useState<number>(10);
  const [charGroupSize, setCharGroupSize] = useState<number>(1);
  const [charAttackMod, setCharAttackMod] = useState<number>(4);
  const [charAttacks, setCharAttacks] = useState<number>(1);
  const [charDesc, setCharDesc] = useState('');
  const [charInitiative, setCharInitiative] = useState<string>(''); // Pre-set initiative or roll
  const [charInitiativeMod, setCharInitiativeMod] = useState<number>(0);
  const [charInitiativeRollMode, setCharInitiativeRollMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [charAttacksList, setCharAttacksList] = useState<any[]>([
    { name: 'Ataque Padrão', attackMod: 4, damageDice: '1d6', damageMod: 2 }
  ]);

  const [errorMsg, setErrorMsg] = useState('');

  const handleAddCharAttackRow = () => {
    setCharAttacksList(prev => [
      ...prev,
      { name: `Ataque ${prev.length + 1}`, attackMod: charAttackMod || 4, damageDice: '1d6', damageMod: 2 }
    ]);
  };

  const handleRemoveCharAttackRow = (index: number) => {
    if (charAttacksList.length <= 1) return;
    setCharAttacksList(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCharAttackRow = (index: number, field: string, value: any) => {
    setCharAttacksList(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Sincronizar banco de personagens do Firestore em tempo real
  useEffect(() => {
    if (!userId) {
      setCharacters([]);
      setShowRegisterForm(true);
      return;
    }

    setIsLoading(true);
    setShowRegisterForm(false);
    const q = query(collection(db, 'characters'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CharacterTemplate[] = [];
      snapshot.forEach((doc) => {
        const item = doc.data() as CharacterTemplate;
        if (!item.isAutoSaved) {
          list.push({ id: doc.id, ...item });
        }
      });
      // Sort alphabetical or newest first
      list.sort((a, b) => b.createdAt - a.createdAt);
      setCharacters(list);
      setIsLoading(false);
    }, (error) => {
      console.error('Erro ao ler personagens:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    const cleanUser = usernameInput.trim();
    onSetUserId(cleanUser);
    onLog(`Mestre conectado com o perfil: "${cleanUser}". Carregando personagens configurados.`, 'setup');
  };

  const handleLogout = () => {
    onSetUserId('');
    setUsernameInput('');
    setShowRegisterForm(true);
    onLog(`Perfil desconectado do banco de dados.`, 'info');
  };

  const resetForm = () => {
    setIsEditing(null);
    setCharName('');
    setCharType('player');
    setCharAc(10);
    setCharHp(10);
    setCharGroupSize(1);
    setCharAttackMod(4);
    setCharAttacks(1);
    setCharDesc('');
    setCharInitiative('');
    setCharInitiativeMod(0);
    setCharInitiativeRollMode('normal');
    setCharAttacksList([
      { name: 'Ataque Padrão', attackMod: 4, damageDice: '1d6', damageMod: 2 }
    ]);
    setErrorMsg('');
  };

  const handleSaveCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setErrorMsg('Você precisa definir um perfil de mestre antes de configurar personagens.');
      return;
    }
    if (!charName.trim()) {
      setErrorMsg('O nome do personagem é obrigatório.');
      return;
    }

    const docId = isEditing || Math.random().toString(36).substring(2, 9);
    const finalAttacksList = charAttacksList.length > 0 ? charAttacksList : [{ name: 'Ataque Padrão', attackMod: charAttackMod, damageDice: '1d6', damageMod: 2 }];
    const newChar: CharacterTemplate = {
      id: docId,
      userId,
      name: charName.trim(),
      type: charType,
      ac: charAc,
      individualHp: charHp,
      groupSize: charType === 'player' ? 1 : charGroupSize,
      attackMod: finalAttacksList[0]?.attackMod ?? charAttackMod,
      attacksPerCreature: charAttacks,
      description: charDesc.trim(),
      initiativeMod: charInitiativeMod,
      initiativeRollMode: charInitiativeRollMode,
      attacksList: finalAttacksList,
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'characters', docId), sanitizeData(newChar));
      onLog(`Personagem salvo na nuvem: "${newChar.name}" (${newChar.type === 'player' ? 'Jogador' : 'Inimigo'}).`, 'setup');
      resetForm();
    } catch (err) {
      console.error('Erro ao salvar personagem no Firestore:', err);
      setErrorMsg('Erro de sincronização de rede com o Firestore ao salvar.');
    }
  };

  const handleEditLoad = (char: CharacterTemplate) => {
    setIsEditing(char.id);
    setCharName(char.name);
    setCharType(char.type);
    setCharAc(char.ac);
    setCharHp(char.individualHp);
    setCharGroupSize(char.groupSize || 1);
    setCharAttackMod(char.attacksList && char.attacksList[0] ? char.attacksList[0].attackMod : char.attackMod);
    setCharAttacks(char.attacksPerCreature || 1);
    setCharDesc(char.description || '');
    setCharInitiativeMod(char.initiativeMod || 0);
    setCharInitiativeRollMode(char.initiativeRollMode || 'normal');
    setCharAttacksList(char.attacksList && char.attacksList.length > 0 ? char.attacksList : [
      { name: 'Ataque Padrão', attackMod: char.attackMod, damageDice: '1d6', damageMod: 2 }
    ]);
    setActiveFormView(true);
  };

  const handleDeleteCharacter = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'characters', id));
      onLog(`Personagem deletado do seu acervo: "${name}"`, 'setup');
      if (isEditing === id) resetForm();
    } catch (err) {
      console.error('Erro de exclusão no Firestore:', err);
    }
  };

  const [activeFormView, setActiveFormView] = useState(false);

  // Inject a character template directly into active combat tracker
  const handleInjectIntoCombat = (char: CharacterTemplate, customQty?: number) => {
    const qty = char.type === 'player' ? 1 : (customQty || char.groupSize || 1);
    const finalHp = char.individualHp * qty;

    // Roll baseline initiative for injection based on character settings or preset
    const rollMode = char.initiativeRollMode || 'normal';
    const initMod = char.initiativeMod !== undefined ? char.initiativeMod : (char.initiative || 0);
    
    let rolledInit = 10;
    let breakdown = `d20`;

    if (charInitiative !== '') {
      rolledInit = parseInt(charInitiative, 10);
      breakdown = `definida manualmente`;
    } else {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      let finalRoll = roll1;
      breakdown = `[${roll1}]`;

      if (rollMode === 'advantage') {
        const roll2 = Math.floor(Math.random() * 20) + 1;
        finalRoll = Math.max(roll1, roll2);
        breakdown = `Vantagem d20 [${roll1}, ${roll2}] (maior: ${finalRoll})`;
      } else if (rollMode === 'disadvantage') {
        const roll2 = Math.floor(Math.random() * 20) + 1;
        finalRoll = Math.min(roll1, roll2);
        breakdown = `Desvantagem d20 [${roll1}, ${roll2}] (menor: ${finalRoll})`;
      }
      rolledInit = finalRoll + initMod;
    }

    const calculatedMaxHp = finalHp;
    const finalAttacksList = char.attacksList && char.attacksList.length > 0 
      ? char.attacksList 
      : [{ name: 'Ataque Padrão', attackMod: char.attackMod, damageDice: '1d6', damageMod: 2 }];

    onAddCombatant({
      name: char.type === 'enemy' && qty > 1 ? `${char.name} x${qty}` : char.name,
      type: char.type,
      initiative: isNaN(rolledInit) ? 10 : rolledInit,
      initiativeMod: initMod,
      initiativeRollMode: rollMode,
      currentHp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      individualHp: char.individualHp,
      groupSize: qty,
      ac: char.ac,
      attackMod: finalAttacksList[0]?.attackMod ?? char.attackMod,
      attacksPerCreature: char.attacksPerCreature || 1,
      attacksList: finalAttacksList
    });

    onLog(`Personagem importado: "${char.name}" com ${qty} unidade(s) injetado na iniciativa em tempo real. HP: ${finalHp}, CA: ${char.ac} (Iniciativa auto-rolada: ${rolledInit} | ${breakdown})`, 'setup');
  };

  return (
    <div className="bg-[#111115] border border-[#2d2d35] rounded-xl overflow-hidden shadow-xl" id="character-config-panel">
      
      {/* 1. Account / Nickname Registration Manager */}
      <div className="bg-[#0c0c0e]/80 border-b border-[#2d2d35] p-4">
        {userId ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-950/40 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-zinc-550 block font-mono">Conta Conectada (Mestre)</span>
                <strong className="text-sm font-bold text-slate-100 font-display block leading-none">{userId}</strong>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 px-1.5 bg-[#16161a] hover:bg-rose-950/20 text-zinc-500 hover:text-rose-455 border border-[#2d2d35] hover:border-rose-900/40 rounded-md transition-all text-[10px] flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Sair
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 bg-amber-600/10 rounded border border-amber-600/20">
                <User className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">Vincular Conta de Mestre</h3>
                <p className="text-[10px] text-zinc-550 font-mono">Configure um ID para persistir no banco de dados</p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex Nome de Mestre: Lucas, MestreGeral"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                className="flex-1 bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 outline-none transition-all placeholder:text-zinc-700"
                id="input-dm-nickname"
              />
              <button
                type="submit"
                className="bg-amber-600 hover:bg-amber-500 text-black text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md hover:shadow-amber-500/10 cursor-pointer"
              >
                Vincular
              </button>
            </div>
          </form>
        )}
      </div>

      {userId && (
        <div className="p-4 space-y-4">
          
          {/* Form Trigger & View State Toggle */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-[#d4d4d8] tracking-wider uppercase flex items-center gap-1.5 font-display">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Meus Personagens ({characters.length})
            </h4>
            
            <button
              onClick={() => { resetForm(); setActiveFormView(!activeFormView); }}
              className="py-1 px-2.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-600/30 hover:border-amber-500 text-amber-500 rounded-lg transition-all text-[11px] font-bold cursor-pointer"
            >
              {activeFormView ? 'Fechar Cadastro' : '+ Cadastrar Personagem'}
            </button>
          </div>

          {activeFormView && (
            <form onSubmit={handleSaveCharacter} className="bg-[#0c0c0e]/60 border border-[#2d2d35] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#2d2d35]/50 pb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                  {isEditing ? 'Editar Personagem Selecionado' : 'Configurar Novo Personagem'}
                </span>
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[9px] text-zinc-550 hover:text-zinc-350 underline"
                  >
                    Novo Personagem
                  </button>
                )}
              </div>

              {/* Character Type (Player vs Enemy) */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCharType('player')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] uppercase font-bold rounded-lg border transition-all ${
                    charType === 'player'
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-350'
                      : 'bg-[#0f0f12] border-[#2d2d35] text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  <User className="w-3 h-3" />
                  Jogador (PC)
                </button>
                <button
                  type="button"
                  onClick={() => setCharType('enemy')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] uppercase font-bold rounded-lg border transition-all ${
                    charType === 'enemy'
                      ? 'bg-rose-950/30 border-rose-800 text-rose-350'
                      : 'bg-[#0f0f12] border-[#2d2d35] text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  <Swords className="w-3 h-3" />
                  Monstro / Grupo
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">Nome do Personagem</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Legolas, Orc Supremo, Mago Negro"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 placeholder-zinc-700 outline-none transition-all"
                  id="char-name"
                />
              </div>

              {/* Characteristics: AC & HP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">
                    <Shield className="w-3 h-3 text-amber-500" />
                    Classe Armadura (CA)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={charAc}
                    onChange={(e) => setCharAc(Math.max(1, parseInt(e.target.value, 10) || 10))}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 outline-none font-mono"
                    id="char-ac"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">
                    <Heart className="w-3 h-3 text-rose-500" />
                    Vida Máxima (HP)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={charHp}
                    onChange={(e) => setCharHp(Math.max(1, parseInt(e.target.value, 10) || 10))}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 outline-none font-mono"
                    id="char-hp"
                  />
                </div>
              </div>

              {/* Initiative settings */}
              <div className="grid grid-cols-2 gap-3 border-t border-[#2d2d35]/35 pt-2">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">Mod. Iniciativa</label>
                  <input
                    type="number"
                    value={charInitiativeMod}
                    onChange={(e) => setCharInitiativeMod(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">Modo de Iniciativa</label>
                  <select
                    value={charInitiativeRollMode}
                    onChange={(e) => setCharInitiativeRollMode(e.target.value as any)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-2 text-xs text-zinc-200 outline-none font-sans"
                  >
                    <option value="normal">Normal</option>
                    <option value="advantage">Vantagem</option>
                    <option value="disadvantage">Desvantagem</option>
                  </select>
                </div>
              </div>

              {/* Multiple Attacks List */}
              <div className="space-y-3.5 border-t border-[#2d2d35]/35 pt-3">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                    ⚔️ Perfis de Ataque ({charAttacksList.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCharAttackRow}
                    className="text-[9px] font-bold text-amber-550 hover:text-amber-400 bg-[#1c1c24] hover:bg-[#282832] border border-[#2d2d35] px-2 py-0.5 rounded flex items-center gap-0.5"
                  >
                    + Novo
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {charAttacksList.map((attack, index) => (
                    <div key={index} className="bg-[#0c0c0e]/40 border border-[#2d2d35]/50 rounded-lg p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1.5 border-b border-[#2d2d35]/30 pb-1">
                        <input
                          type="text"
                          required
                          value={attack.name}
                          onChange={(e) => handleUpdateCharAttackRow(index, 'name', e.target.value)}
                          placeholder="Nome do ataque (ex: Mordida)"
                          className="bg-transparent text-xs font-bold text-zinc-300 outline-none w-full placeholder:text-zinc-700"
                        />
                        {charAttacksList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCharAttackRow(index)}
                            className="text-zinc-500 hover:text-rose-450 p-0.5 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">Mod Acerto</span>
                          <input
                            type="number"
                            value={attack.attackMod}
                            onChange={(e) => handleUpdateCharAttackRow(index, 'attackMod', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0c0c0e] border border-[#2d2d35] rounded py-0.5 px-1 text-xs font-mono text-zinc-300 outline-none"
                          />
                        </div>

                        <div>
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">Dado Dano</span>
                          <input
                            type="text"
                            value={attack.damageDice}
                            onChange={(e) => handleUpdateCharAttackRow(index, 'damageDice', e.target.value)}
                            placeholder="ex: 1d6"
                            className="w-full bg-[#0c0c0e] border border-[#2d2d35] rounded py-0.5 px-1 text-xs font-mono text-zinc-300 outline-none"
                          />
                        </div>

                        <div>
                          <span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">Bônus Dano</span>
                          <input
                            type="number"
                            value={attack.damageMod}
                            onChange={(e) => handleUpdateCharAttackRow(index, 'damageMod', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0c0c0e] border border-[#2d2d35] rounded py-0.5 px-1 text-xs font-mono text-zinc-300 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#2d2d35]/30">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">Ataques por Turno</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={charAttacks}
                      onChange={(e) => setCharAttacks(Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 outline-none font-mono"
                    />
                  </div>

                  {charType === 'enemy' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1 font-sans">Contagem de Grupo</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={charGroupSize}
                        onChange={(e) => setCharGroupSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-2 text-xs text-zinc-200 outline-none font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Description Notes */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 tracking-wider uppercase mb-1">Descrição / Habilidades Padrão</label>
                <textarea
                  placeholder="Ex: Carrega espada longa, possui resistência a fogo"
                  value={charDesc}
                  onChange={(e) => setCharDesc(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 placeholder-zinc-700 outline-none font-sans"
                  rows={2}
                  id="char-desc"
                />
              </div>

              {errorMsg && (
                <p className="text-[10px] text-rose-455 font-mono italic">{errorMsg}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-black py-1.5 px-3 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md hover:shadow-amber-500/10 cursor-pointer"
                >
                  {isEditing ? 'Atualizar Personagem' : 'Salvar no Acervo'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-[#1c1c24] hover:bg-zinc-750 border border-[#2d2d35] text-zinc-400 py-1.5 px-3 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Catalog Lists of configured templates */}
          {isLoading ? (
            <div className="text-center py-6 text-xs text-zinc-500 font-mono animate-pulse">
              Carregando catálogo de personagens do Firestore...
            </div>
          ) : characters.length === 0 ? (
            <div className="bg-[#0c0c0e]/30 border border-dashed border-[#2d2d35] rounded-xl p-6 text-center">
              <p className="text-[11px] text-zinc-550 italic mb-2">Seu banco de personagens está em branco.</p>
              <p className="text-[10px] text-zinc-650">Clique no botão superior "+ Cadastrar Personagem" para definir seus combatentes frequentes e importá-los em um piscar de olhos!</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1" id="characters-catalog-list">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="bg-[#0c0c0e] hover:bg-[#16161a] border border-[#2d2d35] hover:border-amber-600/30 rounded-xl p-3 flex flex-col justify-between transition-all group"
                >
                  {/* Title & Type */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {char.type === 'player' ? (
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Swords className="w-3.5 h-3.5 text-rose-455" />
                        )}
                        <strong className="text-zinc-250 text-xs font-bold tracking-tight">
                          {char.name}
                        </strong>
                        <span className={`text-[8px] uppercase font-bold px-1.5 py-0.2 rounded font-mono ${
                          char.type === 'player' 
                            ? 'bg-emerald-950/40 text-emerald-400' 
                            : 'bg-rose-950/40 text-rose-400'
                        }`}>
                          {char.type === 'player' ? 'Jogador' : 'Inimigo'}
                        </span>
                      </div>
                      
                      {char.description && (
                        <p className="text-[10px] text-zinc-500 truncate max-w-64 italic">
                          "{char.description}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditLoad(char)}
                        title="Editar Definição"
                        className="p-1 text-zinc-600 hover:text-amber-500 rounded transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCharacter(char.id, char.name)}
                        title="Excluir Definição"
                        className="p-1 text-zinc-655 hover:text-rose-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Dynamic stats row */}
                  <div className="flex items-center justify-between border-t border-[#2d2d35]/50 mt-2.5 pt-2 mb-1">
                    <div className="flex items-center gap-3.5 text-[10px] text-zinc-450 font-mono">
                      <span className="flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5 text-amber-500" />
                        CA: {char.ac}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart className="w-2.5 h-2.5 text-rose-500" />
                        HP: {char.individualHp} {char.type === 'enemy' && char.groupSize > 1 ? `x${char.groupSize}` : ''}
                      </span>
                      {char.initiativeMod !== undefined && char.initiativeMod !== 0 && (
                        <span className="flex items-center gap-0.5" title="Modificador de Iniciativa">
                          ⚡ Ini: {char.initiativeMod >= 0 ? '+' : ''}{char.initiativeMod}
                          {char.initiativeRollMode && char.initiativeRollMode !== 'normal' && (
                            <span className="text-[8px] text-amber-500 uppercase ml-0.5 font-bold">
                              ({char.initiativeRollMode === 'advantage' ? 'Vant' : 'Desv'})
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Inject Button */}
                    <button
                      onClick={() => handleInjectIntoCombat(char)}
                      className="py-1 px-2 rounded bg-amber-600 hover:bg-amber-500 text-black text-[9px] font-bold uppercase flex items-center gap-0.5 tracking-wider hover:scale-[1.03] transition-all shadow-sm cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-black" />
                      Injetar +
                    </button>
                  </div>

                  {/* Custom attacks list overview */}
                  {char.attacksList && char.attacksList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 border-t border-[#2d2d35]/30 pt-1.5 pb-0.5">
                      {char.attacksList.map((atk, idx) => (
                        <span key={idx} className="bg-[#111115] text-[8px] text-zinc-400 font-mono px-1 rounded border border-[#2d2d35]" title={`${atk.name}: d20+${atk.attackMod} para acertar. Dano: ${atk.damageDice}+${atk.damageMod}`}>
                          ⚔️ {atk.name} (+{atk.attackMod} | {atk.damageDice}+{atk.damageMod})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

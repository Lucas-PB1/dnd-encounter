import React, { useState, useEffect } from 'react';
import { Combatant } from '../types';
import { Plus, Minus, Zap, Sparkles, Swords, UserPlus, Shield, Heart, Dices, Info, History, Trash2, Search } from 'lucide-react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CombatantFormProps {
  userId?: string;
  onAddCombatant: (combatant: Omit<Combatant, 'id' | 'isDefeated'>) => void;
  onLog: (message: string, type: 'info' | 'setup') => void;
}

export default function CombatantForm({ userId, onAddCombatant, onLog }: CombatantFormProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [recentCreatures, setRecentCreatures] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
// Visual fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'player' | 'enemy'>('enemy');
  const [initiative, setInitiative] = useState<string>('');
  
  // Initiative settings
  const [initiativeMod, setInitiativeMod] = useState<number>(0);
  const [initiativeRollMode, setInitiativeRollMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');

  const [ac, setAc] = useState<number>(10);
  const [individualHp, setIndividualHp] = useState<number>(10);
  const [groupSize, setGroupSize] = useState<number>(1);
  const [attackMod, setAttackMod] = useState<number>(4);
  const [attacksPerCreature, setAttacksPerCreature] = useState<number>(1);

  // Multiple attack configurations state
  const [attacksList, setAttacksList] = useState<any[]>([
    { name: 'Ataque Padrão', attackMod: 4, damageDice: '1d6', damageMod: 2 }
  ]);
  
  // Text Parser field
  const [rawText, setRawText] = useState('');
  const [textError, setTextError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  
  // Mapeamento de quantidades para itens de histórico
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const handleAddAttackRow = () => {
    setAttacksList(prev => [
      ...prev,
      { name: `Ataque ${prev.length + 1}`, attackMod: 4, damageDice: '1d6', damageMod: 2 }
    ]);
  };

  const handleRemoveAttackRow = (index: number) => {
    if (attacksList.length <= 1) return;
    setAttacksList(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAttackRow = (index: number, field: string, value: any) => {
    setAttacksList(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Load and subscribe to recent creatures (history)
  useEffect(() => {
    const loadLocal = () => {
      try {
        const localData = localStorage.getItem('d20_auto_saved_combatants');
        return localData ? JSON.parse(localData) : [];
      } catch (e) {
        console.error("Erro ao ler d20_auto_saved_combatants localmente:", e);
        return [];
      }
    };

    let localList = loadLocal();
    setRecentCreatures(localList);

    if (userId) {
      const q = query(collection(db, 'characters'), where('userId', '==', userId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreList: any[] = [];
        snapshot.forEach((doc) => {
          const item = doc.data();
          if (item.isAutoSaved) {
            firestoreList.push({ id: doc.id, ...item });
          }
        });

        setRecentCreatures(() => {
          const combined = [...firestoreList, ...loadLocal()];
          const uniq: Record<string, any> = {};
          combined.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach(item => {
            const key = item.name.toLowerCase();
            if (!uniq[key]) {
              uniq[key] = item;
            }
          });
          return Object.values(uniq).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        });
      }, (err) => {
        console.error("Erro ao sincronizar criaturas recentes do Firestore:", err);
      });
      return () => unsubscribe();
    }
  }, [userId]);

  const getItemQty = (item: any) => qtyMap[item.name] || 1;

  const handleUpdateQtyMap = (itemName: string, increment: number) => {
    setQtyMap(prev => {
      const curr = prev[itemName] || 1;
      const next = Math.max(1, curr + increment);
      return { ...prev, [itemName]: next };
    });
  };

  const handleSelectRecent = (item: any) => {
    const qty = getItemQty(item);
    if (name.trim() && name.toLowerCase() === item.name.toLowerCase()) {
      setGroupSize(prev => prev + qty);
      onLog(`Incrementado tamanho do grupo de "${item.name}" para ${groupSize + qty}.`, 'info');
    } else {
      setName(item.name);
      setType(item.type || 'enemy');
      setAc(item.ac || 10);
      setIndividualHp(item.individualHp || 10);
      setGroupSize(qty);
      setAttackMod(item.attackMod || 4);
      setAttacksPerCreature(item.attacksPerCreature || 1);
      setInitiativeMod(item.initiativeMod || 0);
      setInitiativeRollMode(item.initiativeRollMode || 'normal');
      
      if (item.attacksList && item.attacksList.length > 0) {
        setAttacksList(item.attacksList);
      } else {
        setAttacksList([
          { name: 'Ataque Padrão', attackMod: item.attackMod || 4, damageDice: '1d6', damageMod: 2 }
        ]);
      }
      onLog(`Carregado do histórico: "${item.name}" pronto para o combate com ${qty} unidade(s).`, 'info');
    }
  };

  const handleQuickAddDirect = (item: any) => {
    const qty = getItemQty(item);
    
    // Rolar iniciativa com base no tom (vantagem/desvantagem) e mod
    const rollMode = item.initiativeRollMode || 'normal';
    const roll1 = Math.floor(Math.random() * 20) + 1;
    let finalRoll = roll1;
    let breakdown = `d20 [${roll1}]`;

    if (rollMode === 'advantage') {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      finalRoll = Math.max(roll1, roll2);
      breakdown = `Vantagem d20 [${roll1}, ${roll2}] (maior: ${finalRoll})`;
    } else if (rollMode === 'disadvantage') {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      finalRoll = Math.min(roll1, roll2);
      breakdown = `Desvantagem d20 [${roll1}, ${roll2}] (menor: ${finalRoll})`;
    }

    const initMod = item.initiativeMod || 0;
    const initVal = finalRoll + initMod;
    const rollDetailsText = `(Iniciativa auto-rolada: ${finalRoll} + Mod ${initMod >= 0 ? '+' : ''}${initMod} = ${initVal} | ${breakdown})`;

    const calculatedMaxHp = (item.individualHp || 10) * qty;
    const finalAttacksList = item.attacksList && item.attacksList.length > 0 
      ? item.attacksList 
      : [{ name: 'Ataque Padrão', attackMod: item.attackMod || 4, damageDice: '1d6', damageMod: 2 }];

    onAddCombatant({
      name: item.type === 'enemy' && qty > 1 ? `${item.name} x${qty}` : item.name,
      type: item.type || 'enemy',
      ac: item.ac || 10,
      initiative: isNaN(initVal) ? 10 : initVal,
      initiativeMod: initMod,
      initiativeRollMode: rollMode,
      currentHp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      individualHp: item.individualHp || 10,
      groupSize: qty,
      attackMod: finalAttacksList[0]?.attackMod ?? (item.attackMod || 4),
      attacksPerCreature: item.attacksPerCreature || 1,
      attacksList: finalAttacksList
    });

    const entityDesc = item.type === 'enemy' 
      ? `Grupo de ${qty}x ${item.name} (${calculatedMaxHp} HP Total, CA ${item.ac})` 
      : `${item.name} (Jogador, CA ${item.ac})`;

    onLog(`Adicionado direto: ${entityDesc} ${rollDetailsText}`, 'setup');
  };

  const handleDeleteRecent = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    
    try {
      const localData = localStorage.getItem('d20_auto_saved_combatants');
      let localList = localData ? JSON.parse(localData) : [];
      localList = localList.filter((x: any) => x.name.toLowerCase() !== item.name.toLowerCase());
      localStorage.setItem('d20_auto_saved_combatants', JSON.stringify(localList));
    } catch (err) {
      console.error(err);
    }

    if (userId && item.id && (item.id.startsWith('auto_') || item.userId === userId)) {
      try {
        await deleteDoc(doc(db, 'characters', item.id));
      } catch (err) {
        console.error("Erro ao deletar do Firestore:", err);
      }
    }

    setRecentCreatures(prev => prev.filter(x => x.name.toLowerCase() !== item.name.toLowerCase()));
  };

  // Initiative manual roll helpers
  const handleRollInitiative = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setInitiative(roll.toString());
  };

  const resetForm = () => {
    setName('');
    setInitiative('');
    setAc(10);
    setIndividualHp(10);
    setGroupSize(1);
    setAttackMod(4);
    setAttacksPerCreature(1);
    setInitiativeMod(0);
    setInitiativeRollMode('normal');
    setAttacksList([
      { name: 'Ataque Padrão', attackMod: 4, damageDice: '1d6', damageMod: 2 }
    ]);
  };

  const handleVisualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let initVal = 10;
    let rollDetailsText = '';

    if (initiative !== '') {
      initVal = parseInt(initiative, 10);
      rollDetailsText = `(Iniciativa definida manual: ${initVal})`;
    } else {
      // Roll based on selection
      const roll1 = Math.floor(Math.random() * 20) + 1;
      let finalRoll = roll1;
      let breakdown = `d20 [${roll1}]`;

      if (initiativeRollMode === 'advantage') {
        const roll2 = Math.floor(Math.random() * 20) + 1;
        finalRoll = Math.max(roll1, roll2);
        breakdown = `Vantagem d20 [${roll1}, ${roll2}] (maior: ${finalRoll})`;
      } else if (initiativeRollMode === 'disadvantage') {
        const roll2 = Math.floor(Math.random() * 20) + 1;
        finalRoll = Math.min(roll1, roll2);
        breakdown = `Desvantagem d20 [${roll1}, ${roll2}] (menor: ${finalRoll})`;
      }

      initVal = finalRoll + initiativeMod;
      rollDetailsText = `(Iniciativa auto-rolada: ${finalRoll} + Mod ${initiativeMod >= 0 ? '+' : ''}${initiativeMod} = ${initVal} | ${breakdown})`;
    }

    const calculatedMaxHp = individualHp * groupSize;
    const finalAttacksList = attacksList.length > 0 ? attacksList : [{ name: 'Ataque Padrão', attackMod, damageDice: '1d6', damageMod: 2 }];

    onAddCombatant({
      name: type === 'enemy' && groupSize > 1 ? `${name} x${groupSize}` : name,
      type,
      initiative: isNaN(initVal) ? 10 : initVal,
      initiativeMod,
      initiativeRollMode,
      currentHp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      individualHp,
      groupSize,
      ac,
      attackMod: finalAttacksList[0]?.attackMod ?? attackMod,
      attacksPerCreature,
      attacksList: finalAttacksList
    });

    const entityDesc = type === 'enemy' 
      ? `Grupo de ${groupSize}x ${name} (${calculatedMaxHp} HP Total, CA ${ac})` 
      : `${name} (Jogador, CA ${ac})`;
    
    onLog(`Adicionado: ${entityDesc} ${rollDetailsText}`, 'setup');
    resetForm();
  };

  // Magic Text Parser Logic
  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedPreview(null);
      setTextError('');
      return;
    }

    try {
      const parsed = parseDndGroupText(text);
      setParsedPreview(parsed);
      setTextError('');
    } catch (err) {
      setTextError('Erro ao decodificar texto.');
    }
  };

  const parseDndGroupText = (text: string) => {
    const norm = text.toLowerCase().trim();
    
    // 1. Group Size & Name
    let groupSize = 1;
    let name = "Monstro";
    
    // "Adicionar 3 orcs", "3 orcs", "3x orcs"
    const sizeMatch = norm.match(/(?:adicionar\s+)?(\d+)\s*(?:x\s*)?([a-zA-Záéíóúãõâêîôûç\s]+?)(?=\.|\,|tem|cada|com|cf|ca|vida|hp|pv|$)/i);
    if (sizeMatch) {
      groupSize = parseInt(sizeMatch[1], 10);
      name = sizeMatch[2].replace(/\bx\b/g, '').trim();
    } else {
      const startNumMatch = norm.match(/^(\d+)\s+([a-zA-Záéíóúãõâêîôûç\s]+)/i);
      if (startNumMatch) {
        groupSize = parseInt(startNumMatch[1], 10);
        name = startNumMatch[2].trim();
      } else {
        // Just extract a name
        const justNameMatch = norm.match(/(?:adicionar\s+)?([a-zA-Záéíóúãõâêîôûç\s]+?)(?=\.|\,|tem|cada|com|cf|ca|vida|hp|pv|$)/i);
        if (justNameMatch) {
          name = justNameMatch[1].trim();
        }
      }
    }

    // Clean name
    name = name.replace(/(?:cada|tem|com|ataque|vida|ca|multiataque|\d+)/gi, '').trim();
    name = name.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    if (!name) name = "Criatura";

    // 2. HP per individual
    let individualHp = 10;
    const hpMatch = norm.match(/(\d+)\s*(?:de\s+)?(?:vida|hp|pv|ponto\s+de\s+vida|pontos\s+de\s+vida)|(?:vida|hp|pv|ponto\s+de\s+vida|pontos\s+de\s+vida)(?:\s*:|\s+de)?\s*(\d+)/i);
    if (hpMatch) {
      individualHp = parseInt(hpMatch[1] || hpMatch[2], 10);
    }

    // 3. CA (Class of Armor)
    let ac = 12;
    const acMatch = norm.match(/(?:ca|classe\s+de\s+armadura|defesa)(?:\s*:|\s+de)?\s*(\d+)/i);
    if (acMatch) {
      ac = parseInt(acMatch[1], 10);
    }

    // 4. Attack modifier
    let attackMod = 4;
    const attackMatch = norm.match(/(?:ataque|atq|modificador\s+de\s+ataque|bonus\s+de\s+ataque)(?:\s*de)?\s*([+-]?\d+)/i);
    if (attackMatch) {
      attackMod = parseInt(attackMatch[1], 10);
    } else {
      // simple +5 search
      const plusNumMatch = norm.match(/(?:ataque\s+|atq\s+)?\+?(\d+)/i);
      if (plusNumMatch && norm.includes("ataque")) {
        attackMod = parseInt(plusNumMatch[1], 10);
      }
    }

    // 5. Multiattack
    let attacksPerCreature = 1;
    const multiMatch = norm.match(/(?:multiataque|multi-ataque)(?:\s*de)?\s*(\d+)/i);
    if (multiMatch) {
      attacksPerCreature = parseInt(multiMatch[1], 10);
    } else {
      const attacksNumMatch = norm.match(/(\d+)\s*(?:ataque|ataques)/i);
      if (attacksNumMatch && !norm.includes("bônus de ataque") && !norm.includes("modificador de ataque")) {
        attacksPerCreature = parseInt(attacksNumMatch[1], 10);
      }
    }

    return {
      name,
      groupSize,
      individualHp,
      ac,
      attackMod,
      attacksPerCreature
    };
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedPreview) return;

    const { name, groupSize, individualHp, ac, attackMod, attacksPerCreature } = parsedPreview;
    const calculatedInit = Math.floor(Math.random() * 20) + 1; // Roll default initiative for text prompt additions
    const calculatedMaxHp = individualHp * groupSize;

    onAddCombatant({
      name: groupSize > 1 ? `${name} x${groupSize}` : name,
      type: 'enemy',
      initiative: calculatedInit,
      currentHp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      individualHp,
      groupSize,
      ac,
      attackMod,
      attacksPerCreature
    });

    onLog(`Adicionado via Texto: Grupo de ${groupSize}x ${name} (${calculatedMaxHp} HP, CA ${ac}, Atq +${attackMod}) [Iniciativa rolar d20: ${calculatedInit}]`, 'setup');
    setRawText('');
    setParsedPreview(null);
  };



  return (
    <div className="bg-[#111115] border border-[#2d2d35] rounded-xl overflow-hidden shadow-xl" id="combatant-form-container">
      {/* Header Tabs */}
      <div className="flex border-b border-[#2d2d35] bg-[#0c0c0e] p-1">
        <button
          onClick={() => setActiveTab('visual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'visual'
              ? 'bg-[#2d2d35] text-amber-500 shadow-sm border border-[#404048]'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#111115]'
          }`}
          type="button"
          id="tab-visual"
        >
          <Plus className="w-3.5 h-3.5" />
          Formulário Visual
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'text'
              ? 'bg-[#2d2d35] text-amber-500 shadow-sm border border-[#404048]'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#111115]'
          }`}
          type="button"
          id="tab-text"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-505" />
          Texto Mágico (Rápido)
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'visual' ? (
          <form onSubmit={handleVisualSubmit} className="space-y-4" id="visual-form">
            {/* Type selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setType('enemy'); if (groupSize < 1) setGroupSize(1); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-all ${
                  type === 'enemy'
                    ? 'bg-rose-950/30 border-rose-800 text-rose-350'
                    : 'bg-[#0f0f12] border-[#2d2d35] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                Inimigo / Grupo
              </button>
              <button
                type="button"
                onClick={() => { setType('player'); setGroupSize(1); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-all ${
                  type === 'player'
                    ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                    : 'bg-[#0f0f12] border-[#2d2d35] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Jogador (Player)
              </button>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">Nome do Personagem ou Grupo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'enemy' ? 'Ex: Orc, Goblin, Kobold' : 'Ex: Guerreiro, Mago, Legolas'}
                className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 placeholder-zinc-700 outline-none transition-all"
                id="input-name"
              />
            </div>

            {/* Sizes & HP Section */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">
                  <Shield className="w-3 h-3 text-amber-500" />
                  Classe de Armadura (CA)
                </label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={ac}
                  onChange={(e) => setAc(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                  id="input-ac"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">
                  <Heart className="w-3 h-3 text-rose-500" />
                  Vida Un. (HP de Cada)
                </label>
                <input
                  type="number"
                  min="1"
                  value={individualHp}
                  onChange={(e) => setIndividualHp(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                  id="input-individual-hp"
                />
              </div>
            </div>

            {/* Group count and Initiative */}
            <div className="grid grid-cols-2 gap-3">
              {type === 'enemy' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">Tamanho do Grupo</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={groupSize}
                    onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                    id="input-group-size"
                  />
                  {groupSize > 1 && (
                    <div className="text-[10px] text-zinc-500 mt-1 italic font-mono">
                      HP do Grupo Total: {individualHp * groupSize} HP
                    </div>
                  )}
                </div>
              ) : (
                <div className="opacity-40 select-none">
                  <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">Tamanho do Grupo</label>
                  <input
                    type="text"
                    disabled
                    value="1 (Fixo para Jogador)"
                    className="w-full bg-[#0c0c0e]/50 border border-[#1e1e24] rounded-lg py-2 px-3 text-xs text-zinc-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">Iniciativa Base</label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="Auto (d20)"
                    value={initiative}
                    onChange={(e) => setInitiative(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-2.5 text-sm text-zinc-200 outline-none transition-all placeholder:text-xs placeholder:text-zinc-600 font-mono"
                    id="input-initiative"
                  />
                  <button
                    type="button"
                    onClick={handleRollInitiative}
                    title="Definir rolagem rápida"
                    className="bg-[#1c1c24] hover:bg-[#282830] text-amber-500 border border-[#2d2d35] rounded-lg px-2.5 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Initiative mod & Roll Mode (Advantage/Disadvantage) */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#2d2d35]/30 pt-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">
                  Mod. Iniciativa
                </label>
                <input
                  type="number"
                  placeholder="+0"
                  value={initiativeMod || ''}
                  onChange={(e) => setInitiativeMod(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">
                  Tom da Rolagem
                </label>
                <select
                  value={initiativeRollMode}
                  onChange={(e) => setInitiativeRollMode(e.target.value as any)}
                  className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                >
                  <option value="normal">Normal (1d20)</option>
                  <option value="advantage">Vantagem (2d20)</option>
                  <option value="disadvantage">Desvantagem (2d20)</option>
                </select>
              </div>
            </div>

            {/* MULTIPLE ATTACKS CONFIGURATION */}
            <div className="space-y-3.5 border-t border-[#2d2d35]/50 pt-3.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-black text-amber-500/90 tracking-widest uppercase font-display select-none">
                  ⚔️ Perfis de Ataque ({attacksList.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddAttackRow}
                  className="text-[10px] font-bold text-amber-500 hover:text-amber-400 bg-[#1c1c24] hover:bg-[#282832] border border-[#2d2d35]/80 hover:border-amber-500/30 px-2 py-1 rounded flex items-center gap-1 transition-all pointer-events-auto cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  + Novo Ataque
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {attacksList.map((attack, index) => (
                  <div key={index} className="bg-[#0c0c0e]/30 border border-[#2d2d35]/50 hover:border-[#2d2d35] rounded-lg p-3 space-y-2.5 transition-all">
                    <div className="flex items-center justify-between gap-2 border-b border-[#2d2d35]/30 pb-1.5">
                      <input
                        type="text"
                        required
                        value={attack.name}
                        onChange={(e) => handleUpdateAttackRow(index, 'name', e.target.value)}
                        placeholder="Nome do ataque (ex: Mordida)"
                        className="bg-transparent text-xs font-bold text-zinc-250 outline-none focus:border-b border-amber-500/50 py-0.5 w-full placeholder:text-zinc-700"
                      />
                      {attacksList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttackRow(index)}
                          className="opacity-60 hover:opacity-100 hover:text-rose-400 p-1 transition-all shrink-0 cursor-pointer"
                          title="Remover este ataque"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">Bônus Acerto</span>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-zinc-500 font-mono font-medium">
                            {attack.attackMod >= 0 ? '+' : ''}
                          </span>
                          <input
                            type="number"
                            value={attack.attackMod}
                            onChange={(e) => handleUpdateAttackRow(index, 'attackMod', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0c0c0e] border border-[#2d2d35] rounded py-1 pl-5 pr-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-amber-500/40"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">Dado Dano</span>
                        <input
                          type="text"
                          value={attack.damageDice}
                          onChange={(e) => handleUpdateAttackRow(index, 'damageDice', e.target.value)}
                          placeholder="ex: 1d6"
                          className="w-full bg-[#0c0c0e] border border-[#2d2d35] rounded py-1 px-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-amber-500/40"
                        />
                      </div>

                      <div>
                        <span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1 tracking-wider">Bônus Dano</span>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-zinc-500 font-mono font-medium">
                            {attack.damageMod >= 0 ? '+' : ''}
                          </span>
                          <input
                            type="number"
                            value={attack.damageMod}
                            onChange={(e) => handleUpdateAttackRow(index, 'damageMod', parseInt(e.target.value, 10) || 0)}
                            className="w-full bg-[#0c0c0e] border border-[#2d2d35] rounded py-1 pl-5 pr-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-amber-500/40"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {type === 'enemy' && (
                <div className="grid grid-cols-1 gap-1.5 pt-1.5">
                  <label className="block text-[10px] font-bold text-zinc-450 uppercase tracking-wide">Multiataque por criatura</label>
                  <select
                    value={attacksPerCreature}
                    onChange={(e) => setAttacksPerCreature(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                    id="input-multiattack"
                  >
                    <option value="1">1 ataque por turno</option>
                    <option value="2">2 ataques por turno (Multi 2)</option>
                    <option value="3">3 ataques por turno (Multi 3)</option>
                    <option value="4">4 ataques por turno (Multi 4)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-4 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-lg py-2.5 px-4 text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg hover:shadow-amber-500/10 cursor-pointer transition-all active:scale-[0.98]"
              id="btn-add-visual"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Adicionar ao Combate
            </button>
          </form>
        ) : (
          /* TEXT MAGIC PARSER */
          <form onSubmit={handleTextSubmit} className="space-y-4" id="text-form">
            <div className="bg-[#0c0c0e] rounded-lg p-3 border border-[#2d2d35]/65 text-xs text-zinc-450 flex flex-start gap-2">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                Digite de forma livre ou siga o exemplo básico para adicionar grupos de monstros num instante!
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">Comando ou Descrição do Grupo</label>
              <textarea
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder='Ex: "Adicionar 3 orcs. Cada orc tem 15 de vida, CA 13 e ataque +5."'
                rows={3}
                className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-xs md:text-sm text-zinc-200 placeholder-zinc-700 outline-none transition-all font-mono leading-relaxed"
                id="text-parser-input"
              />
            </div>

            {/* Live Parsing Preview Card */}
            {parsedPreview && (
              <div className="bg-[#0c0c0e] border border-amber-600/30 rounded-xl p-4 space-y-2.5">
                <span className="inline-flex items-center gap-1.5 bg-amber-600/10 text-amber-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-amber-600/20">
                  <Sparkles className="w-3 h-3" />
                  Visualização da decodificação:
                </span>
                
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono">
                  <div className="text-zinc-500">Inimigo: <strong className="text-zinc-200">{parsedPreview.name}</strong></div>
                  <div className="text-zinc-500">Tamanho: <strong className="text-zinc-200">{parsedPreview.groupSize} criaturas</strong></div>
                  <div className="text-zinc-500">Vida Individual: <strong className="text-zinc-200">{parsedPreview.individualHp} HP</strong></div>
                  <div className="text-zinc-500">CA: <strong className="text-zinc-200">{parsedPreview.ac}</strong></div>
                  <div className="text-zinc-500">Ataque: <strong className="text-zinc-200">+{parsedPreview.attackMod}</strong></div>
                  <div className="text-zinc-500">Ataques p/ Criatura: <strong className="text-zinc-200">{parsedPreview.attacksPerCreature}</strong></div>
                </div>

                <div className="border-t border-[#2d2d35] pt-2 text-[10px] text-zinc-500 italic">
                  Iniciativa será decidida rolando d20 no momento do envio. HP Total: {parsedPreview.individualHp * parsedPreview.groupSize} HP.
                </div>
              </div>
            )}

            {textError && (
              <div className="text-xs text-rose-450 italic font-mono">
                {textError}
              </div>
            )}

            <button
              type="submit"
              disabled={!parsedPreview}
              className={`w-full font-bold rounded-lg py-2.5 px-4 text-xs tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                parsedPreview
                  ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                  : 'bg-[#1c1c24] text-zinc-650 cursor-not-allowed border border-[#111115]'
              }`}
              id="btn-add-text"
            >
              <Sparkles className="w-4 h-4" />
              Processar e Adicionar Grupo
            </button>
          </form>
        )}


      </div>

      {/* SEÇÃO HISTÓRICO DE CRIATURAS RECENTES */}
      <div className="border-t border-[#2d2d35]/60 bg-[#0c0c0e]/45 p-5 mt-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black text-amber-500/90 uppercase tracking-widest flex items-center gap-2 font-display">
            <History className="w-4 h-4 text-amber-500" />
            Sessões Passadas / Histórico de Adicionados
          </h3>
          <span className="text-[10px] text-zinc-500 font-mono">
            {recentCreatures.length} {recentCreatures.length === 1 ? 'criatura' : 'criaturas'}
          </span>
        </div>

        {recentCreatures.length > 0 ? (
          <div className="space-y-3">
            {/* Search Input for history */}
            <div className="relative font-sans">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-605" />
              <input
                type="text"
                placeholder="Pesquisar criaturas salvas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-[#2d2d35]/70 focus:border-amber-500/60 rounded-lg py-1.5 pl-8 pr-3 text-xs text-zinc-350 placeholder-zinc-550 outline-none transition-all"
              />
            </div>

            <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-[#2d2d35] scrollbar-track-transparent">
              {recentCreatures
                .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((item, index) => {
                  const isEnemy = item.type === 'enemy';
                  const currentQty = getItemQty(item);
                  return (
                    <div
                      key={item.id || index}
                      onClick={() => handleSelectRecent(item)}
                      className="group flex items-center justify-between bg-[#111115]/80 hover:bg-[#16161d] border border-[#2d2d35]/50 hover:border-amber-500/30 rounded-lg p-2.5 transition-all duration-150 cursor-pointer text-left gap-2"
                    >
                      {/* Left: Creature Details */}
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-semibold text-zinc-250 group-hover:text-amber-500 transition-colors truncate">
                            {item.name}
                          </strong>
                          <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            isEnemy ? 'bg-rose-95/20 text-rose-450 border border-rose-90/20' : 'bg-emerald-95/20 text-emerald-400 border border-emerald-900/20'
                          }`}>
                            {isEnemy ? 'Inimigo' : 'Jogador'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono mt-0.5 flex-wrap">
                          <span>CA {item.ac}</span>
                          <span>•</span>
                          <span>HP {item.individualHp}</span>
                          <span>•</span>
                          <span>Atq {item.attackMod >= 0 ? `+${item.attackMod}` : item.attackMod}</span>
                          {item.attacksPerCreature > 1 && (
                            <>
                              <span>•</span>
                              <span>Multi {item.attacksPerCreature}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Controls (Quantity Stepper, Direct Fast Add, Delete Template) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Custom inline quantity selector for "na lista mesmo eu posso colocar a quantidade" */}
                        <div 
                          className="flex items-center bg-[#07070a] border border-[#2d2d35] rounded-md overflow-hidden shrink-0"
                          onClick={(e) => e.stopPropagation()} // Prevent loading the form on clicking stepper
                        >
                          <button
                            type="button"
                            onClick={() => handleUpdateQtyMap(item.name, -1)}
                            className="text-zinc-500 hover:text-rose-400 font-bold px-1.5 py-0.5 text-[10px] transition-colors bg-[#0f0f13]/60 hover:bg-[#15151b] border-r border-[#2d2d35]"
                            title="Diminuir quantidade"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          
                          <input
                            type="number"
                            min="1"
                            value={currentQty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setQtyMap(prev => ({ ...prev, [item.name]: val }));
                            }}
                            className="w-7 bg-transparent text-center text-[10px] font-bold font-mono text-zinc-300 outline-none"
                            title="Quantidade a ser adicionada"
                          />

                          <button
                            type="button"
                            onClick={() => handleUpdateQtyMap(item.name, 1)}
                            className="text-zinc-500 hover:text-emerald-400 font-bold px-1.5 py-0.5 text-[10px] transition-colors bg-[#0f0f13]/60 hover:bg-[#15151b] border-l border-[#2d2d35]"
                            title="Aumentar quantidade"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        {/* Quick Inject Direct button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAddDirect(item);
                          }}
                          title={`Rápido: Adicionar ${currentQty} unidade(s) direto ao combate`}
                          className="bg-amber-600/10 hover:bg-amber-600 hover:text-black border border-amber-600/30 hover:border-amber-500 text-amber-500 text-[10px] font-extrabold py-1 px-1.5 rounded flex items-center gap-0.5 transition-all cursor-pointer select-none shrink-0"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span className="hidden sm:inline">Add</span>
                        </button>

                        {/* Delete Action Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecent(e, item)}
                          title="Remover do histórico permanente"
                          className="opacity-40 hover:opacity-100 bg-[#1c1c24] hover:bg-rose-950/20 border border-[#2d2d35] hover:border-rose-900/40 text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="bg-[#0c0c0e]/30 border border-[#2d2d35]/40 rounded-lg py-4 text-center">
            <p className="text-[11px] text-zinc-600 font-sans">
              Histórico de sessões vazio. Suas criaturas serão guardadas aqui automaticamente!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

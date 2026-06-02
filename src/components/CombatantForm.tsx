import React, { useState, useEffect } from 'react';
import { Combatant } from '../types';
import { Plus, Sparkles, Swords, UserPlus, Shield, Heart, Dices, Info, History, Trash2, Search } from 'lucide-react';
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
  const [ac, setAc] = useState<number>(10);
  const [individualHp, setIndividualHp] = useState<number>(10);
  const [groupSize, setGroupSize] = useState<number>(1);
  const [attackMod, setAttackMod] = useState<number>(0);
  const [attacksPerCreature, setAttacksPerCreature] = useState<number>(1);
  
  // Text Parser field
  const [rawText, setRawText] = useState('');
  const [textError, setTextError] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any>(null);

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

  const handleSelectRecent = (item: any) => {
    setName(item.name);
    setType(item.type || 'enemy');
    setAc(item.ac || 10);
    setIndividualHp(item.individualHp || 10);
    setGroupSize(item.groupSize || 1);
    setAttackMod(item.attackMod || 0);
    setAttacksPerCreature(item.attacksPerCreature || 1);
    
    onLog(`Carregado do histórico: "${item.name}" pronto para o combate.`, 'info');
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
    setAttackMod(0);
    setAttacksPerCreature(1);
  };

  const handleVisualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const initVal = initiative === '' ? Math.floor(Math.random() * 20) + 1 : parseInt(initiative, 10);
    const calculatedMaxHp = individualHp * groupSize;

    onAddCombatant({
      name: type === 'enemy' && groupSize > 1 ? `${name} x${groupSize}` : name,
      type,
      initiative: isNaN(initVal) ? 10 : initVal,
      currentHp: calculatedMaxHp,
      maxHp: calculatedMaxHp,
      individualHp,
      groupSize,
      ac,
      attackMod,
      attacksPerCreature,
    });

    const initRollText = initiative === '' ? `(Iniciativa auto-rolada: ${initVal})` : `(Iniciativa: ${initVal})`;
    const entityDesc = type === 'enemy' 
      ? `Grupo de ${groupSize}x ${name} (${calculatedMaxHp} HP Total, CA ${ac})` 
      : `${name} (Jogador, CA ${ac})`;
    
    onLog(`Adicionado: ${entityDesc} ${initRollText}`, 'setup');
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
                <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase mb-1">Iniciativa</label>
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
                    title="Rolar Iniciativa"
                    className="bg-[#1c1c24] hover:bg-[#282830] text-amber-500 border border-[#2d2d35] rounded-lg px-2.5 flex items-center justify-center transition-all cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Combat attack settings (only for enemies) */}
            {type === 'enemy' && (
              <div className="grid grid-cols-2 gap-3 border-t border-[#2d2d35]/50 pt-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-455 tracking-wider uppercase mb-1">Bônus de Ataque</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-zinc-500 text-sm font-semibold">{attackMod >= 0 ? '+' : ''}</span>
                    <input
                      type="number"
                      value={attackMod}
                      onChange={(e) => setAttackMod(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 pl-7 pr-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                      id="input-attack-mod"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-455 tracking-wider uppercase mb-1">Multiataque</label>
                  <select
                    value={attacksPerCreature}
                    onChange={(e) => setAttacksPerCreature(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-2 px-3 text-sm text-zinc-200 outline-none transition-all font-mono"
                    id="input-multiattack"
                  >
                    <option value="1">1 ataque/turno</option>
                    <option value="2">2 ataques (Multi 2)</option>
                    <option value="3">3 ataques (Multi 3)</option>
                    <option value="4">4 ataques (Multi 4)</option>
                  </select>
                </div>
              </div>
            )}

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
                  return (
                    <div
                      key={item.id || index}
                      onClick={() => handleSelectRecent(item)}
                      className="group flex items-center justify-between bg-[#111115]/80 hover:bg-[#16161d] border border-[#2d2d35]/50 hover:border-amber-500/30 rounded-lg p-2.5 transition-all duration-150 cursor-pointer text-left"
                    >
                      {/* Creature Details */}
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-semibold text-zinc-250 group-hover:text-amber-500 transition-colors">
                            {item.name}
                          </strong>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            isEnemy ? 'bg-rose-95/20 text-rose-450 border border-rose-90/20' : 'bg-emerald-95/20 text-emerald-400 border border-emerald-900/20'
                          }`}>
                            {isEnemy ? 'Inimigo' : 'Jogador'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                          <span>CA {item.ac}</span>
                          <span>•</span>
                          <span>HP {item.individualHp} {item.groupSize > 1 ? `(x${item.groupSize})` : ''}</span>
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

                      {/* Delete Action Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRecent(e, item)}
                        title="Remover do histórico permanente"
                        className="opacity-50 hover:opacity-100 bg-[#1c1c24] hover:bg-rose-950/20 border border-[#2d2d35] hover:border-rose-900/40 text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

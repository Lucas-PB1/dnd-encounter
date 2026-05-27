import React, { useState } from 'react';
import { Combatant, MonsterPreset } from '../types';
import { Plus, Sparkles, Swords, UserPlus, Shield, Heart, Dices, Info } from 'lucide-react';

interface CombatantFormProps {
  onAddCombatant: (combatant: Omit<Combatant, 'id' | 'isDefeated'>) => void;
  presets: MonsterPreset[];
  onLog: (message: string, type: 'info' | 'setup') => void;
}

export default function CombatantForm({ onAddCombatant, presets, onLog }: CombatantFormProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  
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

  const applyPreset = (preset: MonsterPreset) => {
    setName(preset.name);
    setType('enemy');
    setAc(preset.ac);
    setIndividualHp(preset.individualHp);
    setAttackMod(preset.attackMod);
    setAttacksPerCreature(preset.attacksPerCreature);
    setActiveTab('visual');
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

        {/* Live presets bar */}
        <div className="border-t border-[#2d2d35] mt-5 pt-3">
          <label className="block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-2">Biblioteca de Monstros Comuns</label>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="bg-[#0c0c0e] hover:bg-[#16161a] text-zinc-300 border border-[#2d2d35] text-[11px] font-medium py-1 px-2 rounded-md hover:border-amber-600/60 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <span>{p.name}</span>
                <span className="text-zinc-550 text-[9px] font-mono">hp:{p.individualHp}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

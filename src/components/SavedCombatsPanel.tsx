import React, { useState, useEffect } from 'react';
import { Combatant, LogEntry } from '../types';
import { Save, FolderOpen, Trash2, Shield, Heart, Users, Gamepad2, Play, Sparkles } from 'lucide-react';

interface SavedCombat {
  id: string;
  name: string;
  combatants: Combatant[];
  createdAt: string;
}

interface SavedCombatsPanelProps {
  currentCombatants: Combatant[];
  onLoadCombatants: (combatants: Combatant[], name: string) => void;
  onLog: (message: string, type: LogEntry['type'], combatantName?: string) => void;
}

export default function SavedCombatsPanel({
  currentCombatants,
  onLoadCombatants,
  onLog
}: SavedCombatsPanelProps) {
  const [savedCombats, setSavedCombats] = useState<SavedCombat[]>([]);
  const [encounterName, setEncounterName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Load saved combats from Local Storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dnd_saved_combats_list');
      if (stored) {
        setSavedCombats(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse saved combats from localStorage:', e);
    }
  }, []);

  const saveToStorage = (list: SavedCombat[]) => {
    localStorage.setItem('dnd_saved_combats_list', JSON.stringify(list));
    setSavedCombats(list);
  };

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounterName.trim()) {
      setErrorMsg('Por favor, defina um nome para o combate.');
      return;
    }
    if (currentCombatants.length === 0) {
      setErrorMsg('Adicione combatentes na iniciativa antes de salvar!');
      return;
    }

    const newSaved: SavedCombat = {
      id: Math.random().toString(36).substring(2, 9),
      name: encounterName.trim(),
      // Store a deep copy of current combatants, resetting status modifiers if wanted or restoring them exactly
      combatants: currentCombatants.map(c => ({
        ...c,
        // Reset dynamic states to full health for clean layout templates, but keep base stats
        currentHp: c.maxHp,
        isDefeated: false
      })),
      createdAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const duplicateIndex = savedCombats.findIndex(
      item => item.name.toLowerCase() === newSaved.name.toLowerCase()
    );

    let updatedList = [...savedCombats];
    if (duplicateIndex >= 0) {
      // Confirm override or just update
      updatedList[duplicateIndex] = {
        ...newSaved,
        id: savedCombats[duplicateIndex].id // Retain original ID
      };
      onLog(`Combate salvo: O combate "${newSaved.name}" foi sobrescrito com sucesso.`, 'setup');
    } else {
      updatedList.unshift(newSaved);
      onLog(`Combate salvo: Roteiro "${newSaved.name}" adicionado à sua biblioteca pessoal.`, 'setup');
    }

    saveToStorage(updatedList);
    setEncounterName('');
    setErrorMsg('');
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCombats.filter(item => item.id !== id);
    saveToStorage(updated);
    onLog(`Combate removido: "${name}" foi apagado da lista de salvamentos rápidos.`, 'setup');
  };

  const handleLoad = (combat: SavedCombat) => {
    // Return original combatants cloned fresh
    const freshCombatants = combat.combatants.map(c => ({
      ...c,
      id: Math.random().toString(36).substring(2, 9) + '-' + c.id.substring(0, 4) // uniquely identify newly cloned
    }));
    onLoadCombatants(freshCombatants, combat.name);
  };

  return (
    <div className="bg-[#111115] border border-[#2d2d35] rounded-xl overflow-hidden shadow-xl" id="saved-combats-panel">
      {/* Header */}
      <div className="bg-[#0c0c0e]/60 border-b border-[#2d2d35] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-600/10 rounded border border-amber-600/20">
            <Save className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">Meus Cenários Salvos</h3>
            <span className="text-[10px] text-zinc-500 font-mono">Salvar e carregar cenários inteiros</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Form to Save Current Combat */}
        <form onSubmit={handleSaveCurrent} className="space-y-2.5">
          <div className="flex flex-col space-y-1">
            <label className="block text-[11px] font-semibold text-zinc-450 tracking-wider uppercase">
              Salvar Combate Atual Como:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Cerco Goblim, Encontro com Ogro"
                value={encounterName}
                onChange={(e) => {
                  setEncounterName(e.target.value);
                  setErrorMsg('');
                }}
                className="flex-1 bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 placeholder-zinc-700 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={currentCombatants.length === 0}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  currentCombatants.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-md hover:shadow-amber-500/15'
                    : 'bg-[#1c1c24] text-zinc-650 cursor-not-allowed border border-[#111115]'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                Salvar
              </button>
            </div>
          </div>
          {errorMsg && (
            <p className="text-[10px] text-rose-450 italic font-mono">{errorMsg}</p>
          )}
          {currentCombatants.length === 0 && (
            <p className="text-[10px] text-zinc-600 italic">
              * Monte um grupo de combate à esquerda para habilitar o salvamento.
            </p>
          )}
        </form>

        {/* Saved List */}
        <div className="space-y-2 border-t border-[#2d2d35]/60 pt-3">
          <label className="block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1">
            Biblioteca de Combates ({savedCombats.length})
          </label>

          {savedCombats.length === 0 ? (
            <div className="bg-[#0c0c0e]/30 border border-dashed border-[#2d2d35] rounded-lg p-5 text-center text-xs text-zinc-550 italic">
              Nenhum cenário salvo ainda. Dê um nome no campo acima e clique em Salvar para preservar o combate atual no seu navegador!
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
              {savedCombats.map((combat) => {
                const playersCount = combat.combatants.filter(tc => tc.type === 'player').length;
                const enemiesCount = combat.combatants.filter(tc => tc.type === 'enemy').length;
                const totalHp = combat.combatants.reduce((sum, c) => sum + (c.maxHp || c.individualHp * c.groupSize), 0);

                return (
                  <div
                    key={combat.id}
                    onClick={() => handleLoad(combat)}
                    className="p-2.5 bg-[#0c0c0e] hover:bg-[#16161a] border border-[#2d2d35] rounded-lg cursor-pointer flex items-center justify-between group transition-all hover:border-amber-600/30"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-zinc-200 text-xs font-semibold group-hover:text-amber-550 transition-colors">
                          {combat.name}
                        </strong>
                        <span className="text-[8px] text-zinc-600 font-mono tracking-wide">
                          {combat.createdAt}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                        {playersCount > 0 && (
                          <span className="flex items-center gap-0.5 text-emerald-500/90 font-bold bg-emerald-950/20 px-1 rounded">
                            <Gamepad2 className="w-2.5 h-2.5" />
                            {playersCount} P
                          </span>
                        )}
                        {enemiesCount > 0 && (
                          <span className="flex items-center gap-0.5 text-rose-450/90 font-bold bg-rose-950/20 px-1 rounded">
                            <Users className="w-2.5 h-2.5" />
                            {combat.combatants.filter(e => e.type === 'enemy').reduce((sum, e) => sum + e.groupSize, 0)} M
                          </span>
                        )}
                        <span className="text-zinc-600">•</span>
                        <span>{combat.combatants.length} cards</span>
                        <span className="text-zinc-600">•</span>
                        <span>HP: {totalHp}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoad(combat);
                        }}
                        title="Injetar Cenário na Iniciativa"
                        className="p-1 px-1.5 rounded bg-amber-600 hover:bg-amber-550 text-black font-extrabold text-[10px] flex items-center gap-0.5 hover:scale-105 transition-all shadow"
                      >
                        <Play className="w-2.5 h-2.5 fill-black" />
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(combat.id, combat.name, e)}
                        title="Excluir da Biblioteca"
                        className="p-1.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-950/10 rounded transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

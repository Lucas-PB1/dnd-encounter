import React, { useState, useEffect } from 'react';
import { Combatant, LogEntry } from '../types';
import { Save, FolderOpen, Trash2, Shield, Heart, Users, Gamepad2, Play, Sparkles } from 'lucide-react';
import { db, sanitizeData } from '../lib/firebase';
import { collection, query, where, onSnapshot, setDoc, doc, deleteDoc } from 'firebase/firestore';

interface SavedCombat {
  id: string;
  userId: string;
  name: string;
  combatants: Combatant[];
  createdAt: string;
}

interface SavedCombatsPanelProps {
  userId: string;
  currentCombatants: Combatant[];
  onLoadCombatants: (combatants: Combatant[], name: string) => void;
  onLog: (message: string, type: LogEntry['type'], combatantName?: string) => void;
}

export default function SavedCombatsPanel({
  userId,
  currentCombatants,
  onLoadCombatants,
  onLog
}: SavedCombatsPanelProps) {
  const [savedCombats, setSavedCombats] = useState<SavedCombat[]>([]);
  const [encounterName, setEncounterName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync saved combats from Firestore in real-time
  useEffect(() => {
    if (!userId) {
      setSavedCombats([]);
      return;
    }

    setIsLoading(true);
    const q = query(collection(db, 'savedCombats'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SavedCombat[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SavedCombat);
      });
      // Sort newest first
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setSavedCombats(list);
      setIsLoading(false);
    }, (error) => {
      console.error('Erro ao escutar savedCombats:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setErrorMsg('Configure um usuário/mestre ativo para salvar cenários.');
      return;
    }
    if (!encounterName.trim()) {
      setErrorMsg('Por favor, defina um nome para o combate.');
      return;
    }
    if (currentCombatants.length === 0) {
      setErrorMsg('Adicione combatentes na iniciativa antes de salvar!');
      return;
    }

    const cleanName = encounterName.trim();
    const id = Math.random().toString(36).substring(2, 9);
    
    // Reset dynamic states to full health for clean templates
    const cleanCombatants = currentCombatants.map(c => ({
      ...c,
      currentHp: c.maxHp,
      isDefeated: false
    }));

    const dateStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    try {
      // Check if duplicate name exists in present list to overwrite
      const duplicate = savedCombats.find(item => item.name.toLowerCase() === cleanName.toLowerCase());
      const docId = duplicate ? duplicate.id : id;

      const newSaved: SavedCombat = {
        id: docId,
        userId,
        name: cleanName,
        combatants: cleanCombatants,
        createdAt: dateStr
      };

      await setDoc(doc(db, 'savedCombats', docId), sanitizeData(newSaved));
      
      if (duplicate) {
        onLog(`Combate salvo: O cenário "${cleanName}" foi atualizado e sincronizado na nuvem.`, 'setup');
      } else {
        onLog(`Combate salvo: Cenário "${cleanName}" construído e salvo na nuvem.`, 'setup');
      }
      setEncounterName('');
      setErrorMsg('');
    } catch (err) {
      console.error('Erro ao salvar no Firestore:', err);
      setErrorMsg('Erro de rede ao salvar cenário no banco Firestore.');
    }
  };

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'savedCombats', id));
      onLog(`Combate removido: "${name}" foi apagado da nuvem.`, 'setup');
    } catch (err) {
      console.error('Erro ao deletar no Firestore:', err);
    }
  };

  const handleLoad = (combat: SavedCombat) => {
    // Return original combatants cloned fresh with new IDs
    const freshCombatants = combat.combatants.map(c => ({
      ...c,
      id: Math.random().toString(36).substring(2, 9) + '-' + c.id.substring(0, 4)
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
            <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">Cenários de Combate (Nuvem)</h3>
            <span className="text-[10px] text-zinc-500 font-mono">Salvo no Firestore por {userId || 'Desconhecido'}</span>
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
                placeholder="Ex: Cerco Goblin, Guardiões das Catacumbas"
                value={encounterName}
                onChange={(e) => {
                  setEncounterName(e.target.value);
                  setErrorMsg('');
                }}
                className="flex-1 bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-lg py-1.5 px-3 text-xs text-zinc-200 placeholder-zinc-700 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={currentCombatants.length === 0 || !userId}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  currentCombatants.length > 0 && userId
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
            <p className="text-[10px] text-rose-455 italic font-mono">{errorMsg}</p>
          )}
          {!userId && (
            <p className="text-[10px] text-amber-500 italic">
              * Defina o seu usuário/mestre para ativar o banco FireStore de cenários.
            </p>
          )}
        </form>

        {/* Saved List */}
        <div className="space-y-2 border-t border-[#2d2d35]/60 pt-3">
          <label className="block text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-1">
            Cenários Salvos no Firestore ({savedCombats.length})
          </label>

          {isLoading ? (
            <div className="text-center py-4 text-xs font-mono text-zinc-500 animate-pulse">
              Carregando cenários da nuvem...
            </div>
          ) : savedCombats.length === 0 ? (
            <div className="bg-[#0c0c0e]/30 border border-dashed border-[#2d2d35] rounded-lg p-5 text-center text-xs text-zinc-550 italic">
              Nenhum cenário cadastrado na nuvem para "{userId || 'este mestre'}". Escreva um nome no campo acima e clique em Salvar!
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto pr-1 space-y-2" id="saved-combats-list">
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
                          <span className="flex items-center gap-0.5 text-rose-455/90 font-bold bg-rose-950/20 px-1 rounded">
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
                        title="Carregar Cenário no Combate Ativo"
                        className="p-1 px-1.5 rounded bg-amber-600 hover:bg-amber-550 text-black font-extrabold text-[10px] flex items-center gap-0.5 hover:scale-105 transition-all shadow-sm"
                      >
                        <Play className="w-2.5 h-2.5 fill-black" />
                        Carregar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(combat.id, combat.name, e)}
                        title="Excluir da Nuvem"
                        className="p-1.5 text-zinc-600 hover:text-rose-550 hover:bg-rose-950/10 rounded transition-all select-none"
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

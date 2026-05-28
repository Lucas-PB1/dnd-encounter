import React, { useState, useEffect } from 'react';
import { Combatant, AttackRollResult, LogEntry } from './types';
import { MONSTER_PRESETS } from './presets';
import { 
  Play, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Swords, 
  Shield, 
  Heart, 
  User, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Dice5,
  Coins,
  Settings,
  HelpCircle,
  Flame,
  UserCheck
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import CombatantForm from './components/CombatantForm';
import RollResultsPanel from './components/RollResultsPanel';
import CombatLog from './components/CombatLog';
import SavedCombatsPanel from './components/SavedCombatsPanel';
import ShareSessionPanel from './components/ShareSessionPanel';
import { db, testConnection, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export default function App() {
  // Live State
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentRoll, setCurrentRoll] = useState<AttackRollResult | null>(null);
  
  // UI Helpers
  const [hpInputValues, setHpInputValues] = useState<Record<string, string>>({});
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'all' | 'players' | 'enemies'>('all');
  const [editingAcId, setEditingAcId] = useState<string | null>(null);
  const [editingAcVal, setEditingAcVal] = useState<number>(10);

  // Attack Custom Targeting States
  const [attackConfigureId, setAttackConfigureId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [customTargetAc, setCustomTargetAc] = useState<string>('10');
  const [attackerCountInput, setAttackerCountInput] = useState<number>(1);

  // Sharing Session States
  const [isSpectatorMode, setIsSpectatorMode] = useState<boolean>(false);
  const [sessionCode, setSessionCode] = useState<string>(() => {
    return localStorage.getItem('dnd_active_share_code') || '';
  });
  const [spectatorError, setSpectatorError] = useState<string>('');

  // Load from LocalStorage
  useEffect(() => {
    testConnection(); // Verify Firestore database connectivity on boot

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('session');
    
    if (code) {
      setIsSpectatorMode(true);
      return; // Stop local storage recovery so spectators get server-driven state
    }

    const savedCombatants = localStorage.getItem('dnd_combatants');
    const savedLogs = localStorage.getItem('dnd_logs');
    const savedRound = localStorage.getItem('dnd_round');
    const savedTurnIndex = localStorage.getItem('dnd_turn_index');
    const savedHasStarted = localStorage.getItem('dnd_has_started');

    if (savedCombatants) {
      try {
        setCombatants(JSON.parse(savedCombatants));
      } catch (e) {
        console.error("Erro ao carregar combatentes", e);
      }
    }
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error("Erro ao carregar logs", e);
      }
    }
    if (savedRound) setRound(parseInt(savedRound, 10) || 1);
    if (savedTurnIndex) setCurrentTurnIndex(parseInt(savedTurnIndex, 10) || 0);
    if (savedHasStarted) setHasStarted(savedHasStarted === 'true');
  }, []);

  // Spectator mode automatic live syncing with Firestore in Real-Time!
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const codeFromUrl = searchParams.get('session');
    if (!isSpectatorMode || !codeFromUrl) return;

    const cleanCode = codeFromUrl.trim().toUpperCase();
    let isMounted = true;

    const docRef = doc(db, 'combatSessions', cleanCode);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (!isMounted) return;
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCombatants(data.combatants || []);
        setCurrentTurnIndex(data.currentTurnIndex || 0);
        setRound(data.round || 1);
        setLogs(data.logs || []);
        setCurrentRoll(data.currentRoll || null);
        setHasStarted(data.hasStarted || false);
        setSpectatorError('');
      } else {
        setSpectatorError("Não foi possível localizar a mesa de combate. O código de sessão pode estar incorreto ou expirou.");
      }
    }, (error) => {
      if (isMounted) {
        console.error("Erro na sincronização em tempo real do Firestore:", error);
        setSpectatorError("Falha de conexão com o servidor de dados do Firestore.");
        handleFirestoreError(error, OperationType.GET, `combatSessions/${cleanCode}`);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isSpectatorMode]);

  // DM sync states to Firestore (debounced) when sharing session is active
  useEffect(() => {
    if (isSpectatorMode || !sessionCode) return;

    const updateSharedStateOnFirestore = async () => {
      const cleanCode = sessionCode.trim().toUpperCase();
      try {
        await setDoc(doc(db, 'combatSessions', cleanCode), {
          sessionCode: cleanCode,
          combatants,
          currentTurnIndex,
          round,
          logs,
          currentRoll,
          hasStarted,
          lastUpdated: Date.now()
        });
      } catch (err) {
        console.error("Erro ao sincronizar dados do mestre com o Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, `combatSessions/${cleanCode}`);
      }
    };

    const debounceId = setTimeout(updateSharedStateOnFirestore, 600); // 600ms debounce
    return () => clearTimeout(debounceId);
  }, [combatants, currentTurnIndex, round, logs, currentRoll, hasStarted, sessionCode, isSpectatorMode]);

  // Save to LocalStorage
  useEffect(() => {
    if (isSpectatorMode) return;
    localStorage.setItem('dnd_combatants', JSON.stringify(combatants));
  }, [combatants, isSpectatorMode]);

  useEffect(() => {
    if (isSpectatorMode) return;
    localStorage.setItem('dnd_logs', JSON.stringify(logs));
  }, [logs, isSpectatorMode]);

  useEffect(() => {
    if (isSpectatorMode) return;
    localStorage.setItem('dnd_round', round.toString());
  }, [round, isSpectatorMode]);

  useEffect(() => {
    if (isSpectatorMode) return;
    localStorage.setItem('dnd_turn_index', currentTurnIndex.toString());
  }, [currentTurnIndex, isSpectatorMode]);

  useEffect(() => {
    if (isSpectatorMode) return;
    localStorage.setItem('dnd_has_started', hasStarted.toString());
  }, [hasStarted, isSpectatorMode]);

  // Generate safe 5-letter uppercase alphanumeric codes for sessions
  const generateSessionCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Highly readable alphanumeric set (avoids O/0, I/1)
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Sharing Action Handlers
  const handleStartSharing = async () => {
    try {
      const code = generateSessionCode();
      const cleanCode = code.trim().toUpperCase();
      
      await setDoc(doc(db, 'combatSessions', cleanCode), {
        sessionCode: cleanCode,
        combatants,
        currentTurnIndex,
        round,
        logs,
        currentRoll,
        hasStarted,
        lastUpdated: Date.now()
      });

      setSessionCode(cleanCode);
      localStorage.setItem('dnd_active_share_code', cleanCode);
      addLog(`Compartilhamento em tempo real do Firestore ativado! Código da sessão: ${cleanCode}`, 'setup');
    } catch (err) {
      console.error("Erro ao iniciar sessão online no Firestore:", err);
      addLog("Falha ao ativar compartilhamento em tempo real. Verifique sua conexão com o Firestore.", "info");
      handleFirestoreError(err, OperationType.CREATE, 'combatSessions');
    }
  };

  const handleStopSharing = () => {
    localStorage.removeItem('dnd_active_share_code');
    setSessionCode('');
    addLog("Compartilhamento em tempo real desativado.", "info");
  };

  const handleExitSpectatorMode = () => {
    window.location.search = '';
  };

  // Log handler helper
  const addLog = (message: string, type: LogEntry['type'], combatantName?: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: time,
      type,
      message,
      combatantName
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("Histórico de combate limpo.", "info");
  };

  // Add new combatant (either player or creature group)
  const handleAddCombatant = (newCombatant: Omit<Combatant, 'id' | 'isDefeated'>) => {
    const combatant: Combatant = {
      ...newCombatant,
      id: Math.random().toString(36).substring(2, 9),
      isDefeated: false
    };

    setCombatants(prev => {
      const updated = [...prev, combatant];
      // Sort immediately by initiative DESC, then by Name
      return updated.sort((a, b) => b.initiative - a.initiative);
    });
  };

  // Remove individual combatant
  const handleRemoveCombatant = (id: string, name: string) => {
    setCombatants(prev => {
      const filtered = prev.filter(c => c.id !== id);
      // Adjust turn index if needed to prevent index out of bounds
      if (currentTurnIndex >= filtered.length && filtered.length > 0) {
        setCurrentTurnIndex(filtered.length - 1);
      }
      return filtered;
    });
    addLog(`Removido do combate: ${name}`, 'setup');
  };

  // Apply HP damage / healing
  const handleModifyHp = (id: string, amountStr: string, mode: 'damage' | 'heal' | 'manual') => {
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) && mode !== 'manual') return;

    setCombatants(prev => {
      return prev.map(c => {
        if (c.id !== id) return c;

        let nextHp = c.currentHp;
        let eventMessage = "";
        let logType: LogEntry['type'] = 'info';

        if (mode === 'damage') {
          if (c.type === 'enemy' && c.groupSize > 1) {
            const prevAliveCount = Math.ceil(c.currentHp / c.individualHp);
            if (prevAliveCount > 0) {
              const currentActiveHp = c.currentHp - (prevAliveCount - 1) * c.individualHp;
              if (amount >= currentActiveHp) {
                // Standard RPG non-spillover rule: only 1 creature dies, and any dynamic excess damage is completely discarded.
                nextHp = (prevAliveCount - 1) * c.individualHp;
                const excess = amount - currentActiveHp;
                if (excess > 0) {
                  eventMessage = `recebeu ${amount} de dano (${currentActiveHp} aplicado, ${excess} de dano excedente foi descartado e ignorado)`;
                } else {
                  eventMessage = `recebeu ${amount} de dano e foi derrotado`;
                }
              } else {
                nextHp = c.currentHp - amount;
                eventMessage = `recebeu ${amount} de dano`;
              }
            } else {
              nextHp = 0;
              eventMessage = `recebeu ${amount} de dano (já estava derrotado)`;
            }
          } else {
            nextHp = Math.max(0, c.currentHp - amount);
            eventMessage = `recebeu ${amount} de dano`;
          }
          logType = 'damage';
        } else if (mode === 'heal') {
          nextHp = Math.min(c.maxHp, c.currentHp + amount);
          eventMessage = `foi curado em ${amount} HP`;
          logType = 'heal';
        } else if (mode === 'manual') {
          nextHp = Math.min(c.maxHp, Math.max(0, amount));
          eventMessage = `teve sua vida definida manualmente para ${nextHp}/${c.maxHp}`;
          logType = 'info';
        }

        const prevAliveCount = Math.ceil(c.currentHp / c.individualHp);
        const nextAliveCount = Math.ceil(nextHp / c.individualHp);
        const sizeDelta = prevAliveCount - nextAliveCount;

        let deathAlert = "";
        if (c.type === 'enemy' && c.groupSize > 1 && sizeDelta > 0 && nextHp > 0) {
          deathAlert = ` (${sizeDelta} monstro(s) derrotado(s), restam ${nextAliveCount} vivo(s))`;
        }

        const isDefeated = nextHp <= 0;
        if (isDefeated && !c.isDefeated) {
          deathAlert = c.type === 'enemy' ? " ☠️ GRUPO DERROTADO!" : " ☠️ CAIU EM COMBATE!";
        }

        addLog(`${c.name} ${eventMessage}.${deathAlert}`, logType, c.name);

        return {
          ...c,
          currentHp: nextHp,
          isDefeated
        };
      });
    });

    // Reset input value
    setHpInputValues(prev => ({ ...prev, [id]: "" }));
  };

  // Turn management skipping dead enemies
  const findNextActiveIndex = (startIndex: number, direction: 'forward' | 'backward', list: Combatant[]): number => {
    if (list.length === 0) return 0;
    
    let index = startIndex;
    const len = list.length;
    
    for (let i = 0; i < len; i++) {
      if (direction === 'forward') {
        index = (index + 1) % len;
      } else {
        index = (index - 1 + len) % len;
      }
      
      // If we found an active (non-defeated) player or enemy, return that index
      if (!list[index].isDefeated) {
        return index;
      }
    }
    
    return startIndex; // Fail-safe (return original if all are defeated)
  };

  const handleNextTurn = () => {
    if (combatants.length === 0) return;
    
    if (!hasStarted) {
      setHasStarted(true);
      // find first active
      const firstActive = combatants.findIndex(c => !c.isDefeated);
      const initialIdx = firstActive !== -1 ? firstActive : 0;
      setCurrentTurnIndex(initialIdx);
      addLog(`Combate iniciado! Turno de: ${combatants[initialIdx]?.name} (Iniciativa ${combatants[initialIdx]?.initiative})`, 'turn');
      return;
    }

    const nextIndex = findNextActiveIndex(currentTurnIndex, 'forward', combatants);
    
    // Check if we looped back to superior initiative (went through round loop)
    if (nextIndex <= currentTurnIndex && combatants.length > 1) {
      setRound(prev => prev + 1);
      addLog(`== RODADA ${round + 1} ==`, 'info');
    }

    setCurrentTurnIndex(nextIndex);
    addLog(`Turno de: ${combatants[nextIndex].name}`, 'turn');
  };

  const handlePrevTurn = () => {
    if (combatants.length === 0 || !hasStarted) return;

    const prevIndex = findNextActiveIndex(currentTurnIndex, 'backward', combatants);
    
    if (prevIndex >= currentTurnIndex && round > 1 && combatants.length > 1) {
      setRound(prev => Math.max(1, prev - 1));
      addLog(`Voltando para == RODADA ${round - 1} ==`, 'info');
    }

    setCurrentTurnIndex(prevIndex);
    addLog(`Turno voltou para: ${combatants[prevIndex].name}`, 'turn');
  };

  // Reset entire combat simulation back to initial values (heals everyone, sets Round 1)
  const handleResetCombat = () => {
    setRound(1);
    setCurrentTurnIndex(0);
    setHasStarted(false);
    setCombatants(prev => {
      return prev.map(c => ({
        ...c,
        currentHp: c.maxHp,
        isDefeated: false
      }));
    });
    setCurrentRoll(null);
    addLog("Combate reiniciado. Todos os combatentes foram curados e a rodada voltou para 1.", "setup");
  };

  // Wipe list clean
  const handleClearAll = () => {
    setRound(1);
    setCurrentTurnIndex(0);
    setHasStarted(false);
    setCombatants([]);
    setCurrentRoll(null);
    addLog("Combate limpo. Todos os combatentes foram removidos.", "setup");
  };

  // Mass D20 Roll Simulation for group monsters
  const handleGroupAttackRoll = (combatant: Combatant) => {
    const aliveCount = Math.ceil(combatant.currentHp / combatant.individualHp);
    if (aliveCount <= 0) return;

    const totalAttacksCount = aliveCount * combatant.attacksPerCreature;
    const rolls: AttackRollResult['rolls'] = [];

    // Loop through alive creatures and their attacks
    for (let enemyIndex = 1; enemyIndex <= aliveCount; enemyIndex++) {
      for (let attackIdx = 1; attackIdx <= combatant.attacksPerCreature; attackIdx++) {
        const dieRoll = Math.floor(Math.random() * 20) + 1;
        const total = dieRoll + combatant.attackMod;
        
        rolls.push({
          creatureIndex: enemyIndex,
          attackIndex: attackIdx,
          dieRoll,
          modifier: combatant.attackMod,
          total,
          isCritSuccess: dieRoll === 20,
          isCritFailure: dieRoll === 1
        });
      }
    }

    const rollResult: AttackRollResult = {
      id: Math.random().toString(36).substring(2, 9),
      attackerName: combatant.name,
      rolls,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setCurrentRoll(rollResult);

    const crits = rolls.filter(r => r.isCritSuccess).length;
    let logMessage = `${combatant.name} realiza ${totalAttacksCount} ataque(s) (Bônus +${combatant.attackMod})`;
    if (crits > 0) {
      logMessage += ` — desferindo ${crits} golpe(s) CRÍTICO(S)! 💥`;
    }

    addLog(logMessage, 'roll', combatant.name);
  };

  // Configured D20 Roll Simulation against a specific player
  const handleGroupAttackRollConfigured = (
    attacker: Combatant, 
    targetId: string, 
    customAc: number, 
    attackerCount: number
  ) => {
    const targetPlayer = combatants.find(x => x.id === targetId);
    const targetAcValue = targetPlayer ? targetPlayer.ac : customAc;
    const targetNameStr = targetPlayer ? targetPlayer.name : `Alvo (CA ${customAc})`;

    const totalAttacksCount = attackerCount * attacker.attacksPerCreature;
    const rolls: AttackRollResult['rolls'] = [];

    // Loop through selected count of creatures and their attacks
    for (let enemyIndex = 1; enemyIndex <= attackerCount; enemyIndex++) {
      for (let attackIdx = 1; attackIdx <= attacker.attacksPerCreature; attackIdx++) {
        const dieRoll = Math.floor(Math.random() * 20) + 1;
        const total = dieRoll + attacker.attackMod;
        const isCritSuccess = dieRoll === 20;
        const isCritFailure = dieRoll === 1;
        const isHit = isCritSuccess || (!isCritFailure && total >= targetAcValue);

        rolls.push({
          creatureIndex: enemyIndex,
          attackIndex: attackIdx,
          dieRoll,
          modifier: attacker.attackMod,
          total,
          isCritSuccess,
          isCritFailure,
          targetAc: targetAcValue,
          isHit
        });
      }
    }

    const rollResult: AttackRollResult = {
      id: Math.random().toString(36).substring(2, 9),
      attackerName: attacker.name,
      rolls,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      targetAc: targetAcValue,
      targetName: targetNameStr,
      attackerCount: attackerCount
    };

    setCurrentRoll(rollResult);
    setAttackConfigureId(null); // Close panel

    // Build the descriptive D&D narrative log exactly as requested
    const hits = rolls.filter(r => r.isHit).length;
    const crits = rolls.filter(r => r.isCritSuccess).length;
    const fumbles = rolls.filter(r => r.isCritFailure).length;

    // First main log sentence
    let mainLog = `${attackerCount} ${attackerCount === 1 ? 'membro' : 'membros'} de "${attacker.name}" atacam "${targetNameStr}" (CA ${targetAcValue}).`;
    mainLog += ` Jogadas: ${hits} acerto(s) de ${totalAttacksCount} tentativa(s).`;

    // Add individual details to show hits/errors/crits on fumbles concisely
    const rollDetails = rolls.map(r => {
      let suffix = "";
      if (r.isCritSuccess) suffix = "crítico 💥";
      else if (r.isCritFailure) suffix = "falha crítica ⚠️";
      else if (r.isHit) suffix = "acertou ✓";
      else suffix = "errou ✗";

      return `Criatura ${r.creatureIndex}${r.attackIndex > 1 ? ` (Atq ${r.attackIndex})` : ''}: ${r.dieRoll}+${r.modifier}=${r.total} [${suffix}]`;
    }).join(' | ');

    addLog(`${mainLog} Detalhes: ${rollDetails}`, 'roll', attacker.name);
  };

  // Quick helper to fill some initial players/monsters to begin with if the board is empty
  const loadDemoEncounter = () => {
    handleClearAll();
    
    // Player 1
    handleAddCombatant({
      name: "Arthur Pendragon (Guerreiro)",
      type: "player",
      initiative: 18,
      currentHp: 32,
      maxHp: 32,
      individualHp: 32,
      groupSize: 1,
      ac: 17,
      attackMod: 5,
      attacksPerCreature: 1
    });

    // Monsters Group
    handleAddCombatant({
      name: "Orcs Selvagens", // will display Orcs Selvagens x3
      type: "enemy",
      initiative: 14,
      currentHp: 45,
      maxHp: 45,
      individualHp: 15,
      groupSize: 3,
      ac: 13,
      attackMod: 5,
      attacksPerCreature: 1
    });

    // Monsters Single
    handleAddCombatant({
      name: "Goblin Batedor",
      type: "enemy",
      initiative: 10,
      currentHp: 7,
      maxHp: 7,
      individualHp: 7,
      groupSize: 1,
      ac: 15,
      attackMod: 4,
      attacksPerCreature: 1
    });

    setHasStarted(false);
  };

  const handleLoadCombatLibrary = (freshCombatants: Combatant[], name: string) => {
    setCombatants(freshCombatants);
    setRound(1);
    setCurrentTurnIndex(0);
    setHasStarted(false);
    setCurrentRoll(null);
    setAttackConfigureId(null);
    setHpInputValues({});
    addLog(`Cenário carregado: "${name}" foi iniciado! Todos os combatentes foram restaurados com vida cheia.`, 'setup');
  };

  const sortedAndFilteredCombatants = combatants.filter(c => {
    if (filterType === 'all') return true;
    if (filterType === 'players') return c.type === 'player';
    if (filterType === 'enemies') return c.type === 'enemy';
    return true;
  });

  const activeCombatant = hasStarted && combatants.length > 0 ? combatants[currentTurnIndex] : null;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#d4d4d8] flex flex-col font-sans" id="combat-tracker-app">
      
      {/* Top Banner Navigation */}
      <header className="border-b border-[#2d2d35] bg-[#16161a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo Brand Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 flex items-center justify-center rounded-xl shadow-lg border border-amber-600/40 active-glow">
              <Swords className="w-5 h-5 text-amber-500 animate-pulse-subtle" />
            </div>
            <div>
              <h1 className="text-md sm:text-lg font-bold tracking-tight text-white font-display flex items-center gap-2">
                Claro
                <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-600/10 px-2 py-0.5 rounded border border-amber-600/20 tracking-wider">Initiative System</span>
              </h1>
              <p className="text-[11px] text-zinc-500 font-light">Controle ágil e automatizado de combates em grupo</p>
            </div>
          </div>

          {/* Turn Control Center */}
          <div className="flex items-center gap-3 bg-[#111115] p-2 rounded-xl border border-[#2d2d35]">
            {/* Round info */}
            <div className="px-3 py-1.5 text-center shrink-0 border-r border-[#2d2d35]">
              <div className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono">Rodada</div>
              <div className="text-md font-extrabold text-amber-500 font-mono">{round}</div>
            </div>

            {/* Turn Buttons */}
            <div className="flex items-center gap-1.5 px-1">
              <button
                onClick={handlePrevTurn}
                disabled={combatants.length === 0 || !hasStarted || isSpectatorMode}
                title="Voltar Turno"
                className="p-2 text-zinc-400 hover:text-amber-500 disabled:text-zinc-750 hover:bg-[#16161a] rounded-lg border border-transparent disabled:bg-transparent transition-all cursor-pointer"
                id="btn-prev-turn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="min-w-36 text-center px-2">
                {hasStarted && activeCombatant ? (
                  <div className="animate-pulse-subtle">
                    <span className="text-[9px] uppercase font-bold text-amber-500 font-mono flex items-center justify-center gap-1">
                      👑 ATIVO
                    </span>
                    <strong className="text-xs text-zinc-100 truncate block max-w-44 text-center">
                      {activeCombatant.name}
                    </strong>
                  </div>
                ) : (
                  <div>
                    <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono block">Pronto para iniciar</span>
                    <span className="text-xs text-zinc-550 block">Aguardando mestre</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleNextTurn}
                disabled={combatants.length === 0 || isSpectatorMode}
                title={isSpectatorMode ? "Modo leitura" : hasStarted ? "Avançar Turno" : "Iniciar Combate"}
                className={`p-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  isSpectatorMode
                    ? 'bg-[#0d0d0f] text-zinc-700 border border-zinc-900 cursor-not-allowed'
                    : hasStarted
                      ? 'text-amber-500 hover:text-white hover:bg-amber-600/15 border border-transparent hover:border-amber-600/30'
                      : 'bg-amber-650 hover:bg-amber-500 text-black shadow-lg shadow-amber-600/20 border border-amber-400/20'
                }`}
                id="btn-next-turn"
              >
                {hasStarted ? <ChevronRight className="w-4 h-4" /> : <Play className="w-3.5 h-3.5 fill-black text-black" />}
              </button>
            </div>
            
            {/* Quick action resets */}
            <div className="flex items-center border-l border-[#2d2d35] pl-1.5 gap-1">
              <button
                onClick={handleResetCombat}
                disabled={combatants.length === 0 || isSpectatorMode}
                title="Reiniciar Combate (Cura tudo, volta rodada 1)"
                className="p-2 text-zinc-550 hover:text-amber-550 hover:bg-[#16161a] rounded-lg transition-all cursor-pointer disabled:text-zinc-800 disabled:opacity-30"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Dash */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="main-content-grid">
        
        {/* LEFT COLUMN: INITIATIVE QUEUE & MANAGEMENT (SPAN 8) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* Header toolbar for listing */}
          <div className="bg-[#111115] border border-[#2d2d35] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md" id="toolbar">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">Combate</span>
              <span className="bg-[#0c0c0e] font-mono text-xs font-bold px-2 py-0.5 rounded text-zinc-400 border border-[#2d2d35]">
                {combatants.length} {combatants.length === 1 ? 'membro' : 'membros'}
              </span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="bg-[#0c0c0e] p-1 rounded-lg border border-[#2d2d35] flex text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    filterType === 'all'
                      ? 'bg-[#2d2d35] text-amber-500'
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  Ver Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('players')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    filterType === 'players'
                      ? 'bg-[#2d2d35] text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  Jogadores
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('enemies')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    filterType === 'enemies'
                      ? 'bg-[#2d2d35] text-rose-450'
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  Inimigos
                </button>
              </div>

              {!isSpectatorMode && (
                combatants.length === 0 ? (
                  <button
                    onClick={loadDemoEncounter}
                    className="bg-[#0c0c0e] hover:bg-[#16161a] text-amber-500 hover:text-amber-400 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#2d2d35] transition-all cursor-pointer"
                  >
                    Carregar Exemplo
                  </button>
                ) : (
                  <button
                    onClick={handleClearAll}
                    className="bg-rose-950/20 hover:bg-rose-950/40 text-rose-450 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-rose-900/40 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Esvaziar
                  </button>
                )
              )}
            </div>
          </div>

          {/* Initiative List Area */}
          <div className="space-y-3 relative" id="initiative-list">
            {combatants.length === 0 ? (
              <div className="bg-[#111115] border border-[#2d2d35] border-dashed rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center justify-center shadow-inner">
                <div className="w-12 h-12 bg-[#0c0c0e] rounded-full flex items-center justify-center border border-[#2d2d35] mb-4">
                  <Dice5 className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-md font-bold text-zinc-350 font-display mb-1">Iniciativa Vazia</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mb-6">
                  {isSpectatorMode 
                    ? "Nenhum combatente ativo na mesa compartilhada do mestre ainda."
                    : "Nenhum guerreiro ou monstro na arena ainda. Adicione aliados ou monstros usando o formulário ao lado ou carregue o exemplo rápido de sessão de combate!"
                  }
                </p>
                {!isSpectatorMode && (
                  <button
                    onClick={loadDemoEncounter}
                    className="bg-amber-600 hover:bg-amber-500 text-black font-semibold text-xs px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer"
                  >
                    Carregar Exemplo de Combate (32 HP Guerreiro vs 3x Orcs)
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {sortedAndFilteredCombatants.map((c, idx) => {
                  const displayIndexInSorted = combatants.findIndex(item => item.id === c.id);
                  const isActive = hasStarted && displayIndexInSorted === currentTurnIndex;
                  const isDead = c.isDefeated;
                  
                  // Calculating survivors counts
                  const aliveCount = Math.ceil(c.currentHp / c.individualHp);
                  const totalCountCheck = c.groupSize;

                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      layout
                      className={`relative bg-[#111115] border rounded-xl overflow-hidden transition-all shadow-md ${
                        isActive 
                          ? 'border-amber-500/85 active-glow bg-gradient-to-r from-[#111115] to-amber-950/10' 
                          : isDead
                            ? 'border-[#1e1e24] opacity-45 bg-[#0a0a0c]'
                            : 'border-[#2d2d35] hover:border-zinc-700'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500"></div>
                      )}

                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        {/* LEFT SECTION: Initiative, Name, Characteristics */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          {/* Initiative Badge */}
                          <div className={`w-10 h-10 shrink-0 font-mono text-center flex flex-col items-center justify-center rounded-lg border font-bold transition-all ${
                            isActive
                              ? 'bg-amber-500 border-amber-400 text-slate-950 scale-105'
                              : isDead
                                ? 'bg-slate-950 border-slate-900 text-slate-600'
                                : 'bg-slate-950 border-slate-800 text-amber-500'
                          }`}>
                            <span className="text-[8px] font-sans uppercase font-bold text-slate-500 block leading-3 leading-none">INI</span>
                            <span className="text-md">{c.initiative}</span>
                          </div>

                          {/* Member/Group identity */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {/* Crest symbol/icon */}
                              {c.type === 'player' ? (
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Swords className="w-3.5 h-3.5 text-rose-500" />
                              )}

                              <h4 className={`text-sm font-bold truncate tracking-tight ${
                                isDead ? 'line-through text-slate-550' : 'text-slate-100'
                              }`}>
                                {c.name}
                              </h4>

                              {/* Alive Badges */}
                              {c.type === 'enemy' && c.groupSize > 1 ? (
                                <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  isDead
                                    ? 'bg-slate-950 text-slate-500 border-slate-900'
                                    : 'bg-rose-950 text-rose-450 border-rose-900/60'
                                }`}>
                                  {aliveCount <= 0 ? 'Derrotados 💀' : `${aliveCount} vivos / ${totalCountCheck}`}
                                </span>
                              ) : isDead ? (
                                <span className="text-[9px] uppercase font-bold bg-slate-950 text-slate-500 px-1.5 py-0.5 border border-slate-900 rounded">
                                  Inativo ☠️
                                </span>
                              ) : null}
                            </div>

                            {/* Combat details: AC/CA, Atq, attacks */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#a1a1aa] font-mono">
                              <span className="flex items-center gap-1 bg-[#0c0c0e] px-1.5 py-0.5 rounded border border-[#2d2d35]">
                                <Shield className="w-3 h-3 text-amber-500" />
                                <span className="text-zinc-500">CA:</span> 
                                <span className="font-bold text-zinc-300">{c.ac}</span>
                              </span>

                              {c.type === 'enemy' && (
                                <>
                                  <span className="flex items-center gap-1 bg-[#0c0c0e] px-1.5 py-0.5 rounded border border-[#2d2d35]">
                                    <Swords className="w-3 h-3 text-rose-500" />
                                    <span className="text-zinc-500">Ataque:</span>
                                    <span className="font-bold text-zinc-300">+{c.attackMod}</span>
                                  </span>

                                  {c.attacksPerCreature > 1 && (
                                    <span className="bg-amber-600/10 text-amber-500 border border-amber-600/20 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase">
                                      Multiataque {c.attacksPerCreature}x
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* MIDDLE SECTION: HP Slider and Values */}
                        <div className="flex flex-col space-y-1.5 md:w-48 shrink-0">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-zinc-450 flex items-center gap-1">
                              <Heart className={`w-3 h-3 ${isDead ? 'text-zinc-700' : 'text-rose-500 fill-rose-500/10'}`} />
                              PV / Vida:
                            </span>
                            <span className="font-bold text-zinc-200">
                              {c.currentHp} <span className="text-zinc-500">/ {c.maxHp}</span>
                            </span>
                          </div>

                          {/* Percentual Bar */}
                          <div className="w-full h-2 bg-[#0c0c0e] rounded-full overflow-hidden border border-[#2d2d35]">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isDead
                                  ? 'bg-zinc-800'
                                  : (c.currentHp / c.maxHp) < 0.3
                                    ? 'bg-rose-500' // vermelho (< 30%)
                                    : (c.currentHp / c.maxHp) <= 0.7
                                      ? 'bg-[#e5c158]' // amarelo (30% - 70%)
                                      : 'bg-emerald-500' // verde (> 70%)
                              }`}
                              style={{ width: `${(c.currentHp / c.maxHp) * 100}%` }}
                            ></div>
                          </div>

                          {/* Quick health visual helper */}
                          {c.type === 'enemy' && c.groupSize > 1 && (
                            <div className="text-[10px] text-zinc-550 font-mono italic leading-none text-right">
                              Cada individual: {c.individualHp} HP
                            </div>
                          )}
                        </div>

                        {/* RIGHT SECTION: Quick Damage / Heal Inputs & Rolling Attacks */}
                        {!isSpectatorMode ? (
                          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                            {/* HP Quick Modifier bar */}
                            <div className="flex items-center bg-[#0c0c0e] rounded-lg overflow-hidden border border-[#2d2d35]">
                              {/* Damage - */}
                              <button
                                onClick={() => {
                                  handleModifyHp(c.id, hpInputValues[c.id] || "1", 'damage');
                                }}
                                title="Aplicar Dano"
                                className="px-2.5 py-1.5 bg-rose-950/30 hover:bg-rose-900 border-r border-[#2d2d35] text-rose-400 hover:text-white transition-all text-xs font-extrabold cursor-pointer"
                              >
                                Dano
                              </button>

                              {/* HP Amount input */}
                              <input
                                type="number"
                                placeholder="Qtd"
                                value={hpInputValues[c.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setHpInputValues(prev => ({ ...prev, [c.id]: val }));
                                }}
                                className="w-12 bg-transparent text-center text-zinc-200 outline-none text-xs font-bold font-mono py-1 placeholder-zinc-750"
                                id={`input-hp-adjust-${c.id}`}
                              />

                              {/* Heals + */}
                              <button
                                onClick={() => {
                                  handleModifyHp(c.id, hpInputValues[c.id] || "1", 'heal');
                                }}
                                title="Curar"
                                className="px-2.5 py-1.5 bg-emerald-950/30 hover:bg-emerald-900 text-emerald-400 hover:text-white transition-all text-xs font-extrabold cursor-pointer"
                              >
                                Cura
                              </button>
                            </div>

                            {/* ROLL ATTACKS (Only for alive enemy units) */}
                            {c.type === 'enemy' && (
                              <button
                                onClick={() => {
                                  if (attackConfigureId === c.id) {
                                    setAttackConfigureId(null);
                                  } else {
                                    setAttackConfigureId(c.id);
                                    const firstActivePlayer = combatants.find(x => x.type === 'player' && !x.isDefeated);
                                    if (firstActivePlayer) {
                                      setSelectedTargetId(firstActivePlayer.id);
                                      setCustomTargetAc(firstActivePlayer.ac.toString());
                                    } else {
                                      setSelectedTargetId('manual');
                                      setCustomTargetAc('10');
                                    }
                                    setAttackerCountInput(aliveCount > 0 ? aliveCount : 1);
                                  }
                                }}
                                disabled={isDead}
                                title={`Rolar ataque para ${aliveCount} monstro(s)`}
                                className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all ${
                                  isDead
                                    ? 'bg-[#0a0a0c] text-zinc-700 border-zinc-900 cursor-not-allowed'
                                    : attackConfigureId === c.id
                                      ? 'bg-amber-500 text-black border-amber-400'
                                      : 'bg-[#ffc83b]/10 border-[#ffc83b]/35 text-[#ffc83b] hover:bg-[#ffc83b]/25 shadow-sm'
                                }`}
                                id={`btn-attack-roll-${c.id}`}
                              >
                                <Swords className="w-3.5 h-3.5 shrink-0" />
                                Atacar
                              </button>
                            )}

                            {/* Quick Manual slider toggle */}
                            <button
                              onClick={() => handleRemoveCombatant(c.id, c.name)}
                              title="Remover Combatente"
                              className="p-1.5 text-zinc-500 hover:text-rose-450 border border-transparent hover:border-[#2d2d35] hover:bg-[#0c0c0e] rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : null}

                      </div>

                      {/* TARGET AND COUNT SELECTION CONFIGURATION EXPANDABLE BLOCK */}
                      {attackConfigureId === c.id && (
                        <div className="border-t border-[#2d2d35]/70 bg-[#0c0c0e] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                              <Swords className="w-3.5 h-3.5" />
                              Configurar Alvo e Quantidade de Atacantes
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            {/* Player target selector */}
                            <div className="md:col-span-4 flex flex-col space-y-1">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase font-sans">Alvo do Ataque:</span>
                              <select
                                value={selectedTargetId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedTargetId(val);
                                  if (val !== 'manual') {
                                    const t = combatants.find(x => x.id === val);
                                    if (t) setCustomTargetAc(t.ac.toString());
                                  }
                                }}
                                className="w-full bg-[#111115] border border-[#2d2d35] rounded-lg py-1.5 px-2.5 text-xs text-zinc-200 outline-none focus:border-amber-500 cursor-pointer transition-all"
                              >
                                {combatants.filter(tc => tc.type === 'player' && !tc.isDefeated).map(tc => (
                                  <option key={tc.id} value={tc.id}>
                                    {tc.name} (CA: {tc.ac})
                                  </option>
                                ))}
                                <option value="manual">Manual (Definir CA...)</option>
                              </select>
                            </div>

                            {/* Custom target AC */}
                            {selectedTargetId === 'manual' && (
                              <div className="md:col-span-2 flex flex-col space-y-1">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase font-sans">Classe de Armadura:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="35"
                                  value={customTargetAc}
                                  onChange={(e) => setCustomTargetAc(e.target.value)}
                                  className="w-full bg-[#111115] border border-[#2d2d35] text-zinc-200 rounded-lg py-1.5 px-2 text-center text-xs font-bold focus:border-amber-500 outline-none font-mono"
                                />
                              </div>
                            )}

                            {/* Attacking enemy quantity */}
                            <div className={`${selectedTargetId === 'manual' ? 'md:col-span-3' : 'md:col-span-5'} flex flex-col space-y-1`}>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase font-sans">Qtd. de Atacantes:</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={aliveCount}
                                  value={attackerCountInput}
                                  onChange={(e) => setAttackerCountInput(Math.min(aliveCount, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                                  className="w-16 bg-[#111115] border border-[#2d2d35] text-zinc-200 rounded-lg py-1.5 px-2 text-center text-xs font-bold focus:border-amber-500 outline-none font-mono"
                                />
                                <span className="text-[9px] text-[#8e8e93] font-mono leading-none">/ {aliveCount} {aliveCount === 1 ? 'criatura viva' : 'criaturas vivas'}</span>
                              </div>
                            </div>

                            {/* Trigger Attack action Button */}
                            <div className="md:col-span-3">
                              <button
                                type="button"
                                onClick={() => handleGroupAttackRollConfigured(c, selectedTargetId, parseInt(customTargetAc, 10), attackerCountInput)}
                                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-extrabold py-2 px-3 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-md hover:shadow-amber-500/10 transition-all cursor-pointer active:scale-95"
                              >
                                <Swords className="w-3.5 h-3.5 stroke-[2.5]" />
                                Atacar Alvo
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CONTROLS, ATTACKS ROLLS & HISTORY LOGS (SPAN 4) */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          
          {/* Share and transmission control panel */}
          <ShareSessionPanel
            isSpectatorMode={isSpectatorMode}
            sessionCode={isSpectatorMode ? (new URLSearchParams(window.location.search).get('session')?.toUpperCase() || '') : sessionCode}
            onStartSharing={handleStartSharing}
            onStopSharing={handleStopSharing}
            onExitSpectator={handleExitSpectatorMode}
            spectatorError={spectatorError}
          />

          {!isSpectatorMode && (
            <>
              {/* 1. Add combatant custom panels */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5 font-display">
                  <Plus className="w-4 h-4 text-amber-500" />
                  Adicionar Combatente
                </h3>
                <CombatantForm 
                  onAddCombatant={handleAddCombatant} 
                  presets={MONSTER_PRESETS}
                  onLog={addLog}
                />
              </div>

              {/* 1.5. Saved Combats Library Panel */}
              <SavedCombatsPanel
                currentCombatants={combatants}
                onLoadCombatants={handleLoadCombatLibrary}
                onLog={addLog}
              />
            </>
          )}

          {/* 2. Live rolling output results */}
          <RollResultsPanel 
            currentRoll={currentRoll} 
            onClearRoll={() => setCurrentRoll(null)} 
          />

          {/* 3. Narrative stream Log */}
          <CombatLog 
            logs={logs} 
            onClearLogs={clearLogs} 
          />

        </div>

      </main>

      {/* Footer credits bar */}
      <footer className="mt-auto border-t border-[#1e1e24] bg-[#111115] py-4 text-center">
        <p className="text-[10px] text-zinc-600 tracking-wider font-mono">
          Iniciativa e Combate em Grupo de D&D • Sistema Autômato para Mestres • 2026
        </p>
      </footer>

    </div>
  );
}

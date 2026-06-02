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
  UserCheck,
  Sparkles,
  Laptop,
  CheckCircle2,
  Users,
  LogOut,
  FolderOpen
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import CombatantForm from './components/CombatantForm';
import RollResultsPanel from './components/RollResultsPanel';
import CombatLog from './components/CombatLog';
import SavedCombatsPanel from './components/SavedCombatsPanel';
import ShareSessionPanel from './components/ShareSessionPanel';
import CharacterConfigurationPanel from './components/CharacterConfigurationPanel';
import { db, testConnection, handleFirestoreError, OperationType, sanitizeData, auth } from './lib/firebase';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';

export default function App() {
  // Authentication & Master/User Identity
  const [userId, setUserId] = useState<string>('');
  const [isStateLoaded, setIsStateLoaded] = useState<boolean>(false);

  // Live Combat State (authoritative from DB)
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentRoll, setCurrentRoll] = useState<AttackRollResult | null>(null);
  const [hasStarted, setHasStarted] = useState<boolean>(false);

  // UI Helpers
  const [hpInputValues, setHpInputValues] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState<'all' | 'players' | 'enemies'>('all');
  const [activeTab, setActiveTab] = useState<'quick-combat' | 'char-library'>('quick-combat');

  // Attack Custom Targeting States
  const [attackConfigureId, setAttackConfigureId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [customTargetAc, setCustomTargetAc] = useState<string>('10');
  const [attackerCountInput, setAttackerCountInput] = useState<number>(1);

  // Spectator Session State
  const [isSpectatorMode, setIsSpectatorMode] = useState<boolean>(false);
  const [sessionCode, setSessionCode] = useState<string>('');
  const [spectatorError, setSpectatorError] = useState<string>('');

  // Portal Lobby States (used before choosing role)
  const [lobbyDmName, setLobbyDmName] = useState<string>('');
  const [lobbyJoinCode, setLobbyJoinCode] = useState<string>('');

  // Real Authentication States
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authDisplayName, setAuthDisplayName] = useState<string>('');
  const [authIsRegister, setAuthIsRegister] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(true);

  // 1. Startup & Connection Check
  useEffect(() => {
    testConnection(); // Verify Firestore connectivity on boot

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('session');
    
    if (code) {
      setIsSpectatorMode(true);
      setSessionCode(code.trim().toUpperCase());
    }
  }, []);

  // 2. Spectator Mode Real-time Stream from Firestore
  useEffect(() => {
    if (!isSpectatorMode || !sessionCode) return;

    const cleanCode = sessionCode.trim().toUpperCase();
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
  }, [isSpectatorMode, sessionCode]);
  const generateSessionCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Highly readable alphanumeric set (avoids O/0, I/1)
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 3. Real Auth Observer & Session Loader
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsStateLoaded(false);
        const namePart = user.displayName || user.email?.split('@')[0] || 'Mestre';
        const cleanName = namePart.replace(/[^a-zA-Z0-9_\-]/g, '');

        try {
          const profileRef = doc(db, 'userProfiles', user.uid);
          const profileSnap = await getDoc(profileRef);

          let targetSessionCode = '';
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            targetSessionCode = profileData.lastActiveSessionCode || '';
          }

          if (targetSessionCode) {
            const sessionRef = doc(db, 'combatSessions', targetSessionCode);
            const sessionSnap = await getDoc(sessionRef);

            if (sessionSnap.exists()) {
              const sData = sessionSnap.data();
              setCombatants(sData.combatants || []);
              setCurrentTurnIndex(sData.currentTurnIndex || 0);
              setRound(sData.round || 1);
              setLogs(sData.logs || []);
              setCurrentRoll(sData.currentRoll || null);
              setHasStarted(sData.hasStarted || false);
              setSessionCode(targetSessionCode);
              setUserId(user.uid);
              setIsStateLoaded(true);
              addLog(`Bem-vindo, Mestre ${cleanName}! Mesa "${targetSessionCode}" carregada em tempo real com sucesso do Firestore.`, 'setup');
              return;
            }
          }

          // Generate fresh room if none existed
          const newCode = generateSessionCode();
          await setDoc(profileRef, {
            username: cleanName,
            lastActiveSessionCode: newCode,
            createdAt: Date.now()
          });

          const initialLogs: LogEntry[] = [{
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            type: 'setup',
            message: `Mesa de combate virtual criada na nuvem. Código da sala: ${newCode}`
          }];

          await setDoc(doc(db, 'combatSessions', newCode), {
            sessionCode: newCode,
            combatants: [],
            currentTurnIndex: 0,
            round: 1,
            logs: initialLogs,
            currentRoll: null,
            hasStarted: false,
            lastUpdated: Date.now()
          });

          setCombatants([]);
          setCurrentTurnIndex(0);
          setRound(1);
          setLogs(initialLogs);
          setCurrentRoll(null);
          setHasStarted(false);
          setSessionCode(newCode);
          setUserId(user.uid);
          setIsStateLoaded(true);
          addLog(`Olá, Mestre ${cleanName}! Novo espaço virtual gerado. Código: ${newCode}`, 'setup');

        } catch (err) {
          console.error("Erro carregando ambiente mestre:", err);
          setUserId(user.uid);
          setIsStateLoaded(true);
        }
      } else {
        setUserId('');
        setSessionCode('');
        setCombatants([]);
        setIsStateLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // 3.1 Real Login & Sign Up Actions (Email & Google)
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Erro ao autenticar com o Google. Tente novamente.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Por favor preencha todos os campos obrigatórios.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authIsRegister) {
        if (authPassword.length < 6) {
          throw { code: 'auth/weak-password' };
        }
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        if (authDisplayName.trim()) {
          await updateProfile(userCredential.user, {
            displayName: authDisplayName.trim()
          });
        }
        addLog("Conta de mestre registrada no Firebase!", "setup");
      } else {
        await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
        addLog("Autenticação aceita!", "setup");
      }
    } catch (err: any) {
      console.error(err);
      let friendlyMsg = err.message || 'Erro de autenticação.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMsg = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMsg = 'E-mail já está em uso por outro cadastro.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyMsg = 'E-mail informado é inválido.';
      } else if (err.code === 'auth/weak-password') {
        friendlyMsg = 'A senha precisa conter no mínimo 6 caracteres.';
      }
      setAuthError(friendlyMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVincularMestre = async (username: string) => {
    // Kept as shim for manual triggers if any, but auth observer drives everything
  };

  // 4. Force state synchronization to Firestore when anything changes locally (debounced!)
  // ONLY pushes when state is fully loaded from Firestore, prevents overwriting with empty tables!
  useEffect(() => {
    if (!isBroadcasting || isSpectatorMode || !sessionCode || !isStateLoaded || !userId) return;

    const updateSharedStateOnFirestore = async () => {
      const cleanCode = sessionCode.trim().toUpperCase();
      try {
        await setDoc(doc(db, 'combatSessions', cleanCode), sanitizeData({
          sessionCode: cleanCode,
          combatants,
          currentTurnIndex,
          round,
          logs,
          currentRoll,
          hasStarted,
          lastUpdated: Date.now()
        }));
      } catch (err) {
        console.error("Erro ao sincronizar dados com o Firestore:", err);
      }
    };

    const debounceId = setTimeout(updateSharedStateOnFirestore, 600);
    return () => clearTimeout(debounceId);
  }, [combatants, currentTurnIndex, round, logs, currentRoll, hasStarted, sessionCode, isSpectatorMode, isStateLoaded, userId]);

  // Generate completely new game session for the active DM
  const handleCreateNewRoom = async () => {
    if (!userId) return;
    try {
      const newCode = generateSessionCode();
      const profileRef = doc(db, 'userProfiles', userId);

      await setDoc(profileRef, {
        username: userId,
        lastActiveSessionCode: newCode,
        createdAt: Date.now()
      });

      const initialLogs: LogEntry[] = [{
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'setup',
        message: `Nova mesa criada sob demanda pelo mestre. Novo código: ${newCode}`
      }];

      await setDoc(doc(db, 'combatSessions', newCode), {
        sessionCode: newCode,
        combatants: [],
        currentTurnIndex: 0,
        round: 1,
        logs: initialLogs,
        currentRoll: null,
        hasStarted: false,
        lastUpdated: Date.now()
      });

      setCombatants([]);
      setCurrentTurnIndex(0);
      setRound(1);
      setLogs(initialLogs);
      setCurrentRoll(null);
      setHasStarted(false);
      setSessionCode(newCode);
      addLog(`Nova mesa limpa iniciada! Código da sessão atualizada para: ${newCode}`, 'setup');
    } catch (err) {
      console.error("Erro ao criar nova sala:", err);
    }
  };

  // Exit Master controls or Spectator role to return to Lobby portal
  const handleExitToLobby = () => {
    setUserId('');
    setSessionCode('');
    setIsSpectatorMode(false);
    setIsStateLoaded(false);
    setCombatants([]);
    setLogs([]);
    setRound(1);
    setCurrentTurnIndex(0);
    setHasStarted(false);
    // Clear URL query
    window.history.pushState({}, document.title, window.location.pathname);
  };

  // Log helper
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

  // Add a combatant manually or loaded from config catalog
  const handleAddCombatant = async (newCombatant: Omit<Combatant, 'id' | 'isDefeated'>) => {
    const combatant: Combatant = {
      ...newCombatant,
      id: Math.random().toString(36).substring(2, 9),
      isDefeated: false
    };

    setCombatants(prev => {
      const updated = [...prev, combatant];
      return updated.sort((a, b) => b.initiative - a.initiative);
    });

    // Auto-save created enemies: "se o mestre criar um inimigo salve ele automaticamente e ele pode ser visto em outra aba"
    if (userId && newCombatant.type === 'enemy') {
      try {
        let baseName = newCombatant.name;
        // Clean group size suffix if it got appended (e.g. Goblin 1, Goblin x3, etc.)
        if (newCombatant.groupSize > 1) {
          const suffixRegex = new RegExp(`\\s+(x|multi)\\s*${newCombatant.groupSize}$`, 'i');
          baseName = baseName.replace(suffixRegex, '').trim();
        }

        const charId = Math.random().toString(36).substring(2, 9);
        const autoSavedEnemy = {
          id: charId,
          userId,
          name: baseName,
          type: 'enemy',
          ac: newCombatant.ac || 10,
          individualHp: newCombatant.individualHp || 10,
          groupSize: newCombatant.groupSize || 1,
          attackMod: newCombatant.attackMod || 0,
          attacksPerCreature: newCombatant.attacksPerCreature || 1,
          description: `Criado e salvo automaticamente em ${new Date().toLocaleDateString('pt-BR')}`,
          createdAt: Date.now()
        };

        const charRef = doc(db, 'characters', charId);
        await setDoc(charRef, sanitizeData(autoSavedEnemy));
        addLog(`Inimigo "${baseName}" catalogado automaticamente no acervo!`, 'setup');
      } catch (err) {
        console.error("Erro ao catalogar inimigo automaticamente:", err);
      }
    }
  };

  // Delete combatant
  const handleRemoveCombatant = (id: string, name: string) => {
    setCombatants(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (currentTurnIndex >= filtered.length && filtered.length > 0) {
        setCurrentTurnIndex(filtered.length - 1);
      }
      return filtered;
    });
    addLog(`Removido do combate: ${name}`, 'setup');
  };

  // Adjust health points
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
                nextHp = (prevAliveCount - 1) * c.individualHp;
                const excess = amount - currentActiveHp;
                if (excess > 0) {
                  eventMessage = `recebeu ${amount} de dano (${currentActiveHp} aplicado, ${excess} de dano excedente descartado)`;
                } else {
                  eventMessage = `recebeu ${amount} de dano e foi derrotado`;
                }
              } else {
                nextHp = c.currentHp - amount;
                eventMessage = `recebeu ${amount} de dano`;
              }
            } else {
              nextHp = 0;
              eventMessage = `recebeu ${amount} de dano (já derrotado)`;
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
          eventMessage = `teve sua vida definida para ${nextHp}/${c.maxHp}`;
          logType = 'info';
        }

        const prevAliveCount = Math.ceil(c.currentHp / c.individualHp);
        const nextAliveCount = Math.ceil(nextHp / c.individualHp);
        const sizeDelta = prevAliveCount - nextAliveCount;

        let deathAlert = "";
        if (c.type === 'enemy' && c.groupSize > 1 && sizeDelta > 0 && nextHp > 0) {
          deathAlert = ` (${sizeDelta} monstro(s) caído(s), restam ${nextAliveCount} vivo(s))`;
        }

        const isDefeated = nextHp <= 0;
        if (isDefeated && !c.isDefeated) {
          deathAlert = c.type === 'enemy' ? " ☠️ GRUPO ELIMINADO" : " ☠️ CAIU EM COMBATE!";
        }

        addLog(`${c.name} ${eventMessage}.${deathAlert}`, logType, c.name);

        return {
          ...c,
          currentHp: nextHp,
          isDefeated
        };
      });
    });

    setHpInputValues(prev => ({ ...prev, [id]: "" }));
  };

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
      
      if (!list[index].isDefeated) {
        return index;
      }
    }
    return startIndex;
  };

  const handleNextTurn = () => {
    if (combatants.length === 0) return;
    
    if (!hasStarted) {
      setHasStarted(true);
      const firstActive = combatants.findIndex(c => !c.isDefeated);
      const initialIdx = firstActive !== -1 ? firstActive : 0;
      setCurrentTurnIndex(initialIdx);
      addLog(`Início do Combate! Turno ativo de: ${combatants[initialIdx]?.name} (Iniciativa ${combatants[initialIdx]?.initiative})`, 'turn');
      return;
    }

    const nextIndex = findNextActiveIndex(currentTurnIndex, 'forward', combatants);
    
    if (nextIndex <= currentTurnIndex && combatants.length > 1) {
      setRound(prev => prev + 1);
      addLog(`== RODADA ${round + 1} ==`, 'info');
    }

    setCurrentTurnIndex(nextIndex);
    addLog(`Turno ativo de: ${combatants[nextIndex].name}`, 'turn');
  };

  const handlePrevTurn = () => {
    if (combatants.length === 0 || !hasStarted) return;

    const prevIndex = findNextActiveIndex(currentTurnIndex, 'backward', combatants);
    
    if (prevIndex >= currentTurnIndex && round > 1 && combatants.length > 1) {
      setRound(prev => Math.max(1, prev - 1));
      addLog(`Retornando para == RODADA ${round - 1} ==`, 'info');
    }

    setCurrentTurnIndex(prevIndex);
    addLog(`Turno retornado para: ${combatants[prevIndex].name}`, 'turn');
  };

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
    addLog("Combate reiniciado. PVs restaurados no Firestore.", "setup");
  };

  const handleClearAll = () => {
    setRound(1);
    setCurrentTurnIndex(0);
    setHasStarted(false);
    setCombatants([]);
    setCurrentRoll(null);
    addLog("Arena limpa. Todos os combatentes removidos.", "setup");
  };

  // Fast group attacks
  const handleGroupAttackRoll = (combatant: Combatant) => {
    const aliveCount = Math.ceil(combatant.currentHp / combatant.individualHp);
    if (aliveCount <= 0) return;

    const totalAttacksCount = aliveCount * combatant.attacksPerCreature;
    const rolls: AttackRollResult['rolls'] = [];

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
    let logMessage = `${combatant.name} realiza ${totalAttacksCount} ataque(s) (+${combatant.attackMod})`;
    if (crits > 0) logMessage += ` — ${crits} golpe(s) CRÍTICO(S)! 💥`;

    addLog(logMessage, 'roll', combatant.name);
  };

  // Targeting Group Attack Simulator
  const handleGroupAttackRollConfigured = (
    attacker: Combatant, 
    targetId: string, 
    customAc: number, 
    attackerCount: number
  ) => {
    const targetPlayer = combatants.find(x => x.id === targetId);
    const targetAcValue = targetPlayer ? targetPlayer.ac : customAc;
    const targetNameStr = targetPlayer ? targetPlayer.name : `Alvo de CA ${customAc}`;

    const totalAttacksCount = attackerCount * attacker.attacksPerCreature;
    const rolls: AttackRollResult['rolls'] = [];

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
    setAttackConfigureId(null);

    const hits = rolls.filter(r => r.isHit).length;
    let mainLog = `Combate: ${attackerCount}x "${attacker.name}" contra "${targetNameStr}" (CA ${targetAcValue}). Total de acertos: ${hits}/${totalAttacksCount}.`;
    
    const rollDetails = rolls.map(r => {
      let suffix = r.isCritSuccess ? "Crítico 💥" : r.isCritFailure ? "Falha ⚠️" : r.isHit ? "✓" : "✗";
      return `Criatura ${r.creatureIndex}(Atq ${r.attackIndex}): ${r.dieRoll}+${r.modifier}=${r.total} [${suffix}]`;
    }).join(' | ');

    addLog(`${mainLog} Detalhes: ${rollDetails}`, 'roll', attacker.name);
  };

  const loadDemoEncounter = () => {
    handleClearAll();
    
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

    handleAddCombatant({
      name: "Orcs Selvagens",
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
    addLog(`Cenário carregado: "${name}" implantado com sucesso na iniciativa!`, 'setup');
  };

  const sortedAndFilteredCombatants = combatants.filter(c => {
    if (filterType === 'all') return true;
    if (filterType === 'players') return c.type === 'player';
    if (filterType === 'enemies') return c.type === 'enemy';
    return true;
  });

  const activeCombatant = hasStarted && combatants.length > 0 ? combatants[currentTurnIndex] : null;

  // LOBBY PORTAL / GATEWAY IF NOT AUTHENTICATED
  const showLobbyGateway = !isSpectatorMode && (!userId || !isStateLoaded);

  if (showLobbyGateway) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] text-[#d4d4d8] flex items-center justify-center font-sans p-4" id="lobby-portal">
        <div className="max-w-md w-full bg-[#111115] border border-[#2d2d35] rounded-3xl overflow-hidden shadow-2xl relative">
          
          {/* Logo brand element */}
          <div className="bg-[#0c0c0e]/80 border-b border-[#2d2d35] p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-600/10 border border-amber-600/30 flex items-center justify-center rounded-2xl mx-auto active-glow">
              <Swords className="w-6 h-6 text-amber-500 animate-pulse-subtle" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-white tracking-tight flex items-center justify-center gap-2">
                Claro
                <span className="text-[10px] uppercase font-bold text-amber-500 bg-amber-600/10 px-2.5 py-0.5 rounded border border-amber-600/20 tracking-widest font-mono">Initiative System</span>
              </h1>
              <p className="text-xs text-zinc-500 font-light mt-1">Plataforma Cloud-Persistent de Jogadores e Mestres de RPG</p>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* option 1: DM Portal with Real Firebase Auth */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#2d2d35]/50 pb-2">
                <Laptop className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  {authIsRegister ? 'Criar Nova Conta de Mestre' : 'Acesso de Mestre (DM Auth)'}
                </h2>
              </div>
              
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {authIsRegister && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block mb-1 font-mono">Apelido de Mestre</label>
                    <input
                      type="text"
                      placeholder="Ex: Lucas_Mestre"
                      value={authDisplayName}
                      onChange={(e) => setAuthDisplayName(e.target.value)}
                      className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none transition-all placeholder:text-zinc-700 font-mono"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block mb-1 font-mono">E-mail</label>
                  <input
                    type="email"
                    placeholder="mestre@rpgmail.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none transition-all placeholder:text-zinc-700 font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block font-mono">Senha</label>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-xl py-2 px-3 text-xs text-zinc-200 outline-none transition-all placeholder:text-zinc-700 font-mono"
                    required
                  />
                </div>

                {authError && (
                  <div className="bg-red-950/20 text-red-400 border border-red-800/20 p-2.5 rounded-xl text-[11px] leading-relaxed flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1 font-sans">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-805 disabled:text-zinc-600 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-md hover:shadow-amber-500/10"
                  >
                    {authLoading ? 'Verificando...' : authIsRegister ? 'Registrar Mestre' : 'Entrar com E-mail'}
                  </button>
                </div>
              </form>

              {/* Toggle registering mode */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setAuthIsRegister(!authIsRegister);
                    setAuthError('');
                  }}
                  className="text-[10px] text-zinc-500 hover:text-amber-500 transition-colors font-semibold bg-transparent border-none cursor-pointer"
                >
                  {authIsRegister ? 'Já possui cadastro? Clique para Entrar' : 'Não tem uma conta mestre? Registre-se aqui'}
                </button>
              </div>

              {/* Google Sign In Divider */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#2d2d35]/30"></div>
                <span className="flex-shrink mx-4 text-[9px] uppercase font-bold tracking-widest font-mono text-zinc-650">Ou mídias sociais</span>
                <div className="flex-grow border-t border-[#2d2d35]/30"></div>
              </div>

              {/* Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full bg-[#0c0c0e] hover:bg-[#14141a] border border-[#2d2d35] text-zinc-300 font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow hover:shadow-amber-500/5 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" width="24" height="24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Entrar com Google
              </button>
            </div>

            {/* option 2: Player Entrance */}
            <div className="space-y-3 pt-2 border-t border-[#2d2d35]/40 text-left">
              <div className="flex items-center gap-2 border-b border-[#2d2d35]/50 pb-2">
                <Users className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Entrar como Jogador / Espectador</h2>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Digite o código de sala de 5 dígitos fornecido pelo Mestre para acompanhar a mesa em tempo real.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="Código de 5 dígitos (ex: K9W3Z)"
                  value={lobbyJoinCode}
                  onChange={(e) => setLobbyJoinCode(e.target.value.toUpperCase().trim())}
                  className="flex-1 bg-[#0c0c0e] border border-[#2d2d35] focus:border-amber-500 rounded-xl py-2.5 px-4 text-xs text-zinc-250 font-mono text-center outline-none transition-all placeholder:text-zinc-700"
                  id="lobby-join-code"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (lobbyJoinCode.length === 5) {
                      window.location.search = `?session=${lobbyJoinCode}`;
                    }
                  }}
                  disabled={lobbyJoinCode.length < 5}
                  className="bg-zinc-800 disabled:opacity-40 hover:bg-zinc-700 text-zinc-200 font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  Acompanhar
                </button>
              </div>
            </div>
            
            <div className="text-center pt-2 text-[10px] text-zinc-600 font-mono">
              * Sem dependência de armazenamento local • Conexão ativa com o banco de dados
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-[#d4d4d8] flex flex-col font-sans" id="combat-tracker-app">
      
      {/* 1. Header & Navigation Controls */}
      <header className="border-b border-[#2d2d35] bg-[#16161a] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600/20 flex items-center justify-center rounded-xl shadow-lg border border-amber-600/40 active-glow">
                <Swords className="w-5 h-5 text-amber-500 animate-pulse-subtle" />
              </div>
              <div>
                <h1 className="text-md sm:text-lg font-bold tracking-tight text-white font-display flex items-center gap-1.5">
                  Claro 
                  <span className="text-[9px] uppercase font-bold text-amber-500 bg-amber-600/10 px-2 py-0.5 rounded border border-amber-600/20 tracking-widest font-mono">Active Deck</span>
                </h1>
                <p className="text-[10px] text-zinc-500 font-mono">Mesa: <strong className="text-zinc-300 font-bold">{sessionCode || 'Local'}</strong> {userId && `• Mestre: ${userId}`}</p>
              </div>
            </div>

            {/* Exit/Change Mestre account button */}
            <button
              onClick={handleExitToLobby}
              className="p-1 px-2 md:hidden bg-zinc-900 border border-zinc-800 rounded text-zinc-400 text-[10px] font-mono leading-none flex items-center gap-1"
            >
              Lobby
            </button>
          </div>

          {/* Turn control board */}
          <div className="flex items-center gap-3 bg-[#111115] p-2 rounded-xl border border-[#2d2d35] w-full md:w-auto justify-between md:justify-start">
            <div className="px-3 py-1 text-center shrink-0 border-r border-[#2d2d35]">
              <div className="text-[8px] uppercase font-bold text-zinc-500 tracking-wider font-mono">Rodada</div>
              <div className="text-md font-extrabold text-amber-500 font-mono">{round}</div>
            </div>

            <div className="flex items-center gap-1 px-1">
              <button
                onClick={handlePrevTurn}
                disabled={combatants.length === 0 || !hasStarted || isSpectatorMode}
                title="Voltar Turno"
                className="p-2 text-zinc-400 hover:text-amber-500 disabled:text-zinc-800 disabled:bg-transparent rounded-lg transition-all cursor-pointer"
                id="btn-prev-turn"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="min-w-36 text-center px-2">
                {hasStarted && activeCombatant ? (
                  <div className="animate-pulse-subtle">
                    <span className="text-[8px] uppercase font-bold text-amber-500 font-mono flex items-center justify-center gap-1">
                      👑 Turno Ativo
                    </span>
                    <strong className="text-xs text-zinc-100 truncate block max-w-[#150px] mx-auto">
                      {activeCombatant.name}
                    </strong>
                  </div>
                ) : (
                  <div>
                    <span className="text-[8px] uppercase font-bold text-zinc-500 font-mono block">Mesa Preparada</span>
                    <span className="text-xs text-zinc-500 block">Iniciar combate</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleNextTurn}
                disabled={combatants.length === 0 || isSpectatorMode}
                title={hasStarted ? "Avançar Turno" : "Iniciar Rodada"}
                className={`p-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center ${
                  hasStarted
                    ? 'text-amber-500 hover:text-white hover:bg-amber-600/10'
                    : 'bg-amber-600 hover:bg-amber-500 text-black shadow-lg shadow-amber-600/20'
                }`}
                id="btn-next-turn"
              >
                {hasStarted ? <ChevronRight className="w-4 h-4" /> : <Play className="w-3.5 h-3.5 fill-black text-black" />}
              </button>
            </div>
            
            <div className="flex items-center border-l border-[#2d2d35] pl-2 gap-2">
              <button
                onClick={handleResetCombat}
                disabled={combatants.length === 0 || isSpectatorMode}
                title="Reiniciar mesa"
                className="p-2 text-zinc-500 hover:text-amber-500 hover:bg-[#16161a] rounded-lg transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={handleExitToLobby}
                title="Sair para o Portal Principal"
                className="hidden md:flex p-2 text-zinc-600 hover:text-zinc-400 font-mono text-xs items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Grid Deck */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="main-content-grid">
        
        {/* LEFT COLUMN: ACTIVE MONSTER/PC QUEUE (SPAN 8) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          <div className="bg-[#111115] border border-[#2d2d35] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md" id="toolbar">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-450 tracking-wider">Combate da Mesa</span>
              <span className="bg-[#0c0c0e] font-mono text-xs font-bold px-2 py-0.5 rounded text-zinc-400 border border-[#2d2d35]">
                {combatants.length} cadastrados
              </span>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="bg-[#0c0c0e] p-1 rounded-lg border border-[#2d2d35] flex text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    filterType === 'all' ? 'bg-[#2d2d35] text-amber-500' : 'text-zinc-555 hover:text-zinc-350'
                  }`}
                >
                  Ver Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('players')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    filterType === 'players' ? 'bg-[#2d2d35] text-emerald-400' : 'text-zinc-555 hover:text-zinc-350'
                  }`}
                >
                  Jogadores
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('enemies')}
                  className={`px-2.5 py-1 rounded transition-all ${
                    filterType === 'enemies' ? 'bg-[#2d2d35] text-rose-455' : 'text-zinc-555 hover:text-zinc-350'
                  }`}
                >
                  Monstros
                </button>
              </div>

              {!isSpectatorMode && (
                combatants.length === 0 ? (
                  <button
                    onClick={loadDemoEncounter}
                    className="bg-[#0c0c0e] hover:bg-[#16161a] text-amber-500 hover:text-amber-400 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[#2d2d35] transition-all cursor-pointer"
                  >
                    Exemplo d20
                  </button>
                ) : (
                  <button
                    onClick={handleClearAll}
                    className="bg-rose-950/20 hover:bg-rose-955/40 text-rose-455 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-rose-900/40 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Resetar Mesa
                  </button>
                )
              )}
            </div>
          </div>

          <div className="space-y-3 relative" id="initiative-list">
            {combatants.length === 0 ? (
              <div className="bg-[#111115] border border-[#2d2d35] border-dashed rounded-2xl p-12 text-center text-zinc-500 flex flex-col items-center justify-center shadow-inner">
                <div className="w-12 h-12 bg-[#0c0c0e] rounded-full flex items-center justify-center border border-[#2d2d35] mb-4">
                  <Dice5 className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-md font-bold text-zinc-350 font-display mb-1">Mesa Virtual Pronta</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-relaxed mb-6">
                  {isSpectatorMode 
                    ? "O mestre de RPG do jogo ainda não alimentou os combatentes na iniciativa de D&D." 
                    : "Sua mesa de iniciativa de D&D está limpa. Adicione personagens ou monstros ao combate no painel à direita, ou importe do seu catálogo de personagens cadastrados!"}
                </p>
                {!isSpectatorMode && (
                  <div className="flex gap-2.5">
                    <button
                      onClick={loadDemoEncounter}
                      className="bg-[#0f0f12] hover:bg-[#16161a] text-amber-550 border border-zinc-700 text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer font-semibold"
                    >
                      Injetar Combatentes Exemplo
                    </button>
                    <button
                      onClick={() => setActiveTab('char-library')}
                      className="bg-amber-600 hover:bg-amber-500 text-black font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      Ver Catálogo de Personagens
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <AnimatePresence>
                {sortedAndFilteredCombatants.map((c, idx) => {
                  const displayIndexInSorted = combatants.findIndex(item => item.id === c.id);
                  const isActive = hasStarted && displayIndexInSorted === currentTurnIndex;
                  const isDead = c.isDefeated;
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
                      {isActive && (
                        <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-500"></div>
                      )}

                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className={`w-10 h-10 shrink-0 font-mono text-center flex flex-col items-center justify-center rounded-lg border font-bold transition-all ${
                            isActive
                              ? 'bg-amber-500 border-amber-400 text-slate-950 scale-105'
                              : isDead ? 'bg-slate-950 border-slate-905 text-slate-600' : 'bg-slate-950 border-slate-800 text-amber-500'
                          }`}>
                            <span className="text-[8px] font-sans uppercase font-bold text-slate-500 block leading-none">INI</span>
                            <span className="text-md">{c.initiative}</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {c.type === 'player' ? (
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Swords className="w-3.5 h-3.5 text-rose-500" />
                              )}

                              <h4 className={`text-sm font-bold truncate tracking-tight ${
                                isDead ? 'line-through text-slate-500' : 'text-slate-100'
                              }`}>
                                {c.name}
                              </h4>

                              {c.type === 'enemy' && c.groupSize > 1 ? (
                                <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                  isDead
                                    ? 'bg-slate-950 text-slate-500 border-slate-900'
                                    : 'bg-rose-950 text-rose-400 border-rose-900/60'
                                }`}>
                                  {aliveCount <= 0 ? 'Derrotados 💀' : `${aliveCount} vivos / ${totalCountCheck}`}
                                </span>
                              ) : isDead ? (
                                <span className="text-[9px] uppercase font-bold bg-slate-950 text-slate-500 px-1.5 py-0.5 border border-slate-900 rounded">
                                  Inativo ☠️
                                </span>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#a1a1aa] font-mono">
                              <span className="flex items-center gap-1 bg-[#0c0c0e] px-1.5 py-0.5 rounded border border-[#2d2d35]">
                                <Shield className="w-3 h-3 text-amber-500" />
                                <span className="text-zinc-500 font-sans">CA:</span> 
                                <span className="font-bold text-zinc-300">{c.ac}</span>
                              </span>

                              {c.type === 'enemy' && (
                                <>
                                  <span className="flex items-center gap-1 bg-[#0c0c0e] px-1.5 py-0.5 rounded border border-[#2d2d35]">
                                    <Swords className="w-3 h-3 text-rose-550" />
                                    <span className="text-zinc-500 font-sans">Ataque:</span>
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

                        <div className="flex flex-col space-y-1.5 md:w-48 shrink-0">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-zinc-500 flex items-center gap-1">
                              <Heart className={`w-3 h-3 ${isDead ? 'text-zinc-705' : 'text-rose-500 fill-rose-500/10'}`} />
                              PV:
                            </span>
                            <span className="font-bold text-zinc-200">
                              {c.currentHp} <span className="text-zinc-500">/ {c.maxHp}</span>
                            </span>
                          </div>

                          <div className="w-full h-2 bg-[#0c0c0e] rounded-full overflow-hidden border border-[#2d2d35]">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isDead
                                  ? 'bg-zinc-805'
                                  : (c.currentHp / c.maxHp) < 0.3
                                    ? 'bg-rose-505'
                                    : (c.currentHp / c.maxHp) <= 0.7 ? 'bg-amber-550' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${(c.currentHp / c.maxHp) * 100}%` }}
                            ></div>
                          </div>

                          {c.type === 'enemy' && c.groupSize > 1 && (
                            <div className="text-[10px] text-zinc-500 font-mono italic text-right leading-none">
                              Monstro unitário: {c.individualHp} PV
                            </div>
                          )}
                        </div>

                        {!isSpectatorMode ? (
                          <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
                            
                            <div className="flex items-center bg-[#0c0c0e] rounded-lg overflow-hidden border border-[#2d2d35]">
                              <button
                                onClick={() => {
                                  handleModifyHp(c.id, hpInputValues[c.id] || "1", 'damage');
                                }}
                                className="px-2.5 py-1.5 bg-rose-950/30 hover:bg-rose-900 border-r border-[#2d2d35] text-rose-400 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                              >
                                Dano
                              </button>

                              <input
                                type="number"
                                placeholder="..."
                                value={hpInputValues[c.id] || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setHpInputValues(prev => ({ ...prev, [c.id]: val }));
                                }}
                                className="w-10 bg-transparent text-center text-zinc-200 outline-none text-xs font-bold font-mono py-1 placeholder-zinc-700"
                                id={`input-hp-adjust-${c.id}`}
                              />

                              <button
                                onClick={() => {
                                  handleModifyHp(c.id, hpInputValues[c.id] || "1", 'heal');
                                }}
                                className="px-2.5 py-1.5 bg-emerald-950/30 hover:bg-emerald-900 text-emerald-400 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                              >
                                Cura
                              </button>
                            </div>

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
                                className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all ${
                                  isDead
                                    ? 'bg-[#0a0a0c] text-zinc-700 border-zinc-900 cursor-not-allowed'
                                    : attackConfigureId === c.id
                                      ? 'bg-amber-500 text-black border-amber-400'
                                      : 'bg-[#ffc83b]/10 border-[#ffc83b]/30 text-[#ffc83b] hover:bg-[#ffc83b]/20 shadow-sm'
                                }`}
                                id={`btn-attack-roll-${c.id}`}
                              >
                                <Swords className="w-3.5 h-3.5 shrink-0" />
                                Atacar
                              </button>
                            )}

                            <button
                              onClick={() => handleRemoveCombatant(c.id, c.name)}
                              className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-950/10 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : null}

                      </div>

                      {/* Expandable configured attack simulation panel */}
                      {attackConfigureId === c.id && (
                        <div className="border-t border-[#2d2d35]/65 bg-[#0c0c0e] p-4 space-y-3">
                          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Swords className="w-3.5 h-3.5" />
                            Definir Alvo e Quantidade de Atacantes
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="md:col-span-4 flex flex-col space-y-1">
                              <span className="text-[10px] font-bold text-zinc-550 uppercase font-sans">Alvo do Ataque:</span>
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
                                className="w-full bg-[#111115] border border-[#2d2d35] rounded-lg py-1.5 px-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
                              >
                                {combatants.filter(tc => tc.type === 'player' && !tc.isDefeated).map(tc => (
                                  <option key={tc.id} value={tc.id}>
                                    {tc.name} (CA: {tc.ac})
                                  </option>
                                ))}
                                <option value="manual">Manual (Definir CA...)</option>
                              </select>
                            </div>

                            {selectedTargetId === 'manual' && (
                              <div className="md:col-span-2 flex flex-col space-y-1">
                                <span className="text-[10px] font-bold text-zinc-550 uppercase font-sans">CA do Alvo:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="35"
                                  value={customTargetAc}
                                  onChange={(e) => setCustomTargetAc(e.target.value)}
                                  className="w-full bg-[#111115] border border-[#2d2d35] text-zinc-250 rounded-lg py-1.5 px-2 text-center text-xs font-mono"
                                />
                              </div>
                            )}

                            <div className={`${selectedTargetId === 'manual' ? 'md:col-span-3' : 'md:col-span-5'} flex flex-col space-y-1`}>
                              <span className="text-[10px] font-bold text-zinc-550 uppercase font-sans">Qtd de Criaturas Atacando:</span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={aliveCount}
                                  value={attackerCountInput}
                                  onChange={(e) => setAttackerCountInput(Math.min(aliveCount, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                                  className="w-16 bg-[#111115] border border-[#2d2d35] text-zinc-200 rounded-lg py-1.5 px-2 text-center text-xs font-bold outline-none font-mono"
                                />
                                <span className="text-[10px] text-zinc-500 font-mono">/ {aliveCount} vivas</span>
                              </div>
                            </div>

                            <div className="md:col-span-3">
                              <button
                                type="button"
                                onClick={() => handleGroupAttackRollConfigured(c, selectedTargetId, parseInt(customTargetAc, 10), attackerCountInput)}
                                className="w-full bg-amber-600 hover:bg-amber-500 text-black font-extrabold py-2 px-3 rounded-lg text-xs uppercase transition-all flex items-center justify-center gap-1 shadow"
                              >
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

        {/* RIGHT COLUMN: CONTROLS, CREATURE BUILDERS, & LIVE CHANNELS (SPAN 4) */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          
          {/* 1. Shared Session / Transmission Status */}
          <ShareSessionPanel
            isSpectatorMode={isSpectatorMode}
            sessionCode={sessionCode}
            isBroadcasting={isBroadcasting}
            onToggleBroadcasting={(active) => {
              setIsBroadcasting(active);
              addLog(active ? "Transmissão reativada - jogadas estão sendo sincronizadas!" : "Transmissão pausada - jogando em modo offline.", "setup");
            }}
            onStartSharing={async () => {
              // Master manual room regenerations
              handleCreateNewRoom();
              setIsBroadcasting(true);
            }}
            onStopSharing={() => {
              setIsBroadcasting(false);
              addLog("Transmissão desativada pelo mestre.", "info");
            }}
            onExitSpectator={() => {
              window.location.search = '';
            }}
            spectatorError={spectatorError}
          />

          {!isSpectatorMode && (
            <div className="space-y-4">
              {/* Tab Selector to toggle creators */}
              <div className="flex bg-[#0c0c0e] p-1 rounded-xl border border-[#2d2d35]">
                <button
                  onClick={() => setActiveTab('quick-combat')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    activeTab === 'quick-combat' 
                      ? 'bg-[#2d2d35] text-amber-500 shadow border border-zinc-700/60' 
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  Criar Batalha Rápida
                </button>
                <button
                  onClick={() => setActiveTab('char-library')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'char-library' 
                      ? 'bg-[#2d2d35] text-amber-500 shadow border border-zinc-700/60' 
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Banco de Personagens
                </button>
              </div>

              {activeTab === 'quick-combat' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5 font-display">
                      <Plus className="w-4 h-4 text-amber-500" />
                      Adicionar Combatente
                    </h3>
                    <CombatantForm 
                      onAddCombatant={handleAddCombatant} 
                      presets={MONSTER_PRESETS}
                      onLog={(msg, type) => addLog(msg, type === 'info' ? 'info' : 'setup')}
                    />
                  </div>

                  <SavedCombatsPanel
                    userId={userId}
                    currentCombatants={combatants}
                    onLoadCombatants={handleLoadCombatLibrary}
                    onLog={addLog}
                  />
                </div>
              ) : (
                <CharacterConfigurationPanel
                  userId={userId}
                  onSetUserId={(name) => handleVincularMestre(name)}
                  onAddCombatant={handleAddCombatant}
                  onLog={addLog}
                />
              )}
            </div>
          )}

          {/* 2. Attack Simulation Outcomes */}
          <RollResultsPanel 
            currentRoll={currentRoll} 
            onClearRoll={() => setCurrentRoll(null)} 
          />

          {/* 3. Deep Log Streams */}
          <CombatLog 
            logs={logs} 
            onClearLogs={clearLogs} 
          />

        </div>

      </main>

      <footer className="mt-auto border-t border-[#1e1e24] bg-[#111115] py-4 text-center">
        <p className="text-[10px] text-zinc-650 tracking-wider font-mono">
          Claro Initiative System • Firestore Cloud Sync • Sem Cookies ou LocalStorage • 2026
        </p>
      </footer>

    </div>
  );
}

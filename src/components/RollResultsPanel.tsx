import React, { useState, useEffect } from 'react';
import { AttackRollResult } from '../types';
import { Swords, Info, HelpCircle, Flame, ShieldAlert, CheckCircle, Crosshair } from 'lucide-react';

interface RollResultsPanelProps {
  currentRoll: AttackRollResult | null;
  onClearRoll: () => void;
}

export default function RollResultsPanel({ currentRoll, onClearRoll }: RollResultsPanelProps) {
  const [targetAc, setTargetAc] = useState<string>('');

  // Sync targetAc when the active roll is performed
  useEffect(() => {
    if (currentRoll && currentRoll.targetAc !== undefined) {
      setTargetAc(currentRoll.targetAc.toString());
    } else {
      setTargetAc('');
    }
  }, [currentRoll]);

  if (!currentRoll) {
    return (
      <div className="bg-[#111115] border border-[#2d2d35] rounded-xl p-6 shadow-xl flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="bg-[#0c0c0e] p-4 rounded-full border border-[#2d2d35] mb-4 text-zinc-650">
          <Swords className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-350 tracking-wider uppercase mb-1">Painel de Ataques</h3>
        <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
          Selecione um grupo de monstros na iniciativa e clique em <strong className="text-amber-505">"Atacar"</strong> para ver as rolagens e críticos aqui em tempo real.
        </p>
      </div>
    );
  }

  const parsedTargetAc = targetAc !== '' ? parseInt(targetAc, 10) : undefined;
  
  // Calculate analytics
  const rolls = currentRoll.rolls;
  const numRolls = rolls.length;
  const numCrits = rolls.filter(r => r.isCritSuccess).length;
  const numFumbles = rolls.filter(r => r.isCritFailure).length;
  
  // Calculate hits if target AC is entered
  const hitsCount = parsedTargetAc !== undefined
    ? rolls.filter(r => r.isCritSuccess || (!r.isCritFailure && r.total >= (parsedTargetAc || 0))).length
    : null;

  return (
    <div className="bg-[#111115] border border-[#2d2d35] rounded-xl overflow-hidden shadow-xl" id="roll-results-panel">
      {/* Panel title */}
      <div className="bg-[#0c0c0e]/60 border-b border-[#2d2d35] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-600/10 rounded border border-amber-600/20">
            <Swords className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">
              {currentRoll.targetName ? `Ataque contra ${currentRoll.targetName}` : 'Resultado dos Ataques'}
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">
              Origem: <strong className="text-amber-500">{currentRoll.attackerName}</strong>
              {currentRoll.attackerCount && ` (${currentRoll.attackerCount} atacante(s))`}
            </span>
          </div>
        </div>
        <button
          onClick={onClearRoll}
          className="text-xs text-zinc-450 hover:text-amber-500 px-2.5 py-1.5 rounded bg-[#0c0c0e] border border-[#2d2d35] transition-all cursor-pointer"
        >
          Limpar
        </button>
      </div>

      {/* Target AC Filter block */}
      <div className="bg-[#0c0c0e]/30 border-b border-[#2d2d35] p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Crosshair className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            {currentRoll.targetName 
              ? `Defesa do alvo (${currentRoll.targetName}):` 
              : 'Defina a CA do Alvo para calcular acertos automáticamente:'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-semibold text-zinc-500 uppercase font-mono">CA do Alvo:</label>
          <input
            type="number"
            min="1"
            max="35"
            placeholder="Ex: 15"
            value={targetAc}
            onChange={(e) => setTargetAc(e.target.value)}
            className="w-16 bg-[#0c0c0e] border border-[#2d2d35] text-zinc-200 rounded px-2 py-1 text-center font-bold text-xs focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Analytics badges */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0c0c0e] p-2.5 rounded-lg border border-[#2d2d35]/60 text-center">
            <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase mb-0.5">Ataques</div>
            <div className="text-lg font-bold text-zinc-200 font-mono">{numRolls}</div>
          </div>
          <div className="bg-[#0c0c0e] p-2.5 rounded-lg border border-[#2d2d35]/60 text-center">
            <div className="text-[10px] font-bold text-amber-500 tracking-wider uppercase mb-0.5">Críticos (20)</div>
            <div className="text-lg font-bold text-amber-500 font-mono flex items-center justify-center gap-1">
              {numCrits > 0 && <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />}
              {numCrits}
            </div>
          </div>
          
          {parsedTargetAc !== undefined ? (
            <div className="bg-[#0c0c0e] p-2.5 rounded-lg border border-[#2d2d35]/60 text-center">
              <div className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase mb-0.5">Acertos</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {hitsCount} <span className="text-xs text-zinc-550 font-light font-sans">/ {numRolls}</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#0c0c0e] p-2.5 rounded-lg border border-[#2d2d35]/60 text-center">
              <div className="text-[10px] font-bold text-rose-450 tracking-wider uppercase mb-0.5">Falhas (1)</div>
              <div className="text-lg font-bold text-rose-455 font-mono">
                {numFumbles}
              </div>
            </div>
          )}
        </div>

        {/* Detailed rolls list */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {rolls.map((roll, idx) => {
            const hasTarget = parsedTargetAc !== undefined;
            const isHit = roll.isCritSuccess || (!roll.isCritFailure && hasTarget && roll.total >= (parsedTargetAc || 0));
            const isMiss = roll.isCritFailure || (hasTarget && roll.total < (parsedTargetAc || 0));

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg border text-xs font-mono transition-all ${
                  roll.isCritSuccess
                    ? 'bg-amber-950/25 border-amber-500 text-amber-200 font-bold shadow-sm shadow-amber-900/10'
                    : roll.isCritFailure
                      ? 'bg-rose-950/20 border-rose-900 text-rose-300 font-bold'
                      : isHit
                        ? 'bg-emerald-950/15 border-emerald-900/50 text-emerald-300 font-medium'
                        : isMiss
                          ? 'bg-[#0a0a0c]/60 text-zinc-500 border-[#1e1e24]'
                          : 'bg-[#0c0c0e] border-[#2d2d35] text-zinc-300'
                }`}
              >
                {/* Roll Identity Label */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-[11px] font-sans">
                    Criatura {roll.creatureIndex}
                    {roll.attackIndex > 1 ? ` (Atq ${roll.attackIndex})` : ''}:
                  </span>
                  
                  {/* Rolagem formula 14 + 5 = 19 */}
                  <span className="font-semibold text-zinc-300">
                    {roll.dieRoll} {roll.modifier >= 0 ? '+' : ''}{roll.modifier}
                  </span>
                  <span className="text-zinc-550">=</span>
                  <span className={`text-sm font-extrabold ${
                    roll.isCritSuccess ? 'text-amber-500' : roll.isCritFailure ? 'text-rose-500' : 'text-zinc-100'
                  }`}>
                    {roll.total}
                  </span>
                </div>

                {/* Hit / Crit Badges matching exact user requirements */}
                <div className="flex items-center gap-1.5">
                  {roll.isCritSuccess && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      — crítico 💥
                    </span>
                  )}
                  {roll.isCritFailure && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950/35 text-rose-450 border border-rose-900/40 animate-pulse-subtle">
                      — falha crítica ⚠️
                    </span>
                  )}
                  {hasTarget && !roll.isCritSuccess && !roll.isCritFailure && (
                    isHit ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900/40">
                        ➔ acertou
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0c0c0e] text-zinc-550 border border-[#212126]">
                        ➔ errou
                      </span>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions footer info */}
        <div className="text-[10px] text-zinc-500 italic mt-2 bg-[#0c0c0e] p-2.5 border border-[#2d2d35]/60 rounded-lg">
          Nota: O dano de críticos e ataques normais deve ser rolado fisicamente de acordo com as regras de ataque do monstro selecionado. Esse painel resolve apenas a jogada de acerto (d20).
        </div>
      </div>
    </div>
  );
}

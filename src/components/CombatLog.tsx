import React, { useState } from 'react';
import { LogEntry } from '../types';
import { ScrollText, Trash2, Heart, Swords, ChevronRight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface CombatLogProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export default function CombatLog({ logs, onClearLogs }: CombatLogProps) {
  const [filter, setFilter] = useState<'all' | 'damage_heal' | 'rolls' | 'turns'>('all');

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'damage_heal') return log.type === 'damage' || log.type === 'heal';
    if (filter === 'rolls') return log.type === 'roll';
    if (filter === 'turns') return log.type === 'turn';
    return true;
  });

  return (
    <div className="bg-[#111115] border border-[#2d2d35] rounded-xl overflow-hidden shadow-xl" id="combat-log-container">
      {/* Header logs */}
      <div className="bg-[#0c0c0e]/60 border-b border-[#2d2d35] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#0c0c0e] rounded border border-[#2d2d35]">
            <ScrollText className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">Histórico do Combate</h3>
          </div>
        </div>
        
        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            title="Limpar Histórico"
            className="text-zinc-500 hover:text-rose-450 p-1.5 hover:bg-rose-950/20 rounded border border-transparent hover:border-rose-905 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="bg-[#0c0c0e]/35 border-b border-[#2d2d35] px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all shrink-0 cursor-pointer ${
            filter === 'all'
              ? 'bg-[#2d2d35] text-amber-500 border border-[#404048]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('damage_heal')}
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
            filter === 'damage_heal'
              ? 'bg-rose-950/40 text-rose-350 border border-rose-900/40'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Heart className="w-2.5 h-2.5 fill-rose-350/10" />
          HP +/-
        </button>
        <button
          onClick={() => setFilter('rolls')}
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
            filter === 'rolls'
              ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Swords className="w-2.5 h-2.5" />
          Ataques
        </button>
        <button
          onClick={() => setFilter('turns')}
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
            filter === 'turns'
              ? 'bg-[#2d2d35] text-amber-400 border border-[#404048]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ChevronRight className="w-2.5 h-2.5" />
          Turnos
        </button>
      </div>

      <div className="p-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-600 italic">
            Nenhuma atividade registrada ainda neste filtro.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {filteredLogs.map((log) => {
              // Decide colors and icon according to entry type
              let colorClasses = 'text-zinc-400 bg-[#0c0c0e]/40 border-[#2d2d35]/50';
              let iconElement = <ScrollText className="w-3.5 h-3.5 text-zinc-500" />;
              
              if (log.type === 'damage') {
                colorClasses = 'text-rose-300 bg-rose-950/15 border-rose-950/20';
                iconElement = <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10 shrink-0" />;
              } else if (log.type === 'heal') {
                colorClasses = 'text-emerald-300 bg-emerald-950/10 border-emerald-950/20';
                iconElement = <Heart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
              } else if (log.type === 'turn') {
                colorClasses = 'text-[#e5c158] bg-amber-950/10 border-[#2d2d35] border-l-2 border-l-amber-500 rounded-l-none';
                iconElement = <ChevronRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
              } else if (log.type === 'roll') {
                colorClasses = 'text-amber-200 bg-amber-950/15 border-amber-950/25';
                iconElement = <Swords className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
              } else if (log.type === 'setup') {
                colorClasses = 'text-zinc-300 bg-[#0c0c0e] border-[#2d2d35]';
                iconElement = <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
              }

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-2.5 p-2.5 border rounded-lg text-xs leading-relaxed transition-all ${colorClasses}`}
                >
                  <div className="mt-0.5 shrink-0 transition-transform">
                    {iconElement}
                  </div>
                  
                  <div className="flex-1">
                    <span className="text-zinc-500 font-mono text-[10px] mr-1.5 font-light">
                      [{log.timestamp}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

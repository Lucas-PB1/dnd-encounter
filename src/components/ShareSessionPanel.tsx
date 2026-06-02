import React, { useState } from 'react';
import { Share2, Globe, Wifi, WifiOff, Copy, Eye, LogOut, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';

interface ShareSessionPanelProps {
  isSpectatorMode: boolean;
  sessionCode: string;
  isBroadcasting: boolean;
  onToggleBroadcasting: (val: boolean) => void;
  onStartSharing: () => Promise<void>;
  onStopSharing: () => void;
  onExitSpectator: () => void;
  spectatorError?: string;
}

export default function ShareSessionPanel({
  isSpectatorMode,
  sessionCode,
  isBroadcasting,
  onToggleBroadcasting,
  onStartSharing,
  onStopSharing,
  onExitSpectator,
  spectatorError
}: ShareSessionPanelProps) {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Generate safe spectator URL to copy
  const spectatorUrl = `${window.location.origin}${window.location.pathname}?session=${sessionCode}`;

  const handleCopyLink = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(spectatorUrl);
      } else {
        // Safe fallback for custom embeds / iframe restrictions
        const textArea = document.createElement("textarea");
        textArea.value = spectatorUrl;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar link:", err);
    }
  };

  const handleStartLoading = async () => {
    setIsLoading(true);
    try {
      await onStartSharing();
    } finally {
      setIsLoading(false);
    }
  };

  // 1. SPECTATOR MODE VIEW
  if (isSpectatorMode) {
    return (
      <div className="bg-[#111115] border border-amber-600/30 rounded-xl overflow-hidden shadow-xl" id="share-session-panel">
        <div className="bg-amber-600/10 border-b border-amber-600/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <div>
              <h3 className="text-xs font-bold text-amber-500 tracking-wider uppercase font-display">
                Modo Espectador
              </h3>
              <p className="text-[9px] text-[#8e8e93] font-mono">Código da Sessão: {sessionCode || '...'}</p>
            </div>
          </div>
          <div className="p-1.5 bg-[#0c0c0e] border border-amber-600/20 text-amber-500 rounded text-xs font-mono font-bold uppercase tracking-wider">
            {sessionCode}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {spectatorError ? (
            <div className="p-3 bg-rose-950/20 border border-rose-900/35 rounded-lg text-xs flex gap-2 text-rose-450 leading-normal" id="spectator-error">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-400">Falha de Conexão</p>
                <p className="text-[10px] mt-0.5">{spectatorError}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#0c0c0e] border border-[#2d2d35]/65 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Sincronia Ativa (Atualizando)
              </div>
              <p className="text-[11px] text-zinc-500 leading-normal font-sans">
                Acompanhando o combate ao vivo! Todas as iniciativas, PV dos combatentes, Classe de Armadura e rolagens críticas são atualizadas em tempo real à medida que o mestre executa as rodadas.
              </p>
            </div>
          )}

          <div className="border-t border-[#2d2d35]/60 pt-3 flex gap-2">
            <button
              onClick={onExitSpectator}
              className="w-full bg-[#1c1c24] hover:bg-zinc-800 text-zinc-300 font-semibold py-2 px-3 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-[#2d2d35]"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair e Criar meu Combate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. DM (MESTRE) MODE VIEW
  return (
    <div className="bg-[#111115] border border-[#2d2d35] rounded-xl overflow-hidden shadow-xl" id="share-session-panel">
      <div className="bg-[#0c0c0e]/60 border-b border-[#2d2d35] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-600/10 rounded border border-amber-600/20">
            <Share2 className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">Sessão Online e Compartilhamento</h3>
            <span className="text-[10px] text-zinc-500 font-mono">Transmita o combate em tempo real</span>
          </div>
        </div>

        {sessionCode && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!sessionCode ? (
          // Inactive session: Show start button
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
              Quer que seus jogadores acompanhem a ordem de iniciativa, vida e jogadas sem precisar de streaming ou compartilhar sua tela? Ative a transmissão e envie o link imediato.
            </p>
            <button
              onClick={handleStartLoading}
              disabled={isLoading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-[#1c1c24] disabled:text-zinc-500 font-bold py-2.5 px-4 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-amber-500/10 transition-all cursor-pointer active:scale-95 disabled:pointer-events-none"
            >
              <Globe className="w-4 h-4 text-black" />
              {isLoading ? 'Ativando Transmissão...' : 'Iniciar Transmissão ao Vivo'}
            </button>
          </div>
        ) : (
          // Active session: Show session actions and links
          <div className="space-y-3.5">
            {isBroadcasting ? (
              <div className="p-3 bg-[#0c0c0e] border border-emerald-900/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 animate-pulse" />
                    Transmissão Ativa
                  </span>
                  <span className="text-[10px] bg-emerald-950/40 text-emerald-400 font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-900/30">
                    Código: {sessionCode}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-550 leading-relaxed">
                  Qualquer modificação que você realizar nos turnos, vida ou rolagens será transmitida automaticamente para seus espectadores em tempo real.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[#0c0c0e] border border-yellow-904/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide flex items-center gap-1">
                    <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
                    Transmissão Desativada / Modo Local
                  </span>
                  <span className="text-[10px] bg-yellow-950/30 text-yellow-500 font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-904/20">
                    Código: {sessionCode}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
                  Sua sessão está rodando no modo local. Nenhuma modificação será enviada aos espectadores até que você reative a transmissão.
                </p>
              </div>
            )}

            {/* Readonly copy URL widget */}
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Link para os Jogadores</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={spectatorUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-[#0c0c0e] border border-[#2d2d35]/80 rounded-lg py-1.5 px-3 text-[10px] text-zinc-400 outline-none select-all font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    copied
                      ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-[#404048]'
                  }`}
                  title="Copiar Link para Área de Transferência"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="border-t border-[#2d2d35]/65 pt-3">
              {isBroadcasting ? (
                <button
                  type="button"
                  onClick={() => onToggleBroadcasting(false)}
                  className="w-full bg-rose-950/15 hover:bg-rose-950/30 text-rose-450 hover:text-rose-400 font-semibold py-2 px-3 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-rose-900/40"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  Desativar Transmissão
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleBroadcasting(true)}
                  className="w-full bg-emerald-950/15 hover:bg-emerald-950/30 text-emerald-400 font-semibold py-2 px-3 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-900/40"
                >
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  Ativar Transmissão Online
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

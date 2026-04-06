import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { RefreshCcw, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ThemeName } from "../hooks/useAppConfig";
import type { CharacterName, ProviderStatus } from "../types/agent";

interface HeaderSelectorsProps {
  activeProviderName: string;
  providers: ProviderStatus[];
  onProviderChange: (providerName: string) => void;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  setIsSelectOpen: Dispatch<SetStateAction<boolean>>;
}

interface SessionPanelProps {
  characterName: CharacterName;
  activeProviderName: string;
  providers: ProviderStatus[];
  setActiveProviderName: (providerName: string) => void;
  setIsSelectOpen: Dispatch<SetStateAction<boolean>>;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  sessionOutput: string[];
  setSessionOutput: Dispatch<SetStateAction<string[]>>;
  isSessionActive: boolean;
  startSession: (binaryPath: string) => Promise<void>;
  handleInstall: (binary: string, name: string) => Promise<void>;
  inputText: string;
  setInputText: Dispatch<SetStateAction<string>>;
  sendMessage: () => Promise<void>;
}

function HeaderSelectors({
  activeProviderName,
  providers,
  onProviderChange,
  theme,
  onThemeChange,
  setIsSelectOpen,
}: HeaderSelectorsProps) {
  const selectedProvider = activeProviderName || (providers.length > 0 ? providers[0].name : "");

  return (
    <div className="popover-header-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Select value={selectedProvider} onValueChange={onProviderChange} onOpenChange={setIsSelectOpen}>
        <SelectTrigger className="w-[140px] h-7 text-xs bg-transparent border-none shadow-none focus:ring-0 px-0 hover:bg-black/5 rounded">
          <SelectValue placeholder="Select Provider" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p.name} value={p.name}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={theme} onValueChange={onThemeChange} onOpenChange={setIsSelectOpen}>
        <SelectTrigger className="w-[110px] h-7 text-xs bg-transparent border-none shadow-none focus:ring-0 px-0 hover:bg-black/5 rounded">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="midnight">Midnight</SelectItem>
          <SelectItem value="peach">Peach</SelectItem>
          <SelectItem value="cloud">Cloud</SelectItem>
          <SelectItem value="moss">Moss</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function SessionPanel({
  characterName,
  activeProviderName,
  providers,
  setActiveProviderName,
  setIsSelectOpen,
  theme,
  onThemeChange,
  sessionOutput,
  setSessionOutput,
  isSessionActive,
  startSession,
  handleInstall,
  inputText,
  setInputText,
  sendMessage,
}: SessionPanelProps) {
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputEndRef.current) outputEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [sessionOutput, isSessionActive]);

  return (
    <div className={`popover-panel popover-panel-${characterName}`}>
      <div className="popover-header">
        <HeaderSelectors
          activeProviderName={activeProviderName}
          providers={providers}
          onProviderChange={setActiveProviderName}
          theme={theme}
          onThemeChange={onThemeChange}
          setIsSelectOpen={setIsSelectOpen}
        />
        <div className="popover-actions">
          <button
            className="icon-btn"
            onClick={() => {
              const p = providers.find((provider) => provider.name === activeProviderName);
              if (p && p.is_installed && p.path) startSession(p.path);
            }}
            title="Restart Session"
          >
            <RefreshCcw size={14} />
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              const lastOut = [...sessionOutput].reverse().find((line) => line.startsWith("[Out]: "));
              if (lastOut) {
                const textToCopy = lastOut.replace("[Out]: ", "").trim();
                navigator.clipboard.writeText(textToCopy);
                setSessionOutput((prev) => [...prev, "[System]: Copied last response to clipboard."]);
              } else {
                setSessionOutput((prev) => [...prev, "[System]: No response to copy."]);
              }
            }}
            title="Copy Last Response"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      <div className="terminal-output">
        {(() => {
          const currentP = providers.find((p) => p.name === activeProviderName);
          if (!currentP) return <div>No provider selected.</div>;
          if (!currentP.is_installed) {
            return (
              <div style={{ textAlign: "center", marginTop: "40px" }}>
                <div style={{ marginBottom: 10, opacity: 0.7 }}>{currentP.name} is not installed.</div>
                <button
                  onClick={() => handleInstall(currentP.binary, currentP.name)}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(0,0,0,0.1)",
                    border: "1px solid rgba(0,0,0,0.2)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Install {currentP.name}
                </button>
              </div>
            );
          }
          if (!isSessionActive) {
            return (
              <div style={{ textAlign: "center", marginTop: "40px" }}>
                <button
                  onClick={() => startSession(currentP.path!)}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(0,0,0,0.1)",
                    border: "1px solid rgba(0,0,0,0.2)",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Start Session with {currentP.name}
                </button>
              </div>
            );
          }
          return (
            <>
              {sessionOutput.length === 0
                ? "Terminal output will appear here..."
                : sessionOutput.map((line, i) => <div key={i}>{line}</div>)}
              <div ref={outputEndRef} />
            </>
          );
        })()}
      </div>

      {isSessionActive && (
        <div className="chat-input-container">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Ask ${activeProviderName}...`}
          />
        </div>
      )}
    </div>
  );
}

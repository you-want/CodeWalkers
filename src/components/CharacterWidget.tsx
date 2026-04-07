import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAgentSession } from "../hooks/useAgentSession";
import { useCharacterMovement } from "../hooks/useCharacterMovement";
import type { ThemeName } from "../hooks/useAppConfig";
import { SessionPanel } from "./SessionPanel";
import type { CharacterName, CharacterSize } from "../types/agent";

interface CharacterWidgetProps {
  characterName: CharacterName;
  size: CharacterSize;
  initialX: number;
  setIsSelectOpen: Dispatch<SetStateAction<boolean>>;
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
  isSoundsEnabled: boolean;
}

export function CharacterWidget({
  characterName,
  size,
  initialX,
  setIsSelectOpen,
  theme,
  onThemeChange,
  isSoundsEnabled
}: CharacterWidgetProps) {
  const {
    bubbleText,
    providers,
    inputText,
    setInputText,
    sessionOutput,
    setSessionOutput,
    isSessionActive,
    startSession,
    handleInstall,
    sendMessage,
  } = useAgentSession(characterName, isSoundsEnabled);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeProviderName, setActiveProviderName] = useState<string>("");
  const {
    position,
    isDragging,
    hasMoved,
    videoRef,
    directionRef,
    widgetRef,
    handleMouseDown,
    getSizeScale,
  } = useCharacterMovement({
    characterName,
    size,
    initialX,
    isPopoverOpen,
  });

  const [mediaError, setMediaError] = useState(false);

  useEffect(() => {
    if (!activeProviderName && providers.length > 0) {
      const firstInstalled = providers.find((p) => p.is_installed);
      setActiveProviderName(firstInstalled ? firstInstalled.name : providers[0].name);
    }
  }, [providers, activeProviderName]);

  useEffect(() => {
    if (isPopoverOpen) {
      import("@tauri-apps/api/event").then(({ emit }) => {
        emit("refresh_providers");
      });
    }
  }, [isPopoverOpen]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // 避免点击事件发生在小人身上时，被全局的点击处理器给误关了
      // 小人身上的点击由其自身的 onClick 事件来处理开关
      const target = e.target as HTMLElement;
      
      // 如果点击的是当前小人本身，不在这里处理关闭，让 onClick 处理切换
      if (target.closest(`.agent-character-${characterName}`)) {
        return;
      }
      
      const isInsideWidget = target.closest(`.popover-panel-${characterName}`) || 
                             target.closest('[data-radix-popper-content-wrapper]') ||
                             target.closest('[role="listbox"]') ||
                             target.closest('[data-radix-select-content]') ||
                             target.closest('.chat-input-container') ||
                             target.closest('div[role="dialog"]');

      if (!isInsideWidget) {
          setIsPopoverOpen(false);
          // We do not set isSessionActive(false) so the session remains alive in the background
        }
      };

    if (isPopoverOpen || isSessionActive) {
      document.addEventListener('mousedown', handleGlobalClick);
      
      const unlistenFocus = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          setIsPopoverOpen(false);
        }
      });
      
      return () => {
        document.removeEventListener('mousedown', handleGlobalClick);
        unlistenFocus.then(f => f());
      };
    }
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [isPopoverOpen, isSessionActive, characterName]);

  return (
    <div 
      ref={widgetRef}
      className="floating-widget"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: 'none',
        position: 'absolute',
        zIndex: isPopoverOpen ? 100 : 10,
      }}
    >
      <div 
          className={`agent-character agent-character-${characterName} ${isDragging ? 'agent-dragging' : ''}`} 
          onMouseUp={() => {
            // 只有当鼠标没有发生实际拖动时，才算作“点击”，切换弹窗状态
            if (!hasMoved) {
              setIsPopoverOpen(prev => !prev);
            }
          }}
          onMouseDown={handleMouseDown}
          style={{
            width: 150 * getSizeScale(),
            height: 150 * getSizeScale(),
            transform: `scaleX(${directionRef.current === -1 ? -1 : 1}) ${isDragging ? 'rotate(5deg) scale(1.05)' : ''}`,
            transformOrigin: 'bottom center',
          }}
        >
        {!mediaError ? (
          <img 
            src={`/walk-${characterName}-01.png`}
            onError={() => setMediaError(true)}
            className={`agent-video ${hasMoved || isDragging ? 'walking-animation' : ''}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            draggable={false}
            alt={characterName}
          />
        ) : (
          <video 
            ref={videoRef}
            src={`/walk-${characterName}-01.mov`}
            autoPlay 
            loop 
            muted 
            playsInline 
            className="agent-video"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            draggable={false}
          />
        )}
      </div>
      {bubbleText && (
        <div className="bubble">
          {bubbleText}
        </div>
      )}

      <div style={{ display: isPopoverOpen ? 'block' : 'none' }}>
        <SessionPanel
          characterName={characterName}
          activeProviderName={activeProviderName}
          providers={providers}
          setActiveProviderName={setActiveProviderName}
          setIsSelectOpen={setIsSelectOpen}
          theme={theme}
          onThemeChange={onThemeChange}
          sessionOutput={sessionOutput}
          setSessionOutput={setSessionOutput}
          isSessionActive={isSessionActive}
          startSession={startSession}
          handleInstall={handleInstall}
          inputText={inputText}
          setInputText={setInputText}
          sendMessage={sendMessage}
          isPopoverOpen={isPopoverOpen}
        />
      </div>
    </div>
  );
}
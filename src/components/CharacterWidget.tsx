import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAgentSession } from "../hooks/useAgentSession";
import { useCharacterMovement } from "../hooks/useCharacterMovement";
import type { ThemeName } from "../hooks/useAppConfig";
import { SessionPanel } from "./SessionPanel";
import { CharacterBubble } from "./CharacterBubble";
import { StatusSettingsModal } from "./StatusSettingsModal";
import { useStatusSettingsStore } from "../store/useStatusSettingsStore";
import { useUserStatus } from "../hooks/useUserStatus";
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
  const { config, saveConfig, activeStatusId, setActiveStatusId, statusMessage: hookStatusMessage } = useUserStatus(characterName);
  
  // Use hook's statusMessage
  const finalStatusMessage = hookStatusMessage;
  
  const [contextMenuVisible, setContextMenuVisible] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuVisible(true);
  };

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
      // To avoid global click handlers from closing the popover when clicking the character,
      // the character's own onClick event handles toggling.
      const target = e.target as HTMLElement;
      
      // If clicking the current character itself, do not close here.
      if (target.closest(`.agent-character-${characterName}`)) {
        return;
      }
      
      const isInsideWidget = target.closest(`.popover-panel-${characterName}`) || 
                             target.closest('[data-radix-popper-content-wrapper]') ||
                             target.closest('[role="listbox"]') ||
                             target.closest('[data-radix-select-content]') ||
                             target.closest('.chat-input-container') ||
                             target.closest('.context-menu') ||
                             target.closest('.settings-modal') ||
                             target.closest('div[role="dialog"]');

      if (!isInsideWidget) {
          setIsPopoverOpen(false);
          setContextMenuVisible(false);
          // We do not set isSessionActive(false) so the session remains alive in the background
        }
      };

    if (isPopoverOpen || isSessionActive || contextMenuVisible) {
      document.addEventListener('mousedown', handleGlobalClick);
      
      const unlistenFocus = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          setIsPopoverOpen(false);
          setContextMenuVisible(false);
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
  }, [isPopoverOpen, isSessionActive, characterName, contextMenuVisible]);

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
          onContextMenu={handleContextMenu}
          onMouseUp={(e) => {
            // Only toggle popover on left click (button 0) and if no drag occurred
            if (e.button === 0 && !hasMoved) {
              setIsPopoverOpen(prev => !prev);
              setContextMenuVisible(false);
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
      <CharacterBubble text={bubbleText || finalStatusMessage} />

      {contextMenuVisible && (
        <div 
          className="context-menu"
          style={{
            position: 'absolute',
            left: 'calc(100% - 5px)',
            top: '0px',
            backgroundColor: 'var(--popover-bg, #1a1a1a)',
            border: '1px solid var(--border-color, #333)',
            borderRadius: '8px',
            padding: '4px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '120px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            color: 'var(--text-color, #fff)',
            fontSize: '12px'
          }}
        >
          <div className="context-menu-title" style={{ padding: '4px 8px', opacity: 0.5, fontSize: '10px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            User Status
          </div>
          {config.map((item: import('../types/userStatus').StatusItemConfig) => {
            const isActive = activeStatusId === item.id;
            return (
              <button
                key={item.id}
                style={{
                  background: isActive ? 'var(--hover-bg, rgba(255,255,255,0.15))' : 'transparent',
                  border: 'none',
                  color: isActive ? '#fff' : 'inherit',
                  fontWeight: isActive ? 600 : 400,
                  padding: '6px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => { 
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.1))'; 
                }}
                onMouseLeave={(e) => { 
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; 
                }}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  setActiveStatusId(item.id);
                  setContextMenuVisible(false);
                }}
              >
                <span>{item.icon} {item.label}</span>
                {isActive && (
                  <span style={{ fontSize: '10px', marginLeft: '8px' }}>✓</span>
                )}
              </button>
            );
          })}
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              padding: '6px 8px',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.1))'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            onMouseUp={(e) => {
              e.stopPropagation();
              setActiveStatusId(null);
              setContextMenuVisible(false);
            }}
          >
            <span>Clear Status</span>
            {activeStatusId === null && (
              <span style={{ fontSize: '10px', marginLeft: '8px' }}>✓</span>
            )}
          </button>
          <div style={{ height: '1px', backgroundColor: '#333', margin: '4px 0' }} />
          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              padding: '6px 8px',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--hover-bg, rgba(255,255,255,0.1))'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#999'; }}
            onMouseUp={(e) => {
              e.stopPropagation();
              setContextMenuVisible(false);
              useStatusSettingsStore.getState().open(config, saveConfig, characterName);
            }}
          >
            <span>⚙️ Settings...</span>
          </button>
        </div>
      )}

      <StatusSettingsModal characterName={characterName} />

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
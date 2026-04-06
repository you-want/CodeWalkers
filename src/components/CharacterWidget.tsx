import { useState, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCcw, Copy } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useAgentSession } from "../hooks/useAgentSession";

export interface ProviderStatus {
  name: string;
  binary: string;
  is_installed: boolean;
  path: string | null;
}

export function CharacterWidget({
  characterName,
  size,
  initialX,
  setIsSelectOpen,
  isSoundsEnabled
}: any) {
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

  const [position, setPosition] = useState({ x: initialX, y: window.innerHeight / 2 - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [activeProviderName, setActiveProviderName] = useState<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!activeProviderName && providers.length > 0) {
      const firstInstalled = providers.find((p: ProviderStatus) => p.is_installed);
      setActiveProviderName(firstInstalled ? firstInstalled.name : providers[0].name);
    }
  }, [providers, activeProviderName]);

  const targetXRef = useRef<number | null>(null);
  const isWalkingRef = useRef(false);
  const directionRef = useRef(1);
  const startPosRef = useRef({ x: 0, y: 0 });
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sessionOutput, isPopoverOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    
    // Stop character movement immediately
    if (isWalkingRef.current) {
      isWalkingRef.current = false;
      targetXRef.current = null;
      if (videoRef.current) videoRef.current.pause();
    }
    
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          setHasMoved(true);
        }
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMoveGlobal);
      window.addEventListener('mouseup', handleMouseUpGlobal);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, [isDragging, dragOffset]);

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

  // Constants for walking animation from lil-agents
  const videoDuration = 10.0;
  const accelStart = characterName === 'bruce' ? 3.0 : 3.9;
  const fullSpeedStart = characterName === 'bruce' ? 3.75 : 4.5;
  const decelStart = 8.0;
  const walkStop = characterName === 'bruce' ? 8.5 : 8.75;
  const walkAmountRange = characterName === 'bruce' ? [0.4, 0.65] : [0.35, 0.6];

  const movementPosition = (videoTime: number) => {
    const dIn = fullSpeedStart - accelStart;
    const dLin = decelStart - fullSpeedStart;
    const dOut = walkStop - decelStart;
    const v = 1.0 / (dIn / 2.0 + dLin + dOut / 2.0);

    if (videoTime <= accelStart) {
      return 0.0;
    } else if (videoTime <= fullSpeedStart) {
      const t = videoTime - accelStart;
      return v * t * t / (2.0 * dIn);
    } else if (videoTime <= decelStart) {
      const easeInDist = v * dIn / 2.0;
      const t = videoTime - fullSpeedStart;
      return easeInDist + v * t;
    } else if (videoTime <= walkStop) {
      const easeInDist = v * dIn / 2.0;
      const linearDist = v * dLin;
      const t = videoTime - decelStart;
      return easeInDist + linearDist + v * (t - t * t / (2.0 * dOut));
    } else {
      return 1.0;
    }
  };

  const walkStateRef = useRef({
    isWalking: false,
    isPaused: true,
    pauseEndTime: Date.now() + Math.random() * 7000 + 5000, // 5-12s
    walkStartTime: 0,
    walkStartPixel: 0,
    walkEndPixel: 0,
    goingRight: true
  });

  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    
    const update = () => {
      const now = Date.now();
      const state = walkStateRef.current;

      // Skip roaming if dragging, popover is open
      if (isDragging || isPopoverOpen) {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        animationFrameId = requestAnimationFrame(update);
        return;
      }

      if (state.isPaused) {
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        if (now >= state.pauseEndTime) {
          // Start walk
          state.isPaused = false;
          state.isWalking = true;
          state.walkStartTime = now;
          
          // Determine direction
          const currentX = position.x;
          const screenWidth = window.innerWidth;
          if (currentX > screenWidth * 0.85) {
            state.goingRight = false;
          } else if (currentX < screenWidth * 0.15) {
            state.goingRight = true;
          } else {
            state.goingRight = Math.random() > 0.5;
          }
          
          directionRef.current = state.goingRight ? 1 : -1;
          
          // Calculate distance
          const walkPixels = (Math.random() * (walkAmountRange[1] - walkAmountRange[0]) + walkAmountRange[0]) * 500.0;
          state.walkStartPixel = currentX;
          state.walkEndPixel = state.goingRight 
            ? Math.min(currentX + walkPixels, screenWidth - 150)
            : Math.max(currentX - walkPixels, 0);

          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
          }
        }
      }

      if (state.isWalking) {
        const elapsed = (now - state.walkStartTime) / 1000.0; // seconds
        const videoTime = Math.min(elapsed, videoDuration);
        
        const walkNorm = elapsed >= videoDuration ? 1.0 : movementPosition(videoTime);
        const currentPixel = state.walkStartPixel + (state.walkEndPixel - state.walkStartPixel) * walkNorm;
        
        // Update position directly to avoid React state overhead
        if (widgetRef.current) {
          widgetRef.current.style.transform = `translate(${currentPixel}px, ${position.y}px)`;
        }
        
        if (elapsed >= videoDuration) {
          // End walk
          state.isWalking = false;
          state.isPaused = true;
          state.pauseEndTime = now + Math.random() * 7000 + 5000; // 5-12s
          setPosition(prev => ({ ...prev, x: currentPixel })); // Sync React state
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
        }
      }

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isDragging, isPopoverOpen, position.x, position.y]);

  const getSizeScale = () => {
    switch(size) {
      case "small": return 0.7;
      case "large": return 1.5;
      case "medium":
      default: return 1;
    }
  };

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
          onMouseUp={(e) => {
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
        <video 
          ref={videoRef}
          src={`/walk-${characterName}-01.mov`}
          autoPlay 
          loop 
          muted 
          playsInline 
          className="agent-video"
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />
      </div>
      {bubbleText && (
        <div className="bubble">
          {bubbleText}
        </div>
      )}

      {isPopoverOpen && (
        <div className={`popover-panel popover-panel-${characterName}`}>
          <div className="popover-header">
            <div className="popover-header-title">
              <Select 
                value={activeProviderName || (providers.length > 0 ? providers[0].name : "")} 
                onValueChange={(val) => setActiveProviderName(val)}
                onOpenChange={setIsSelectOpen}
              >
                <SelectTrigger className="w-[140px] h-7 text-xs bg-transparent border-none shadow-none focus:ring-0 px-0 hover:bg-black/5 rounded">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p: ProviderStatus) => (
                    <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="popover-actions">
              <button className="icon-btn" onClick={() => {
                const p = providers.find((p: ProviderStatus) => p.name === activeProviderName);
                if (p && p.is_installed && p.path) startSession(p.path);
              }} title="Restart Session">
                <RefreshCcw size={14}/>
              </button>
              <button className="icon-btn" onClick={() => {
                const lastOut = [...sessionOutput].reverse().find((line: string) => line.startsWith("[Out]: "));
                if (lastOut) {
                  const textToCopy = lastOut.replace("[Out]: ", "").trim();
                  navigator.clipboard.writeText(textToCopy);
                  setSessionOutput((prev: string[]) => [...prev, `[System]: Copied last response to clipboard.`]);
                } else {
                  setSessionOutput((prev: string[]) => [...prev, `[System]: No response to copy.`]);
                }
              }} title="Copy Last Response">
                <Copy size={14}/>
              </button>
            </div>
          </div>
          
          <div className="terminal-output">
            {(() => {
              const currentP = providers.find((p: ProviderStatus) => p.name === activeProviderName);
              if (!currentP) return <div>No provider selected.</div>;
              if (!currentP.is_installed) {
                return (
                  <div style={{ textAlign: 'center', marginTop: '40px' }}>
                    <div style={{ marginBottom: 10, opacity: 0.7 }}>{currentP.name} is not installed.</div>
                    <button 
                      onClick={() => handleInstall(currentP.binary, currentP.name)}
                      style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >
                      Install {currentP.name}
                    </button>
                  </div>
                );
              }
              if (!isSessionActive) {
                return (
                  <div style={{ textAlign: 'center', marginTop: '40px' }}>
                    <button 
                      onClick={() => startSession(currentP.path!)}
                      style={{ padding: '6px 12px', background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >
                      Start Session with {currentP.name}
                    </button>
                  </div>
                );
              }
              return (
                <>
                  {sessionOutput.length === 0 ? "Terminal output will appear here..." : sessionOutput.map((line: string, i: number) => (
                    <div key={i}>{line}</div>
                  ))}
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
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={`Ask ${activeProviderName}...`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
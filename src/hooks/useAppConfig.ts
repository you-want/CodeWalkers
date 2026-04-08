import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ThemeName = "midnight" | "peach" | "cloud" | "moss";

export function useAppConfig() {
  const [showEthan, setShowEthan] = useState(true);
  const [showLuna, setShowLuna] = useState(true);
  const [theme, setTheme] = useState<ThemeName>("midnight");
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const [isSoundsEnabled, setIsSoundsEnabled] = useState(true);
  const isSoundsEnabledRef = useRef(isSoundsEnabled);

  useEffect(() => {
    isSoundsEnabledRef.current = isSoundsEnabled;
  }, [isSoundsEnabled]);

  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const lastIgnoreState = useRef<boolean | null>(null);
  const isCheckingMouseRef = useRef(false);
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const checkMouse = async () => {
      if (isSelectOpen) return;
      if (isCheckingMouseRef.current) return;
      isCheckingMouseRef.current = true;

      try {
        const isDevToolsOpen = await invoke<boolean>("is_devtools_open").catch(() => false);
        
        const [x, y] = await invoke<[number, number]>("get_mouse_pos");
        
        const target = document.elementFromPoint(x, y) as HTMLElement | null;
        
        let shouldIgnore = true;

        if (isDevToolsOpen) {
          shouldIgnore = false;
        } else if (!target) {
          shouldIgnore = true;
        } else {
          if (target.closest('.agent-character')) {
            const charEl = target.closest('.agent-character') as HTMLElement;
            const media = charEl.querySelector('video') || charEl.querySelector('img');
            if (media) {
              const rect = media.getBoundingClientRect();
              const mediaX = x - rect.left;
              const mediaY = y - rect.top;

              if (rect.width > 0 && rect.height > 0) {
                if (!pixelCanvasRef.current) {
                  pixelCanvasRef.current = document.createElement('canvas');
                  pixelCanvasRef.current.width = 1;
                  pixelCanvasRef.current.height = 1;
                  pixelCtxRef.current = pixelCanvasRef.current.getContext('2d', { willReadFrequently: true });
                }

                const ctx = pixelCtxRef.current;
                if (ctx) {
                  const isVideo = media.tagName.toLowerCase() === 'video';
                  const naturalWidth = isVideo ? (media as HTMLVideoElement).videoWidth : (media as HTMLImageElement).naturalWidth;
                  const naturalHeight = isVideo ? (media as HTMLVideoElement).videoHeight : (media as HTMLImageElement).naturalHeight;
                  
                  if (naturalWidth > 0 && naturalHeight > 0) {
                    const scaleX = naturalWidth / rect.width;
                    const scaleY = naturalHeight / rect.height;
                    
                    ctx.clearRect(0, 0, 1, 1);
                    ctx.drawImage(
                      media, 
                      mediaX * scaleX, mediaY * scaleY, 1, 1,
                      0, 0, 1, 1
                    );
                    
                    const pixel = ctx.getImageData(0, 0, 1, 1).data;
                    const alpha = pixel[3];
                    
                    if (alpha > 10) {
                      shouldIgnore = false;
                    }
                  }
                }
              }
            }
          }

          const isInteractive = target.closest('.bubble') || 
                                target.closest('.popover-panel') || 
                                target.closest('.context-menu') ||
                                target.closest('.settings-modal') ||
                                target.closest('[data-radix-popper-content-wrapper]') ||
                                target.closest('[role="listbox"]') ||
                                target.closest('[data-radix-select-content]') ||
                                target.closest('.radix-select-content') ||
                                target.closest('div[role="dialog"]');
          
          if (isInteractive) {
            shouldIgnore = false;
          }

          const computedStyle = window.getComputedStyle(target);
          if (computedStyle.zIndex !== 'auto' && parseInt(computedStyle.zIndex) > 1000) {
            shouldIgnore = false;
          }
        }

        const debugInfo = document.getElementById('debug-info-overlay');
        if (debugInfo) {
          debugInfo.remove();
        }

        if (lastIgnoreState.current !== shouldIgnore) {
          await invoke("set_ignore_cursor_events", { ignore: shouldIgnore });
          lastIgnoreState.current = shouldIgnore;
        }
      } catch (e) {
        console.error("checkMouse error:", e);
      } finally {
        isCheckingMouseRef.current = false;
      }
    };

    if (isSelectOpen) {
      if (lastIgnoreState.current !== false) {
        invoke("set_ignore_cursor_events", { ignore: false }).catch(console.error);
        lastIgnoreState.current = false;
      }
    }

    const interval = setInterval(checkMouse, 100);

    return () => {
      clearInterval(interval);
    };
  }, [isSelectOpen]);

  useEffect(() => {
    const unlistenTray = listen<string>("tray_event", (event) => {
      const id = event.payload;
      console.log("Tray event received in React:", id);
      
      if (id === "char_ethan") setShowEthan(prev => !prev);
      if (id === "char_luna") setShowLuna(prev => !prev);
      if (id === "style_midnight") setTheme("midnight");
      if (id === "style_peach") setTheme("peach");
      if (id === "style_cloud") setTheme("cloud");
      if (id === "style_moss") setTheme("moss");
      
      if (id === "sounds") {
        setIsSoundsEnabled(prev => !prev);
      }

      if (id.startsWith("size_")) {
        const sizeStr = id.replace("size_", "") as "small" | "medium" | "large";
        setSize(sizeStr);
      }

      if (id.startsWith("disp_")) {
        const dispMode = id.replace("disp_", "");
        invoke("set_display_mode", { mode: dispMode }).catch(console.error);
      }
    });

    return () => {
      unlistenTray.then(f => f());
    };
  }, []);

  return {
    showEthan,
    showLuna,
    theme,
    setTheme,
    size,
    isSoundsEnabled,
    isSelectOpen,
    setIsSelectOpen
  };
}
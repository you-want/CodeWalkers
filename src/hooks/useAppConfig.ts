import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function useAppConfig() {
  const [showBruce, setShowBruce] = useState(true);
  const [showJazz, setShowJazz] = useState(true);
  const [theme, setTheme] = useState<string>("midnight");
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const [isSoundsEnabled, setIsSoundsEnabled] = useState(true);
  const isSoundsEnabledRef = useRef(isSoundsEnabled);

  useEffect(() => {
    isSoundsEnabledRef.current = isSoundsEnabled;
  }, [isSoundsEnabled]);

  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const lastIgnoreState = useRef<boolean | null>(null);

  useEffect(() => {
    const checkMouse = async () => {
      if (isSelectOpen) return;

      try {
        const [x, y] = await invoke<[number, number]>("get_mouse_pos");
        
        const target = document.elementFromPoint(x, y) as HTMLElement | null;
        if (!target) return;

        let shouldIgnore = true;

        if (target.closest('.agent-character')) {
          const charEl = target.closest('.agent-character') as HTMLElement;
          const video = charEl.querySelector('video');
          if (video) {
            const rect = video.getBoundingClientRect();
            const videoX = x - rect.left;
            const videoY = y - rect.top;
            
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            if (ctx) {
              const scaleX = video.videoWidth / rect.width;
              const scaleY = video.videoHeight / rect.height;
              
              ctx.drawImage(
                video, 
                videoX * scaleX, videoY * scaleY, 1, 1,
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

        const isInteractive = target.closest('.bubble') || 
                              target.closest('.popover-panel') || 
                              target.closest('[data-radix-popper-content-wrapper]') ||
                              target.closest('[role="listbox"]') ||
                              target.closest('[data-radix-select-content]') ||
                              target.closest('.radix-select-content') ||
                              target.closest('div[role="dialog"]');
        
        if (isInteractive) {
          shouldIgnore = false;
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
      }
    };

    if (isSelectOpen) {
      if (lastIgnoreState.current !== false) {
        invoke("set_ignore_cursor_events", { ignore: false }).catch(console.error);
        lastIgnoreState.current = false;
      }
    }

    const interval = setInterval(checkMouse, 30);

    return () => {
      clearInterval(interval);
    };
  }, [isSelectOpen]);

  useEffect(() => {
    const unlistenTray = listen<string>("tray_event", (event) => {
      const id = event.payload;
      console.log("Tray event received in React:", id);
      
      if (id === "char_bruce") setShowBruce(prev => !prev);
      if (id === "char_jazz") setShowJazz(prev => !prev);
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
    showBruce,
    showJazz,
    theme,
    size,
    isSoundsEnabled,
    isSelectOpen,
    setIsSelectOpen
  };
}
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProviderStatus } from "../types/agent";

const THINKING_PHRASES = [
  "hmm...", "thinking...", "one sec...", "ok hold on",
  "let me check", "working on it", "almost...", "bear with me",
  "on it!", "gimme a sec", "brb", "processing...",
  "hang tight", "just a moment", "figuring it out",
  "crunching...", "reading...", "looking...",
  "cooking...", "vibing...", "digging in",
];

const COMPLETION_PHRASES = [
  "done!", "all set!", "ready!", "here you go", "got it!",
  "finished!", "ta-da!", "voila!", "boom!",
];

export function useAgentSession(sessionId: string, isSoundsEnabled: boolean) {
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleType, setBubbleType] = useState<'thinking' | 'completion' | 'info' | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [inputText, setInputText] = useState("");
  const [sessionOutput, setSessionOutput] = useState<string[]>([]);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const isSoundsEnabledRef = useRef(isSoundsEnabled);
  useEffect(() => {
    isSoundsEnabledRef.current = isSoundsEnabled;
  }, [isSoundsEnabled]);

  const isThinkingRef = useRef(false);
  const hasStartedOutputtingRef = useRef(false);
  const lastSentMessageRef = useRef("");
  const clearBubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const outputBufferRef = useRef<string>("");

  const playCompletionSound = () => {
    if (!isSoundsEnabledRef.current) return;
    const sounds = ['ping-aa.mp3', 'ping-bb.mp3', 'ping-cc.mp3', 'ping-dd.mp3', 'ping-ee.mp3', 'ping-ff.mp3', 'ping-gg.mp3', 'ping-hh.mp3'];
    const randomSound = sounds[Math.floor(Math.random() * sounds.length)];
    const audio = new Audio(`/sounds/${randomSound}`);
    audio.volume = 0.5;
    audio.play().catch(e => console.error("Error playing completion sound:", e));
  };

  const startSession = async (binaryPath: string) => {
    try {
      await invoke("stop_session", { sessionId }).catch(() => {});
      await invoke("start_session", { sessionId, binaryPath });
      setIsSessionActive(true);
      setSessionOutput(prev => [...prev, `Started session with ${binaryPath}`]);
    } catch (err) {
      console.error(err);
      setSessionOutput(prev => [...prev, `Failed to start session: ${err}`]);
    }
  };

  const handleInstall = async (binary: string, name: string) => {
    try {
        setSessionOutput(prev => [...prev, `[System]: Opening Terminal to install ${name}...`]);
        const res = await invoke<string>("install_provider", { binary });
        setSessionOutput(prev => [...prev, `[System]: ${res}`]);
        
        const checkInterval = setInterval(async () => {
            const updatedProviders = await invoke<ProviderStatus[]>("check_providers");
            setProviders(updatedProviders);
            
            const isNowInstalled = updatedProviders.find(p => p.binary === binary)?.is_installed;
            if (isNowInstalled) {
                clearInterval(checkInterval);
                setSessionOutput(prev => [...prev, `[System]: Detected ${name} installation successful!`]);
                const available = updatedProviders.filter(p => p.is_installed);
                setBubbleText(`Found ${available.map(a => a.name).join(", ")}`);
                setBubbleType('info');
                clearBubbleTimeoutRef.current = setTimeout(() => {
                  setBubbleText(null);
                  setBubbleType(null);
                }, 5000);
            }
        }, 5000);

        setTimeout(() => clearInterval(checkInterval), 300000);
        
    } catch (err) {
      console.error(err);
      setSessionOutput(prev => [...prev, `[System]: Failed to launch installation for ${name}: ${err}`]);
    }
  };

  useEffect(() => {
    const unlistenOut = listen<string>(`session_output_${sessionId}`, (event) => {
      const cleanPayload = event.payload.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      // PTY might send \r\n, \n, or just \r for progress spinners
      // We normalize all of them to \n so we can process each update frame
      const normalizedPayload = cleanPayload.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      outputBufferRef.current += normalizedPayload;

      let newlineIndex;
      let hasRealOutput = false;
      while ((newlineIndex = outputBufferRef.current.indexOf('\n')) !== -1) {
        const line = outputBufferRef.current.slice(0, newlineIndex).trim();
        outputBufferRef.current = outputBufferRef.current.slice(newlineIndex + 1);

        if (!line) continue;

        if (line === lastSentMessageRef.current || line === `* ${lastSentMessageRef.current}`) {
          continue; // ignore echoed input
        }
        
        hasRealOutput = true;

        try {
          const json = JSON.parse(line);
          const type = json.type || json.event || "";
          const data = json.data || json;

          if (["content", "text", "delta", "message"].includes(type)) {
            let text = "";
            if (typeof data === "string") {
              text = data;
            } else {
              text = data.text || data.content || data.value || data.output || json.text || json.content || "";
            }
            
            if (text) {
              setSessionOutput(prev => {
                const newOut = [...prev];
                const last = newOut[newOut.length - 1];
                if (last && last.startsWith("[Out]: ")) {
                  newOut[newOut.length - 1] = last + text;
                } else {
                  newOut.push(`[Out]: ${text}`);
                }
                return newOut;
              });
            }
          } else if (["tool_call", "function_call", "tool_use"].includes(type)) {
            const toolName = data.name || json.tool_name || "Tool";
            if (toolName !== "activate_skill") {
              const args = data.args || json.args || {};
              const argsStr = Object.keys(args).length > 0 ? ` with ${JSON.stringify(args)}` : "";
              setSessionOutput(prev => [...prev, `[Tool]: ${toolName}${argsStr}`]);
            }
          } else if (["tool_result", "function_result"].includes(type)) {
            const output = data.output || data.result || json.output || "";
            const summary = typeof output === 'string' ? output.substring(0, 50).replace(/\n/g, ' ') : "";
            setSessionOutput(prev => [...prev, `[Tool Result]: ${summary}...`]);
          } else if (["done", "end", "complete", "turn_end", "result"].includes(type)) {
            // turn complete
          } else if (type === "error") {
            const msg = data.message || data.error || "Error";
            setSessionOutput(prev => [...prev, `[Error]: ${msg}`]);
          } else {
            const text = json.text || json.content || json.message;
            if (text) {
              setSessionOutput(prev => {
                const newOut = [...prev];
                const last = newOut[newOut.length - 1];
                if (last && last.startsWith("[Out]: ")) {
                  newOut[newOut.length - 1] = last + text;
                } else {
                  newOut.push(`[Out]: ${text}`);
                }
                return newOut;
              });
            } else if (type !== "progress" && type !== "status") {
              // fallback for unknown json structure
              console.log("Unhandled JSON from gemini:", json);
              setSessionOutput(prev => {
                const newOut = [...prev];
                newOut.push(`[Out]: ${JSON.stringify(json, null, 2)}`);
                return newOut;
              });
            }
          }
        } catch {
          const trimmedLine = line.trim();
          
          // Handle known progress noise by updating the bubble instead of ignoring
          const progressMatch = trimmedLine.match(/^([✓→◆⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏])\s+(.*)/);
          if (progressMatch) {
            const [, icon, text] = progressMatch;
            if (isThinkingRef.current) {
              setBubbleText(`${icon} ${text}`);
              setBubbleType('thinking');
            }
            continue;
          }
          
          // Ignore any remaining standalone progress noise
          if (trimmedLine.match(/^[✓→◆⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/)) continue;

          if (trimmedLine.includes("Keychain initialization encountered an error")) continue;

          // Ignore REPL UI noise
          if (trimmedLine.match(/^workspace\s*\(.*\)/)) continue;
          if (trimmedLine.match(/^Ask Gemini/) || trimmedLine.includes("Auto (Gemini") || trimmedLine.match(/^.*Auto\s*\(Gemini/)) {
            if (isThinkingRef.current) {
              isThinkingRef.current = false;
              hasStartedOutputtingRef.current = false;
              if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
              const phrase = COMPLETION_PHRASES[Math.floor(Math.random() * COMPLETION_PHRASES.length)];
              setBubbleText(phrase);
              setBubbleType('completion');
              playCompletionSound();
              
              if (clearBubbleTimeoutRef.current) clearTimeout(clearBubbleTimeoutRef.current);
              clearBubbleTimeoutRef.current = setTimeout(() => {
                setBubbleText(null);
                setBubbleType(null);
              }, 3000);
            }
            continue;
          }
          if (trimmedLine.match(/^YOLO Ctrl\+Y/)) continue;
          if (trimmedLine.match(/^[=─━_-]{10,}/)) continue;
          
          // Handle tool calls by updating the bubble and NOT printing to terminal (to match lil-agents)
          const toolMatch = trimmedLine.match(/^\*\s+(.*)/);
          if (toolMatch) {
            const tool = toolMatch[1];
            if (isThinkingRef.current) {
              setBubbleText(`Running ${tool}...`);
              setBubbleType('thinking');
            }
            // lil-agents prints [Tool]: to the output history
            setSessionOutput(prev => [...prev, `[Tool]: ${tool}`]);
            continue;
          }

          // Also ignore empty lines to reduce clutter
          if (!trimmedLine) continue;

          setSessionOutput(prev => {
            const newOut = [...prev];
            const last = newOut[newOut.length - 1];
            if (last && last.startsWith("[Out]: ")) {
              newOut[newOut.length - 1] = last + "\n" + trimmedLine;
            } else {
              newOut.push(`[Out]: ${trimmedLine}`);
            }
            return newOut;
          });
        }
      }
      
      if (hasRealOutput && isThinkingRef.current) {
        hasStartedOutputtingRef.current = true;
      }
    });

    const unlistenErr = listen<string>("session_error", (event) => {
      setSessionOutput(prev => [...prev, `[Err]: ${event.payload}`]);
      if (event.payload.startsWith(`${sessionId}:`)) {
        setIsSessionActive(false);
      }
    });

    const unlistenEnded = listen<string>(`session_ended_${sessionId}`, () => {
      setIsSessionActive(false);
      setSessionOutput(prev => [...prev, `[System]: Session ended.`]);
    });

    invoke<ProviderStatus[]>("check_providers")
      .then((res) => {
        setProviders(res);
        const available = res.filter(p => p.is_installed);
        if (available.length > 0) {
          setBubbleText(`Found ${available.map(a => a.name).join(", ")}`);
          setBubbleType('info');
        } else {
          setBubbleText("No AI providers found. Please install one.");
          setBubbleType('info');
        }
        
        clearBubbleTimeoutRef.current = setTimeout(() => {
          setBubbleText(null);
          setBubbleType(null);
        }, 5000);
      })
      .catch(console.error);

    return () => {
      unlistenOut.then(f => f());
      unlistenErr.then(f => f());
      unlistenEnded.then(f => f());
      invoke("stop_session", { sessionId }).catch(() => {});
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
      const clearBubbleTimeout = clearBubbleTimeoutRef.current;
      if (clearBubbleTimeout) clearTimeout(clearBubbleTimeout);
    };
  }, [sessionId]);

  // 2. Clear output when a new query starts
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    const text = inputText.trim();
    setInputText("");
    
    if (text === "/clear") {
      setSessionOutput([]);
      return;
    }

    if (text === "/copy") {
      const lastOut = [...sessionOutput].reverse().find(line => line.startsWith("[Out]: "));
      if (lastOut) {
        const textToCopy = lastOut.replace("[Out]: ", "").trim();
        navigator.clipboard.writeText(textToCopy);
        setSessionOutput(prev => [...prev, `[System]: Copied last response to clipboard.`]);
      } else {
        setSessionOutput(prev => [...prev, `[System]: No response to copy.`]);
      }
      return;
    }

    if (text === "/help") {
      setSessionOutput(prev => [
        ...prev, 
        `[System]: Available commands:`, 
        `  /clear - Clear terminal output`, 
        `  /copy  - Copy last response to clipboard`, 
        `  /help  - Show this help message`
      ]);
      return;
    }
    
    lastSentMessageRef.current = text;
    hasStartedOutputtingRef.current = false;
    isThinkingRef.current = true;
    outputBufferRef.current = ""; // clear buffer on new message
    
    // Force a "thinking" bubble immediately
    const initialPhrase = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
    setBubbleText(initialPhrase);
    setBubbleType('thinking');
    
    if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
    thinkingIntervalRef.current = setInterval(() => {
      setBubbleText(prev => {
        let next = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
        while (next === prev && THINKING_PHRASES.length > 1) {
          next = THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)];
        }
        return next;
      });
    }, Math.floor(Math.random() * 2000) + 3000); // 3-5 seconds
    
    if (clearBubbleTimeoutRef.current) {
      clearTimeout(clearBubbleTimeoutRef.current);
    }
    try {
      await invoke("send_message", { sessionId, message: text });
      setSessionOutput(prev => [...prev, `[You]: ${text}`]);
    } catch (err) {
      console.error(err);
      setSessionOutput(prev => [...prev, `Failed to send message: ${err}`]);
      isThinkingRef.current = false;
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current);
      setBubbleText(null);
      setBubbleType(null);
    }
  };

  return {
    bubbleText,
    bubbleType,
    providers,
    inputText,
    setInputText,
    sessionOutput,
    setSessionOutput,
    isSessionActive,
    startSession,
    handleInstall,
    sendMessage,
  };
}
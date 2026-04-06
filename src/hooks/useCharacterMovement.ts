import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import type { CharacterName, CharacterSize } from "../types/agent";

interface UseCharacterMovementArgs {
  characterName: CharacterName;
  size: CharacterSize;
  initialX: number;
  isPopoverOpen: boolean;
}

export function useCharacterMovement({
  characterName,
  size,
  initialX,
  isPopoverOpen,
}: UseCharacterMovementArgs) {
  const [position, setPosition] = useState({ x: initialX, y: window.innerHeight / 2 - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const directionRef = useRef(1);
  const startPosRef = useRef({ x: 0, y: 0 });
  const walkStateRef = useRef({
    isWalking: false,
    isPaused: true,
    pauseEndTime: Date.now() + Math.random() * 7000 + 5000,
    walkStartTime: 0,
    walkStartPixel: 0,
    walkEndPixel: 0,
    goingRight: true,
  });
  const widgetRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: ReactMouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    startPosRef.current = { x: e.clientX, y: e.clientY };

    if (walkStateRef.current.isWalking) {
      walkStateRef.current.isWalking = false;
      if (videoRef.current) videoRef.current.pause();
    }

    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMoveGlobal = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setHasMoved(true);
      }
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUpGlobal = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMoveGlobal);
      window.addEventListener("mouseup", handleMouseUpGlobal);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMoveGlobal);
      window.removeEventListener("mouseup", handleMouseUpGlobal);
    };
  }, [isDragging, dragOffset]);

  const videoDuration = 10.0;
  const accelStart = characterName === "bruce" ? 3.0 : 3.9;
  const fullSpeedStart = characterName === "bruce" ? 3.75 : 4.5;
  const decelStart = 8.0;
  const walkStop = characterName === "bruce" ? 8.5 : 8.75;
  useEffect(() => {
    let animationFrameId: number;
    const walkAmountRange = characterName === "bruce" ? [0.4, 0.65] : [0.35, 0.6];
    const movementPosition = (videoTime: number) => {
      const dIn = fullSpeedStart - accelStart;
      const dLin = decelStart - fullSpeedStart;
      const dOut = walkStop - decelStart;
      const v = 1.0 / (dIn / 2.0 + dLin + dOut / 2.0);

      if (videoTime <= accelStart) return 0.0;
      if (videoTime <= fullSpeedStart) {
        const t = videoTime - accelStart;
        return v * t * t / (2.0 * dIn);
      }
      if (videoTime <= decelStart) {
        const easeInDist = v * dIn / 2.0;
        const t = videoTime - fullSpeedStart;
        return easeInDist + v * t;
      }
      if (videoTime <= walkStop) {
        const easeInDist = v * dIn / 2.0;
        const linearDist = v * dLin;
        const t = videoTime - decelStart;
        return easeInDist + linearDist + v * (t - t * t / (2.0 * dOut));
      }
      return 1.0;
    };

    const update = () => {
      const now = Date.now();
      const state = walkStateRef.current;

      if (isDragging || isPopoverOpen) {
        if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
        animationFrameId = requestAnimationFrame(update);
        return;
      }

      if (state.isPaused) {
        if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
        if (now >= state.pauseEndTime) {
          state.isPaused = false;
          state.isWalking = true;
          state.walkStartTime = now;

          const currentX = position.x;
          const screenWidth = window.innerWidth;
          if (currentX > screenWidth * 0.85) state.goingRight = false;
          else if (currentX < screenWidth * 0.15) state.goingRight = true;
          else state.goingRight = Math.random() > 0.5;

          directionRef.current = state.goingRight ? 1 : -1;

          const walkPixels =
            (Math.random() * (walkAmountRange[1] - walkAmountRange[0]) + walkAmountRange[0]) * 500.0;
          state.walkStartPixel = currentX;
          state.walkEndPixel = state.goingRight
            ? Math.min(currentX + walkPixels, screenWidth - 150)
            : Math.max(currentX - walkPixels, 0);

          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch((e) => console.error("Error playing video:", e));
          }
        }
      }

      if (state.isWalking) {
        const elapsed = (now - state.walkStartTime) / 1000.0;
        const videoTime = Math.min(elapsed, videoDuration);
        const walkNorm = elapsed >= videoDuration ? 1.0 : movementPosition(videoTime);
        const currentPixel = state.walkStartPixel + (state.walkEndPixel - state.walkStartPixel) * walkNorm;

        if (widgetRef.current) {
          widgetRef.current.style.transform = `translate(${currentPixel}px, ${position.y}px)`;
        }

        if (elapsed >= videoDuration) {
          state.isWalking = false;
          state.isPaused = true;
          state.pauseEndTime = now + Math.random() * 7000 + 5000;
          setPosition((prev) => ({ ...prev, x: currentPixel }));
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
  }, [isDragging, isPopoverOpen, position.x, position.y, characterName, accelStart, fullSpeedStart, decelStart, walkStop]);

  const getSizeScale = () => {
    switch (size) {
      case "small":
        return 0.7;
      case "large":
        return 1.5;
      case "medium":
      default:
        return 1;
    }
  };

  return {
    position,
    isDragging,
    hasMoved,
    videoRef,
    directionRef,
    widgetRef,
    handleMouseDown,
    getSizeScale,
  };
}

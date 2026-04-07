import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppConfig } from "./useAppConfig";

const mockInvoke = vi.fn();
const mockListen = vi.fn();
let trayListener: ((event: { payload: string }) => void) | null = null;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

describe("useAppConfig", () => {
  beforeEach(() => {
    trayListener = null;
    mockInvoke.mockReset();
    mockListen.mockReset();

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "is_devtools_open") return Promise.resolve(false);
      if (cmd === "get_mouse_pos") return Promise.resolve([0, 0]);
      return Promise.resolve();
    });
    mockListen.mockImplementation((_eventName: string, handler: (event: { payload: string }) => void) => {
      trayListener = handler;
      return Promise.resolve(() => {});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("responds to tray style event and updates theme", async () => {
    const { result } = renderHook(() => useAppConfig());

    await waitFor(() => expect(mockListen).toHaveBeenCalled());
    expect(result.current.theme).toBe("midnight");

    act(() => {
      trayListener?.({ payload: "style_peach" });
    });
    expect(result.current.theme).toBe("peach");

    act(() => {
      trayListener?.({ payload: "style_cloud" });
    });
    expect(result.current.theme).toBe("cloud");
  });

  it("responds to size and sounds events", async () => {
    const { result } = renderHook(() => useAppConfig());

    await waitFor(() => expect(mockListen).toHaveBeenCalled());
    expect(result.current.size).toBe("medium");
    expect(result.current.isSoundsEnabled).toBe(true);

    act(() => {
      trayListener?.({ payload: "size_large" });
    });
    expect(result.current.size).toBe("large");

    act(() => {
      trayListener?.({ payload: "sounds" });
    });
    expect(result.current.isSoundsEnabled).toBe(false);
  });

  it("forces ignore cursor events to false when popover is open", async () => {
    const { result } = renderHook(() => useAppConfig());
    await waitFor(() => expect(mockListen).toHaveBeenCalled());

    mockInvoke.mockClear();
    act(() => {
      result.current.setIsSelectOpen(true);
    });

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith("set_ignore_cursor_events", { ignore: false }),
    );
  });

  it("responds to character visibility and monitor mode events", async () => {
    const { result } = renderHook(() => useAppConfig());
    await waitFor(() => expect(mockListen).toHaveBeenCalled());

    expect(result.current.showEthan).toBe(true);
    expect(result.current.showLuna).toBe(true);

    act(() => {
      trayListener?.({ payload: "char_ethan" });
    });
    expect(result.current.showEthan).toBe(false);

    act(() => {
      trayListener?.({ payload: "char_luna" });
    });
    expect(result.current.showLuna).toBe(false);

    act(() => {
      trayListener?.({ payload: "disp_primary" });
    });
    expect(mockInvoke).toHaveBeenCalledWith("set_display_mode", { mode: "primary" });
  });

  it("sets ignore=false when polling hits interactive area", async () => {
    vi.useFakeTimers();
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    vi.spyOn(document, "elementFromPoint").mockReturnValue(bubble);

    renderHook(() => useAppConfig());

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("set_ignore_cursor_events", { ignore: false });
  });

  it("sets ignore=true when polling hits non-interactive area", async () => {
    vi.useFakeTimers();
    const plain = document.createElement("div");
    vi.spyOn(document, "elementFromPoint").mockReturnValue(plain);

    renderHook(() => useAppConfig());

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("set_ignore_cursor_events", { ignore: true });
  });

  it("forces ignore=false when DevTools is open", async () => {
    vi.useFakeTimers();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "is_devtools_open") return Promise.resolve(true); // simulate DevTools open
      if (cmd === "get_mouse_pos") return Promise.resolve([0, 0]);
      return Promise.resolve();
    });

    const plain = document.createElement("div");
    vi.spyOn(document, "elementFromPoint").mockReturnValue(plain);

    renderHook(() => useAppConfig());

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    // Even if it's a non-interactive area, we must set ignore=false because DevTools is open
    expect(mockInvoke).toHaveBeenCalledWith("set_ignore_cursor_events", { ignore: false });
  });

  it("sets ignore=false when hovering over high z-index elements", async () => {
    vi.useFakeTimers();
    const highZIndexElement = document.createElement("div");
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ zIndex: "2000" } as CSSStyleDeclaration);
    vi.spyOn(document, "elementFromPoint").mockReturnValue(highZIndexElement);

    renderHook(() => useAppConfig());

    await act(async () => {
      vi.advanceTimersByTime(120);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("set_ignore_cursor_events", { ignore: false });
  });
});

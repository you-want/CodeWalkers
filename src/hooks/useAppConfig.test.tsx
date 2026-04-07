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

  it("响应 tray 的 style 事件并更新主题", async () => {
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

  it("响应 size 和 sounds 事件", async () => {
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

  it("选择器打开时会强制关闭 ignore cursor events", async () => {
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

  it("响应角色显示与显示器模式事件", async () => {
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

  it("轮询时命中交互区域会设置 ignore=false", async () => {
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

  it("轮询时非交互区域会设置 ignore=true", async () => {
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

  it("当开启开发者工具时会强制设置 ignore=false", async () => {
    vi.useFakeTimers();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "is_devtools_open") return Promise.resolve(true); // 模拟开启了 DevTools
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

    // 即使是非交互区域，但因为 DevTools 开着，必须设置 ignore=false 放行点击
    expect(mockInvoke).toHaveBeenCalledWith("set_ignore_cursor_events", { ignore: false });
  });

  it("当鼠标悬浮在高 z-index 元素时会设置 ignore=false", async () => {
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

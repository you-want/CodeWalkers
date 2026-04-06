import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

    mockInvoke.mockResolvedValue([0, 0]);
    mockListen.mockImplementation((_eventName: string, handler: (event: { payload: string }) => void) => {
      trayListener = handler;
      return Promise.resolve(() => {});
    });
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
});

import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionPanel } from "./SessionPanel";
import type { ProviderStatus } from "../types/agent";

const provider: ProviderStatus = {
  name: "Gemini",
  binary: "gemini",
  is_installed: true,
  path: "/usr/local/bin/gemini",
};

function renderSessionPanel(overrides: Partial<ComponentProps<typeof SessionPanel>> = {}) {
  const defaultProps: ComponentProps<typeof SessionPanel> = {
    characterName: "bruce",
    activeProviderName: "Gemini",
    providers: [provider],
    setActiveProviderName: vi.fn(),
    setIsSelectOpen: vi.fn(),
    theme: "midnight",
    onThemeChange: vi.fn(),
    sessionOutput: ["[Out]: hello world"],
    setSessionOutput: vi.fn(),
    isSessionActive: true,
    startSession: vi.fn(async () => {}),
    handleInstall: vi.fn(async () => {}),
    inputText: "",
    setInputText: vi.fn(),
    sendMessage: vi.fn(async () => {}),
  };

  const props = { ...defaultProps, ...overrides };
  render(<SessionPanel {...props} />);
  return props;
}

describe("SessionPanel", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn() },
      configurable: true,
    });
  });

  it("复制最后一条输出到剪贴板", () => {
    const setSessionOutput = vi.fn();
    renderSessionPanel({ setSessionOutput });

    fireEvent.click(screen.getByTitle("Copy Last Response"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello world");
    expect(setSessionOutput).toHaveBeenCalled();
  });

  it("没有可复制输出时给出系统提示", () => {
    const setSessionOutput = vi.fn();
    renderSessionPanel({ sessionOutput: [], setSessionOutput });

    fireEvent.click(screen.getByTitle("Copy Last Response"));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(setSessionOutput).toHaveBeenCalled();
  });

  it("provider 未安装时可触发安装", () => {
    const handleInstall = vi.fn(async () => {});
    const uninstalledProvider: ProviderStatus = { ...provider, is_installed: false };
    renderSessionPanel({ providers: [uninstalledProvider], handleInstall, isSessionActive: false });

    fireEvent.click(screen.getByText("Install Gemini"));
    expect(handleInstall).toHaveBeenCalledWith("gemini", "Gemini");
  });

  it("provider 已安装但会话未启动时可启动会话", () => {
    const startSession = vi.fn(async () => {});
    renderSessionPanel({ isSessionActive: false, startSession });

    fireEvent.click(screen.getByText("Start Session with Gemini"));
    expect(startSession).toHaveBeenCalledWith("/usr/local/bin/gemini");
  });

  it("输入框回车会发送消息", () => {
    const sendMessage = vi.fn(async () => {});
    const setInputText = vi.fn();
    renderSessionPanel({ inputText: "hello", setInputText, sendMessage, isSessionActive: true });

    fireEvent.change(screen.getByPlaceholderText("Ask Gemini..."), { target: { value: "new prompt" } });
    expect(setInputText).toHaveBeenCalled();

    fireEvent.keyDown(screen.getByPlaceholderText("Ask Gemini..."), { key: "Enter" });
    expect(sendMessage).toHaveBeenCalled();
  });
});

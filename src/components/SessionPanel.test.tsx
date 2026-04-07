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
    isPopoverOpen: true,
    characterName: "ethan",
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

  it("copies last output to clipboard", () => {
    const setSessionOutput = vi.fn();
    renderSessionPanel({ setSessionOutput });

    fireEvent.click(screen.getByTitle("Copy Last Response"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello world");
    expect(setSessionOutput).toHaveBeenCalled();
  });

  it("shows system prompt when no output to copy", () => {
    const setSessionOutput = vi.fn();
    renderSessionPanel({ sessionOutput: [], setSessionOutput });

    fireEvent.click(screen.getByTitle("Copy Last Response"));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(setSessionOutput).toHaveBeenCalled();
  });

  it("triggers install when provider is not installed", () => {
    const handleInstall = vi.fn(async () => {});
    const uninstalledProvider: ProviderStatus = { ...provider, is_installed: false };
    renderSessionPanel({ providers: [uninstalledProvider], handleInstall, isSessionActive: false });

    fireEvent.click(screen.getByText("Install Gemini"));
    expect(handleInstall).toHaveBeenCalledWith("gemini", "Gemini");
  });

  it("starts session when provider is installed but session is stopped", () => {
    const startSession = vi.fn(async () => {});
    renderSessionPanel({ isSessionActive: false, startSession });

    fireEvent.click(screen.getByText("Start Session with Gemini"));
    expect(startSession).toHaveBeenCalledWith("/usr/local/bin/gemini");
  });

  it("sends message on Enter key", () => {
    const sendMessage = vi.fn(async () => {});
    const setInputText = vi.fn();
    renderSessionPanel({ inputText: "hello", setInputText, sendMessage, isSessionActive: true });

    fireEvent.change(screen.getByPlaceholderText("Ask Gemini..."), { target: { value: "new prompt" } });
    expect(setInputText).toHaveBeenCalled();

    fireEvent.keyDown(screen.getByPlaceholderText("Ask Gemini..."), { key: "Enter" });
    expect(sendMessage).toHaveBeenCalled();
  });

  it("restarts session when clicking restart button", () => {
    const startSession = vi.fn(async () => {});
    renderSessionPanel({ startSession, isSessionActive: true });

    fireEvent.click(screen.getByTitle("Restart Session"));
    expect(startSession).toHaveBeenCalledWith("/usr/local/bin/gemini");
  });

  it("renders different types of messages", () => {
    renderSessionPanel({
      sessionOutput: [
        "[You]: hello",
        "[Out]: world",
        "[Tool]: run ls",
        "[Tool Result]: success",
        "[Tool Fail]: error",
        "[System]: init",
        "[Err]: crash",
      ],
    });

    expect(screen.getByText(">")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByText("TOOL")).toBeInTheDocument();
    expect(screen.getByText("run ls")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM")).toBeInTheDocument();
    expect(screen.getByText("init")).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(screen.getByText("crash")).toBeInTheDocument();
  });
});

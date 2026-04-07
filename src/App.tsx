import { CharacterWidget } from "./components/CharacterWidget";
import { useAppConfig } from "./hooks/useAppConfig";
import "./App.css";

function App() {
  const {
    showEthan,
    showLuna,
    theme,
    setTheme,
    size,
    isSoundsEnabled,
    setIsSelectOpen,
  } = useAppConfig();

  return (
    <main className={`container theme-${theme}`}>
      {showEthan && (
        <CharacterWidget
          characterName="ethan"
          size={size}
          initialX={window.innerWidth / 2 - 150}
          setIsSelectOpen={setIsSelectOpen}
          theme={theme}
          onThemeChange={setTheme}
          isSoundsEnabled={isSoundsEnabled}
        />
      )}
      {showLuna && (
        <CharacterWidget
          characterName="luna"
          size={size}
          initialX={window.innerWidth / 2 + 50}
          setIsSelectOpen={setIsSelectOpen}
          theme={theme}
          onThemeChange={setTheme}
          isSoundsEnabled={isSoundsEnabled}
        />
      )}
    </main>
  );
}

export default App;
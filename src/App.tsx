import { CharacterWidget } from "./components/CharacterWidget";
import { useAppConfig } from "./hooks/useAppConfig";
import "./App.css";

function App() {
  const {
    showBruce,
    showJazz,
    theme,
    setTheme,
    size,
    isSoundsEnabled,
    setIsSelectOpen,
  } = useAppConfig();

  return (
    <main className={`container theme-${theme}`}>
      {showBruce && (
        <CharacterWidget
          characterName="bruce"
          size={size}
          initialX={window.innerWidth / 2 - 150}
          setIsSelectOpen={setIsSelectOpen}
          theme={theme}
          onThemeChange={setTheme}
          isSoundsEnabled={isSoundsEnabled}
        />
      )}
      {showJazz && (
        <CharacterWidget
          characterName="jazz"
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
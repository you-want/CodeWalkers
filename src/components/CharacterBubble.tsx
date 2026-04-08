interface CharacterBubbleProps {
  text?: string | null;
}

export function CharacterBubble({ text }: CharacterBubbleProps) {
  if (!text) return null;
  
  return (
    <div className="bubble">
      {text}
    </div>
  );
}

import React, { useLayoutEffect } from 'react';

const MAX_LENGTH = 2000;
// The box grows with the question up to about eight lines, then scrolls
const MAX_INPUT_HEIGHT = 192;

// The question box and its button as one control. The page owns the text, so an example can fill it.
function Composer({ value, onChange, inputRef, busy, disabled, disabledReason, note, docked, onSend, onStop }) {
  const trimmed = value.trim();

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [value, inputRef]);

  const submit = (event) => {
    event?.preventDefault();
    if (!trimmed || busy || disabled) return;
    onSend(trimmed);
  };

  // Enter sends, Shift+Enter starts a new line (and Enter while composing CJK text does neither)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  return (
    <form className={`chat-composer${docked ? ' chat-composer--docked' : ''}`} onSubmit={submit}>
      <div className={`chat-box${disabled ? ' chat-box--disabled' : ''}`}>
        <textarea
          ref={inputRef}
          className="chat-input"
          rows={2}
          maxLength={MAX_LENGTH}
          value={value}
          disabled={disabled}
          placeholder={disabled ? disabledReason : 'Ask about resorts, runs or lifts…'}
          aria-label="Your question"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {busy ? (
          <button type="button" className="btn btn-secondary btn-small chat-send" onClick={onStop}>Stop</button>
        ) : (
          <button type="submit" className="btn btn-small chat-send" disabled={disabled || !trimmed}>Ask</button>
        )}
      </div>
      <div className="chat-composer-bar">
        <span>{note}</span>
        <span>{value.length > MAX_LENGTH * 0.8 && `${value.length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`}</span>
      </div>
    </form>
  );
}

export default Composer;

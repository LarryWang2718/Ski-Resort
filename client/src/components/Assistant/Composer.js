import React, { useState } from 'react';

const MAX_LENGTH = 2000;

function Composer({ busy, disabled, disabledReason, onSend, onStop }) {
  const [text, setText] = useState('');
  const trimmed = text.trim();

  const submit = (event) => {
    event?.preventDefault();
    if (!trimmed || busy || disabled) return;
    onSend(trimmed);
    setText('');
  };

  // Enter sends, Shift+Enter starts a new line (and Enter while composing CJK text does neither)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  return (
    <form className="chat-composer" onSubmit={submit}>
      <textarea
        className="field chat-input"
        rows={2}
        maxLength={MAX_LENGTH}
        value={text}
        disabled={disabled}
        placeholder={disabled ? disabledReason : 'Ask about resorts, runs or lifts…'}
        aria-label="Your question"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="chat-composer-bar">
        <span className="chat-count">
          {text.length > MAX_LENGTH * 0.8 && `${text.length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`}
        </span>
        {busy ? (
          <button type="button" className="btn btn-secondary" onClick={onStop}>Stop</button>
        ) : (
          <button type="submit" className="btn" disabled={disabled || !trimmed}>Ask</button>
        )}
      </div>
    </form>
  );
}

export default Composer;

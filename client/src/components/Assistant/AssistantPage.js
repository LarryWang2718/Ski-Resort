import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import useAssistantChat from '../../hooks/useAssistantChat';
import ChatTurn from './ChatTurn';
import Composer from './Composer';
import { ErrorNotice } from '../Feedback';

// Picking one fills the box rather than sending, so it can be edited first (questions count against a daily limit)
const GENERAL_EXAMPLES = [
  { label: 'Find resorts', question: 'Resorts in Austria with over 200 km of slopes' },
  { label: 'Compare', question: 'Compare Verbier and Zermatt' },
  { label: 'Explore trails', question: 'Show the mapped black runs at Chamonix' },
  { label: 'Find nearby', question: 'What resorts are near Les 3 Vallées?' }
];

const RESORT_EXAMPLES = [
  { label: 'Lifts', question: 'How many lifts does this resort have, and what kinds?' },
  { label: 'Explore trails', question: 'Which mapped black runs are there?' },
  { label: 'Find nearby', question: 'Which resorts are nearby?' },
  { label: 'Compare', question: 'How does it compare with Verbier?' }
];

const quotaText = (quota) => {
  if (!quota) return null;
  if (quota.turnsLeft === 0) return 'No questions left today. The limit resets at 00:00 UTC.';
  return `${quota.turnsLeft} of ${quota.turnsLimit} questions left today`;
};

function AssistantPage() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const resortId = searchParams.get('resort') || undefined;
  const { conversation, turns, busy, quota, loadError, send, stop, retry, reset } = useAssistantChat({ conversationId, resortId });
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  // Until the conversation exists, the resort comes from the link on the resort page
  const context = conversation ? conversation.context : resortId && { resortId, name: location.state?.resortName };
  const outOfQuestions = quota?.turnsLeft === 0;
  const lastTurn = turns[turns.length - 1];
  const full = conversation?.full || lastTurn?.error?.code === 'conversation_full';
  const composerDisabled = outOfQuestions || full || Boolean(loadError);
  const examples = context ? RESORT_EXAMPLES : GENERAL_EXAMPLES;
  // Once there is a conversation, the introduction shrinks to a title so the answers get the space
  const started = turns.length > 0 || Boolean(conversationId);
  const scrollRef = useRef(null);
  const followAnswer = useRef(true);
  const turnCount = turns.length;

  // In a conversation the page is exactly the window below the navbar, whose height changes as it wraps
  useLayoutEffect(() => {
    const navbar = document.querySelector('.navbar');
    if (!started || !navbar) return undefined;
    const update = () => document.documentElement.style.setProperty('--navbar-height', `${navbar.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(navbar);
    return () => observer.disconnect();
  }, [started]);

  // A new question always scrolls into view
  useLayoutEffect(() => {
    followAnswer.current = true;
  }, [turnCount]);

  // Keep the streaming answer in view, unless the reader has scrolled up to something earlier
  useLayoutEffect(() => {
    const log = scrollRef.current;
    if (log && followAnswer.current) log.scrollTop = log.scrollHeight;
  }, [turns]);

  // ...also when the window resizes or a long question makes the box taller
  useLayoutEffect(() => {
    const log = scrollRef.current;
    if (!log) return undefined;
    const observer = new ResizeObserver(() => {
      if (followAnswer.current) log.scrollTop = log.scrollHeight;
    });
    observer.observe(log);
    return () => observer.disconnect();
  }, [started]);

  const handleScroll = () => {
    const log = scrollRef.current;
    followAnswer.current = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  };

  const ask = (text) => {
    send(text);
    setDraft('');
  };

  const fillExample = (question) => {
    setDraft(question);
    // After the re-render, so the cursor lands at the end of the new text
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(question.length, question.length);
    });
  };

  const startOver = () => {
    setDraft('');
    reset();
  };

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      inputRef={inputRef}
      busy={busy}
      disabled={composerDisabled}
      disabledReason={full ? 'This conversation is full. Start a new one.' : 'No questions left today.'}
      note={quotaText(quota)}
      docked={started}
      onSend={ask}
      onStop={stop}
    />
  );

  return (
    <div className={`page-shell assistant-shell${started ? ' assistant-shell--chat' : ''}`}>
      <header className={`assistant-header${started ? ' assistant-header--compact' : ''}`}>
        {!started && <div className="page-kicker">Assistant</div>}
        <div className="assistant-heading">
          <h1>Ask about ski resorts</h1>
          {started && <button type="button" className="btn btn-secondary btn-small" onClick={startOver}>New conversation</button>}
        </div>
        {!started && (
          <>
            <p className="assistant-lead">Compare resorts, explore mapped trails and find nearby ski areas.</p>
            <p className="assistant-note">
              Answers use this site's resort directory and OpenStreetMap. Trail coverage varies, and there's no live snow,
              weather or opening information.
            </p>
          </>
        )}
        {context && (
          <span className="context-chip">
            About <Link to={`/resorts/${context.resortId}`}>{context.name || 'this resort'}</Link>
          </span>
        )}
      </header>

      {loadError && <ErrorNotice message={loadError} />}

      {started ? (
        <>
          <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll} role="region" aria-label="Conversation">
            <ol className="chat-log" aria-busy={busy}>
              {turns.map((turn) => <ChatTurn key={turn.id} turn={turn} onRetry={retry} />)}
            </ol>
          </div>
          {composer}
        </>
      ) : (
        <>
          {composer}
          <section className="chat-examples" aria-label="Example questions">
            <div className="chat-resorts-title">Try asking</div>
            <ul className="chat-example-grid">
              {examples.map(({ label, question }) => (
                <li key={question}>
                  <button type="button" className="chat-example" disabled={composerDisabled} onClick={() => fillExample(question)}>
                    <span className="chat-example-label">{label}</span>
                    <span className="chat-example-question">{question}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

export default AssistantPage;

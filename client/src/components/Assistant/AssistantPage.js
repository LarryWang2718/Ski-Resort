import React from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import useAssistantChat from '../../hooks/useAssistantChat';
import ChatTurn from './ChatTurn';
import Composer from './Composer';
import { ErrorNotice } from '../Feedback';

const GENERAL_QUESTIONS = [
  'Which resorts in Austria have more than 200 km of slopes?',
  'Compare Verbier and Zermatt',
  'Which black runs does Chamonix have?',
  'What resorts are near Les 3 Vallées?'
];

const RESORT_QUESTIONS = [
  'How many lifts does this resort have, and what kinds?',
  'Which black runs are there?',
  'Which resorts are nearby?',
  'How does it compare with Verbier?'
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

  // Until the conversation exists, the resort comes from the link on the resort page
  const context = conversation ? conversation.context : resortId && { resortId, name: location.state?.resortName };
  const outOfQuestions = quota?.turnsLeft === 0;
  const lastTurn = turns[turns.length - 1];
  const full = conversation?.full || lastTurn?.error?.code === 'conversation_full';
  const suggestions = context ? RESORT_QUESTIONS : GENERAL_QUESTIONS;

  return (
    <div className="page-shell assistant-shell">
      <header className="page-header">
        <div className="page-kicker">Assistant</div>
        <h1>Ask about ski resorts</h1>
        <p>
          Answers come from this site's resort directory and OpenStreetMap trail data, so there's no live snow,
          weather or opening information.
        </p>
      </header>

      <div className="assistant-toolbar">
        {context && (
          <span className="context-chip">
            About <Link to={`/resorts/${context.resortId}`}>{context.name || 'this resort'}</Link>
          </span>
        )}
        <span className="assistant-quota">{quotaText(quota)}</span>
        {(turns.length > 0 || conversationId) && (
          <button type="button" className="btn btn-secondary btn-small" onClick={reset}>New conversation</button>
        )}
      </div>

      {loadError && <ErrorNotice message={loadError} />}

      {turns.length === 0 && !loadError ? (
        <section className="chat-suggestions" aria-label="Example questions">
          <div className="chat-resorts-title">Try asking</div>
          <ul className="list">
            {suggestions.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  className="list-row list-row--button"
                  disabled={busy || outOfQuestions}
                  onClick={() => send(question)}
                >
                  <span className="list-title">{question}</span>
                  <span className="list-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ol className="chat-log" aria-busy={busy}>
          {turns.map((turn) => <ChatTurn key={turn.id} turn={turn} onRetry={retry} />)}
        </ol>
      )}

      <Composer
        busy={busy}
        disabled={outOfQuestions || full || Boolean(loadError)}
        disabledReason={full ? 'This conversation is full. Start a new one.' : 'No questions left today.'}
        onSend={send}
        onStop={stop}
      />
    </div>
  );
}

export default AssistantPage;

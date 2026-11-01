import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import AnswerText, { linkedResortIds } from './AnswerText';
import { ErrorNotice } from '../Feedback';
import { formatLocation } from '../../utils/format';

const STEP_ICONS = { running: '…', ok: '✓', error: '!' };

const STATUS_NOTES = {
  truncated: 'The answer was cut short.',
  stopped: 'Stopped.'
};

function ChatTurn({ turn, onRetry }) {
  const streaming = turn.status === 'streaming';
  const finished = turn.status === 'complete' || turn.status === 'truncated';
  const allowedIds = useMemo(() => new Set(turn.resorts.map((resort) => resort.id)), [turn.resorts]);

  // List the resorts the answer actually links to, in its order, not every search result
  const linkedResorts = useMemo(() => {
    const byId = new Map(turn.resorts.map((resort) => [resort.id, resort]));
    return linkedResortIds(turn.text).map((id) => byId.get(id)).filter(Boolean);
  }, [turn.resorts, turn.text]);

  return (
    <li className="chat-turn">
      <div className="chat-row">
        <span className="chat-label">You</span>
        <p className="chat-question">{turn.userText}</p>
      </div>

      <div className="chat-row">
        <span className="chat-label">Assistant</span>
        <div className="chat-body">
          {turn.tools.length > 0 && (
            <ul className="chat-steps">
              {turn.tools.map((tool) => (
                <li key={tool.id} className={`chat-step chat-step--${tool.state}`}>
                  <span className="chat-step-icon" aria-hidden="true">{STEP_ICONS[tool.state]}</span>
                  {tool.label}
                  {tool.summary && <span className="chat-step-summary"> · {tool.summary}</span>}
                </li>
              ))}
            </ul>
          )}

          {streaming && !turn.text && (
            <p className="chat-thinking">{turn.phase === 'tools' ? 'Looking things up…' : 'Thinking…'}</p>
          )}

          {turn.text && (
            <AnswerText text={turn.text} allowedIds={allowedIds} muted={turn.status === 'failed' || turn.status === 'stopped'} />
          )}

          {STATUS_NOTES[turn.status] && <p className="chat-note">{STATUS_NOTES[turn.status]}</p>}

          {finished && turn.mapLinks.length > 0 && (
            <div className="chat-actions">
              {turn.mapLinks.map((link) => (
                <Link key={link.href} to={link.href} className="btn btn-secondary btn-small">{link.label}</Link>
              ))}
            </div>
          )}

          {finished && linkedResorts.length > 0 && (
            <div className="chat-resorts">
              <div className="chat-resorts-title">Resorts in this answer</div>
              <ul className="list">
                {linkedResorts.map((resort) => (
                  <li key={resort.id}>
                    <Link to={`/resorts/${resort.id}`} className="list-row">
                      <div className="list-text">
                        <span className="list-title">{resort.name}</span>
                        <span className="list-sub">{formatLocation({ location_region: resort.region, location_country: resort.country })}</span>
                      </div>
                      <span className="list-meta">{resort.slope_km ? `${resort.slope_km} km of slopes` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {turn.error && (
            <ErrorNotice message={turn.error.message} onRetry={turn.error.retryable ? () => onRetry(turn) : undefined} />
          )}
        </div>
      </div>
    </li>
  );
}

export default ChatTurn;

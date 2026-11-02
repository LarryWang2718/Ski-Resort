import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import AnswerText, { linkedResortIds } from './AnswerText';
import { ErrorNotice } from '../Feedback';
import { formatLocation, formatStat } from '../../utils/format';

const STEP_ICONS = { running: '…', ok: '✓', error: '!' };

// The directory figures the tools return; any of them can be missing
const STATS = [
  { field: 'slope_km', label: 'Slopes', unit: 'km', inline: (text) => `${text} of slopes` },
  { field: 'lifts', label: 'Lifts', unit: '', inline: (text, value) => `${text} ${Number(value) === 1 ? 'lift' : 'lifts'}` },
  { field: 'top_elevation_m', label: 'Top elevation', unit: 'm', inline: (text) => `top ${text}` },
  { field: 'vertical_m', label: 'Vertical drop', unit: 'm', inline: (text) => `${text} vertical` }
];

const placeOf = (resort) => formatLocation({ location_region: resort.region, location_country: resort.country });

// "412 km of slopes · 68 lifts · top 3,330 m", leaving out what the directory doesn't have
const statLine = (resort) => {
  const parts = STATS.map(({ field, unit, inline }) => {
    const text = formatStat(resort[field], unit);
    return text && inline(text, resort[field]);
  }).filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No figures in the directory';
};

function ResortRows({ resorts }) {
  return (
    <ul className="list">
      {resorts.map((resort) => (
        <li key={resort.id} className="list-row chat-resort">
          <div className="list-text">
            <Link to={`/resorts/${resort.id}`} className="list-title chat-resort-name">{resort.name}</Link>
            <span className="list-sub">{placeOf(resort)}</span>
            <span className="chat-resort-stats">{statLine(resort)}</span>
          </div>
          <span className="chat-resort-links">
            <Link to={`/resorts/${resort.id}`}>View resort</Link>
            <Link to={`/resorts/${resort.id}#map`}>Trail map</Link>
          </span>
        </li>
      ))}
    </ul>
  );
}

// A comparison's resorts in columns; scrolls sideways when the screen is too narrow for them
function CompareTable({ resorts }) {
  return (
    <div className="chat-compare">
      <table className="compare-table">
        <thead>
          <tr>
            <td />
            {resorts.map((resort) => (
              <th key={resort.id} scope="col">
                <Link to={`/resorts/${resort.id}`}>{resort.name}</Link>
                <span className="compare-place">{placeOf(resort)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STATS.map(({ field, label, unit }) => (
            <tr key={field}>
              <th scope="row">{label}</th>
              {resorts.map((resort) => (
                <td key={resort.id}>{formatStat(resort[field], unit) || <span className="compare-missing">Not available</span>}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">Map</th>
            {resorts.map((resort) => (
              <td key={resort.id}><Link to={`/resorts/${resort.id}#map`}>Trail map</Link></td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

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
  const compared = linkedResorts.length >= 2 && linkedResorts.length <= 4
    && turn.tools.some((tool) => tool.name === 'get_resort_details' && tool.state === 'ok');

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
              <div className="chat-resorts-title">{compared ? 'Side by side' : 'Resorts in this answer'}</div>
              {compared ? <CompareTable resorts={linkedResorts} /> : <ResortRows resorts={linkedResorts} />}
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

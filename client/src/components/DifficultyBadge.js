import React from 'react';
import { DIFFICULTIES, UNKNOWN_DIFFICULTY_COLOR, humanize } from '../utils/format';

function DifficultyBadge({ difficulty }) {
  const known = DIFFICULTIES[difficulty];
  const label = known?.label || humanize(difficulty) || 'Unrated';

  return (
    <span className="difficulty">
      <span className="difficulty-dot" style={{ background: known?.color || UNKNOWN_DIFFICULTY_COLOR }} aria-hidden="true" />
      {label}
    </span>
  );
}

export default DifficultyBadge;

import React from 'react';
import FeatureBrowser from './FeatureBrowser';
import DifficultyBadge from './DifficultyBadge';
import { DIFFICULTIES } from '../utils/format';

const DIFFICULTY_FILTER = {
  param: 'difficulty',
  label: 'Difficulties',
  options: Object.entries(DIFFICULTIES).map(([value, { label }]) => [value, label])
};

function Trails() {
  return (
    <FeatureBrowser
      endpoint="/trails"
      kicker="Pistes"
      title="Ski Trails"
      intro="Every mapped piste, searchable by name, difficulty and resort."
      noun="trails"
      typeFilter={DIFFICULTY_FILTER}
      renderMeta={(trail) => <DifficultyBadge difficulty={trail.difficulty} />}
    />
  );
}

export default Trails;

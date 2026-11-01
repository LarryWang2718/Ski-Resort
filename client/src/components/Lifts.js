import React from 'react';
import FeatureBrowser from './FeatureBrowser';
import { LIFT_TYPES, liftLabel } from '../utils/format';

const LIFT_TYPE_FILTER = {
  param: 'aerialway',
  label: 'Lift types',
  options: Object.entries(LIFT_TYPES)
};

const liftMeta = (lift) => [
  liftLabel(lift.aerialway),
  lift.capacity && `${lift.capacity.toLocaleString()} people/hour`
].filter(Boolean).join(' · ');

function Lifts() {
  return (
    <FeatureBrowser
      endpoint="/lifts"
      kicker="Lift network"
      title="Ski Lifts"
      intro="Gondolas, chairlifts and surface lifts, with capacity where it is mapped."
      noun="lifts"
      typeFilter={LIFT_TYPE_FILTER}
      renderMeta={liftMeta}
    />
  );
}

export default Lifts;

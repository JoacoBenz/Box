import React from 'react';
import { Composition } from 'remotion';
import { BoxDemo, DURATION } from './BoxDemo';

export const Root: React.FC = () => (
  <Composition
    id="BoxDemo"
    component={BoxDemo}
    durationInFrames={DURATION}
    fps={30}
    width={1280}
    height={720}
  />
);

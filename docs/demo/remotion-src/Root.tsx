import React from 'react';
import { Composition } from 'remotion';
import { BoxDemo, DURATION } from './BoxDemo';
import { BoxDemoIG, DURATION_IG } from './BoxDemoIG';

export const Root: React.FC = () => (
  <>
    <Composition
      id="BoxDemo"
      component={BoxDemo}
      durationInFrames={DURATION}
      fps={30}
      width={1280}
      height={720}
    />
    <Composition
      id="BoxDemoIG"
      component={BoxDemoIG}
      durationInFrames={DURATION_IG}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);

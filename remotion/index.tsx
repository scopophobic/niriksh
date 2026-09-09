import {registerRoot, Composition} from 'remotion';
import {EvidenceChain} from './EvidenceChain';
import {LivingCaseFile} from './LivingCaseFile';
import {SignalOrbit} from './SignalOrbit';

const Root = () => <><Composition id="EvidenceChain" component={EvidenceChain} width={1920} height={1080} fps={60} durationInFrames={420} /><Composition id="LivingCaseFile" component={LivingCaseFile} width={1920} height={1080} fps={60} durationInFrames={420}/><Composition id="SignalOrbit" component={SignalOrbit} width={1920} height={1080} fps={60} durationInFrames={420}/></>;
registerRoot(Root);

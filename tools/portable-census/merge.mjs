import fs from 'fs';
const P='portable-census/census.json';
const c=JSON.parse(fs.readFileSync(P,'utf8'));
const v1=JSON.parse(fs.readFileSync('cov_v1.json','utf8')), v11=JSON.parse(fs.readFileSync('cov_v11.json','utf8'));
const f1=JSON.parse(fs.readFileSync('features_v1.json','utf8')), f11=JSON.parse(fs.readFileSync('features_v11.json','utf8'));
const strip=(b)=>{ const x={...b}; delete x.uncoveredApps; return x; };
c.coverage = {
  definition: 'An app is "fully covered" by a control set when every control it uses (sap.ui.core.mvc.View and sap.ui.core.FragmentDefinition excluded as document roots) is in the set. Ranking = number of core apps (samples+stack+addons) using the control, ties broken by samples-controls usage.',
  appCounts: v1.appCounts,
  rankCore: v1.rankCore,
  rankControlsCorpus: v1.rankControlsCorpus,
  curveByCoreRank: v1.curveByCoreRank,
  curveControlsByOwnRank: v1.curveControlsByOwnRank,
  greedyCoreCurve: v1.greedyCoreCurve,
  greedyCoreSteps: v1.greedyCore,
  greedyControlsCurve: v1.greedyControlsCurve,
  blockersAtTop40: strip(v1.blockersAtTop40),
  profileV1: { controls: JSON.parse(fs.readFileSync('v1.json','utf8')), controlCoverage: v1.proposal.coverage, blockersCore: strip(v1.proposal.blockersCore), uncoveredCoreApps: v1.proposal.blockersCore.uncoveredApps, blockersControls: v1.proposal.blockersControls, featureCoverage: { core: f1.core, samples: f1.samples, stack: f1.stack, addons: f1.addons, controls: f1.controls }, rules: f1.rules, supportedMembers: f1.supportedMembers },
  profileV1plusV11: { controls: JSON.parse(fs.readFileSync('v11.json','utf8')), controlCoverage: v11.proposal.coverage, blockersCore: strip(v11.proposal.blockersCore), featureCoverage: { core: f11.core, controls: f11.controls } },
};
fs.writeFileSync(P, JSON.stringify(c,null,1));
console.log((fs.statSync(P).size/1e6).toFixed(1),'MB');

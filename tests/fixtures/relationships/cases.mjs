// Synthetic evaluation cases for Skill 2. These are specifications, not real research.
const evidence=(id,text,context='Synthetic evaluation interview')=>({id,sourceId:`source-${id}`,text,locator:'Paragraph 1',context,limitations:[]});

export const relationshipCases=[
 {
  id:'REL-01',title:'Comparable claims can contradict',
  claims:[{id:'claim-a',text:'The same status label was understood during first use.',evidence:['e-a']},{id:'claim-b',text:'The same status label was not understood during first use.',evidence:['e-b']}],
  evidence:[evidence('e-a','I knew exactly what “queued” meant the first time.'),evidence('e-b','The first time, I thought “queued” meant the request was complete.')],
  expected:{decision:'retained',type:'contradiction',contextCheck:'Same feature and stage; participant perspectives remain distinct.',mustNotResolve:true},
 },
 {
  id:'REL-02',title:'Different stages are sequencing',
  claims:[{id:'claim-a',text:'People want an overview before starting.',evidence:['e-a']},{id:'claim-b',text:'People want detail after trying the workflow.',evidence:['e-b']}],
  evidence:[evidence('e-a','Before I start, show me the main steps.','Before task'),evidence('e-b','After trying it, I want the detailed explanation.','After task')],
  expected:{decision:'contextual_pattern',shape:'sequencing',retainedTension:false},
 },
 {
  id:'REL-03',title:'Role differences need consequential connection',
  claims:[{id:'claim-a',text:'Frontline staff need edit access.',evidence:['e-a']},{id:'claim-b',text:'Auditors need an unaltered record.',evidence:['e-b']}],
  evidence:[evidence('e-a','I correct the record while I am helping the client.','Frontline staff'),evidence('e-b','I need to see what the record said at the time of review.','Auditor')],
  expected:{decision:'retained',type:'perspective_conflict',contextCheck:'Different roles are explicit; the shared record makes the contrast consequential.',fallbackIfNoSharedConsequence:'contextual_variation'},
 },
 {
  id:'REL-04',title:'Expectation and reality stay distinct',
  claims:[{id:'claim-a',text:'The service promises a response within two days.',evidence:['e-a']},{id:'claim-b',text:'One participant waited nine days without an update.',evidence:['e-b']}],
  evidence:[evidence('e-a','We respond within two working days.','Published service standard'),evidence('e-b','It was nine days before I heard anything.','Participant interview')],
  expected:{decision:'retained',type:'expectation_reality_gap',mustKeepSourceTypesDistinct:true},
 },
 {
  id:'REL-05',title:'Weak support remains unresolved',
  claims:[{id:'claim-a',text:'Language may affect whether labels are understood.',evidence:['e-a']},{id:'claim-b',text:'The current study did not record language preference.',evidence:['e-b']}],
  evidence:[{...evidence('e-a','The labels were hard for me to follow.'),limitations:['One participant; language preference unknown.']},evidence('e-b','Language preference: not collected.','Study metadata')],
  expected:{decision:'retained',type:'unresolved_weak_evidence',mustStateLimitations:true,mustNotGeneralize:true},
 },
 {
  id:'REL-06',title:'A trivial difference is no meaningful tension',
  claims:[{id:'claim-a',text:'One interview occurred on Tuesday.',evidence:['e-a']},{id:'claim-b',text:'Another interview occurred on Wednesday.',evidence:['e-b']}],
  evidence:[evidence('e-a','Interview date: Tuesday.','Study metadata'),evidence('e-b','Interview date: Wednesday.','Study metadata')],
  expected:{decision:'rejected',type:'no_meaningful_tension',retainedTension:false,reason:'The date difference has no evidenced interpretive consequence.'},
 },
 {
  id:'REL-07',title:'Abstract value pairs are not research tensions',
  claims:[{id:'claim-a',text:'The team values autonomy.',evidence:['e-a']},{id:'claim-b',text:'The team values safety.',evidence:['e-b']}],
  evidence:[evidence('e-a','Autonomy is one of our workshop values.','Team workshop'),evidence('e-b','Safety is one of our workshop values.','Team workshop')],
  expected:{decision:'rejected',type:'no_meaningful_tension',retainedTension:false,reason:'The supplied material does not show that these values pull in different directions in this project.',forbiddenType:'value_tension'},
 },
 {
  id:'REL-08',title:'Human review and edits preserve history',
  claims:[{id:'claim-a',text:'Staff need edit access.',evidence:['e-a']},{id:'claim-b',text:'Auditors need an unaltered record.',evidence:['e-b']}],
  evidence:[evidence('e-a','I correct mistakes while helping the client.','Frontline staff'),evidence('e-b','I need the original entry for audit.','Auditor')],
  designerEvents:[{type:'edit_title',value:'Correcting records while retaining an audit trail'},{type:'partly_accept',reason:'Applies only to regulated cases.'},{type:'merge',targetId:'relationship-existing'}],
  expected:{origin:'dave_edited_by_researcher',originalSuggestionRetained:true,reviewReasonRetained:true,mergeIsExplicit:true,evidenceUnchanged:true},
 },
];

export const relationshipInvariantAssertions=[
 'Every claim reference and evidence reference resolves.',
 'Context and challenge are recorded before retention.',
 'Allowed retained types exclude value_tension.',
 'Sequencing, contextual variation, complementary needs, and no meaningful relationship are not displayed as accepted tensions.',
 'Researcher edits and rejection or merge decisions preserve the original and its provenance.',
 'No relationship text recommends a design response or decides which perspective is correct.',
];

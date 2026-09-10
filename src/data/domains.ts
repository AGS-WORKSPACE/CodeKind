/* The landing hero rotates through these. Add an entry here and it appears in the
   rotation, the domain rail and the search suggestions — no component changes needed. */

export type CodeBlock={type:'code';lines:string[]};
export type MeterBlock={type:'meters';items:[label:string,value:string,pct:number][]};
export type BarBlock={type:'bars';caption:string;items:[label:string,pct:number][]};
export type ListBlock={type:'list';items:[label:string,tag:string,tone:Tone][]};
export type SwatchBlock={type:'swatches';items:[label:string,color:string][]};
export type PanelBlock=CodeBlock|MeterBlock|BarBlock|ListBlock|SwatchBlock;
export type Tone='ok'|'warn'|'risk'|'idle';
export type DomainIcon='code'|'brain'|'chart'|'cloud'|'shield'|'pen';

export type Domain={
 id:string;
 /** Full name, used for labels and assistive text. */
 label:string;
 /** Short name for the domain rail chips. */
 chip:string;
 icon:DomainIcon;
 pill:string;
 headline:[lead:string,accent:string];
 blurb:string;
 search:string;
 theme:{accent:string;shell:string;bar:string;glow:string};
 panel:{file:string;blocks:PanelBlock[]};
 mentor:{initials:string;name:string;role:string;quote:string};
 next:{label:string;when:string};
};

export const domains:Domain[]=[
{
 id:'software',
 label:'Software Development',
 chip:'Software',
 icon:'code',
 pill:'Learn with working engineers',
 headline:['Learn to build software.','Ship what matters.'],
 blurb:'One-on-one lessons from engineers who teach the thinking behind good software — not just the syntax.',
 search:'Try “React”, “Python” or “system design”',
 theme:{accent:'#2f8f68',shell:'#0e211c',bar:'#173029',glow:'#b9f4d0'},
 panel:{file:'first-project.tsx',blocks:[
  {type:'code',lines:[
   '@kw{function} @fn{LearningJourney}() {',
   '  @kw{const} goal = @str{"Build confidently"};',
   '  @kw{const} support = @str{"1-on-1 mentoring"};',
   '',
   '  @kw{return} goal + support;',
   '}']}]},
 mentor:{initials:'MC',name:'Maya',role:'React tutor',quote:'Great instinct. Now let’s make it reusable.'},
 next:{label:'Next lesson',when:'Today · 6:00 PM'},
},
{
 id:'ai',
 label:'AI & Machine Learning',
 chip:'AI & ML',
 icon:'brain',
 pill:'Learn with practising ML engineers',
 headline:['Train real models.','Know every layer.'],
 blurb:'Go from first notebook to a model in production, guided by people who fine-tune and evaluate AI systems for a living.',
 search:'Try “fine-tuning”, “PyTorch” or “RAG pipelines”',
 theme:{accent:'#6552e6',shell:'#161230',bar:'#221c45',glow:'#cfc7ff'},
 panel:{file:'finetune.ipynb',blocks:[
  {type:'code',lines:[
   '@kw{from} transformers @kw{import} Trainer',
   '',
   'trainer = @fn{Trainer}(model, @var{args}=cfg)',
   'trainer.@fn{train}()  @cm{# epoch 3 of 3}']},
  {type:'meters',items:[['Validation accuracy','94.2%',94],['Training loss','0.18',18]]}]},
 mentor:{initials:'RM',name:'Ravi',role:'ML engineer',quote:'Your loss curve is flattening — let’s talk learning rate.'},
 next:{label:'Next session',when:'Tomorrow · 9:30 AM'},
},
{
 id:'data',
 label:'Data & Analytics',
 chip:'Data',
 icon:'chart',
 pill:'Learn with analysts who ship dashboards',
 headline:['Read the data.','Make the call.'],
 blurb:'Turn raw tables into decisions with trainers who model, visualise and defend real business numbers every week.',
 search:'Try “SQL”, “Power BI” or “experiment design”',
 theme:{accent:'#1c74bd',shell:'#0c1e31',bar:'#153048',glow:'#bfdfff'},
 panel:{file:'retention.dash',blocks:[
  {type:'bars',caption:'Cohort retention · weeks since signup',items:[['W1',100],['W2',68],['W3',54],['W4',47],['W5',41],['W6',38]]},
  {type:'meters',items:[['Confidence interval','±3.1pt',72]]}]},
 mentor:{initials:'AD',name:'Amara',role:'Analytics lead',quote:'The dip is real — now show me why it happens in week three.'},
 next:{label:'Next session',when:'Thursday · 5:00 PM'},
},
{
 id:'cloud',
 label:'Cloud & DevOps',
 chip:'Cloud & DevOps',
 icon:'cloud',
 pill:'Learn with on-call engineers',
 headline:['Run it in production.','Sleep at night.'],
 blurb:'Pipelines, containers and incident response taught by the people who keep real systems online at 3am.',
 search:'Try “Kubernetes”, “Terraform” or “CI/CD”',
 theme:{accent:'#b96b1c',shell:'#231607',bar:'#35230e',glow:'#ffdcb0'},
 panel:{file:'deploy.pipeline',blocks:[
  {type:'list',items:[
   ['build · container image','passed','ok'],
   ['test · 248 specs','passed','ok'],
   ['deploy · eu-west-1','running','warn'],
   ['smoke · health checks','queued','idle']]},
  {type:'meters',items:[['Rollout progress','62%',62]]}]},
 mentor:{initials:'TR',name:'Tomás',role:'Platform engineer',quote:'Before we scale it, tell me what you’d roll back to.'},
 next:{label:'Next session',when:'Today · 8:15 PM'},
},
{
 id:'security',
 label:'Cybersecurity',
 chip:'Security',
 icon:'shield',
 pill:'Learn with security practitioners',
 headline:['Break it safely.','Then lock it down.'],
 blurb:'Threat modelling, secure code review and hands-on labs led by defenders who work real incidents.',
 search:'Try “threat modelling”, “OWASP” or “SOC analysis”',
 theme:{accent:'#a8405a',shell:'#250f18',bar:'#391a26',glow:'#ffcdda'},
 panel:{file:'threat-model.md',blocks:[
  {type:'list',items:[
   ['Broken access control','critical','risk'],
   ['Outdated dependency','medium','warn'],
   ['Secrets in CI logs','patched','ok'],
   ['TLS configuration','passed','ok']]},
  {type:'meters',items:[['Findings resolved','2 of 4',50]]}]},
 mentor:{initials:'NK',name:'Nadia',role:'Security engineer',quote:'Good find. Now write the fix and the detection rule.'},
 next:{label:'Next lab',when:'Saturday · 11:00 AM'},
},
{
 id:'design',
 label:'Product & UX Design',
 chip:'Design',
 icon:'pen',
 pill:'Learn with working product designers',
 headline:['Design with intent.','Prove it with users.'],
 blurb:'Research, interface craft and design systems taught through honest critique of work you actually ship.',
 search:'Try “design systems”, “Figma” or “UX research”',
 theme:{accent:'#9a3f92',shell:'#210f29',bar:'#33193c',glow:'#f3ccef'},
 panel:{file:'design-system',blocks:[
  {type:'swatches',items:[['Ink','#10251f'],['Mint','#b9f4d0'],['Coral','#ff8c5a'],['Sand','#ffe8a3'],['Paper','#fbfcf8']]},
  {type:'list',items:[
   ['Type scale','1.25 major third','idle'],
   ['Grid','12 col · 24 gutter','idle'],
   ['Colour contrast','AA verified','ok']]}]},
 mentor:{initials:'HB',name:'Hannah',role:'Product designer',quote:'It looks calm. Now defend every spacing decision.'},
 next:{label:'Next critique',when:'Monday · 4:00 PM'},
},
];

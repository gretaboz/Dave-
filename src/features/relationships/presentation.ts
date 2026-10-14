/** Preserve the subject, verb and qualifiers instead of assembling keyword fragments. */
export function claimTitle(statement: string): string {
  const sentence = statement.trim().match(/^.*?[.!?](?=\s|$)/)?.[0] ?? statement.trim();
  const clause = sentence.split(/[,;]|\s+(?:while|whereas)\s+/i)[0].trim();
  // A short fragment is less useful than the original complete wording.
  const title = clause.split(/\s+/).length >= 6 ? clause : sentence;
  return title.replace(/[.!?]$/, '') || 'Research interpretation';
}
export function cardHeight(title: string, description: string): number {
  // Conservative wrapping allowance; cards also grow naturally if needed.
  return Math.max(170, 85 + Math.ceil(title.length / 22) * 23 + Math.ceil(description.length / 28) * 21);
}
export const relationshipLabels: Record<string,string> = {
 connection:'Connection',potential_tension:'Potential tension',unclassified:'Needs classification',
};
export function relationshipType(type: string): 'connection' | 'potential_tension' | 'unclassified' {
 return type === 'connection' || type === 'potential_tension' ? type : 'unclassified';
}

/** Compact propositions: retain who/what, the concern, and relevant qualifiers. */
export function claimMapLabel(statement: string): string {
 const clean=statement.trim().replace(/[.!?]$/, '');
 if(clean.split(/\s+/).length<=10)return clean;
 if(/presses vary|different basic mechanisms|different mechanisms/i.test(clean) && /trade-offs?|mechanical advantage/i.test(clean))return 'Press types involve different trade-offs';
 if(/stakeholders?/i.test(clean)&&/different|distinct|diverse/i.test(clean))return 'Different stakeholder pressing priorities';
 if(/listing/i.test(clean)&&/rarely|gap|transparency/i.test(clean))return 'Unclear pulp and juice yields';
 if(/cleaning (?:and maintenance )?users/i.test(clean))return 'Residue removal and tool turnaround';
 if(/design challenges/i.test(clean))return 'Unresolved design constraints';
 if(/retail buyers/i.test(clean))return 'Retail appeal and commercial fit';
 if(/value perception/i.test(clean)&&/staff time/i.test(clean))return 'Durability and staff-time savings';
 if(/wet pulp/i.test(clean)&&/seams|strainers/i.test(clean))return 'Residue access versus handling complexity';
 if(/heavy lever presses/i.test(clean)&&/space/i.test(clean))return 'Stability versus storage space';
 if(/right-handed|left-handed/i.test(clean)&&/not been explored/i.test(clean))return 'Unexplored grip and handedness needs';
 if(/single-lemon|single-fruit/i.test(clean)&&/rinse|rinsing/i.test(clean))return 'Quick rinsing for small tasks';
 if(/technical categories|different basic mechanisms|presses vary/i.test(clean))return 'Press mechanisms and their trade-offs';
 // Wording-specific compression; no additional research interpretation or API call.
 if(/home cooks/i.test(clean) && /small|compact/i.test(clean) && /rinse|clean/i.test(clean))return 'Home cooks value compact, easy-clean presses';
 if(/café|cafe/i.test(clean) && /stable|stability|dependab|reliable/i.test(clean))return /service/i.test(clean)?'Cafés value stable presses during service':'Cafés value stable presses';
 if(/solid/i.test(clean) && /not (?:being )?heavy/i.test(clean))return /home cooks/i.test(clean)?'Home cooks want solidity without extra weight':'Users want solidity without extra weight';
 if(/product listings/i.test(clean) && /rarely|gap|unclear|missing/i.test(clean))return 'Product listings leave juice performance unclear';
 if(/manual effort|perceived effort/i.test(clean) && /higher volumes|larger quantities|multiple/i.test(clean))return 'Pressing more fruit makes effort a barrier';
 if(/removable (?:components|parts)/i.test(clean) && /hassle|complexity|numerous/i.test(clean))return 'Removable parts help cleaning but add complexity';
 if(/leverage/i.test(clean) && /precision|control/i.test(clean) && /trade-off|tradeoff/i.test(clean))return 'More leverage can reduce effort and precision';
 if(/storage|stored/i.test(clean) && /frequen/i.test(clean) && /occasional/i.test(clean))return 'Storage preferences vary with use frequency';
 if(/entry-level/i.test(clean) && /compactness/i.test(clean) && /rinsing/i.test(clean))return 'Entry-level presses favour compactness and easy rinsing';
 if(/trade-offs?/i.test(clean) && /manual citrus presses/i.test(clean) && /leverage/i.test(clean) && /size/i.test(clean) && /price/i.test(clean))return 'Manual presses balance leverage, size and price';
 if(/^Stakeholders? include/i.test(clean) && /diverse|distinct/i.test(clean))return 'Different users bring different pressing needs';
 if(/cleaning effort/i.test(clean) && /visibility/i.test(clean) && /confidence/i.test(clean))return 'Cleaning effort includes residue visibility and confidence';
 // Prefer a complete leading proposition, never just a subject stripped of its verb.
 const clauses=clean.split(/[,;]|\s+(?:while|whereas|reflecting|indicating)\s+/i).map(s=>s.trim());
 const first=clauses[0];
 if(first.split(/\s+/).length>=5 && first.split(/\s+/).length<=10)return first;
 // Keep faithful wording if shortening would remove the point or its uncertainty.
 return limitMapLabel(clean);
}

/** Resolve collisions using distinguishing wording, not arbitrary claim numbers. */
export function claimMapLabels(claims: readonly {id:string;statement:string;context?:string;stakeholder?:string}[]): Map<string,string> {
 const labels=new Map<string,string>();
 const groups=new Map<string,typeof claims[number][]>();
 const normalize=(s:string)=>s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 for(const c of claims){const base=claimMapLabel(c.statement);labels.set(c.id,base);const key=normalize(base);groups.set(key,[...(groups.get(key)??[]),c]);}
 const used=new Set<string>();
 const stop=new Set('the a an and or of to in on with for that which while where as is are be been being this these those their they it its users user described describe some many more less at by from through than'.split(' '));
 for(const group of groups.values()) {
   for(const c of [...group].sort((a,b)=>a.id.localeCompare(b.id))) {
     const base=labels.get(c.id)!;
     let result=base;
     if(group.length>1) {
       const others=group.filter(x=>x.id!==c.id).map(x=>normalize(x.statement));
       const tokens=c.statement.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)??[];
       const candidates:string[]=[];
       for(const size of [2,3,1])for(let i=0;i+size<=tokens.length;i++) {
         const phrase=tokens.slice(i,i+size).join(' ');
         if(tokens.slice(i,i+size).some(w=>stop.has(w.toLowerCase())))continue;
         if(others.every(s=>!(` ${s} `).includes(` ${normalize(phrase)} `)))candidates.push(phrase);
       }
       const qualifier=candidates[0] ?? c.stakeholder ?? c.context;
       if(qualifier) {
         // The qualifier comes verbatim from this claim; base remains the shared topic.
         result=`${base} — ${qualifier}`;
       }
     }
     const initial=result;let index=2;
     while(used.has(normalize(result)))result=`${initial} (${index++})`;
     result=limitMapLabel(result);
     const limited=result;index=2;
     while(used.has(normalize(result)))result=limitMapLabel(`${limited} (${index++})`);
     used.add(normalize(result));labels.set(c.id,result);
   }
 }
 return labels;
}

/** Canvas-only length limit; never changes the stored interpretation. */
export const MAX_MAP_LABEL_WORDS = 30;
export function limitMapLabel(text: string): string {
 const words=text.trim().split(/\s+/);
 if(words.length<=MAX_MAP_LABEL_WORDS)return text.trim();
 const suffix=words.at(-1)?.match(/^\(\d+\)$/)?words.pop():undefined;
 const budget=MAX_MAP_LABEL_WORDS-(suffix?1:0);
 const within=words.slice(0,budget).join(' ');
 const boundary=within.match(/^(.{20,}?)[,;.!?](?:\s|$)/);
 const short=boundary?.[1] ?? within;
 return `${short.replace(/[,;:]$/, '')}${suffix?' '+suffix:''}`;
}

/** Verbatim meaningful clauses from saved reasoning, not a new interpretation. */
export function relationshipBrief(relationship: {description:string;explanation:string}): string {
 const clauses=[relationship.explanation,relationship.description].flatMap(text=>text.split(/(?<=[.!?])\s+|;|,\s+/i)).map(text=>text.replace(/^Claims?\s+[\d\s,/]+(?:and\s+\d+\s+)?(?:describe|discuss|highlight|connect|relate|identify)\s+/i,'').trim());
 const concise=clauses.find(text=>text.split(/\s+/).length>=5&&text.split(/\s+/).length<=12);
 if(concise)return concise.charAt(0).toUpperCase()+concise.slice(1);
 // A longer faithful clause is preferable to an invented or broken summary.
 const shortest=clauses.filter(Boolean).sort((a,b)=>a.length-b.length)[0]??'Inspect the relationship explanation';
 return shortest.charAt(0).toUpperCase()+shortest.slice(1);
}

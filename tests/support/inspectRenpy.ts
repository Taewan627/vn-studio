/** Independent, deliberately limited inspection of the emitted script subset.
 * Not the Ren'Py parser, linter, engine, or a playback simulator.
 */
export function inspectRenpy(script: string) {
  const labels = new Map<string, { kind: string; text?: string; target?: string; image?: string; speaker?: string }[]>();
  const images = new Map<string,string>();
  const characters = new Map<string,string>();
  const targets: string[] = [];
  const shown: string[] = [];
  let current: string | undefined;
  let menuText: string | undefined;
  const literal = '"(?:[^"\\\\]|\\\\.)*"';
  const decode = (source: string) => (JSON.parse(source) as string).replace(/\[\[/g,'[').replace(/\{\{/g,'{');
  const unique = <T>(map: Map<string,T>,key: string,value: T) => { if(map.has(key))throw Error('Duplicate declaration '+key);map.set(key,value); };
  for (const line of script.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    let match: RegExpMatchArray | null;
    if ((match=line.match(new RegExp('^image ([a-z][a-z0-9_]*(?: [a-z][a-z0-9_]*)?) = ('+literal+')$')))) {
      unique(images,match[1],JSON.parse(match[2]));continue;
    }
    if ((match=line.match(new RegExp('^define ([a-z][a-z0-9_]*) = Character\\(('+literal+')\\)$')))) {
      unique(characters,match[1],decode(match[2]));continue;
    }
    if ((match=line.match(/^label ([a-z][a-z0-9_]*):$/))) {
      if(menuText!==undefined)throw Error('Unfinished choice');current=match[1];unique(labels,current,[]);continue;
    }
    if (!current)throw Error('Statement outside label');
    const body=labels.get(current)!;
    if ((match=line.match(/^    jump ([a-z][a-z0-9_]*)$/))) {body.push({kind:'jump',target:match[1]});targets.push(match[1]);continue;}
    if (line==='    menu:') {body.push({kind:'menu'});continue;}
    if ((match=line.match(new RegExp('^        ('+literal+'):$')))) {
      if(menuText!==undefined)throw Error('Unfinished choice');menuText=decode(match[1]);continue;
    }
    if ((match=line.match(/^            jump ([a-z][a-z0-9_]*)$/))) {
      if(menuText===undefined)throw Error('Choice jump without text');body.push({kind:'choice',text:menuText,target:match[1]});
      targets.push(match[1]);menuText=undefined;continue;
    }
    if ((match=line.match(/^    scene(?: ([a-z][a-z0-9_]*) with fade)?$/))) {
      body.push({kind:'scene',image:match[1]});if(match[1])shown.push(match[1]);continue;
    }
    if ((match=line.match(/^    hide ([a-z][a-z0-9_]*)$/))) {body.push({kind:'hide',image:match[1]});continue;}
    if ((match=line.match(/^    show ([a-z][a-z0-9_]* [a-z][a-z0-9_]*)(?: at (?:left|right|center|truecenter))? with dissolve$/))) {
      body.push({kind:'show',image:match[1]});shown.push(match[1]);continue;
    }
    if(line==='    return'){body.push({kind:'return'});continue;}
    if ((match=line.match(new RegExp('^    (?:([a-z][a-z0-9_]*) )?('+literal+')$')))) {
      if(match[1]&&!characters.has(match[1]))throw Error('Unknown speaker');body.push({kind:'say',speaker:match[1],text:decode(match[2])});continue;
    }
    throw Error('Outside inspected RenPy subset: '+line);
  }
  if(menuText!==undefined)throw Error('Unfinished choice');
  if(!labels.has('start'))throw Error('Missing start label');
  for(const target of targets)if(!labels.has(target))throw Error('Unresolved jump '+target);
  for(const image of shown)if(!images.has(image))throw Error('Undeclared image '+image);
  return { labels, images, characters, targets };
}

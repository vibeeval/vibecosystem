#!/usr/bin/env node
// Deterministic vector sources. No rendered terminal output or execution claims.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const defaultDesc = 'Core is the default runtime. Dashboard, quality, context, memory and orchestration are optional profiles. Catalog size is different from active context.';
const frame = (title, body, desc = defaultDesc) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
<title id="title">${title}</title><desc id="desc">${desc}</desc>
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#121322"/><stop offset="1" stop-color="#221a38"/></linearGradient><linearGradient id="accent"><stop stop-color="#b5a0ff"/><stop offset="1" stop-color="#ddd2ff"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<g fill="#f4f0ff" font-family="Arial, Helvetica, sans-serif">${body}</g>
</svg>\n`;
const label = (x,y,text,size=22,fill='#d5cfe5',weight=400) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text>`;
const card = (x,y,w,h,heading,subtitle,accent=false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${accent?'#30244c':'#1c1d30'}" stroke="${accent?'#bba4ff':'#484159'}" stroke-width="${accent?2:1}"/>${label(x+24,y+41,heading,24,accent?'#ddd0ff':'#f4f0ff',700)}${label(x+24,y+72,subtitle,16)}`;
writeFileSync(join(root,'runtime-overview.svg'),frame('vibecosystem runtime profiles',`
${label(62,58,'vibecosystem',32,'#cab7ff',700)}
${label(62,108,'Keep the default path focused.',44,'#ffffff',700)}
${label(62,146,'Select capabilities for the task. Inspect what is active.',23)}
${card(62,168,500,96,'core · default','Investigate → implement → review → verify',true)}
${card(600,168,250,88,'quality','Focused edit checks')}
${card(874,168,264,88,'context','Targeted retrieval')}
${card(600,268,250,88,'memory','Persistent recall')}
${card(874,268,264,88,'orchestration','Explicit agent workflows')}
${label(86,294,'Bounded optional hook context',23,'#d9ccff',700)}
${label(86,326,'4,000 characters / event',21)}
${label(86,356,'12,000 characters / session',21)}
${label(600,388,'dashboard · optional local activity monitor',19)}
<path d="M562 216 H580 V312 H600 M580 212 H600" fill="none" stroke="#8f78c9" stroke-width="2"/>
<path d="M62 404 H1138" stroke="#484159"/>
${card(62,418,526,100,'Catalog (in repo)','138 agents · 296 skills · 74 hooks · 20 rules')}
${card(612,418,526,100,'Default core','12 agents · 32 skills · 6 hooks')}
${label(62,546,'full (opt-in): 138 agents, 296 skills, 20 rules, 53 of 74 hooks',22,'#ddd0ff',700)}
${label(62,576,'Catalog size ≠ active context ≠ model token bill',22)}
${label(62,608,'Conceptual diagram · not a recording of automated execution',17,'#9d96b1')}
`,'Core is the default runtime. Catalog (in repo) has 138 agents, 296 skills, 74 hooks and 20 rules. Default core has 12 agents, 32 skills and 6 hooks. The full profile installs 138 agents, 296 skills, 20 rules and 53 of the 74 hooks. Catalog size is different from active context.'));
writeFileSync(join(root,'social-preview.svg'),frame('vibecosystem — core by default',`
<rect x="62" y="58" width="72" height="72" rx="20" fill="#baa1ff"/>
<path d="M79 79 L98 111 L117 79" fill="none" stroke="#20172e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
${label(158,107,'vibecosystem',43,'#eee5ff',700)}
${label(62,226,'A focused coding runtime.',62,'#ffffff',700)}
${label(62,291,'Core by default.',62,'#cbb3ff',700)}
${label(62,360,'Claude Code components · bounded Codex worker',28)}
${card(62,414,332,98,'Select the profile','Keep routine work small',true)}
${card(418,414,332,98,'Bound the context','Measure the actual fixture')}
${card(774,414,364,98,'Verify the result','Keep source and bundles aligned')}
${label(62,584,'github.com/vibeeval/vibecosystem',22,'#b0a5c5')}
`));

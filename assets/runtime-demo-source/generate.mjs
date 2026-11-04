import './source-data.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const data = JSON.parse(readFileSync(new URL('./profile-data.json', import.meta.url), 'utf8'));
const core = data.profiles.find(p=>p.name==='core');
let html=readFileSync(new URL('./compositions/profiles.template.html', import.meta.url),'utf8');
const values={version:data.version,agents:core.agents,skills:core.skills,hooks:core.hooks,eventBudget:core.contextBudget.perEventChars.toLocaleString('en-US'),sessionBudget:core.contextBudget.sessionChars.toLocaleString('en-US')};
for(const [key,value] of Object.entries(values)) html=html.replaceAll(`{{${key}}}`,String(value));
if(/\{\{/.test(html)) throw new Error('Unresolved composition template value');
writeFileSync(new URL('./compositions/profiles.html', import.meta.url),html);

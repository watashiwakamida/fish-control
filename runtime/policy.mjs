import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
export const root=process.env.FISH_ROOT||'D:/DeepSeekCompanion';
export const home=process.env.DSH_HOME||join(root,'data/dsh');
export const policyFile=join(home,'fish-control.json');
export function readJson(path,fallback){try{return JSON.parse(readFileSync(path,'utf8'));}catch{return fallback;}}
export function atomic(path,value){writeFileSync(path+'.tmp',JSON.stringify(value,null,2));renameSync(path+'.tmp',path);}
export function policy(){const p=readJson(policyFile,{});return {...p,enabled:p.enabled===true,open:p.open===true};}
export function enabled(){return policy().enabled;}
export function accepts(p,sender,owner){return p.enabled===true&&(String(sender)===String(owner)||p.open===true);}
export function publicAllowed(p){return p.enabled===true&&p.open===true;}
export function fresh(p,time,publicChat=false){return Number(time)*1000 >= Number(publicChat?p.publicSince:p.enabledSince);}

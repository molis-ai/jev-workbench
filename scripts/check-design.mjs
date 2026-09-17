import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const assert=(v,m)=>{if(!v)throw new Error(m)};
mkdirSync('.impeccable/review/single-page',{recursive:true});
await page.goto('http://127.0.0.1:17431');
for(const kind of ['Noul','Choice','Score']){
 await page.locator('.design-rail [data-kind="'+kind.toLowerCase()+'"]').click();
 await page.getByRole('button',{name:'运行测试',exact:true}).click();
 await page.getByText('模拟结果',{exact:true}).waitFor();
 await page.screenshot({path:'.impeccable/review/single-page/'+kind.toLowerCase()+'.png',fullPage:true});
}
await page.locator('.design-rail [data-kind="noul"]').click();
await page.locator('#claim').fill('这是保留的用户编辑');
await page.getByRole('button',{name:'English',exact:true}).click();
assert(await page.locator('#claim').inputValue()==='这是保留的用户编辑','Language lost user edits');
await page.getByRole('button',{name:'Save draft',exact:true}).click();
await page.reload();assert(await page.locator('#claim').inputValue()==='这是保留的用户编辑','Save failed');
await page.locator('#scenario').selectOption('unclear');
await page.getByRole('button',{name:'Run test',exact:true}).click();
await page.getByText('Needs review',{exact:true}).waitFor();
await page.locator('#scenario').selectOption('failure');
await page.getByRole('button',{name:'Run test',exact:true}).click();
await page.getByRole('alert').waitFor();
await page.locator('#input').fill('');await page.getByRole('button',{name:'Run test',exact:true}).click();
assert((await page.getByRole('alert').innerText()).includes('Add input'),'Missing input state');
await page.locator('.design-rail [data-kind="choice"]').click();
await page.getByRole('button',{name:'Run test',exact:true}).click();
await page.getByText('Simulated result',{exact:true}).waitFor();
await page.locator('#connect summary').click();
await page.getByRole('button',{name:'Preview release',exact:true}).click();
assert((await page.locator('#release').innerText()).includes('preview_only'),'Not labelled preview');
await page.getByRole('button',{name:'MCP',exact:true}).click();
assert((await page.locator('#code').innerText()).includes('jev_invoke'),'MCP example missing');
await page.screenshot({path:'.impeccable/review/single-page/english.png',fullPage:true});
for(const width of [1440,768,390]){
 await page.setViewportSize({width,height:900});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);
 if(width===390)await page.screenshot({path:'.impeccable/review/single-page/mobile.png',fullPage:true});
}
assert(!errors.length,errors.join('\n'));await browser.close();console.log('PASS: 3 primitives, language preservation, local save, review/error/empty, inline release/MCP, 3 widths.');

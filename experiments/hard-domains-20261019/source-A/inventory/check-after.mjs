import {wallet} from './after.mjs';
const g=(receipt,amount=7)=>({kind:'grant',receipt,amount});const v=(receipt,amount=7)=>({kind:'void',receipt,amount});
const cases=[['retry-grant',[g('a'),g('a')],7],['retry-void',[g('a'),v('a'),v('a')],0],['distinct-receipts',[g('a'),g('b')],14],['reverse-recorded-effect',[g('a'),v('a',99)],0],['unknown-void-no-future-effect',[v('a'),g('a')],7],['retry-after-void',[g('a'),v('a'),g('a')],0]];
console.log(JSON.stringify(cases.map(([id,input,expected])=>{let actual;try{actual=wallet(input)}catch(e){actual={error:e.message}}return {id,input,expected,actual,passed:actual===expected}})));

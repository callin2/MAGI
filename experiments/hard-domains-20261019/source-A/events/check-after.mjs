import {latest} from './after.mjs';
const r=(device,observed_ms,value,reading_id)=>({device,observed_ms,value,reading_id});const a=r('a',100,10,'z'),b=r('a',50,5,'b'),c=r('a',100,11,'y');
const cases=[['late-arrival',[a,b],{a:10}],['reordered',[b,a],{a:10}],['retry',[a,a],{a:10}],['stable-tie',[a,c],{a:10}],['tie-permutation',[c,a],{a:10}],['independent-device',[a,r('b',1,9,'a'),b],{a:10,b:9}]];
console.log(JSON.stringify(cases.map(([id,input,expected])=>{const actual=latest(input);return {id,input,expected,actual,passed:JSON.stringify(actual)===JSON.stringify(expected)}})));

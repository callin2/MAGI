export function wallet(messages){let balance=0;for(const m of messages)balance+=(m.kind==='grant'?1:-1)*m.amount;return balance;}

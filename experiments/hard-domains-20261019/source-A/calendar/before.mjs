export function alarm(local,zone){return Date.parse(local+'Z');} export function overlaps(a,b){return a.start<=b.end&&b.start<=a.end;}

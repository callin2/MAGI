export function latest(readings){const state={};for(const r of readings)state[r.device]=r.value;return state;}

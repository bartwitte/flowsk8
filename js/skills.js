// Street skills: wat je in het echt hebt geland (gefilmd + "geland" gemarkeerd)
// bepaalt wat je in de game unlockt.
import { getAllClips } from './db.js';

export async function getStreetSkills() {
  const clips = await getAllClips();
  const landed = clips.filter(c => c.landed);
  const byTrick = {};
  for (const c of landed) {
    const t = (c.trick || '').toLowerCase().trim();
    if (t) byTrick[t] = (byTrick[t] || 0) + 1;
  }
  const obstacles = new Set(landed.map(c => c.obstacle).filter(Boolean));
  const names = Object.keys(byTrick);
  return {
    landedCount: landed.length,
    distinct: names,
    byTrick,
    obstacles,
    hasTrick: name => names.some(t => t.includes(name)),
    hasGrind: () =>
      names.some(t => t.includes('grind') || t.includes('slide')) ||
      obstacles.has('ledge') || obstacles.has('rail'),
  };
}

// Requirement: alle velden moeten kloppen (AND).
// { landed: 5, distinct: 3, trick: 'kickflip', anyTrick: ['kickflip','heelflip'], grind: true }
export function checkReq(req, s) {
  if (!req) return true;
  if (req.landed && s.landedCount < req.landed) return false;
  if (req.distinct && s.distinct.length < req.distinct) return false;
  if (req.trick && !s.hasTrick(req.trick)) return false;
  if (req.anyTrick && !req.anyTrick.some(t => s.hasTrick(t))) return false;
  if (req.grind && !s.hasGrind()) return false;
  return true;
}

export function describeReq(req) {
  if (!req) return 'altijd beschikbaar';
  const parts = [];
  if (req.trick) parts.push(`land een ${req.trick}`);
  if (req.anyTrick) parts.push(`land een ${req.anyTrick.join(' of ')}`);
  if (req.grind) parts.push('land een grind of slide (ledge of rail telt)');
  if (req.landed) parts.push(`land ${req.landed} clip${req.landed === 1 ? '' : 's'}`);
  if (req.distinct) parts.push(`${req.distinct} verschillende tricks`);
  return parts.join(' én ');
}

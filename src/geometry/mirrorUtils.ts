import type { CoilDefinition } from '../types/coil';
import { generateId } from '../utils/id';

type MirrorPlane = 'xy' | 'xz' | 'yz';

export function mirrorCoil(coil: CoilDefinition, plane: MirrorPlane): CoilDefinition {
  const [px, py, pz] = coil.transform.position;
  const [rx, ry, rz] = coil.transform.rotation;
  let position: [number,number,number], rotation: [number,number,number];
  switch (plane) {
    case 'xy': position=[px,py,-pz]; rotation=[rx,ry,-rz]; break;
    case 'xz': position=[px,-py,pz]; rotation=[rx,-ry,rz]; break;
    case 'yz': position=[-px,py,pz]; rotation=[-rx,ry,rz]; break;
  }
  return { ...coil, id: generateId('coil'), name: `${coil.name} (mirror)`, transform: { ...coil.transform, position, rotation } };
}

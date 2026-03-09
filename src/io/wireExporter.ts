import type { WireExportFile, WireExportCoil, WireExportTurn } from '../types/export';
import type { CoilDefinition } from '../types/coil';
import type { ExpandedCoilGeometry } from '../types/geometry';

export function buildWireExport(
  coils: CoilDefinition[],
  geometries: ExpandedCoilGeometry[]
): WireExportFile {
  const geoMap = new Map(geometries.map(g => [g.coilId, g]));

  const exportCoils: WireExportCoil[] = coils.map(coil => {
    const geo = geoMap.get(coil.id);
    const turns: WireExportTurn[] = (geo?.turns ?? []).map(t => {
      const pts: [number, number, number][] = [];
      for (let i = 0; i < t.points.length; i += 3) {
        pts.push([t.points[i], t.points[i+1], t.points[i+2]]);
      }
      return {
        turnIndex: t.turnIndex,
        layerIndex: t.layerIndex,
        arcLength: t.arcLength,
        closed: t.closed,
        points: pts,
      };
    });

    return {
      id: coil.id,
      name: coil.name,
      currentAmps: coil.currentAmps,
      currentDirection: coil.winding.currentDirection,
      conductorOuterDiameter: coil.conductor.outerDiameter,
      totalTurns: coil.winding.turns * coil.winding.layers,
      totalWireLength: geo?.totalWireLength ?? 0,
      turns,
    };
  });

  return {
    version: '1.0',
    schema: 'coil-geometry-editor-wires',
    meta: {
      units: 'meters',
      coordinateSystem: 'right-hand',
      exportedAt: new Date().toISOString(),
    },
    coils: exportCoils,
  };
}

export function downloadWireExport(
  coils: CoilDefinition[],
  geometries: ExpandedCoilGeometry[]
): void {
  const data = buildWireExport(coils, geometries);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wires.coilwires.json';
  a.click();
  URL.revokeObjectURL(url);
}

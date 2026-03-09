import { useEditorStore } from '../../stores/useEditorStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { CoilSimplified } from './CoilSimplified';
import { CoilSampledTurns } from './CoilSampledTurns';
import { CoilFullWire } from './CoilFullWire';
import type { CoilDefinition } from '../../types/coil';

interface Props {
  coil: CoilDefinition;
  onClick: (id: string, additive: boolean) => void;
}

export function CoilObject({ coil, onClick }: Props) {
  const displayMode = useEditorStore(s => s.renderOptions.displayMode);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const geo = useSceneStore(s => s.expandedGeometry[coil.id]);
  const selected = selectedIds.includes(coil.id);

  if (!coil.visible) return null;

  const handleClick = (e: { nativeEvent: MouseEvent }) => {
    e.nativeEvent.stopPropagation?.();
    onClick(coil.id, e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
  };

  return (
    <group onClick={handleClick}>
      {displayMode === 'simplified' && (
        <CoilSimplified coil={coil} geo={geo} selected={selected} />
      )}
      {displayMode === 'sampled_turns' && geo && (
        <CoilSampledTurns coil={coil} geo={geo} selected={selected} />
      )}
      {displayMode === 'sampled_turns' && !geo && (
        <CoilSimplified coil={coil} geo={undefined} selected={selected} />
      )}
      {displayMode === 'full_explicit_wire' && geo && (
        <CoilFullWire coil={coil} geo={geo} selected={selected} />
      )}
      {displayMode === 'full_explicit_wire' && !geo && (
        <CoilSimplified coil={coil} geo={undefined} selected={selected} />
      )}
    </group>
  );
}

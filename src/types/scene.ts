export interface GroupNode {
  kind: 'group';
  id: string;
  name: string;
  /** Ordered IDs of direct children (coil IDs or group IDs) */
  childIds: string[];
  expanded: boolean;
}

export interface CoilNode {
  kind: 'coil';
  id: string;
  /** Points to a CoilDefinition */
  coilId: string;
}

export type SceneItem = GroupNode | CoilNode;

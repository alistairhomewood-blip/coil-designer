import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SceneRoot } from './SceneRoot';
import { useCoilExpansion } from '../../hooks/useCoilExpansion';
import { useBFieldPreview } from '../../hooks/useBFieldPreview';
import styles from './Viewport.module.css';

function ViewportInner() {
  useCoilExpansion();
  useBFieldPreview();
  return <SceneRoot />;
}

export function Viewport() {
  return (
    <div className={styles.wrap}>
      <Canvas
        camera={{ position: [0.3, 0.3, 0.4], fov: 50, near: 0.001, far: 100 }}
        gl={{ antialias: true }}
        shadows
      >
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
        <ViewportInner />
      </Canvas>
    </div>
  );
}

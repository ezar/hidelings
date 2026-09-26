import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ALL_SPECIES, SPECIES } from '../engine/species';
import { creatureForExport } from './usdz';

describe('creatureForExport', () => {
  it.each(ALL_SPECIES)('builds %s with standard materials, standing on the floor at a real size', species => {
    const scene = creatureForExport(species);
    const box = new THREE.Box3();
    let meshes = 0;
    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      let parent: THREE.Object3D | null = m.parent;
      while (parent) { if (!parent.visible) return; parent = parent.parent; }
      meshes++;
      expect((m.material as THREE.Material).type).toBe('MeshStandardMaterial');
      box.expandByObject(m);
    });
    expect(meshes).toBeGreaterThan(2);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(0.22 * SPECIES[species].size, 2);
  });
});

describe('creatureUsdz', () => {
  it('exports a USDZ archive', async () => {
    const { creatureUsdz } = await import('./usdz');
    const blob = await creatureUsdz('pompon');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    // A USDZ file is a zip archive.
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });
});

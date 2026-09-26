// "Verlo en tu habitación" (spec 9.5): the creature model exported as USDZ for AR Quick Look on iOS. The game
// materials are custom occlusion shaders, so the export swaps them for standard materials of the same colour
// and leaves out the ink outlines and Brillo's additive halo, which Quick Look cannot draw.
import * as THREE from 'three';
import { SPECIES, type SpeciesId } from '../engine/species';
import { createCreature } from './creatures3d';
import { createCreatureUniforms } from './occlusionMaterial';

/** Height of a Pompón in the room, in metres; the others scale with their species size. */
export const BASE_HEIGHT_M = 0.22;

function shown(o: THREE.Object3D): boolean {
  for (let x: THREE.Object3D | null = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

/** Scale that makes the shown parts of `group` `height` metres tall, and the lift that stands them on y = 0. */
export function floorFit(group: THREE.Object3D, height: number): { scale: number; lift: number } {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  group.traverse(o => { if ((o as THREE.Mesh).isMesh && shown(o)) box.expandByObject(o); });
  const scale = height / (box.max.y - box.min.y || 1);
  return { scale, lift: -box.min.y * scale };
}

/** The creature as a scene of standard materials, standing on y = 0 and facing +z. */
export function creatureForExport(species: SpeciesId): THREE.Scene {
  const rig = createCreature(species, createCreatureUniforms(), 0);
  rig.alert.visible = false;
  const hidden = new Set<THREE.Object3D>(rig.outline);
  rig.group.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = mesh.material as THREE.ShaderMaterial;
    if (hidden.has(mesh) || m.side === THREE.BackSide || m.blending === THREE.AdditiveBlending) {
      mesh.visible = false;
      return;
    }
    const color = (m.uniforms?.uColor?.value as THREE.Color | undefined) ?? new THREE.Color(SPECIES[species].color);
    mesh.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0,
      emissive: species === 'brillo' ? color : 0x000000,
      emissiveIntensity: species === 'brillo' ? 0.35 : 0,
    });
  });
  const root = new THREE.Group();
  root.add(rig.group);
  const { scale, lift } = floorFit(rig.group, BASE_HEIGHT_M * SPECIES[species].size);
  root.scale.setScalar(scale);
  root.position.y = lift;
  const scene = new THREE.Scene();
  scene.add(root);
  scene.updateMatrixWorld(true);
  return scene;
}

export async function creatureUsdz(species: SpeciesId): Promise<Blob> {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const data = await new USDZExporter().parseAsync(creatureForExport(species), { quickLookCompatible: true });
  return new Blob([data as BlobPart], { type: 'model/vnd.usdz+zip' });
}

/** Whether this browser opens `rel="ar"` links in AR Quick Look (iOS Safari). */
export function supportsQuickLook(): boolean {
  if (typeof document === 'undefined') return false;
  const a = document.createElement('a');
  return !!a.relList?.supports?.('ar');
}

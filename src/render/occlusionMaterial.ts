// Creature material with depth-based occlusion (spec 8.4). Each fragment finds where it sits in the video,
// shifts that lookup by the rotation since the depth frame was grabbed, reads the scene's depth there and
// fades out where the real scene is nearer than the creature.
import * as THREE from 'three';

/** Uniforms shared by every material of one creature. */
export interface CreatureUniforms {
  [name: string]: THREE.IUniform;
  uDepth: THREE.IUniform<THREE.Texture | null>;
  uHasDepth: THREE.IUniform<number>;
  /** 0 draws the creature whole, ignoring depth (calibration). */
  uOcclusion: THREE.IUniform<number>;
  /** Drawing buffer size in pixels. */
  uBuffer: THREE.IUniform<THREE.Vector2>;
  /** Displayed video rectangle in drawing buffer pixels, top-left origin: x, y, width, height. */
  uVideoRect: THREE.IUniform<THREE.Vector4>;
  /** Rotation compensation: the anchor's position in the depth frame minus its position now, in video UV. */
  uOffset: THREE.IUniform<THREE.Vector2>;
  /** The creature's own relative inverse depth, 0 (far) .. 1 (near). */
  uDisp: THREE.IUniform<number>;
  uMargin: THREE.IUniform<number>;
  uSoft: THREE.IUniform<number>;
  /** 1 while rendering the visibility pass. */
  uVisPass: THREE.IUniform<number>;
  uFade: THREE.IUniform<number>;
}

export function createCreatureUniforms(): CreatureUniforms {
  return {
    uDepth: { value: null },
    uHasDepth: { value: 0 },
    uOcclusion: { value: 1 },
    uBuffer: { value: new THREE.Vector2(1, 1) },
    uVideoRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uOffset: { value: new THREE.Vector2() },
    uDisp: { value: 0.5 },
    uMargin: { value: 0.04 },
    uSoft: { value: 0.03 },
    uVisPass: { value: 0 },
    uFade: { value: 1 },
  };
}

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uHasDepth;
  uniform float uOcclusion;
  uniform vec2 uBuffer;
  uniform vec4 uVideoRect;
  uniform vec2 uOffset;
  uniform float uDisp;
  uniform float uMargin;
  uniform float uSoft;
  uniform float uVisPass;
  uniform float uFade;
  uniform vec3 uColor;
  uniform float uShade;
  uniform float uRim;
  varying vec3 vNormal;

  float visibility() {
    if (uOcclusion < 0.5) return 1.0;
    if (uHasDepth < 0.5) return 0.0;
    vec2 px = vec2(gl_FragCoord.x, uBuffer.y - gl_FragCoord.y);
    vec2 uv = (px - uVideoRect.xy) / uVideoRect.zw + uOffset;
    // Outside the frame the depth map was computed for there is no depth to trust: stay hidden until a
    // newer map covers this part of the view, rather than popping in unoccluded.
    if (uv.x < 0.0 || uv.x >= 1.0 || uv.y < 0.0 || uv.y >= 1.0) return 0.0;
    float scene = texture2D(uDepth, uv).r;
    float edge = uDisp + uMargin;
    return 1.0 - smoothstep(edge - uSoft, edge + uSoft, scene);
  }

  void main() {
    float vis = visibility();
    if (uVisPass > 0.5) {
      gl_FragColor = vec4(vis, 1.0, 0.0, 1.0);
      return;
    }
    vec3 n = normalize(vNormal);
    float diffuse = 1.0 - uShade + uShade * max(dot(n, normalize(vec3(0.35, 0.65, 0.7))), 0.0);
    float rim = pow(1.0 - max(n.z, 0.0), 2.4) * uRim;
    vec3 color = uColor * diffuse + vec3(rim);
    float alpha = vis * uFade;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

export interface CreatureMaterialOptions {
  color: THREE.ColorRepresentation;
  /** 0 = flat colour, 1 = full lambert. */
  shade?: number;
  /** Strength of the fur-like rim light. */
  rim?: number;
  side?: THREE.Side;
}

export function createCreatureMaterial(uniforms: CreatureUniforms, opts: CreatureMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uColor: { value: new THREE.Color(opts.color) },
      uShade: { value: opts.shade ?? 0.3 },
      uRim: { value: opts.rim ?? 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: opts.side ?? THREE.FrontSide,
  });
}

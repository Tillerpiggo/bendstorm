import * as THREE from 'three';

/** Pure additive: the shader outputs colour already scaled by its own alpha. */
const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

/** Glowing rim shell, used for shields and the water wave. */
export function fresnelMaterial(color: THREE.Color, base = 0.1, gain = 2.4, power = 2.2): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    ...ADDITIVE,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color.clone() },
      uBase: { value: base },
      uGain: { value: gain },
      uPower: { value: power },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uBase;
      uniform float uGain;
      uniform float uPower;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
        float a = (uBase + f * uGain) * uOpacity;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
}

/** The ultimate's beam: a cylinder along local Y with energy streaking down its length. */
export function beamMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    ...ADDITIVE,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: color.clone() }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float streak = 0.55 + 0.45 * sin(vUv.y * 160.0 - uTime * 60.0 + sin(vUv.x * 18.85) * 2.5);
        float fine = 0.7 + 0.3 * sin(vUv.y * 610.0 - uTime * 140.0 + vUv.x * 31.0);
        float a = pow(facing, 1.4) * streak * fine * uOpacity;
        gl_FragColor = vec4(uColor * a * 1.7, 1.0);
      }`,
  });
}

/** Soft round point sprites sized in world units. `uScale` is set per frame from the viewport. */
export function particleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    ...ADDITIVE,
    uniforms: { uScale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uScale;
      varying vec3 vColor;
      void main() {
        vColor = aColor * aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d);
        gl_FragColor = vec4(vColor * a * a, 1.0);
      }`,
  });
}

/** HDR colour (values above 1 bloom). `hex` is an sRGB CSS colour. */
export function hdr(hex: string, intensity: number): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(intensity);
}

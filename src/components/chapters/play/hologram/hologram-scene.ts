import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { GearSlot } from "@/content/types";
import { buildFigure, type Figure, GEAR_ORDER, partId, PARTS, SHOWS, type Voxel } from "./figure-3d";

// The Court's hologram: the cube-built player turning on a projector floor.
//
// Three instanced meshes share one box: the hologram (every cube, drawn as
// glowing edges over a faint fill, faces between neighbours dropped), the
// solid (only the gear, in its real colours, collapsed until a piece is on
// show) and the floor. Pointing at a piece of gear makes it materialise from
// its lowest cube to its highest while the rest of the figure steps back.

export type HologramEvents = {
  /** The gear under the pointer changed (mouse and pen only). */
  onHover: (slot: GearSlot | null) => void;
  /** A press that didn't turn the figure landed on this gear, or on nothing. */
  onPick: (slot: GearSlot | null) => void;
  /** Where the gear on show sits on screen, in CSS pixels from the canvas's top left. Called every frame it is shown. */
  onAnchor: (point: { x: number; y: number } | null) => void;
  /** The visitor turned the figure for the first time. */
  onTurned?: () => void;
};

const FLOOR_ID = 20;
/** Radians per CSS pixel of drag. */
const DRAG_TURN = 0.011;
/** Idle turning speed, radians per second: one turn in about twenty seconds. */
const SPIN = 0.32;
/** Milliseconds without input before the figure starts turning by itself again. */
const IDLE_MS = 2600;
/** How long a piece takes to materialise, in seconds. */
const MATERIALISE = 0.42;
/** Camera tilt above the horizon, in radians. */
const TILT = 0.17;

const FACE_BIT = /* glsl */ `
  float faceBit(vec3 n) {
    if (n.x > 0.5) return 1.0;
    if (n.x < -0.5) return 2.0;
    if (n.y > 0.5) return 4.0;
    if (n.y < -0.5) return 8.0;
    if (n.z > 0.5) return 16.0;
    return 32.0;
  }
  bool coveredFace(float mask, vec3 n) {
    return mod(floor(mask / faceBit(n)), 2.0) > 0.5;
  }
`;

/** Distance from a fragment to the nearest edge of its face, in cells. */
const EDGE_DISTANCE = /* glsl */ `
  float edgeDistance(vec3 local, vec3 size) {
    vec3 a = abs(local);
    vec3 d = (0.5 - a) * size;
    if (a.x >= a.y && a.x >= a.z) return min(d.y, d.z);
    if (a.y >= a.z) return min(d.x, d.z);
    return min(d.x, d.y);
  }
`;

const HOLO_VERTEX = /* glsl */ `
  attribute float aPart;
  attribute float aMask;
  attribute float aGlow;
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalV;
  varying vec3 vWorld;
  varying float vPart;
  varying float vGlow;
  ${FACE_BIT}
  void main() {
    if (coveredFace(aMask, normal)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vLocal = position;
    vPart = aPart;
    vGlow = aGlow;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalV = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const HOLO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uTime;
  uniform float uMotion;
  uniform float uFade;
  uniform float uShown;
  uniform float uMix;
  uniform float uSweep;
  uniform float uLight;
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalV;
  varying vec3 vWorld;
  varying float vPart;
  varying float vGlow;
  ${EDGE_DISTANCE}
  void main() {
    float e = edgeDistance(vLocal, vSize);
    float w = max(fwidth(e) * 1.4, 0.015);
    float edge = 1.0 - smoothstep(0.035, 0.035 + w, e);
    float rim = pow(1.0 - abs(normalize(vNormalV).z), 2.0);
    // Scan lines across the screen, drifting slowly, and a band that sweeps up the figure.
    float lines = 0.86 + 0.14 * sin(gl_FragCoord.y * 1.25 + uTime * 2.4 * uMotion);
    float band = uMotion * (1.0 - smoothstep(0.0, 2.6, abs(vWorld.y - uSweep)));
    float fill = (uLight > 0.5 ? 0.05 : 0.05) + 0.12 * rim;
    float alpha = max(fill, edge * (uLight > 0.5 ? 0.85 : 0.7)) * lines + band * 0.22 * (0.35 + edge);
    vec3 color = mix(uColor, uEdge, clamp(edge * 0.85 + band * 0.6, 0.0, 1.0));
    alpha *= vGlow * uFade;
    // The piece on show is drawn solid by the other mesh; the rest of the figure steps back.
    bool onShow = mod(floor(uShown / exp2(vPart)), 2.0) > 0.5;
    alpha *= onShow ? (1.0 - uMix) : (1.0 - 0.35 * uMix * step(0.5, uShown));
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

const SOLID_VERTEX = /* glsl */ `
  attribute float aPart;
  attribute float aMask;
  attribute vec3 aColour;
  attribute float aRise;
  uniform float uShown;
  uniform float uMix;
  uniform float uStagger;
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalV;
  varying vec3 vColour;
  ${FACE_BIT}
  void main() {
    float p = mod(floor(uShown / exp2(aPart)), 2.0) > 0.5 ? clamp(uMix * (1.0 + uStagger) - aRise * uStagger, 0.0, 1.0) : 0.0;
    // Collapsed cubes, and faces a neighbour covers once every cube is whole, are dropped.
    if (p <= 0.0 || (p >= 1.0 && coveredFace(aMask, normal))) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float k = 0.3 + 0.7 * (1.0 - (1.0 - p) * (1.0 - p));
    vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz)) * k;
    vLocal = position;
    vColour = aColour;
    vNormalV = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position * k, 1.0);
  }
`;

const SOLID_FRAGMENT = /* glsl */ `
  uniform vec3 uEdge;
  varying vec3 vLocal;
  varying vec3 vSize;
  varying vec3 vNormalV;
  varying vec3 vColour;
  ${EDGE_DISTANCE}
  void main() {
    vec3 base = vColour;
    vec3 n = normalize(vNormalV);
    float light = 0.6 + 0.4 * max(dot(n, normalize(vec3(0.35, 0.8, 0.5))), 0.0);
    // A fine seam between cubes keeps the squares readable, as on the rest of the site.
    float e = edgeDistance(vLocal, vSize);
    float seam = 1.0 - smoothstep(0.02, 0.02 + max(fwidth(e) * 1.2, 0.01), e);
    vec3 color = base * light * (1.0 - 0.3 * seam * step(0.5, min(vSize.x, min(vSize.y, vSize.z))));
    float rim = pow(1.0 - abs(n.z), 3.0);
    color = mix(color, uEdge, rim * 0.22);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Per-cube values: a number, or three for a colour. */
type Extra = Record<string, number | readonly [number, number, number]>;

function instanced(voxels: readonly Voxel[], material: ShaderMaterial, extra: (v: Voxel) => Extra) {
  const geometry = new BoxGeometry(1, 1, 1);
  const mesh = new InstancedMesh(geometry, material, voxels.length);
  const matrix = new Matrix4();
  const position = new Vector3();
  const turn = new Quaternion();
  const euler = new Euler();
  const scale = new Vector3();
  const sample = voxels.length ? extra(voxels[0]) : {};
  const names = Object.keys(sample);
  const sizes = Object.fromEntries(names.map((name) => [name, typeof sample[name] === "number" ? 1 : 3]));
  const arrays = Object.fromEntries(names.map((name) => [name, new Float32Array(voxels.length * sizes[name])]));
  voxels.forEach((v, i) => {
    matrix.compose(position.set(v.x, v.y, v.z), turn.setFromEuler(euler.set(0, v.ry, v.rz, "YXZ")), scale.set(v.sx, v.sy, v.sz));
    mesh.setMatrixAt(i, matrix);
    const values = extra(v);
    for (const name of names) {
      const value = values[name];
      if (typeof value === "number") arrays[name][i] = value;
      else arrays[name].set(value, i * 3);
    }
  });
  for (const name of names) geometry.setAttribute(name, new InstancedBufferAttribute(arrays[name], sizes[name]));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Brightness of each part in the hologram, so the figure reads as more than one flat colour. */
const GLOW: Record<string, number> = { skin: 0.8, hair: 1.15, eyes: 1.3, shorts: 0.9, socks: 0.85, strings: 1.35, racket: 1.1, grip: 1.1 };

export class HologramScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly events: HologramEvents;
  private readonly figure: Figure;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(24, 1, 1, 2000);
  private readonly turntable = new Group();
  private readonly holoMaterial: ShaderMaterial;
  private readonly solidMaterial: ShaderMaterial;
  private readonly holo: InstancedMesh;
  private readonly solid: InstancedMesh;
  private readonly floor: InstancedMesh;
  private readonly bed: Mesh;
  private readonly partOf: Int8Array;
  private readonly raycaster = new Raycaster();

  private width = 0;
  private height = 0;
  private yaw = 0.42;
  private velocity = 0;
  private spin = 0;
  private target: number | null = null;
  private lastInput = performance.now();

  private press: { id: number; x: number; yaw: number; lastX: number; lastT: number; turned: boolean } | null = null;
  private pointerInside = false;
  private pointerAt: Vector2 | null = null;
  private pickPending = false;
  private hovered: GearSlot | null = null;
  private everTurned = false;

  private shown: GearSlot | null = null;
  /** Bit mask of the part ids drawn solid: the gear on show, or the gear fading out. */
  private shownMask = 0;
  private mix = 0;

  private motion: boolean;
  private visible = false;
  private raf = 0;
  private lastFrame = 0;
  private time = 0;
  private fadeIn = 0;

  private readonly cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, events: HologramEvents, reducedMotion: boolean) {
    this.canvas = canvas;
    this.events = events;
    this.motion = !reducedMotion;
    this.figure = buildFigure();

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.holoMaterial = new ShaderMaterial({
      vertexShader: HOLO_VERTEX,
      fragmentShader: HOLO_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new Color() },
        uEdge: { value: new Color() },
        uTime: { value: 0 },
        uMotion: { value: this.motion ? 1 : 0 },
        uFade: { value: this.motion ? 0 : 1 },
        uShown: { value: 0 },
        uMix: { value: 0 },
        uSweep: { value: -100 },
        uLight: { value: 1 },
      },
    });
    this.solidMaterial = new ShaderMaterial({
      vertexShader: SOLID_VERTEX,
      fragmentShader: SOLID_FRAGMENT,
      uniforms: {
        uShown: { value: 0 },
        uMix: { value: 0 },
        uStagger: { value: this.motion ? 1.2 : 0 },
        uEdge: { value: new Color() },
      },
    });

    const voxels = this.figure.voxels;
    this.holo = instanced(voxels, this.holoMaterial, (v) => ({
      aPart: partId(v.part),
      aMask: v.hidden,
      aGlow: GLOW[v.part] ?? 1,
    }));
    this.partOf = Int8Array.from(voxels, (v) => partId(v.part));

    const gear = voxels.filter((v) => GEAR_ORDER.some((slot) => SHOWS[slot].includes(v.part)));
    this.solid = instanced(gear, this.solidMaterial, (v) => ({
      aPart: partId(v.part),
      aMask: v.hidden,
      // Colours are given in sRGB; the shader works in linear light.
      aColour: new Color(v.colour || "#808080").toArray() as [number, number, number],
      aRise: v.rise,
    }));
    this.solid.renderOrder = 0;
    this.holo.renderOrder = 1;

    // The projector floor: flat tiles fading out from the middle, a brighter ring at the edge.
    const tiles: Voxel[] = [];
    const glow: number[] = [];
    const R = this.figure.floorRadius;
    for (let x = -R; x <= R; x++)
      for (let z = -R; z <= R; z++) {
        const r = Math.hypot(x, z);
        if (r > R) continue;
        tiles.push({ x, y: -0.62, z, sx: 0.9, sy: 0.12, sz: 0.9, ry: 0, rz: 0, part: "skin", colour: "", hidden: 8, rise: 0 });
        glow.push(r > R - 1 ? 0.75 : 0.42 * (1 - r / R) + 0.08);
      }
    this.floor = instanced(tiles, this.holoMaterial, () => ({ aPart: FLOOR_ID, aMask: 8, aGlow: 0 }));
    const glowAttr = this.floor.geometry.getAttribute("aGlow") as InstancedBufferAttribute;
    glow.forEach((g, i) => glowAttr.setX(i, g));
    glowAttr.needsUpdate = true;
    this.floor.renderOrder = 1;

    // An invisible pane across the racket head, easier to point at than the strings themselves.
    const { centre, size } = this.figure.stringBed;
    this.bed = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial({ visible: false }));
    this.bed.position.set(...centre);

    this.turntable.add(this.solid, this.holo, this.floor, this.bed);
    this.scene.add(this.turntable);

    this.refreshColours();
    this.listen();
  }

  // ----- Public API -----------------------------------------------------------

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.fitCamera();
    this.invalidate();
  }

  /** Start or stop drawing: off screen, nothing runs. */
  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.invalidate();
    else this.stop();
  }

  setReducedMotion(reduced: boolean) {
    this.motion = !reduced;
    this.holoMaterial.uniforms.uMotion.value = this.motion ? 1 : 0;
    this.solidMaterial.uniforms.uStagger.value = this.motion ? 1.2 : 0;
    if (!this.motion) {
      this.spin = 0;
      this.fadeIn = 1;
      this.mix = this.shown ? 1 : 0;
    }
    this.invalidate();
  }

  /** Show one piece of gear solid, or none. */
  setShown(slot: GearSlot | null) {
    if (slot === this.shown) return;
    this.shown = slot;
    if (slot) {
      this.shownMask = SHOWS[slot].reduce((mask, part) => mask | (1 << partId(part)), 0);
      this.mix = this.motion ? 0 : 1;
    } else if (!this.motion) {
      this.mix = 0;
      this.shownMask = 0;
    }
    this.lastInput = performance.now();
    this.invalidate();
  }

  /** Turn so a piece of gear faces the visitor, the short way round. */
  face(slot: GearSlot) {
    const goal = this.figure.facing[slot];
    const turns = Math.round((this.yaw - goal) / (Math.PI * 2));
    this.aim(goal + turns * Math.PI * 2);
  }

  /** Turn by a step, for the arrow keys. */
  turn(radians: number) {
    this.aim((this.target ?? this.yaw) + radians);
    this.noteTurned();
  }

  /** Re-read the page's colours, after the colour mode changes. */
  refreshColours() {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => new Color(style.getPropertyValue(name).trim() || "#2b7a5f");
    const jade = read("--jade");
    const ink = read("--ink");
    const paper = read("--paper");
    const light = paper.r + paper.g + paper.b > 1.5;
    const u = this.holoMaterial.uniforms;
    u.uLight.value = light ? 1 : 0;
    if (light) {
      u.uColor.value.copy(jade);
      u.uEdge.value.copy(jade).lerp(ink, 0.45);
      this.holoMaterial.blending = NormalBlending;
    } else {
      u.uColor.value.copy(jade).multiplyScalar(0.8);
      u.uEdge.value.copy(jade).lerp(new Color(1, 1, 1), 0.5);
      this.holoMaterial.blending = AdditiveBlending;
    }
    this.holoMaterial.needsUpdate = true;
    this.solidMaterial.uniforms.uEdge.value.copy(jade);
    this.invalidate();
  }

  dispose() {
    this.stop();
    for (const undo of this.cleanup) undo();
    for (const mesh of [this.holo, this.solid, this.floor, this.bed]) mesh.geometry.dispose();
    this.holoMaterial.dispose();
    this.solidMaterial.dispose();
    (this.bed.material as MeshBasicMaterial).dispose();
    this.renderer.dispose();
  }

  // ----- Camera ---------------------------------------------------------------

  /** Pull the camera back until the whole turning figure and its floor fit, then centre them. */
  private fitCamera() {
    const { camera } = this;
    camera.aspect = this.width / Math.max(1, this.height);
    const R = this.figure.floorRadius + 0.5;
    const top = this.figure.top + 0.5;
    const points: Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      points.push(new Vector3(Math.cos(a) * R, -0.7, Math.sin(a) * R));
      // The figure is narrower than the floor at the top.
      points.push(new Vector3(Math.cos(a) * 11, top, Math.sin(a) * 11));
      points.push(new Vector3(Math.cos(a) * 14.5, top - 12, Math.sin(a) * 14.5));
    }
    const margin = 0.9;
    let lookY = top * 0.45;
    let distance = 120;
    const place = () => {
      camera.position.set(0, lookY + Math.sin(TILT) * distance, Math.cos(TILT) * distance);
      camera.lookAt(0, lookY, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };
    const bounds = () => {
      let minY = Infinity;
      let maxY = -Infinity;
      let maxX = 0;
      for (const p of points) {
        const q = p.clone().project(camera);
        minY = Math.min(minY, q.y);
        maxY = Math.max(maxY, q.y);
        maxX = Math.max(maxX, Math.abs(q.x));
      }
      return { minY, maxY, maxX };
    };
    for (let pass = 0; pass < 3; pass++) {
      let lo = 20;
      let hi = 800;
      for (let i = 0; i < 28; i++) {
        distance = (lo + hi) / 2;
        place();
        const b = bounds();
        if (b.maxX <= margin && b.maxY <= margin && b.minY >= -margin) hi = distance;
        else lo = distance;
      }
      distance = hi;
      place();
      const b = bounds();
      // Shift the aim so the content sits in the middle of the frame.
      const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * distance;
      lookY += ((b.maxY + b.minY) / 2) * halfHeight;
    }
    place();
  }

  // ----- Input ----------------------------------------------------------------

  private listen() {
    const canvas = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(type: K, handler: (event: HTMLElementEventMap[K]) => void) => {
      canvas.addEventListener(type, handler);
      this.cleanup.push(() => canvas.removeEventListener(type, handler));
    };

    on("pointerdown", (event) => {
      if (event.button !== 0 || this.press) return;
      canvas.setPointerCapture(event.pointerId);
      this.press = { id: event.pointerId, x: event.clientX, yaw: this.yaw, lastX: event.clientX, lastT: event.timeStamp, turned: false };
      this.velocity = 0;
      this.target = null;
      this.spin = 0;
      this.lastInput = performance.now();
    });
    on("pointermove", (event) => {
      this.pointerAt = this.toNdc(event);
      const press = this.press;
      if (press && event.pointerId === press.id) {
        const dx = event.clientX - press.x;
        if (!press.turned && Math.abs(dx) > 4) {
          press.turned = true;
          canvas.dataset.turning = "";
          this.noteTurned();
        }
        if (press.turned) {
          this.yaw = press.yaw + dx * DRAG_TURN;
          const dt = Math.max(1, event.timeStamp - press.lastT);
          this.velocity = ((event.clientX - press.lastX) * DRAG_TURN * 1000) / dt;
          press.lastX = event.clientX;
          press.lastT = event.timeStamp;
        }
        this.lastInput = performance.now();
      } else if (event.pointerType !== "touch") {
        this.pickPending = true;
      }
      this.invalidate();
    });
    const release = (event: PointerEvent, cancelled: boolean) => {
      const press = this.press;
      if (!press || event.pointerId !== press.id) return;
      this.press = null;
      delete canvas.dataset.turning;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      // A flick keeps turning for a moment; a still release stops dead.
      if (event.timeStamp - press.lastT > 80) this.velocity = 0;
      if (!press.turned && !cancelled) this.events.onPick(this.pick(this.toNdc(event)));
      this.lastInput = performance.now();
      this.invalidate();
    };
    on("pointerup", (event) => release(event, false));
    on("pointercancel", (event) => release(event, true));
    on("pointerenter", () => {
      this.pointerInside = true;
    });
    on("pointerleave", () => {
      this.pointerInside = false;
      this.pointerAt = null;
      this.setHovered(null);
      this.lastInput = performance.now();
      this.invalidate();
    });
  }

  private noteTurned() {
    if (this.everTurned) return;
    this.everTurned = true;
    this.events.onTurned?.();
  }

  private aim(goal: number) {
    this.velocity = 0;
    this.spin = 0;
    this.lastInput = performance.now();
    if (this.motion) this.target = goal;
    else {
      this.yaw = goal;
      this.target = null;
    }
    this.invalidate();
  }

  private toNdc(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  }

  /** The gear under a point, or null when the nearest thing there is the player or nothing. */
  private pick(ndc: Vector2): GearSlot | null {
    this.turntable.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects([this.holo, this.bed], false)[0];
    if (!hit) return null;
    if (hit.object === this.bed) return "strings";
    const part = PARTS[this.partOf[hit.instanceId ?? -1] ?? -1];
    return part && (GEAR_ORDER as readonly string[]).includes(part) ? (part as GearSlot) : null;
  }

  private setHovered(slot: GearSlot | null) {
    if (slot === this.hovered) return;
    this.hovered = slot;
    if (slot) this.canvas.dataset.over = "";
    else delete this.canvas.dataset.over;
    this.events.onHover(slot);
  }

  // ----- Frame loop -----------------------------------------------------------

  private invalidate() {
    if (!this.visible || this.raf || !this.width) return;
    this.lastFrame = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;
    let busy = this.motion; // scan lines and the idle turn never rest

    // Turning: a drag sets the angle directly; otherwise glide to a target, coast, or idle-spin.
    if (!this.press) {
      if (this.target !== null) {
        const gap = this.target - this.yaw;
        this.yaw += gap * (1 - Math.exp(-dt * 9));
        if (Math.abs(gap) < 0.0015) {
          this.yaw = this.target;
          this.target = null;
        } else busy = true;
      } else if (Math.abs(this.velocity) > 0.002) {
        this.yaw += this.velocity * dt;
        this.velocity *= Math.exp(-dt * 3.2);
        busy = true;
      }
      const idle = this.motion && !this.shown && !this.pointerInside && this.target === null && now - this.lastInput > IDLE_MS;
      this.spin += ((idle ? SPIN : 0) - this.spin) * (1 - Math.exp(-dt * 1.5));
      if (Math.abs(this.spin) > 0.0005) this.yaw += this.spin * dt;
    } else busy = true;
    this.turntable.rotation.y = this.yaw;

    // Materialise or dissolve the piece on show.
    if (this.shownMask) {
      const goal = this.shown ? 1 : 0;
      if (this.mix !== goal) {
        const step = dt / MATERIALISE;
        this.mix = goal > this.mix ? Math.min(goal, this.mix + step) : Math.max(goal, this.mix - step * 1.6);
        busy = true;
      }
      if (!this.shown && this.mix === 0) this.shownMask = 0;
    }

    if (this.motion) {
      this.time += dt;
      this.fadeIn = Math.min(1, this.fadeIn + dt / 0.6);
    }
    const u = this.holoMaterial.uniforms;
    u.uTime.value = this.time;
    // A sweep up the figure every six seconds.
    const sweepPeriod = 6;
    const phase = (this.time % sweepPeriod) / sweepPeriod;
    u.uSweep.value = phase < 0.45 ? -4 + (phase / 0.45) * (this.figure.top + 8) : -100;
    u.uFade.value = this.motion ? this.fadeIn * (0.94 + 0.06 * Math.sin(this.time * 9.0) * Math.sin(this.time * 2.3)) : 1;
    u.uShown.value = this.shownMask;
    u.uMix.value = easeOut(this.mix);
    this.solidMaterial.uniforms.uShown.value = this.shownMask;
    this.solidMaterial.uniforms.uMix.value = this.mix;

    if (this.pickPending && this.pointerAt && !this.press) {
      this.pickPending = false;
      this.setHovered(this.pick(this.pointerAt));
    }

    this.renderer.render(this.scene, this.camera);
    this.reportAnchor();

    if (busy && this.visible) this.raf = requestAnimationFrame(this.frame);
  };

  private reportAnchor() {
    if (!this.shown) {
      this.events.onAnchor(null);
      return;
    }
    const point = new Vector3(...this.figure.anchors[this.shown]);
    this.turntable.localToWorld(point);
    point.project(this.camera);
    this.events.onAnchor({ x: ((point.x + 1) / 2) * this.width, y: ((1 - point.y) / 2) * this.height });
  }
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

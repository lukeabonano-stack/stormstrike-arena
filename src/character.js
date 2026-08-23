// ── character.js  Rigged Quaternius humans with the legacy pose contract ──────
// Leaf-level module: imports only engine.js + assets.js.
//
// Wraps a Quaternius base-body instance (realistic human, retargeted 46-clip
// animation set) in the legacy rig contract {bodyGroup, head, hatMesh, armLeft,
// armRight, gun, legLeft, legRight} so enemies.js / emotes.js / controls.js /
// main.js / armory keep working unchanged.
//
// glTF joints animate via rotationQuaternion; the 12 emote poses + gameplay
// call sites write Euler `.rotation` in the OLD primitive convention. Each
// posed contract key is a PoseAdapter that converts that convention onto the
// real bone. Locomotion uses real animation clips (idle/walk/jog/death).

import { scene } from './engine.js';
import { instantiateCharacter } from './assets.js';

const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);

// Corrective rotation aligning weapon-mesh local +Z (barrel-forward, the
// convention every weapons.js builder uses) with the hand bone's grip
// orientation. Tuned visually — see the M-feedback screenshot pass.
let GUN_GRIP_CORRECTION = BABYLON.Quaternion.Identity();

export const LEGACY_REST = {
  head:     () => V3(0, 0, 0),
  armLeft:  () => V3(Math.PI / 10, 0, 0),
  armRight: () => V3(-1.25, 0, 0.15),
  legLeft:  () => V3(0, 0, 0),
  legRight: () => V3(0, 0, 0),
};

// Legacy-euler → bone-local-euler delta from rest (tuned for the Quaternius
// UE arm/leg bone axes: local +Y runs down the limb, +X swings it forward).
const REMAP = {
  head:     (r) => V3(r.x, r.y, r.z),
  armLeft:  (r) => V3(0, 0, (r.x - Math.PI / 10)),
  armRight: (r) => V3(0, 0, -(r.x + 1.25)),
  legLeft:  (r) => V3((r.x), 0, 0),
  legRight: (r) => V3((r.x), 0, 0),
};

class PoseAdapter {
  constructor(key, joint) {
    this.key = key;
    this.joint = joint;
    this.restQuat = joint && joint.rotationQuaternion ? joint.rotationQuaternion.clone()
                   : BABYLON.Quaternion.Identity();
    this.rotation = LEGACY_REST[key]();
    this.position = joint ? joint.position : V3(0, 0, 0);
    this.node = joint;
  }
  reset() { this.rotation = LEGACY_REST[this.key](); }
  apply() {
    if (!this.joint) return;
    const e = REMAP[this.key](this.rotation);
    this.joint.rotationQuaternion = this.restQuat.multiply(
      BABYLON.Quaternion.FromEulerAngles(e.x, e.y, e.z));
  }
}

// ── Rig factory ───────────────────────────────────────────────────────────────
// opts: { body, hair, hairColor, tint, bodyScale, sc, adoptGunNode }
export function createRiggedCharacter(opts = {}) {
  const sc = opts.sc || scene;
  const inst = instantiateCharacter(opts, sc);
  if (!inst) return null;

  const bodyGroup = new BABYLON.TransformNode('charRig', sc);
  inst.root.parent = bodyGroup;
  // Horde perf: skip per-submesh frustum churn for many skinned characters.
  for (const m of inst.bodyMeshes) m.alwaysSelectAsActiveMesh = true;
  const ns = inst.normScale;
  const bs = opts.bodyScale || [1, 1, 1];
  inst.root.scaling.multiplyInPlace(V3(ns * bs[0], ns * bs[1], ns * bs[2]));
  inst.root.position.set(0, 0, 0);

  // Gun node parented to bodyGroup, position-synced to the right hand each frame.
  const gun = opts.adoptGunNode || new BABYLON.TransformNode('gun', sc);
  gun.parent = bodyGroup;
  gun.position.set(0.3, 1.1, 0.35);
  gun.rotation.set(0, 0, 0);
  if (!gun.muzzle) {
    const muzzle = new BABYLON.TransformNode('muzzle', sc);
    muzzle.parent = gun;
    muzzle.position.set(0, 0, 0.45);
    gun.muzzle = muzzle;
  }

  const mk = (key, node) => new PoseAdapter(key, node);
  const adapters = {
    head:     mk('head', inst.nodes.head),
    armLeft:  mk('armLeft', inst.nodes.upperarmL),
    armRight: mk('armRight', inst.nodes.upperarmR),
    legLeft:  mk('legLeft', inst.nodes.upperlegL),
    legRight: mk('legRight', inst.nodes.upperlegR),
  };

  const rig = {
    bodyGroup,
    head: adapters.head, armLeft: adapters.armLeft, armRight: adapters.armRight,
    legLeft: adapters.legLeft, legRight: adapters.legRight, gun,
    hatMesh: new BABYLON.TransformNode('hatStub', sc),
    nodes: inst.nodes, bodyMeshes: inst.bodyMeshes, materials: inst.materials,
    skinMat: inst.skinMat, hairMat: inst.hairMat,
    animGroups: inst.animGroups,
    isRigged: true,
    _mode: 'anim', _current: null, _currentName: null, _alwaysPose: [], _disposed: false,
    _instDispose: inst.dispose,
  };

  rig.playAnim = (clipKey, o = {}) => {
    if (rig._disposed) return;
    if (rig._currentName === clipKey && rig._mode === 'anim') {
      if (o.speedRatio !== undefined && rig._current) rig._current.speedRatio = o.speedRatio;
      return;
    }
    const g = rig.animGroups.get(clipKey);
    if (!g) return;
    if (rig._current) rig._current.stop();
    g.start(o.loop !== false, o.speedRatio ?? 1);
    rig._current = g; rig._currentName = clipKey; rig._mode = 'anim';
    if (o.onEnd && o.loop === false) g.onAnimationGroupEndObservable.addOnce(() => o.onEnd());
  };

  rig.enterPoseMode = () => {
    if (rig._current) { rig._current.stop(); rig._current = null; rig._currentName = null; }
    rig._mode = 'pose';
  };
  rig.exitPoseMode = () => {
    for (const a of Object.values(adapters)) a.reset();
    rig._mode = 'anim';
    rig.playAnim(rig._idleClip || 'idle');
  };
  rig.playDeath = (onDone) => {
    if (rig._current) rig._current.stop();
    rig._mode = 'anim';
    const g = rig.animGroups.get('death');
    if (!g) { if (onDone) onDone(); return; }
    g.start(false, 1.2);
    rig._current = g; rig._currentName = 'death';
    g.onAnimationGroupEndObservable.addOnce(() => { if (onDone) onDone(); });
  };

  // Per-frame: gun follows the right hand's position AND rotation (not just
  // position — a gun that only translates with the hand but never rotates
  // with it stays at a fixed orientation no matter how the arm/hand moves,
  // which reads as "not actually held". GUN_GRIP_CORRECTION compensates for
  // the weapon meshes' authored forward-axis convention vs. the hand bone's
  // own local axes (tuned visually, same technique as the outfit geometry).
  const handR = inst.nodes.handR;
  const _tmpMat = new BABYLON.Matrix();
  const _handWorldQuat = new BABYLON.Quaternion();
  const _bodyWorldQuat = new BABYLON.Quaternion();
  const _scratchV3 = new BABYLON.Vector3();
  rig._limbTrackers = [];
  rig._pointTrackers = [];
  const _up = BABYLON.Vector3.Up();
  const _worldQuat = new BABYLON.Quaternion();
  rig._observer = sc.onAfterAnimationsObservable.add(() => {
    if (rig._disposed) return;
    if (rig._mode === 'pose') for (const a of Object.values(adapters)) a.apply();
    else for (const k of rig._alwaysPose) adapters[k].apply();
    if (handR) {
      handR.computeWorldMatrix(true);
      bodyGroup.getWorldMatrix().invertToRef(_tmpMat);
      gun.position.copyFrom(BABYLON.Vector3.TransformCoordinates(handR.getAbsolutePosition(), _tmpMat));
      handR.getWorldMatrix().decompose(_scratchV3, _handWorldQuat, _scratchV3);
      bodyGroup.getWorldMatrix().decompose(_scratchV3, _bodyWorldQuat, _scratchV3);
      gun.rotationQuaternion = BABYLON.Quaternion.Inverse(_bodyWorldQuat)
        .multiply(_handWorldQuat).multiply(GUN_GRIP_CORRECTION);
    }
    // Outfit limb armor: bones carry a baked non-uniform, mirrored scale
    // (glTF handedness correction), which turns a naive "static local
    // transform under the bone" into real shear once decomposed — visibly
    // flared/misplaced geometry. bodyGroup itself has a clean uniform scale,
    // so instead these pieces are parented to bodyGroup and re-positioned/
    // re-oriented every frame from the bones' WORLD transforms (same proven
    // technique as the gun tracking above — rotation-only, position via
    // exact point transform, never inverting the bone's own scale).
    if (rig._limbTrackers.length || rig._pointTrackers.length) {
      bodyGroup.getWorldMatrix().invertToRef(_tmpMat);
      bodyGroup.getWorldMatrix().decompose(_scratchV3, _bodyWorldQuat, _scratchV3);
      const invBodyQuat = BABYLON.Quaternion.Inverse(_bodyWorldQuat);
      for (const t of rig._limbTrackers) {
        t.boneNode.computeWorldMatrix(true); t.childNode.computeWorldMatrix(true);
        const worldStart = t.boneNode.getAbsolutePosition();
        const worldEnd = t.childNode.getAbsolutePosition();
        const mid = BABYLON.Vector3.Lerp(worldStart, worldEnd, 0.5);
        t.mesh.position.copyFrom(BABYLON.Vector3.TransformCoordinates(mid, _tmpMat));
        const dir = worldEnd.subtract(worldStart).normalize();
        const dot = BABYLON.Vector3.Dot(_up, dir);
        if (dot > 0.9999) _worldQuat.copyFrom(BABYLON.Quaternion.Identity());
        else if (dot < -0.9999) _worldQuat.copyFrom(BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), Math.PI));
        else _worldQuat.copyFrom(BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Cross(_up, dir).normalize(), Math.acos(dot)));
        if (!t.mesh.rotationQuaternion) t.mesh.rotationQuaternion = new BABYLON.Quaternion();
        invBodyQuat.multiplyToRef(_worldQuat, t.mesh.rotationQuaternion);
      }
      for (const t of rig._pointTrackers) {
        t.childNode.computeWorldMatrix(true);
        t.mesh.position.copyFrom(BABYLON.Vector3.TransformCoordinates(t.childNode.getAbsolutePosition(), _tmpMat));
      }
    }
  });

  rig.disposeExtras = () => {
    if (rig._disposed) return;
    rig._disposed = true;
    sc.onAfterAnimationsObservable.remove(rig._observer);
    for (const g of rig.animGroups.values()) g.dispose();
  };
  rig.dispose = () => { rig.disposeExtras(); bodyGroup.dispose(); };

  rig.playAnim('idle');
  return rig;
}

// ── Outfit meshes (shirt/pants/armor) — REAL geometry, never touches skin ────
// The Quaternius body is a single mesh/material covering the whole character
// (including the face), so tinting that material recolors the face too and
// strips the texture's painted-on shorts. Instead we layer simple clothing
// geometry onto bones — same idea as the old primitive rig's box-armor system,
// but anchored to real bones so it rides the animation.
// Outfit pieces are parented to `bodyGroup` (not individual limb bones —
// verified those carry inconsistent/negative-scale local axes that mirror a
// parented box onto the wrong side). Placement is derived by measuring each
// reference bone's CURRENT position in bodyGroup-local space at build time,
// rather than hardcoded world heights — the live player's bodyGroup sits
// inside a legacy wrapper (`playerBody`) with its own non-zero offset
// (a leftover of the old primitive-rig convention), so any hardcoded
// "feet at y=0" assumption silently drifts off the body. Bone-relative
// measurement is immune to that, and to whatever offset any future caller's
// wrapper uses.
function _boneLocalPos(rig, boneNode) {
  if (!boneNode) return null;
  boneNode.computeWorldMatrix(true);
  rig.bodyGroup.computeWorldMatrix(true);
  const inv = BABYLON.Matrix.Invert(rig.bodyGroup.getWorldMatrix());
  return BABYLON.Vector3.TransformCoordinates(boneNode.getAbsolutePosition(), inv);
}

export function applyOutfit(rig, opts = {}) {
  if (!rig || !rig.bodyGroup) return;
  const sc = rig.bodyGroup.getScene();
  if (rig._outfitMeshes) { for (const m of rig._outfitMeshes) { m.material?.dispose(); m.dispose(); } }
  rig._outfitMeshes = [];
  rig._limbTrackers = [];
  rig._pointTrackers = [];

  const chestY = _boneLocalPos(rig, rig.nodes.chest)?.y;
  const hipsY  = _boneLocalPos(rig, rig.nodes.hips)?.y;
  const kneeY  = _boneLocalPos(rig, rig.nodes.lowerlegL)?.y;
  const footY  = _boneLocalPos(rig, rig.nodes.footL)?.y;
  const shoulderPosL = _boneLocalPos(rig, rig.nodes.upperarmL);
  const shoulderPosR = _boneLocalPos(rig, rig.nodes.upperarmR);
  if (chestY === undefined || hipsY === undefined) return;   // rig not ready — no outfit this frame

  const mkMat = (color, metallic, roughness, opts2 = {}) => {
    const mat = new BABYLON.PBRMaterial('outfit' + Math.random(), sc);
    mat.albedoColor = BABYLON.Color3.FromHexString('#' + color.toString(16).padStart(6, '0'));
    mat.metallic = metallic; mat.roughness = roughness;
    if (opts2.emissive !== undefined) {
      mat.emissiveColor = BABYLON.Color3.FromHexString('#' + opts2.emissive.toString(16).padStart(6, '0'))
        .scale(opts2.emissiveIntensity ?? 0.3);
    }
    return mat;
  };
  const track = (mesh) => { mesh.isPickable = false; mesh.parent = rig.bodyGroup; rig._outfitMeshes.push(mesh); return mesh; };
  const mkCapsule = (mat, r, len, x, y, z, sx = 1, sz = 1) => {
    const m = BABYLON.MeshBuilder.CreateCapsule('outfitPart', { radius: r, height: len + r * 2, tessellation: 12, subdivisions: 2 }, sc);
    m.material = mat; m.position.set(x, y, z); m.scaling.x = sx; m.scaling.z = sz;
    return track(m);
  };
  const mkBox = (mat, w, h, d, x, y, z, ry = 0) => {
    const m = BABYLON.MeshBuilder.CreateBox('outfitPart', { width: w, height: h, depth: d }, sc);
    m.material = mat; m.position.set(x, y, z); m.rotation.y = ry;
    return track(m);
  };

  const span = chestY - hipsY;   // hip→chest reference span, used to scale every other measurement
  const shoulderY = chestY + span * 0.55;
  const kneeYSafe = kneeY !== undefined ? kneeY : hipsY - span * 0.9;
  const footYSafe = footY !== undefined ? footY : kneeYSafe - span * 0.75;
  const shoulderX = Math.max(0.24, Math.abs(shoulderPosL?.x ?? 0.27));

  const shirtMat = mkMat(opts.shirtColor ?? 0x27324f, opts.shirtMetallic ?? 0.06, opts.shirtRoughness ?? 0.75);
  const pantsMat = mkMat(opts.pantsColor ?? 0x1c1f2a, 0.05, 0.8);
  const cuffMat  = mkMat((opts.shirtColor ?? 0x27324f), opts.shirtMetallic ?? 0.06, 0.75);

  // ── Torso: two overlapping capsules (wider chest, narrower waist) instead
  // of a flat box — approximates a tapered human torso silhouette. This is a
  // third-person game (camera behind the player), so full BACK coverage
  // matters more than front — sized generously and overlapped to avoid a
  // "wasp waist" gap between the two capsules during raised-arm poses.
  // Without armor the shirt runs a touch shorter (tank-top-ish) — full
  // sleeve coverage is reserved for when opts.sleeves is set (armor
  // equipped), so an unarmored "No Armor" look reads as casual clothing
  // and never gets mistaken for already wearing protective gear.
  const chestH = (shoulderY - chestY) * (opts.sleeves ? 0.65 : 0.55);
  mkCapsule(shirtMat, 0.26, chestH, 0, chestY + span * 0.08, 0, 1.05, 0.85);
  mkCapsule(shirtMat, 0.23, span * 0.62, 0, hipsY + span * 0.2, 0, 1.0, 0.8);
  // Collar ring at the neck.
  mkCapsule(shirtMat, 0.1, 0.02, 0, shoulderY + 0.04, 0, 1, 0.9);

  // Short collar seam at the shoulder, kept subtle — the full arm (shoulder
  // to wrist) is real bone-tracked armor when opts.armorColor is set (see
  // buildFittedLimbArmor below), so this is never more than a sliver of
  // fabric peeking out at the very top of the shoulder, never a separate
  // "cap" that would read as a second, unaligned bulge next to the pauldron.
  if (opts.sleeves && !opts.armorColor) {
    for (const sx of [-1, 1]) {
      mkCapsule(cuffMat, 0.1, 0.16, sx * shoulderX, shoulderY - 0.08, 0, 1, 1);
    }
  }

  // ── Shorts + pant legs (capsules, tapered thigh→shin via per-piece radius).
  mkCapsule(pantsMat, 0.21, span * 0.4, 0, hipsY - span * 0.05, 0, 1.05, 0.85);
  const legTopY = hipsY - span * 0.15;
  const legMidY = (legTopY + kneeYSafe) / 2;
  const shinMidY = (kneeYSafe + footYSafe) / 2 + span * 0.1;
  for (const sx of [-1, 1]) {
    mkCapsule(pantsMat, 0.135, legTopY - kneeYSafe, sx * 0.11, legMidY, 0);
    mkCapsule(pantsMat, 0.09,  kneeYSafe - shinMidY + span * 0.15, sx * 0.11, shinMidY, 0);
    // Shoe
    mkBox(pantsMat, 0.13, 0.11, 0.24, sx * 0.11, footYSafe + 0.05, 0.05);
  }

  if (opts.armorColor !== undefined) {
    buildFittedTorsoArmor(rig, sc, hipsY, chestY, span, opts.armorColor, track);
    buildFittedLimbArmor(rig, sc, opts.armorColor, rig._outfitMeshes);
    buildFittedHelmet(rig, sc, opts.armorColor, rig._outfitMeshes);
    // Boots: simple, bodyGroup-anchored like the shoe pieces above (feet
    // don't need bone-precise tracking at typical camera distance).
    const bootMat = mkMat(opts.armorColor, 0.6, 0.35);
    for (const sx of [-1, 1]) {
      mkBox(bootMat, 0.15, 0.13, 0.27, sx * 0.11, footYSafe + 0.06, 0.05);
    }
  }
}

// ── Fitted torso armor ────────────────────────────────────────────────────────
// Built from REAL vertex measurements of the Quaternius body mesh (not guessed
// primitive radii): the male torso was sampled in horizontal Y-bands (idle
// pose, arms down, so arm geometry doesn't contaminate the torso silhouette —
// see the M-feedback measurement pass) giving actual half-width/half-depth at
// each height. The profile below is that data expressed as fractions of the
// hip→chest span so it scales correctly for any bodyScale (enemy variants
// etc.), then LOFTED as a stack of tapered-cylinder segments — each segment's
// top/bottom diameter taken straight from the measured widths, squashed to an
// oval cross-section by the measured depth/width ratio. This is what actually
// tracks the body's natural waist-taper (narrow waist, flared chest) instead
// of a single guessed capsule radius.
//   [Y offset from hips (÷span), halfWidth (÷span), halfDepth (÷span)]
const TORSO_PROFILE = [
  [-0.157, 0.483, 0.232],   // low hip
  [ 0.145, 0.425, 0.281],   // waist top
  [ 0.470, 0.386, 0.279],   // narrowing
  [ 0.750, 0.335, 0.251],   // natural waist (narrowest point)
  [ 1.028, 0.444, 0.328],   // lower chest (widening again)
  [ 1.215, 0.511, 0.360],   // upper chest / base of collar
];
const TORSO_ARMOR_MARGIN = 1.16;   // stands the plate off the skin by ~16%

function buildFittedTorsoArmor(rig, sc, hipsY, chestY, span, colorHex, track) {
  const mat = new BABYLON.PBRMaterial('fittedArmor' + Math.random(), sc);
  mat.albedoColor = BABYLON.Color3.FromHexString('#' + colorHex.toString(16).padStart(6, '0'));
  mat.metallic = 0.55; mat.roughness = 0.42;

  for (let i = 0; i < TORSO_PROFILE.length - 1; i++) {
    const [o0, w0, d0] = TORSO_PROFILE[i];
    const [o1, w1, d1] = TORSO_PROFILE[i + 1];
    const y0 = hipsY + o0 * span, y1 = hipsY + o1 * span;
    const seg = BABYLON.MeshBuilder.CreateCylinder('outfitPart', {
      diameterTop: w1 * span * 2 * TORSO_ARMOR_MARGIN,
      diameterBottom: w0 * span * 2 * TORSO_ARMOR_MARGIN,
      height: y1 - y0, tessellation: 20,
    }, sc);
    seg.material = mat;
    seg.position.set(0, (y0 + y1) / 2, 0);
    seg.scaling.z = ((d0 / w0) + (d1 / w1)) / 2;
    track(seg);
  }
}

// ── Bone-tracked limb pieces ──────────────────────────────────────────────────
// A limb armor piece must ROTATE with its bone (elbow bends, arm swings, knee
// bends) or it visibly detaches from the body the instant the character
// animates. The obvious approach — parent the mesh directly to the bone with
// a fixed local transform derived via Local = DesiredWorld * Inverse(BoneWorld)
// — breaks here: every bone in this skeleton carries a baked non-uniform,
// MIRRORED world scale (~1.072, -1.072, 1.072 — a glTF right-handed→
// left-handed handedness fixup applied per-bone). Sandwiching an arbitrary
// world rotation between that non-uniform scale and its inverse produces real
// shear, and Matrix.decompose cannot cleanly invert shear back into a
// scale+rotation pair — the result is the flared, floating, misplaced
// geometry seen when this was tried (verified via a bone-scale diagnostic:
// every limb bone reports exactly that mirrored scale; bodyGroup itself
// reports a clean uniform (1,1,1)).
//
// Fix: build each piece's geometry once (correct world-space dimensions,
// since bodyGroup's scale is clean 1:1 with world units), parent it to
// bodyGroup instead of the bone, and re-derive its position + orientation
// every frame straight from the bones' current WORLD transforms — exactly
// the technique already proven for the gun-in-hand tracking above (rotation
// computed fresh each frame, position via an exact point transform, the
// bone's own scale never inverted or reused).
function _buildLimbSegment(radiusStart, radiusEnd, margin, mat, sc, length) {
  const cyl = BABYLON.MeshBuilder.CreateCylinder('outfitPart', {
    diameterBottom: radiusStart * 2 * margin, diameterTop: radiusEnd * 2 * margin,
    height: length, tessellation: 14,
  }, sc);
  cyl.material = mat;
  cyl.isPickable = false;
  return cyl;
}

// ── Fitted limb armor — vambraces, upper-arm guards, thigh guards, greaves ───
// Radii below come from bone-weight-filtered vertex sampling (only vertices
// whose DOMINANT skinning bone matches the segment were measured, avoiding
// the cross-contamination a naive world-space distance search hits when a
// limb rests near the torso in idle pose). Thigh measured cleanly end-to-end;
// upper-arm/forearm/shin measurements were partly contaminated by skinning
// blend zones near the joints, so those use the reliable partial
// measurements plus anatomically-consistent tapering rather than the noisy
// raw numbers — still real-measurement-informed, not guessed from scratch.
// Radii are the ARMOR's own outer radius at each end (margin applied on top
// as a small standoff from the limb, not as a bulk multiplier) — each piece's
// r1 matches the next piece's r0 (and the joint-cover sphere between them) so
// the taper is continuous down the limb instead of stair-stepping.
const LIMB_MARGIN = 1.08;
const LIMB_SPECS = [
  { bone: 'upperarm', child: 'forearm',  r0: 0.070, r1: 0.058, jointR: 0.058 },
  { bone: 'forearm',  child: 'hand',     r0: 0.058, r1: 0.046, jointR: 0.046 },
  { bone: 'upperleg', child: 'lowerleg', r0: 0.098, r1: 0.070, jointR: 0.070 },
  { bone: 'lowerleg', child: 'foot',     r0: 0.070, r1: 0.054, jointR: null },
];

function buildFittedLimbArmor(rig, sc, colorHex, outfitMeshes) {
  const mat = new BABYLON.PBRMaterial('fittedLimbArmor' + Math.random(), sc);
  mat.albedoColor = BABYLON.Color3.FromHexString('#' + colorHex.toString(16).padStart(6, '0'));
  mat.metallic = 0.55; mat.roughness = 0.42;

  for (const side of ['L', 'R']) {
    for (const spec of LIMB_SPECS) {
      const boneNode = rig.nodes[spec.bone + side];
      const childNode = rig.nodes[spec.child + side];
      if (!boneNode || !childNode) continue;
      boneNode.computeWorldMatrix(true); childNode.computeWorldMatrix(true);
      const length = BABYLON.Vector3.Distance(boneNode.getAbsolutePosition(), childNode.getAbsolutePosition());
      const piece = _buildLimbSegment(spec.r0, spec.r1, LIMB_MARGIN, mat, sc, length);
      piece.parent = rig.bodyGroup;
      piece.rotationQuaternion = BABYLON.Quaternion.Identity();
      outfitMeshes.push(piece);
      rig._limbTrackers.push({ mesh: piece, boneNode, childNode });
      // Joint cover sphere at the child end — masks the small seam between
      // this segment and the next one down the chain (e.g. elbow, knee),
      // which are independently tracked and can't perfectly share an edge.
      if (spec.jointR) {
        const ring = BABYLON.MeshBuilder.CreateSphere('outfitPart',
          { diameter: spec.jointR * 2 * LIMB_MARGIN * 1.04, segments: 10 }, sc);
        ring.material = mat; ring.isPickable = false;
        ring.parent = rig.bodyGroup;
        outfitMeshes.push(ring);
        rig._pointTrackers.push({ mesh: ring, childNode });
      }
    }
  }
}

// ── Fitted helmet ──────────────────────────────────────────────────────────────
// Measured from Head-bone-dominant vertices: the head mesh center sits offset
// up and slightly forward of the bone position (bone sits near the neck
// joint, not the skull centroid — same pattern as every other joint in this
// rig), average radius ≈0.17-0.19. Parented to the head bone so it rides
// head-turn animation for free.
const HELMET_RADIUS = 0.155;
const HELMET_OFFSET = { y: 0.10, z: 0.02 };   // local-ish world offset from the head bone

function buildFittedHelmet(rig, sc, colorHex, outfitMeshes) {
  const headBone = rig.nodes.head;
  if (!headBone) return;
  const mat = new BABYLON.PBRMaterial('fittedHelmet' + Math.random(), sc);
  mat.albedoColor = BABYLON.Color3.FromHexString('#' + colorHex.toString(16).padStart(6, '0'));
  mat.metallic = 0.6; mat.roughness = 0.38;

  const dome = BABYLON.MeshBuilder.CreateSphere('outfitPart', { diameter: HELMET_RADIUS * 2, segments: 16 }, sc);
  dome.material = mat; dome.isPickable = false;
  dome.parent = headBone;
  dome.position.set(0, HELMET_OFFSET.y, HELMET_OFFSET.z);
  dome.rotationQuaternion = BABYLON.Quaternion.Identity();
  outfitMeshes.push(dome);

  // Dark visor band across the eyes.
  const visorMat = new BABYLON.PBRMaterial('visor' + Math.random(), sc);
  visorMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.06);
  visorMat.metallic = 0.3; visorMat.roughness = 0.35;
  const visor = BABYLON.MeshBuilder.CreateBox('outfitPart', { width: HELMET_RADIUS * 1.5, height: HELMET_RADIUS * 0.4, depth: HELMET_RADIUS * 0.5 }, sc);
  visor.material = visorMat; visor.isPickable = false;
  visor.parent = headBone;
  visor.position.set(0, HELMET_OFFSET.y - 0.01, HELMET_OFFSET.z + HELMET_RADIUS * 0.85);
  visor.rotationQuaternion = BABYLON.Quaternion.Identity();
  outfitMeshes.push(visor);
}

// ── Variation tables ──────────────────────────────────────────────────────────
// Skin tones (albedo multiply over the muscular superhero texture).
const SKIN_TONES = [0xf1c9a5, 0xe0ac82, 0xc68642, 0x8d5524, 0xffdbac, 0xa16e4b];
const HAIRS = ['long', 'buzzed', 'buns', 'beard', 'simpleParted'];
const HAIR_COLORS = [0x1a1008, 0x3b2412, 0x6a4a2a, 0x0a0a0a, 0x8a6a3a, 0x2a2a2a];

// Real clothing colors (shirt/pants/armor geometry via applyOutfit) — team
// color reads as an actual uniform, not a skin recolor. `tint` is left
// undefined so jitterVariant gives each enemy a natural skin tone.
export const ENEMY_VARIANTS = {
  grunt:  { body: 'male',   shirtColor: 0x2a3a6a },                                 // navy
  rusher: { body: 'male',   shirtColor: 0xcc5522, bodyScale: [0.94, 0.97, 0.94] },   // orange
  heavy:  { body: 'male',   shirtColor: 0x40502a, armorColor: 0x2f3a1e, bodyScale: [1.22, 1.1, 1.22] }, // olive, bulky
  boss:   { body: 'male',   shirtColor: 0x5a2a8a, armorColor: 0x3a1a5a, bodyScale: [1.15, 1.15, 1.15] }, // purple
  sniper: { body: 'female', shirtColor: 0x2a4a2a },                                 // forest
  bomber: { body: 'male',   shirtColor: 0x8a2020, armorColor: 0x5a1010 },           // red
  medic:  { body: 'female', shirtColor: 0xdddddd },                                 // white
};

// Apocalypse zombies: sickly green/pink skin, no hair variation baseline.
export const ZOMBIE_VARIANTS = {
  grunt:  { body: 'male',   tint: 0x9fd15a },
  rusher: { body: 'male',   tint: 0x8fc24a, bodyScale: [0.94, 0.97, 0.94] },
  heavy:  { body: 'male',   tint: 0x7aad3a, bodyScale: [1.22, 1.1, 1.22] },
  sniper: { body: 'female', tint: 0x9fd15a },
  bomber: { body: 'male',   tint: 0xb0d84a, tintEmissive: 0xff3300 },
  medic:  { body: 'female', tint: 0xaad46a },
  boss:   { body: 'male',   tint: 0xff7fb0, bodyScale: [1.5, 1.3, 1.5] },
};

let _spawnN = 0;
export function jitterVariant(v) {
  const out = { ...v };
  _spawnN++;
  // Skin tone only when the character isn't already given an explicit tint
  // (zombies set their own sickly-green/pink tint).
  if (out.tint === undefined) out.tint = SKIN_TONES[_spawnN % SKIN_TONES.length];
  // Hair + color pick
  if (out.hair === undefined) out.hair = HAIRS[_spawnN % HAIRS.length];
  if (out.hairColor === undefined) out.hairColor = HAIR_COLORS[(_spawnN * 3) % HAIR_COLORS.length];
  // Body jitter
  const bs = out.bodyScale || [1, 1, 1];
  const jx = 1 + (Math.random() - 0.5) * 0.08;
  const jy = 1 + (Math.random() - 0.5) * 0.05;
  out.bodyScale = [bs[0] * jx, bs[1] * jy, bs[2] * jx];
  return out;
}

// ── Attach a rigged human inside an existing (legacy) body group ──────────────
export function attachRiggedToBody(legacyBodyGroup, opts = {}) {
  const rig = createRiggedCharacter({ ...opts, sc: opts.sc || scene });
  if (!rig) return null;
  const keep = (opts.keepNodes || []).filter(Boolean);
  const isKept = (m) => {
    if (m.name === 'hpBar') return true;
    let n = m;
    while (n) { if (keep.includes(n)) return true; n = n.parent; }
    return false;
  };
  for (const m of legacyBodyGroup.getChildMeshes(false)) if (!isKept(m)) m.setEnabled(false);
  rig.bodyGroup.parent = legacyBodyGroup;
  rig.bodyGroup.position.set(0, 0, 0);
  return rig;
}

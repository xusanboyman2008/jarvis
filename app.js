/**
 * Vision.Core // High-Precision Hand Vision & 3D Spatial Manipulation Engine
 * 
 * 3D Models:
 * 1. 🪖 models/damaged_helmet.glb (Battle-Damaged Sci-Fi PBR Helmet)
 * 2. 🤖 models/robot_expressive.glb (Animated Expressive Cyber Robot)
 * 
 * Special Synergistic Controls:
 * - 👈 Left Hand [Index + Middle ✌️ (Others Curled)]: Direct 3D Model Rotation (Pitch, Yaw, Roll)
 * - 👉 Right Hand [Thumb + Pointer 🤏 (Others Curled)]: Dynamic Optical Scaling (Spread = Scale Up, Close = Scale Down)
 * - 👐 Dual-Hand Simultaneous: Rotate with Left Hand + Scale with Right Hand concurrently!
 * - ✊ Fist: Drag & Physics Momentum Throwing
 * - 🔄 Bottom-Right Corner: Single-Hand Box Rotation
 */

// --- DOM ELEMENT BINDINGS ---
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const webglCanvas = document.getElementById('webgl-canvas');

const fpsVal = document.getElementById('fps-val');
const handsCountVal = document.getElementById('hands-count-val');
const interactionVal = document.getElementById('interaction-val');
const systemStatusText = document.getElementById('system-status-text');
const statusIndicator = document.getElementById('status-indicator');
const permissionModal = document.getElementById('permission-modal');

const pointedObjectBanner = document.getElementById('pointed-object-banner');
const selectedObjectIcon = document.getElementById('selected-object-icon');
const selectedObjectName = document.getElementById('selected-object-name');
const selectedObjectDesc = document.getElementById('selected-object-desc');

const leftGestureVal = document.getElementById('left-gesture-val');
const leftFingersVal = document.getElementById('left-fingers-val');
const rightGestureVal = document.getElementById('right-gesture-val');
const rightFingersVal = document.getElementById('right-fingers-val');

const toggleVideo = document.getElementById('toggle-video');
const toggleSkeleton = document.getElementById('toggle-skeleton');
const toggleLaser = document.getElementById('toggle-laser');

const btnToggleCam = document.getElementById('btn-toggle-cam');
const btnSimMode = document.getElementById('btn-sim-mode');
const btnRequestCam = document.getElementById('btn-request-camera');
const btnDemoMode = document.getElementById('btn-demo-mode');
const btnResetLayout = document.getElementById('btn-reset-layout');

// --- SYSTEM & ENGINE STATES ---
let handLandmarker = null;
let legacyHands = null;
let cameraStream = null;
let isSimulating = false;
let isProcessingFrame = false;
let activeModelName = "MediaPipe Full";

// Targeting Laser State (Hold Thumb + Ring for 2.0s)
let isSystemActive = false;
let holdStartTime = null;
const HOLD_DURATION_MS = 2000;
let hasTriggeredForCurrentHold = false;
let lastTouchPoint = { x: 640, y: 360 };

// Laser Point Dwell Selection State (2.0s intentional dwell)
let currentPointedObject = null;
let pointStartTime = null;
const POINT_SELECTION_DURATION_MS = 2000;
let confirmedSelectedObject = null;

// Interaction & Dual-Hand Grab State Management
let currentlyGrabbedObjectId = null;
let grabMode = null; // 'fist' | 'pinch' | 'corner-rot' | 'side-grip' | 'two-finger-rot' | 'mouse'
let grabGraceFrames = 0;
const MAX_GRACE_FRAMES = 3;
let isObjectGrabbed = false;
let lastInteractionText = "READY";

// Dual-Hand Independent Grab States (Left & Right Hands can hold 2 separate objects simultaneously)
function createHandGrabState(label) {
  return {
    handLabel: label,
    grabbedObjId: null,
    grabMode: null, // 'fist' | 'pinch' | 'corner-rot'
    candidateObj: null,
    candidateStartTime: null,
    grabStartTime: null,
    stillStartTime: null,
    stillAnchorPos: { x: 0, y: 0 },
    isCurrentlyMoving: false,
    is3DUnlocked: false,
    initialHandPos: { x: 0, y: 0 },
    initialObjPos: { x: 0, y: 0 },
    initialHandSpan: 0.15,
    initialObjScale: 1.0,
    initialHandAngle: 0,
    initialObjRotZ: 0,
    grabOffsetX: 0,
    grabOffsetY: 0,
    initialSingleObjRotZ: 0,
    initialTwoFingerAngle: 0
  };
}
const handGrabStates = {
  Left: createHandGrabState('Left'),
  Right: createHandGrabState('Right')
};

// Two-Finger (Index + Middle ✌️) Direct 3D Model Rotation (Left or Right Hand inside box)
const TWO_FINGER_ROT_HOLD_MS = 280;
let twoFingerCandidateObj = null;
let twoFingerCandidateStartTime = null;
let isTwoFingerRotating = false;
let twoFingerRotateObjId = null;
let twoFingerHandLabel = null; // 'Left' | 'Right' | 'Dual'
let initialTwoFingerAngle = 0;
let initialTwoFingerPos = { x: 0, y: 0 };
let initialModelRotX = 0;
let initialModelRotY = 0;
let initialModelRotZ = 0;

// Dynamic Optical 3D Model Scaling (Thumb + Pointer 🤏 inside box or while rotating)
const SCALE_CONFIRM_MS = 240;
let scaleCandidateObj = null;
let scaleCandidateStartTime = null;
let isRightHandScaling = false;
let rightHandScaleObjId = null;
let initialRightThumbIndexRatio = null;
let initialObjScaleForRightHand = 1.0;

// Fist 3D Grab & Motion-Gated 1.5s Still Dwell State (Supports Left or Right Hand)
const FIST_CONFIRM_MS = 240;
const FIST_3D_UNLOCK_MS = 1500;
const FIST_STILL_TOLERANCE_PX = 24;
let fistCandidateObj = null;
let fistCandidateStartTime = null;
let fistGrabStartTime = null;
let fistStillStartTime = null;
let fistStillAnchorPos = { x: 0, y: 0 };
let isFistCurrentlyMoving = false;
let is3DFistUnlocked = false;
let fistGrabHandLabel = null;
let initialFistPos = { x: 0, y: 0 };
let initialObjPos = { x: 0, y: 0 };
let initialFistSpan = 0.15;
let initialObjScale = 1.0;
let initialFistAngle = 0;
let initialObjRotZ = 0;

// Single Pinch Grab State (0.28s intentional hold)
const GRAB_CONFIRM_MS = 280;
let pinchCandidateObj = null;
let pinchCandidateStartTime = null;
let grabOffsetX = 0;
let grabOffsetY = 0;
let initialSingleObjRotZ = 0;

// Side-Grip Dual Scale & Rotate Confirmation State (0.28s intentional hold)
const SIDE_GRIP_CONFIRM_MS = 280;
let sideGripCandidateObj = null;
let sideGripStartTime = null;
let isSideGripActive = false;
let initialGripDist = null;
let initialGripScale = null;
let initialGripAngle = null;
let initialGripRotZ = 0;

// Force Pull State (Laser Select -> Open Hand -> Fist Clench within 5.0s)
let forcePullSelectedObject = null;
let forcePullState = 'idle'; // 'idle' | 'selected' | 'opened'
let forcePullSelectedTime = 0;
let lastOpenHandTime = 0;
const FORCE_PULL_WINDOW_MS = 5000;

// Mouse & Touch Control State
let isMouseDown = false;
let mouseGrabbedObj = null;
let mouseOffsetX = 0;
let mouseOffsetY = 0;
let mouseStartX = 0;
let mouseStartY = 0;

// Render Loop & Performance State
let lastRenderTime = performance.now();
let lastRenderFpsTime = performance.now();
let frameCountRender = 0;
let currentFpsRender = 60;
let lastVisionTime = performance.now();
let frameCountVision = 0;
let currentFpsVision = 60;
let globalAnimTime = 0;

// =========================================================================
// ⚡ BAREHANDS AI PRESENCE RING & BLOOMING ORBS MENU ENGINE
// =========================================================================
class BarehandsAIEngine {
  constructor() {
    this.state = 'idle'; // 'idle' | 'listening' | 'thinking' | 'speaking'
    this.mood = 'cyan';  // 'cyan' | 'amber' | 'magenta'
    this.isBloomed = false;
    this.bloomProgress = 0.0;
    this.lastStateChange = performance.now();
    this.tapTime = 0;
    this.amp = 0.0;
    this.activeOrbId = null;
    this.lastClapTime = 0;
    this.isSketchActive = false;
    this.isExplodeActive = false;
    this.explodeAmount = 0.0;
    
    this.orbs = [
      { id: 'notes', label: 'NOTES', icon: '📝', color: '#00e5ff', angle: -Math.PI * 0.55, dist: 165 },
      { id: 'models', label: 'MODELS', icon: '🤖', color: '#eab308', angle: -Math.PI * 0.15, dist: 165 },
      { id: 'sketch', label: 'SKETCH', icon: '✏️', color: '#ff007f', angle: Math.PI * 0.25, dist: 165 },
      { id: 'explode', label: 'EXPLODE', icon: '💥', color: '#a855f7', angle: Math.PI * 0.65, dist: 165 },
      { id: 'reset', label: 'RECALL', icon: '⚡', color: '#00ffcc', angle: Math.PI * 1.05, dist: 165 }
    ];
  }

  toggleBloom() {
    this.isBloomed = !this.isBloomed;
    this.tapTime = performance.now();
    barehandsFoley.arrive();
    return this.isBloomed;
  }

  setState(st) {
    this.state = st;
    this.lastStateChange = performance.now();
  }

  update(dt) {
    const targetBloom = this.isBloomed ? 1.0 : 0.0;
    this.bloomProgress += (targetBloom - this.bloomProgress) * Math.min(1.0, dt * 10.0);
    
    const targetExplode = this.isExplodeActive ? 1.0 : 0.0;
    this.explodeAmount += (targetExplode - this.explodeAmount) * Math.min(1.0, dt * 8.0);
    
    const now = performance.now();
    if (this.state === 'speaking') {
      this.amp = 0.4 + Math.sin(now * 0.014) * 0.35 + Math.random() * 0.22;
    } else {
      this.amp *= 0.88;
    }
  }
}
const barehandsAI = new BarehandsAIEngine();

// --- 3D SPATIAL AIR DRAWING (SKETCH TRAILS) ---
const sketchTrails = [];
let currentSketchStroke = null;
let lastSketchPoint = null;

function addSketchPoint(x, y, z = 0, color = '#00e5ff') {
  const now = performance.now();
  if (!currentSketchStroke) {
    currentSketchStroke = {
      id: Date.now(),
      color,
      points: [],
      startTime: now
    };
    sketchTrails.push(currentSketchStroke);
    barehandsFoley.scale();
  }
  
  if (lastSketchPoint) {
    const d = Math.hypot(x - lastSketchPoint.x, y - lastSketchPoint.y);
    if (d < 3.0) return;
  }
  
  currentSketchStroke.points.push({ x, y, z, time: now });
  lastSketchPoint = { x, y, z };
  spawnParticles(x, y, color, 1, 1);
}

function finishSketchStroke() {
  currentSketchStroke = null;
  lastSketchPoint = null;
}

function clearAllSketches() {
  sketchTrails.length = 0;
  currentSketchStroke = null;
  lastSketchPoint = null;
  barehandsFoley.release();
}

// --- PERSISTENT SCENE OBJECTS ---
const DEFAULT_SCENE_TEMPLATES = [
  {
    id: "OBJ_RING",
    name: "JARVIS Core",
    icon: "⚡",
    desc: "AI Presence Hub // Tap for Orbs",
    x: 640,
    y: 200,
    radius: 95,
    scale: 1.0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    color: "#00e5ff",
    idOffset: 0.0
  },
  {
    id: "OBJ_HELMET",
    name: "Sci-Fi Helmet",
    modelPath: "models/damaged_helmet.glb",
    icon: "🪖",
    desc: "Battle-Damaged Titanium Helmet // PBR",
    x: 340,
    y: 470,
    radius: 120,
    scale: 1.0,
    rotX: 0.15,
    rotY: 0,
    rotZ: 0,
    color: "#00ffcc",
    idOffset: 0.5
  },
  {
    id: "OBJ_ROBOT",
    name: "Cyber Robot",
    modelPath: "models/robot_expressive.glb",
    icon: "🤖",
    desc: "Animated Cyber Android // Active",
    x: 940,
    y: 470,
    radius: 120,
    scale: 1.0,
    rotX: 0.1,
    rotY: 0,
    rotZ: 0,
    color: "#eab308",
    idOffset: 1.5
  }
];

const DEFAULT_OBJECT_POSITIONS = [
  { id: "OBJ_RING", x: 640, y: 200, scale: 1.0, modelScale: 1.0, rotX: 0, rotY: 0, rotZ: 0, modelRotX: 0, modelRotY: 0, modelRotZ: 0 },
  { id: "OBJ_HELMET", x: 340, y: 470, scale: 1.0, modelScale: 1.0, rotX: 0.15, rotY: 0, rotZ: 0, modelRotX: 0, modelRotY: 0, modelRotZ: 0 },
  { id: "OBJ_ROBOT", x: 940, y: 470, scale: 1.0, modelScale: 1.0, rotX: 0.1, rotY: 0, rotZ: 0, modelRotX: 0, modelRotY: 0, modelRotZ: 0 }
];

const SCENE_OBJECTS = [
  {
    id: "OBJ_RING",
    name: "JARVIS Core",
    icon: "⚡",
    desc: "AI Presence Hub // Tap for Orbs",
    x: 640,
    y: 200,
    targetX: 640,
    targetY: 200,
    prevTargetX: 640,
    prevTargetY: 200,
    vx: 0,
    vy: 0,
    physVx: 0,
    physVy: 0,
    physVrot: 0,
    throwVx: 0,
    throwVy: 0,
    peakThrowVx: 0,
    peakThrowVy: 0,
    lastHandMoveTime: 0,
    radius: 95,
    scale: 1.0,
    targetScale: 1.0,
    modelScale: 1.0,
    targetModelScale: 1.0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    targetRotX: 0,
    targetRotY: 0,
    targetRotZ: 0,
    modelRotX: 0,
    targetModelRotX: 0,
    modelRotY: 0,
    targetModelRotY: 0,
    modelRotZ: 0,
    targetModelRotZ: 0,
    color: "#00e5ff",
    idOffset: 0.0
  },
  {
    id: "OBJ_HELMET",
    name: "Sci-Fi Helmet",
    modelPath: "models/damaged_helmet.glb",
    icon: "🪖",
    desc: "Battle-Damaged Titanium Helmet // PBR",
    x: 340,
    y: 470,
    targetX: 340,
    targetY: 470,
    prevTargetX: 340,
    prevTargetY: 470,
    vx: 0,
    vy: 0,
    physVx: 0,
    physVy: 0,
    physVrot: 0,
    throwVx: 0,
    throwVy: 0,
    peakThrowVx: 0,
    peakThrowVy: 0,
    lastHandMoveTime: 0,
    radius: 120,
    scale: 1.0,
    targetScale: 1.0,
    modelScale: 1.0,
    targetModelScale: 1.0,
    rotX: 0.15,
    rotY: 0,
    rotZ: 0,
    targetRotX: 0.15,
    targetRotY: 0,
    targetRotZ: 0,
    modelRotX: 0,
    targetModelRotX: 0,
    modelRotY: 0,
    targetModelRotY: 0,
    modelRotZ: 0,
    targetModelRotZ: 0,
    color: "#00ffcc",
    idOffset: 0.5
  },
  {
    id: "OBJ_ROBOT",
    name: "Cyber Robot",
    modelPath: "models/robot_expressive.glb",
    icon: "🤖",
    desc: "Animated Cyber Android // Active",
    x: 940,
    y: 470,
    targetX: 940,
    targetY: 470,
    prevTargetX: 940,
    prevTargetY: 470,
    vx: 0,
    vy: 0,
    physVx: 0,
    physVy: 0,
    physVrot: 0,
    throwVx: 0,
    throwVy: 0,
    peakThrowVx: 0,
    peakThrowVy: 0,
    lastHandMoveTime: 0,
    radius: 120,
    scale: 1.0,
    targetScale: 1.0,
    modelScale: 1.0,
    targetModelScale: 1.0,
    rotX: 0.1,
    rotY: 0,
    rotZ: 0,
    targetRotX: 0.1,
    targetRotY: 0,
    targetRotZ: 0,
    modelRotX: 0,
    targetModelRotX: 0,
    modelRotY: 0,
    targetModelRotY: 0,
    modelRotZ: 0,
    targetModelRotZ: 0,
    color: "#eab308",
    idOffset: 1.5
  }
];

// Restore saved coordinates and rotations from localStorage
try {
  const savedPositions = localStorage.getItem('vision_core_internet_3d_v6');
  if (savedPositions) {
    const parsed = JSON.parse(savedPositions);
    parsed.forEach(item => {
      const obj = SCENE_OBJECTS.find(o => o.id === item.id);
      if (obj) {
        obj.x = obj.targetX = obj.prevTargetX = item.x;
        obj.y = obj.targetY = obj.prevTargetY = item.y;
        obj.scale = obj.targetScale = item.scale || 1.0;
        obj.rotX = obj.targetRotX = item.rotX || 0;
        obj.rotY = obj.targetRotY = item.rotY || 0;
        obj.rotZ = obj.targetRotZ = item.rotZ || 0;
        obj.modelRotX = obj.targetModelRotX = item.modelRotX || 0;
        obj.modelRotY = obj.targetModelRotY = item.modelRotY || 0;
        obj.modelRotZ = obj.targetModelRotZ = item.modelRotZ || 0;
      }
    });
  }
} catch (e) {}

confirmedSelectedObject = SCENE_OBJECTS[0];

function savePositionsToStorage() {
  try {
    const data = SCENE_OBJECTS.map(o => ({
      id: o.id,
      x: Math.round(o.targetX),
      y: Math.round(o.targetY),
      scale: Number(o.targetScale.toFixed(2)),
      rotX: Number(o.targetRotX.toFixed(2)),
      rotY: Number(o.targetRotY.toFixed(2)),
      rotZ: Number(o.targetRotZ.toFixed(2)),
      modelRotX: Number(o.targetModelRotX.toFixed(2)),
      modelRotY: Number(o.targetModelRotY.toFixed(2)),
      modelRotZ: Number(o.targetModelRotZ.toFixed(2))
    }));
    localStorage.setItem('vision_core_internet_3d_v6', JSON.stringify(data));
  } catch (e) {}
}

function removeObjectFromScene(obj) {
  if (!obj) return;

  // 1. Remove and dispose Three.js 3D model
  if (obj.threeGroup && threeScene) {
    threeScene.remove(obj.threeGroup);
    obj.threeGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    obj.threeGroup = null;
  }

  // 2. Clear all interaction and selection states
  if (currentlyGrabbedObjectId === obj.id) {
    currentlyGrabbedObjectId = null;
    isObjectGrabbed = false;
    grabMode = null;
    mouseGrabbedObj = null;
    pinchCandidateObj = null;
    fistCandidateObj = null;
    fistGrabStartTime = null;
    fistStillStartTime = null;
  }
  if (confirmedSelectedObject && confirmedSelectedObject.id === obj.id) {
    confirmedSelectedObject = SCENE_OBJECTS.find(o => o.id !== obj.id) || null;
  }
  if (forcePullSelectedObject && forcePullSelectedObject.id === obj.id) {
    forcePullSelectedObject = null;
    forcePullState = 'idle';
  }
  if (twoFingerRotateObjId === obj.id) {
    isTwoFingerRotating = false;
    twoFingerRotateObjId = null;
  }
  if (rightHandScaleObjId === obj.id) {
    isRightHandScaling = false;
    rightHandScaleObjId = null;
  }

  // 3. Remove from SCENE_OBJECTS array
  const idx = SCENE_OBJECTS.findIndex(o => o.id === obj.id);
  if (idx !== -1) {
    SCENE_OBJECTS.splice(idx, 1);
    savePositionsToStorage();
  }
  lastInteractionText = `🗑️ REMOVED ${obj.name.toUpperCase()} (OUT OF PLAYGROUND)`;
}

function createSceneObjectInstance(def) {
  const obj = {
    id: def.id,
    name: def.name,
    modelPath: def.modelPath,
    icon: def.icon,
    desc: def.desc,
    x: def.x,
    y: def.y,
    targetX: def.x,
    targetY: def.y,
    prevTargetX: def.x,
    prevTargetY: def.y,
    vx: 0,
    vy: 0,
    physVx: 0,
    physVy: 0,
    physVrot: 0,
    throwVx: 0,
    throwVy: 0,
    peakThrowVx: 0,
    peakThrowVy: 0,
    lastHandMoveTime: 0,
    radius: def.radius || 130,
    scale: def.scale || 1.0,
    targetScale: def.scale || 1.0,
    modelScale: 1.0,
    targetModelScale: 1.0,
    rotX: def.rotX || 0,
    rotY: def.rotY || 0,
    rotZ: def.rotZ || 0,
    targetRotX: def.rotX || 0,
    targetRotY: def.rotY || 0,
    targetRotZ: def.rotZ || 0,
    modelRotX: 0,
    targetModelRotX: 0,
    modelRotY: 0,
    targetModelRotY: 0,
    modelRotZ: 0,
    targetModelRotZ: 0,
    color: def.color || "#00ffcc",
    idOffset: def.idOffset || 0
  };

  if (threeScene && typeof THREE !== 'undefined') {
    const group = new THREE.Group();
    group.position.set(obj.x, 720 - obj.y, 0);
    threeScene.add(group);
    obj.threeGroup = group;

    load3DModel(obj);

    const objLight = new THREE.PointLight(obj.color === "#00ffcc" ? 0x00ffcc : 0xffcc00, 2.5, 400);
    objLight.position.set(0, 0, 120);
    group.add(objLight);
    obj.threeLight = objLight;
  }

  return obj;
}

function resetAllToDefault() {
  DEFAULT_SCENE_TEMPLATES.forEach(tmpl => {
    let obj = SCENE_OBJECTS.find(o => o.id === tmpl.id);
    if (!obj) {
      obj = createSceneObjectInstance(tmpl);
      SCENE_OBJECTS.push(obj);
    }
    const def = DEFAULT_OBJECT_POSITIONS.find(d => d.id === tmpl.id) || tmpl;
    obj.x = obj.targetX = obj.prevTargetX = def.x;
    obj.y = obj.targetY = obj.prevTargetY = def.y;
    obj.physVx = 0;
    obj.physVy = 0;
    obj.physVrot = 0;
    obj.throwVx = 0;
    obj.throwVy = 0;
    obj.peakThrowVx = 0;
    obj.peakThrowVy = 0;
    obj.scale = obj.targetScale = def.scale || 1.0;
    obj.modelScale = obj.targetModelScale = 1.0;
    obj.rotX = obj.targetRotX = def.rotX || 0;
    obj.rotY = obj.targetRotY = def.rotY || 0;
    obj.rotZ = obj.targetRotZ = def.rotZ || 0;
    obj.modelRotX = obj.targetModelRotX = def.modelRotX || 0;
    obj.modelRotY = obj.targetModelRotY = def.modelRotY || 0;
    obj.modelRotZ = obj.targetModelRotZ = def.modelRotZ || 0;
  });

  if (!confirmedSelectedObject && SCENE_OBJECTS.length > 0) {
    confirmedSelectedObject = SCENE_OBJECTS[0];
  }
  savePositionsToStorage();
  lastInteractionText = "STAGE RESET TO DEFAULT POSITIONS";
}

if (btnResetLayout) {
  btnResetLayout.addEventListener('click', resetAllToDefault);
}

// 21 Hand Topology Connections
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index
  [5, 9], [9, 10], [10, 11], [11, 12],   // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky & Palm
];

// Helper: Transform point to local rotated coordinates of object box
function toLocalBoxCoords(px, py, obj) {
  const dx = px - obj.x;
  const dy = py - obj.y;
  const cos = Math.cos(-obj.rotZ);
  const sin = Math.sin(-obj.rotZ);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos
  };
}

// --- THREE.JS WEBGL 3D SCENE & MODEL ENGINE ---
let threeScene = null;
let threeCamera = null;
let threeRenderer = null;
let gltfLoaderInstance = null;

function initThreeScene() {
  if (typeof THREE === 'undefined') {
    console.warn("Three.js not loaded, using pure 2D/3D projection engine");
    return;
  }

  threeScene = new THREE.Scene();

  threeCamera = new THREE.OrthographicCamera(0, 1280, 720, 0, -2500, 2500);
  threeCamera.position.set(0, 0, 800);

  threeRenderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    alpha: true,
    antialias: true
  });
  threeRenderer.setClearColor(0x000000, 0); // 100% Transparent
  threeRenderer.setSize(1280, 720, false);
  threeRenderer.setPixelRatio(window.devicePixelRatio || 1);
  threeRenderer.outputEncoding = THREE.sRGBEncoding;

  // Studio Lighting Rig for PBR Metallic Surfaces
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
  threeScene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.8);
  threeScene.add(hemiLight);

  const frontDir = new THREE.DirectionalLight(0xffffff, 2.8);
  frontDir.position.set(0, 400, 800);
  threeScene.add(frontDir);

  const keyCyan = new THREE.DirectionalLight(0x00ffcc, 2.5);
  keyCyan.position.set(600, 600, 500);
  threeScene.add(keyCyan);

  const rimMagenta = new THREE.DirectionalLight(0xff007f, 2.2);
  rimMagenta.position.set(-600, -200, 500);
  threeScene.add(rimMagenta);

  SCENE_OBJECTS.forEach(obj => {
    const group = new THREE.Group();
    group.position.set(obj.x, 720 - obj.y, 0);
    threeScene.add(group);
    obj.threeGroup = group;

    load3DModel(obj);

    // 2. Point Light attached to object group
    const objLight = new THREE.PointLight(obj.color === "#00ffcc" ? 0x00ffcc : 0xffcc00, 2.5, 400);
    objLight.position.set(0, 0, 120);
    group.add(objLight);
    obj.threeLight = objLight;
  });
}

function load3DModel(obj) {
  if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined' || !obj.modelPath) {
    return;
  }

  if (!gltfLoaderInstance) {
    gltfLoaderInstance = new THREE.GLTFLoader();
  }

  gltfLoaderInstance.load(
    obj.modelPath,
    (gltf) => {
      const model = gltf.scene;

      // Extract submeshes and compute radial centroid directions for Barehands Exploded View
      const submeshes = [];
      model.traverse((child) => {
        if (child.isMesh) {
          child.frustumCulled = false;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            if (child.material.isMeshStandardMaterial) {
              child.material.roughness = Math.max(0.2, child.material.roughness);
              child.material.metalness = Math.min(0.85, child.material.metalness);
            }
            child.material.needsUpdate = true;
          }
          const meshCenter = new THREE.Vector3();
          try {
            const childBox = new THREE.Box3().setFromObject(child);
            childBox.getCenter(meshCenter);
          } catch(e) {}
          const dir = meshCenter.clone().normalize();
          if (dir.length() < 0.1) dir.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, Math.random() * 2).normalize();
          submeshes.push({
            mesh: child,
            homePos: child.position.clone(),
            dir
          });
        }
      });
      obj.submeshes = submeshes;

      // Calculate Bounding Box of model
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

      // Offset model inside wrapper so geometric center is strictly at (0, 0, 0)
      model.position.x -= center.x;
      model.position.y -= center.y;
      model.position.z -= center.z;

      const pivotWrapper = new THREE.Group();
      pivotWrapper.add(model);

      const targetSize = obj.radius * 1.55;
      const bScale = targetSize / maxDim;
      pivotWrapper.scale.set(bScale, bScale, bScale);

      // Replace procedural placeholder with real centered model
      if (obj.protoGroup && obj.threeGroup) {
        obj.threeGroup.remove(obj.protoGroup);
      }
      obj.threeGroup.add(pivotWrapper);
      obj.gltfModel = pivotWrapper;

      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach(clip => {
          mixer.clipAction(clip).play();
        });
        obj.mixer = mixer;
      }
      console.log(`Successfully loaded & centered 3D model: ${obj.name}`);
    },
    undefined,
    (error) => {
      console.warn(`Could not load GLB ${obj.modelPath}:`, error);
    }
  );
}

// --- HIGH-PERFORMANCE PARTICLE & SHOCKWAVE SYSTEM ---
const particles = [];
const shockwaves = [];

function spawnParticles(x, y, color, count = 10, speed = 3.5) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.7) * speed;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      size: 2 + Math.random() * 3.5,
      color: color,
      alpha: 1.0,
      decay: 0.02 + Math.random() * 0.03
    });
  }
}

function spawnShockwave(x, y, color, maxRadius = 240, lineWidth = 4) {
  shockwaves.push({
    x,
    y,
    color,
    radius: 10,
    maxRadius,
    lineWidth,
    alpha: 1.0,
    speed: 9 + Math.random() * 3
  });
}

function updateAndRenderEffects(ctx, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.radius += s.speed;
    s.alpha = Math.max(0, 1.0 - (s.radius / s.maxRadius));
    if (s.radius >= s.maxRadius || s.alpha <= 0) {
      shockwaves.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.alpha;
    ctx.lineWidth = s.lineWidth * s.alpha;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.restore();
  }
}

// --- BAREHANDS PROCEDURAL WEBAUDIO FOLEY SYNTHESIZER ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}
window.addEventListener('keydown', getAudioContext);
window.addEventListener('click', getAudioContext);
window.addEventListener('touchstart', getAudioContext);

function playNoise(dur, fLo, fHi, gain, sweepTo) {
  const ac = getAudioContext();
  if (!ac || ac.state !== 'running') return;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime((fLo + fHi) / 2, ac.currentTime);
  if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, ac.currentTime + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur);
}

function playTone(freq, dur, gain = 0.08, type = 'sine', sweepTo = 0, delay = 0) {
  const ac = getAudioContext();
  if (!ac || ac.state !== 'running') return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

const barehandsFoley = {
  grab: () => { playNoise(0.04, 900, 2200, 0.12); playTone(160, 0.07, 0.14, 'triangle'); },
  release: () => { playTone(240, 0.05, 0.08, 'sine', 120); },
  throw: (spd) => {
    const intensity = Math.min(1.0, spd / 1200);
    playNoise(0.08 + intensity * 0.08, 400, 1800, 0.12 + intensity * 0.1, 120);
    playTone(280 + intensity * 220, 0.14, 0.09, 'triangle', 90);
  },
  bounce: () => {
    playTone(190, 0.06, 0.12, 'sine', 70);
    playNoise(0.03, 800, 1600, 0.08);
  },
  scale: () => { playTone(360 + Math.random() * 120, 0.035, 0.03, 'sine'); },
  arrive: () => {
    playTone(523.25, 0.10, 0.07);
    playTone(659.25, 0.10, 0.07, 'sine', 0, 0.06);
    playTone(783.99, 0.14, 0.08, 'sine', 0, 0.12);
  },
  toggleOn: () => { playTone(440, 0.08, 0.08, 'sawtooth', 880); },
  toggleOff: () => { playTone(660, 0.08, 0.08, 'sawtooth', 220); }
};

// --- ONE-EURO ADAPTIVE LANDMARK FILTER ---
class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  alpha(rate, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(x, timestamp) {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = timestamp;
      return x;
    }

    const dt = Math.max((timestamp - this.tPrev) / 1000.0, 1e-4);
    this.tPrev = timestamp;
    const rate = 1.0 / dt;

    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(rate, this.dCutoff);
    const dxHat = aD * dx + (1.0 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(rate, cutoff);
    const xHat = a * x + (1.0 - a) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }
}

const landmarkFilters = {
  Left: Array.from({ length: 21 }, () => ({ x: new OneEuroFilter(1.2, 0.008), y: new OneEuroFilter(1.2, 0.008) })),
  Right: Array.from({ length: 21 }, () => ({ x: new OneEuroFilter(1.2, 0.008), y: new OneEuroFilter(1.2, 0.008) }))
};

function applyAdaptiveFiltering(rawLandmarks, label, timestamp) {
  const filters = landmarkFilters[label] || landmarkFilters.Left;
  return rawLandmarks.map((p, idx) => ({
    x: filters[idx].x.filter(p.x, timestamp),
    y: filters[idx].y.filter(p.y, timestamp),
    z: p.z || 0
  }));
}

function dist(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// --- FINGER POSTURE & EXTENSION ANALYSIS ---
function analyzeFingers(landmarks) {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const pinkyMCP = landmarks[17];

  const dWristTip8 = dist(landmarks[8], wrist);
  const dWristPip6 = dist(landmarks[6], wrist);
  const dWristTip12 = dist(landmarks[12], wrist);
  const dWristPip10 = dist(landmarks[10], wrist);
  const dWristTip16 = dist(landmarks[16], wrist);
  const dWristPip14 = dist(landmarks[14], wrist);
  const dWristTip20 = dist(landmarks[20], wrist);
  const dWristPip18 = dist(landmarks[18], wrist);

  const dMcpTip8 = dist(landmarks[8], landmarks[5]);
  const dMcpPip6 = dist(landmarks[6], landmarks[5]);
  const dMcpTip12 = dist(landmarks[12], landmarks[9]);
  const dMcpPip10 = dist(landmarks[10], landmarks[9]);
  const dMcpTip16 = dist(landmarks[16], landmarks[13]);
  const dMcpPip14 = dist(landmarks[14], landmarks[13]);
  const dMcpTip20 = dist(landmarks[20], landmarks[17]);
  const dMcpPip18 = dist(landmarks[18], landmarks[17]);

  // A finger is truly EXTENDED if tip is past PIP relative to MCP, AND tip is extended from wrist
  const indexOpen = (dMcpTip8 > dMcpPip6 * 1.15) && (dWristTip8 > dWristPip6 * 1.02);
  const middleOpen = (dMcpTip12 > dMcpPip10 * 1.15) && (dWristTip12 > dWristPip10 * 1.02);
  const ringOpen = (dMcpTip16 > dMcpPip14 * 1.15) && (dWristTip16 > dWristPip14 * 1.02);
  const pinkyOpen = (dMcpTip20 > dMcpPip18 * 1.15) && (dWristTip20 > dWristPip18 * 1.02);
  const thumbOpen = dist(thumbTip, pinkyMCP) > dist(thumbIP, pinkyMCP) * 1.04;

  // Genuine Fist Posture: none of the 4 main fingers are open
  const isFistPosture = !indexOpen && !middleOpen && !ringOpen && !pinkyOpen;

  // Genuine 2-Finger Posture: index and middle are open, ring and pinky are closed, not a fist
  const isTwoFingerDirect = !isFistPosture && indexOpen && middleOpen && !ringOpen && !pinkyOpen;

  // Palm Plane Normal & Front / Back Orientation
  // Vector A: from wrist (0) to middle MCP (9)
  const ax = landmarks[9].x - landmarks[0].x;
  const ay = landmarks[9].y - landmarks[0].y;
  // Vector B: from index MCP (5) to pinky MCP (17)
  const bx = landmarks[17].x - landmarks[5].x;
  const by = landmarks[17].y - landmarks[5].y;
  // Cross product Z-component
  const crossZ = ax * by - ay * bx;

  // Relative Depth: Knuckles (5,9,13,17) vs Curled Tips (8,12,16,20)
  const avgZKnuckles = ((landmarks[5].z || 0) + (landmarks[9].z || 0) + (landmarks[13].z || 0) + (landmarks[17].z || 0)) / 4.0;
  const avgZTips = ((landmarks[8].z || 0) + (landmarks[12].z || 0) + (landmarks[16].z || 0) + (landmarks[20].z || 0)) / 4.0;
  const zDiff = avgZTips - avgZKnuckles; // > 0 means fingertips are behind knuckles (Back of hand facing camera)

  const thumbToIndexX = landmarks[4].x - landmarks[5].x;

  const fingers = {
    thumb: thumbOpen,
    index: indexOpen,
    middle: middleOpen,
    ring: ringOpen,
    pinky: pinkyOpen
  };

  const count = (thumbOpen ? 1 : 0) +
                (indexOpen ? 1 : 0) +
                (middleOpen ? 1 : 0) +
                (ringOpen ? 1 : 0) +
                (pinkyOpen ? 1 : 0);

  return {
    fingers,
    count,
    wrist,
    thumbTip,
    indexTip: landmarks[8],
    middleTip: landmarks[12],
    palmCenter: landmarks[9],
    isFistPosture,
    isTwoFingerDirect,
    crossZ,
    zDiff,
    thumbToIndexX,
    avgZKnuckles,
    avgZTips
  };
}

// --- GESTURE CLASSIFIER WITH FRONT/BACK ORIENTATION ---
function classifyGesture(analysis, landmarks, handLabel = 'Right') {
  const { fingers, count, thumbTip, indexTip, isFistPosture, isTwoFingerDirect, crossZ, zDiff, thumbToIndexX } = analysis;
  const dThumbIndex = dist(thumbTip, indexTip);
  const isPinchContact = dThumbIndex < 0.085;

  // Determine Hand & Fist Orientation: FRONT (Palm) vs BACK (Dorsal / Knuckles)
  let isBackFacing = false;
  if (handLabel === 'Right') {
    isBackFacing = (crossZ > 0.004) || (zDiff > 0.015);
  } else {
    isBackFacing = (crossZ < -0.004) || (zDiff > 0.015);
  }
  const facing = isBackFacing ? 'BACK' : 'FRONT';

  // 1. Fist ✊ (PRIORITY FOR GRAB & THROW - With Front / Back Tracking)
  if (isFistPosture) {
    const fistName = isBackFacing ? "Fist ✊ [BACK]" : "Fist ✊ [FRONT]";
    return { name: fistName, count: 0, isFist: true, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
  }

  // 2. Index + Middle ✌️ (Direct 3D Model Rotation)
  if (isTwoFingerDirect || (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky)) {
    return { name: "Index + Middle ✌️", count: 2, isFist: false, isPinch: false, isTwoFinger: true, isThumbIndexScale: false, facing, isBackFacing };
  }

  // 3. Pinch Contact 🤏 (Thumb & Index touching)
  if (isPinchContact) {
    return { name: "Pinch 🤏", count: count, isFist: false, isPinch: true, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
  }

  // 4. Thumb + Pointer Extended & SPREAD, Others Down like a Fist (Dynamic Scaling)
  const isThumbIndexScale = fingers.thumb && fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky && dThumbIndex >= 0.095;
  if (isThumbIndexScale) {
    return { name: "Thumb + Pointer 🤏", count: 2, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: true, facing, isBackFacing };
  }

  if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
    return { name: "Pointer ☝️", count: 1, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
  }

  if (fingers.index && fingers.pinky && !fingers.middle && !fingers.ring) {
    return { name: "Rock 🤘", count: 2, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
  }

  if (fingers.thumb && fingers.pinky && !fingers.index && !fingers.middle && !fingers.ring) {
    return { name: "Call 🤙", count: 2, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
  }

  switch (count) {
    case 0: return { name: isBackFacing ? "Fist ✊ [BACK]" : "Fist ✊ [FRONT]", count: 0, isFist: true, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
    case 1: return { name: "1 Finger", count: 1, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
    case 2: return { name: "2 Fingers", count: 2, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
    case 3: return { name: "3 Fingers", count: 3, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
    case 4: return { name: "4 Fingers", count: 4, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
    case 5: return { name: `Open Hand 🖐️ [${facing}]`, count: 5, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
    default: return { name: `${count} Fingers`, count, isFist: false, isPinch: false, isTwoFinger: false, isThumbIndexScale: false, facing, isBackFacing };
  }
}

// --- ⚡ RENDER BAREHANDS AI PRESENCE RING & RADIAL BLOOMING ORBS MENU ---
function drawBarehandsRing(ctx, obj, isTargeted, isThisGrabbed, isConfirmed, dt) {
  barehandsAI.update(dt);
  const { state, mood, bloomProgress, amp, orbs } = barehandsAI;
  const now = performance.now();
  const rad = obj.radius * obj.scale;

  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.rotZ);

  // 1. Blooming Radial Orbs Menu
  if (bloomProgress > 0.01) {
    orbs.forEach(orb => {
      const curDist = orb.dist * bloomProgress * obj.scale;
      const ox = Math.cos(orb.angle) * curDist;
      const oy = Math.sin(orb.angle) * curDist;
      const orbR = 34 * bloomProgress * obj.scale;

      ctx.save();
      ctx.translate(ox, oy);

      // Check hover / targeting
      const isOrbHovered = barehandsAI.activeOrbId === orb.id;

      // Frosted Glass Orb Background
      ctx.beginPath();
      ctx.arc(0, 0, orbR, 0, Math.PI * 2);
      ctx.fillStyle = isOrbHovered ? "rgba(18, 54, 50, 0.95)" : "rgba(8, 28, 26, 0.88)";
      ctx.fill();

      // Outer Luminous Border
      ctx.strokeStyle = isOrbHovered ? "#ffffff" : orb.color;
      ctx.lineWidth = isOrbHovered ? 3.0 : 1.8;
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = isOrbHovered ? 20 : 10;
      ctx.stroke();

      // Inner specular arc
      ctx.beginPath();
      ctx.arc(0, 0, orbR - 4, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Icon Emoji
      ctx.shadowBlur = 0;
      ctx.font = `${Math.round(20 * bloomProgress * obj.scale)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(orb.icon, 0, -3);

      // Label beneath Orb
      ctx.fillStyle = isOrbHovered ? "#ffffff" : "#a8d8cf";
      ctx.font = `bold ${Math.max(9, Math.round(10 * bloomProgress * obj.scale))}px 'JetBrains Mono', monospace`;
      ctx.fillText(orb.label, 0, orbR + 14);

      ctx.restore();
    });
  }

  // 2. The Main AI Presence Ring
  // Outer Glowing Aura
  const breath = 0.92 + 0.08 * Math.sin(now * 0.002);
  const glowBlur = (12 + amp * 32) * breath;
  
  // Solid Outer Hot Rim
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.strokeStyle = state === 'speaking' ? "#ffffff" : (isThisGrabbed ? "#00ffcc" : "rgba(140, 240, 225, 0.9)");
  ctx.lineWidth = 3.0 + amp * 4.0;
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = glowBlur;
  ctx.stroke();

  // Thick Luminous Power Band
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.90, 0, Math.PI * 2);
  ctx.strokeStyle = state === 'speaking' ? "rgba(235, 250, 252, 0.95)" : "rgba(0, 229, 255, 0.85)";
  ctx.lineWidth = 14 + amp * 6;
  ctx.shadowBlur = glowBlur + 6;
  ctx.stroke();

  // Inner Thin Ring
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.78, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 229, 255, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 0;
  ctx.stroke();

  // Concentric Radial Ticks (48 ticks)
  const numTicks = 48;
  for (let i = 0; i < numTicks; i++) {
    const a = (i / numTicks) * Math.PI * 2;
    const isMajor = i % 4 === 0;
    const rIn = rad * (isMajor ? 0.68 : 0.72);
    const rOut = rad * 0.76;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
    ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
    ctx.strokeStyle = isMajor ? "rgba(0, 229, 255, 0.75)" : "rgba(0, 229, 255, 0.35)";
    ctx.lineWidth = isMajor ? 2.0 : 1.0;
    ctx.stroke();
  }

  // State FX in Core
  if (state === 'listening') {
    // Inward drawing pulses
    for (let k = 0; k < 3; k++) {
      const p = ((now * 0.0008) + k / 3) % 1.0;
      ctx.beginPath();
      ctx.arc(0, 0, rad * (0.76 - p * 0.45), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 229, 255, ${(1.0 - p) * 0.75})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  } else if (state === 'thinking') {
    // Rotating radar sweep
    const sweepA = now * 0.0035;
    for (let i = 0; i < 8; i++) {
      const a = sweepA - i * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.70, a - 0.12, a);
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.65 * (1 - i / 8)})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 10;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  // Glass Core Disk
  ctx.beginPath();
  ctx.arc(0, 0, rad * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(4, 18, 20, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Wordmark + Status
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("J.A.R.V.I.S.", 0, -8);

  ctx.fillStyle = "#00ffcc";
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  const stateLabel = state.toUpperCase();
  ctx.fillText(stateLabel, 0, 12);

  // Bottom Hint: "TAP FOR ORBS"
  ctx.fillStyle = isThisGrabbed ? "#ffff00" : (barehandsAI.isBloomed ? "#00e5ff" : "#94a3b8");
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  ctx.fillText(barehandsAI.isBloomed ? "✦ ORBS BLOOMED // TAP TO FOLD" : "✦ TAP RING TO BLOOM ORBS", 0, rad + 24);

  ctx.restore();
}

// --- 📝 RENDER BAREHANDS GLASS MARKDOWN NOTES CARD ---
function drawGlassNoteCard(ctx, obj, isTargeted, isThisGrabbed, isConfirmed, dt) {
  const w = 460;
  const h = 280;
  const hw = w / 2;
  const hh = h / 2;

  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.rotZ);

  // 1. Frosted Smoked Dark Teal Glass Background
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, w, h, 14);
  const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  grad.addColorStop(0, "rgba(22, 58, 52, 0.94)");
  grad.addColorStop(1, "rgba(8, 24, 22, 0.96)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Luminous Cyan / Teal Edge
  ctx.strokeStyle = isThisGrabbed ? "#00ffcc" : (isTargeted ? "rgba(0, 229, 255, 0.9)" : "rgba(111, 229, 214, 0.55)");
  ctx.lineWidth = isThisGrabbed ? 2.5 : 1.5;
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = isThisGrabbed ? 22 : 12;
  ctx.stroke();

  // Top Specular Highlight Edge
  ctx.beginPath();
  ctx.moveTo(-hw + 14, -hh + 1.5);
  ctx.lineTo(hw - 14, -hh + 1.5);
  ctx.strokeStyle = "rgba(210, 255, 248, 0.65)";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 0;
  ctx.stroke();

  // 2. Top Header Bar
  ctx.fillStyle = "rgba(0, 229, 255, 0.12)";
  ctx.fillRect(-hw + 1, -hh + 1, w - 2, 38);

  ctx.fillStyle = "#8ff0e4";
  ctx.font = "bold 13px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("⚡ JARVIS // DIRECTIVES & GESTURES", -hw + 16, -hh + 20);

  // Close Button [✕] at Top-Right
  const closeBtnX = hw - 22;
  const closeBtnY = -hh + 20;
  ctx.beginPath();
  ctx.arc(closeBtnX, closeBtnY, 11, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 229, 255, 0.25)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 229, 255, 0.8)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("✕", closeBtnX, closeBtnY + 1);

  // 3. Formatted Directives & Gestures Content Rows
  const items = [
    { tag: "👐 DUAL GRAB", desc: "Left + Right hands hold 2 objects simultaneously", col: "#00e5ff" },
    { tag: "✌️ 3D ROTATE", desc: "Index+Middle 2-finger gesture spins 3D pitch/yaw/roll", col: "#00ffcc" },
    { tag: "🤏 3D SCALE", desc: "Thumb+Pointer 2-finger spread to expand / shrink", col: "#ff007f" },
    { tag: "✊ FIST THROW", desc: "Instant grab & swing to launch with momentum glide", col: "#ffff00" },
    { tag: "👏 CLAP", desc: "Palms together (fingers up) recalls JARVIS to center", col: "#a855f7" },
    { tag: "✏️ 3D SKETCH", desc: "1-finger pointer draws floating neon light ribbons", col: "#ff007f" },
    { tag: "💥 EXPLODE", desc: "Scrub / tap explode orb to disassemble 3D meshes", col: "#38bdf8" }
  ];

  let rowY = -hh + 56;
  ctx.textAlign = "left";
  items.forEach(item => {
    // Tag Badge
    ctx.fillStyle = item.col;
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(item.tag, -hw + 16, rowY);

    // Description
    ctx.fillStyle = "#dcf5ee";
    ctx.font = "11px sans-serif";
    ctx.fillText(item.desc, -hw + 120, rowY);

    rowY += 28;
  });

  ctx.restore();
}

// --- 🎨 RENDER 3D SPATIAL AIR DRAWING TRAILS ---
function drawSketchTrails(ctx) {
  if (sketchTrails.length === 0) return;

  ctx.save();
  sketchTrails.forEach(stroke => {
    if (!stroke.points || stroke.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p0 = stroke.points[i - 1];
      const p1 = stroke.points[i];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }

    ctx.strokeStyle = stroke.color || "#00e5ff";
    ctx.lineWidth = 4.5;
    ctx.shadowColor = stroke.color || "#00e5ff";
    ctx.shadowBlur = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // White core highlight
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 0;
    ctx.stroke();
  });
  ctx.restore();
}

/// --- RENDER SCENE OBJECTS WITH UNIFIED ROTATED BOX & 3D MODEL ---
function renderSceneObjects(ctx, pointerRays, isEngaged, activePointedId, dwellProgress, dt) {
  let activePointedObject = null;
  const objectsToDelete = [];

  SCENE_OBJECTS.forEach(obj => {
    const prevX = obj.x;
    const prevY = obj.y;

    const isLeftGrabbed = handGrabStates.Left.grabbedObjId === obj.id;
    const isRightGrabbed = handGrabStates.Right.grabbedObjId === obj.id;
    const isThisGrabbed = isLeftGrabbed || isRightGrabbed || currentlyGrabbedObjectId === obj.id || (mouseGrabbedObj && mouseGrabbedObj.id === obj.id) || (isTwoFingerRotating && twoFingerRotateObjId === obj.id) || (isRightHandScaling && rightHandScaleObjId === obj.id);
    const effRadius = obj.radius * obj.scale;

    // --- PHYSICS IMPULSE MOMENTUM SIMULATION WHEN THROWN ---
    if (!isThisGrabbed) {
      const speed = Math.hypot(obj.physVx || 0, obj.physVy || 0);

      if (speed > 8.0) {
        // Integrate position from throw velocity
        obj.targetX += obj.physVx * dt;
        obj.targetY += obj.physVy * dt;

        // Critical Damping Friction (smooth fast deceleration, zero bounce)
        const drag = Math.pow(0.82, (dt || 0.016) * 60.0);
        obj.physVx *= drag;
        obj.physVy *= drag;
        obj.physVrot = 0;
        obj.targetRotZ = 0;
      } else if (obj.physVx || obj.physVy) {
        obj.physVx = 0;
        obj.physVy = 0;
        obj.physVrot = 0;
        obj.targetRotZ = 0;
        savePositionsToStorage();
      }

      // Smooth critically-damped position update when free
      const factorPos = 1.0 - Math.exp(-28.0 * dt);
      obj.x += (obj.targetX - obj.x) * factorPos;
      obj.y += (obj.targetY - obj.y) * factorPos;
      obj.scale += (obj.targetScale - obj.scale) * factorPos;
      obj.modelScale += (obj.targetModelScale - obj.modelScale) * factorPos;
      obj.rotX += (obj.targetRotX - obj.rotX) * factorPos;
      obj.rotY += (obj.targetRotY - obj.rotY) * factorPos;
      obj.rotZ += (obj.targetRotZ - obj.rotZ) * factorPos;
      obj.modelRotX += (obj.targetModelRotX - obj.modelRotX) * factorPos;
      obj.modelRotY += (obj.targetModelRotY - obj.modelRotY) * factorPos;
      obj.modelRotZ += (obj.targetModelRotZ - obj.modelRotZ) * factorPos;
    } else {
      // 1:1 DIRECT ZERO-LAG TRACKING WHEN GRABBED (NO RUBBER-BAND BOUNCE)
      const instVx = (obj.targetX - (obj.prevTargetX || obj.targetX)) / (dt || 0.016);
      const instVy = (obj.targetY - (obj.prevTargetY || obj.targetY)) / (dt || 0.016);
      const instSpeed = Math.hypot(instVx, instVy);
      
      if (instSpeed > 10) {
        obj.throwVx = (obj.throwVx || 0) * 0.3 + instVx * 0.7;
        obj.throwVy = (obj.throwVy || 0) * 0.3 + instVy * 0.7;
        obj.lastHandMoveTime = performance.now();
        obj.peakThrowVx = obj.throwVx;
        obj.peakThrowVy = obj.throwVy;
      }
      obj.prevTargetX = obj.targetX;
      obj.prevTargetY = obj.targetY;

      obj.x = obj.targetX;
      obj.y = obj.targetY;
      obj.scale = obj.targetScale;
      obj.modelScale = obj.targetModelScale;
      obj.rotX = obj.targetRotX;
      obj.rotY = obj.targetRotY;
      obj.rotZ = obj.targetRotZ;
      obj.modelRotX = obj.targetModelRotX;
      obj.modelRotY = obj.targetModelRotY;
      obj.modelRotZ = obj.targetModelRotZ;
    }

    obj.vx = (obj.x - prevX) / (dt || 0.016);
    obj.vy = (obj.y - prevY) / (dt || 0.016);

    // --- 70% WARNING & 90% OUTSIDE PLAYGROUND DELETION CHECK ---
    const bDiameter = effRadius * 2;
    const offLeft = Math.max(0, - (obj.x - effRadius));
    const offRight = Math.max(0, (obj.x + effRadius) - canvasElement.width);
    const offTop = Math.max(0, - (obj.y - effRadius));
    const offBottom = Math.max(0, (obj.y + effRadius) - canvasElement.height);

    const offFracX = (offLeft + offRight) / bDiameter;
    const offFracY = (offTop + offBottom) / bDiameter;
    const maxOffFrac = Math.max(offFracX, offFracY);

    const isExitingPlayground = (maxOffFrac >= 0.70); // Warns in RED when reaching 70%
    const exitProgress = Math.min(1.0, maxOffFrac / 0.90); // 90% is threshold for removal

    // Only delete after release (when not held) if >= 90% off-screen
    if (!isThisGrabbed && maxOffFrac >= 0.90) {
      objectsToDelete.push(obj);
      return;
    }

    // Update Three.js 3D Model Instance Transforms (Auto-Rotation is OFF)
    if (obj.threeGroup) {
      obj.threeGroup.position.set(obj.x, 720 - obj.y, isThisGrabbed ? 100 : 0);
      const total3DScale = obj.scale * obj.modelScale;
      obj.threeGroup.scale.set(total3DScale, total3DScale, total3DScale);

      // Model orientation combines box baseline + independent direct 3D model rotation
      const totalRotX = obj.rotX + obj.modelRotX;
      const totalRotY = obj.rotY + obj.modelRotY;
      const totalRotZ = obj.rotZ + obj.modelRotZ;
      obj.threeGroup.rotation.set(totalRotX, totalRotY, -totalRotZ);

      if (obj.mixer) {
        obj.mixer.update(dt);
      }

      if (obj.submeshes && obj.submeshes.length > 0) {
        const expAmt = barehandsAI.explodeAmount;
        obj.submeshes.forEach(sm => {
          sm.mesh.position.x = sm.homePos.x + sm.dir.x * (expAmt * 50.0);
          sm.mesh.position.y = sm.homePos.y + sm.dir.y * (expAmt * 50.0);
          sm.mesh.position.z = sm.homePos.z + sm.dir.z * (expAmt * 50.0);
        });
      }
    }

    // Laser Raycast targeting test
    let isTargeted = false;
    if (isEngaged && pointerRays.length > 0) {
      pointerRays.forEach(ray => {
        const dTip = Math.hypot(ray.tipX - obj.x, ray.tipY - obj.y);
        if (dTip < effRadius + 40) isTargeted = true;

        const dx = obj.x - ray.tipX;
        const dy = obj.y - ray.tipY;
        const dotProd = dx * ray.dirX + dy * ray.dirY;

        if (dotProd > 0) {
          const perpDist = Math.abs(dx * ray.dirY - dy * ray.dirX);
          if (perpDist < effRadius + 28 && dotProd < 1200) {
            isTargeted = true;
          }
        }
      });
    }

    if (isTargeted) activePointedObject = obj;

    const isConfirmed = confirmedSelectedObject && confirmedSelectedObject.id === obj.id;
    const isModelRotating = isTwoFingerRotating && twoFingerRotateObjId === obj.id;
    const isScalingRightHand = isRightHandScaling && rightHandScaleObjId === obj.id;

    if (obj.id === "OBJ_RING") {
      drawBarehandsRing(ctx, obj, isTargeted, isThisGrabbed, isConfirmed, dt);
    } else if (obj.id === "OBJ_NOTE") {
      drawGlassNoteCard(ctx, obj, isTargeted, isThisGrabbed, isConfirmed, dt);
    } else {
      // =========================================================================
      // RENDER UNIFIED ROTATING HOLOGRAPHIC BOX (BOX ROTATION STAYS FIXED IN 2-FINGER MODE)
      // =========================================================================
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotZ);

      const bSize = effRadius + 42;

      // Outer Bounding Box
      ctx.beginPath();
      ctx.roundRect(-bSize, -bSize, bSize * 2, bSize * 2, 16);
      if (isExitingPlayground) {
        ctx.strokeStyle = "#ff0033";
        ctx.lineWidth = 4.0;
        ctx.shadowColor = "#ff0033";
        ctx.shadowBlur = 24 + Math.sin(performance.now() * 0.015) * 8;
        ctx.fillStyle = "rgba(255, 0, 51, 0.14)";
      } else if (isScalingRightHand) {
        ctx.strokeStyle = "#ff007f";
        ctx.lineWidth = 4.0;
        ctx.shadowColor = "#ff007f";
        ctx.shadowBlur = 28;
        ctx.fillStyle = "rgba(255, 0, 127, 0.08)";
      } else if (isModelRotating) {
        ctx.strokeStyle = twoFingerHandLabel === 'Left' ? '#00e5ff' : (twoFingerHandLabel === 'Right' ? '#ff007f' : '#a855f7');
        ctx.lineWidth = 3.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 24;
        ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
      } else if (isThisGrabbed) {
        ctx.strokeStyle = isLeftGrabbed ? "#00e5ff" : (isRightGrabbed ? "#ffcc00" : "#ffff00");
        ctx.lineWidth = 3.5;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 24;
        ctx.fillStyle = isLeftGrabbed ? "rgba(0, 229, 255, 0.08)" : (isRightGrabbed ? "rgba(255, 204, 0, 0.08)" : "rgba(255, 255, 0, 0.08)");
      } else if (isConfirmed) {
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "rgba(0, 255, 204, 0.04)";
      } else {
        ctx.strokeStyle = isTargeted ? "rgba(0, 255, 204, 0.85)" : "rgba(100, 116, 139, 0.45)";
        ctx.lineWidth = isTargeted ? 2.0 : 1.2;
        ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
      }
      ctx.fill();
      ctx.stroke();

      // 4 Corner Brackets
      const hDist = bSize;
      [[-hDist, -hDist], [hDist, -hDist], [-hDist, hDist]].forEach(([hx, hy]) => {
        const signX = hx > 0 ? -1 : 1;
        const signY = hy > 0 ? -1 : 1;
        ctx.strokeStyle = isExitingPlayground ? "#ff0033" : (isModelRotating ? (twoFingerHandLabel === 'Left' ? '#00e5ff' : (twoFingerHandLabel === 'Right' ? '#ff007f' : '#a855f7')) : (isConfirmed ? "#00ffcc" : (isTargeted ? "#00ffcc" : "#64748b")));
        ctx.lineWidth = isExitingPlayground ? 3.5 : 3.0;
        ctx.beginPath();
        ctx.moveTo(hx, hy + signY * 22);
        ctx.lineTo(hx, hy);
        ctx.lineTo(hx + signX * 22, hy);
        ctx.stroke();
      });

      // Holographic Kinetic Streamline Shadows when Flying
      const flightSpeed = Math.round(Math.hypot(obj.physVx || 0, obj.physVy || 0));
      if (flightSpeed > 35 && !isThisGrabbed) {
        const trailNormX = (obj.physVx / flightSpeed);
        const trailNormY = (obj.physVy / flightSpeed);
        for (let t = 1; t <= 3; t++) {
          const trailOffset = t * (flightSpeed * 0.015);
          const trailAlpha = (1.0 - t / 4) * 0.20;
          ctx.save();
          ctx.translate(-trailNormX * trailOffset, -trailNormY * trailOffset);
          ctx.strokeStyle = obj.color || "#00e5ff";
          ctx.globalAlpha = trailAlpha;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-bSize, -bSize, bSize * 2, bSize * 2);
          ctx.restore();
        }
      }

      // Special Dedicated Bottom-Right Corner ROTATION HANDLE
      const brX = hDist;
      const brY = hDist;
      const isBrGrabbed = grabMode === 'corner-rot' && currentlyGrabbedObjectId === obj.id;
      ctx.strokeStyle = isBrGrabbed ? "#ffff00" : "#00ffcc";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(brX, brY - 26);
      ctx.lineTo(brX, brY);
      ctx.lineTo(brX - 26, brY);
      ctx.stroke();

      // Glowing Circular Rotation Handle Pin at Bottom-Right Corner
      ctx.beginPath();
      ctx.arc(brX, brY, 12, 0, Math.PI * 2);
      ctx.fillStyle = isBrGrabbed ? "#ffff00" : "#00ffcc";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 16;
      ctx.fill();

      // Inner Rotation Arc Icon
      ctx.beginPath();
      ctx.arc(brX, brY, 6, -Math.PI / 2, Math.PI);
      ctx.strokeStyle = "#080c14";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Side-Grip Handles on Left and Right borders
      const handleLen = 38;
      ctx.strokeStyle = isModelRotating ? "#38bdf8" : (isThisGrabbed ? "#ffff00" : (isConfirmed ? "#00ffcc" : "rgba(148, 163, 184, 0.6)"));
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(-bSize, -handleLen); ctx.lineTo(-bSize - 8, 0); ctx.lineTo(-bSize, handleLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bSize, -handleLen); ctx.lineTo(bSize + 8, 0); ctx.lineTo(bSize, handleLen);
      ctx.stroke();

      // Status Label Aligned with Box
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      const mDegZ = Math.round((obj.modelRotZ * 180 / Math.PI) % 360);
      const mDegY = Math.round((obj.modelRotY * 180 / Math.PI) % 360);
      const mDegX = Math.round((obj.modelRotX * 180 / Math.PI) % 360);

      if (isScalingRightHand) {
        ctx.fillStyle = "#ff007f";
        ctx.fillText(`🔍 RIGHT HAND SCALE: ${(obj.scale).toFixed(2)}x`, 0, bSize + 22);
      } else if (flightSpeed > 20) {
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`🚀 VELOCITY: ${flightSpeed} PX/S`, 0, bSize + 22);
      } else {
        ctx.fillText(`3D ROT: [X:${mDegX}° Y:${mDegY}° Z:${mDegZ}°]`, 0, bSize + 22);
      }

      if (isExitingPlayground) {
        ctx.fillStyle = "#ff0033";
        if (isThisGrabbed) {
          ctx.fillText(`⚠️ RELEASE TO DELETE (${Math.round(exitProgress * 100)}%)`, 0, -bSize - 14);
        } else {
          ctx.fillText(`⚠️ WARNING: EXITING PLAYGROUND (${Math.round(exitProgress * 100)}%)`, 0, -bSize - 14);
        }
      } else if (isScalingRightHand && isModelRotating) {
        ctx.fillStyle = "#00ffcc";
        ctx.fillText(`✨ 3D ROTATE [L 👈] + SCALE [R 👉] // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isScalingRightHand) {
        ctx.fillStyle = "#ff007f";
        ctx.fillText(`🤏 RIGHT HAND DYNAMIC SCALE // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isModelRotating && twoFingerHandLabel === 'Left') {
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(`✌️ LEFT HAND 3D ROTATION // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isModelRotating && twoFingerHandLabel === 'Right') {
        ctx.fillStyle = "#ff007f";
        ctx.fillText(`👉 RIGHT HAND 3D ROTATION // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isThisGrabbed && isLeftGrabbed) {
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(`👈 LEFT HAND GRAB ✊ // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isThisGrabbed && isRightGrabbed) {
        ctx.fillStyle = "#ffcc00";
        ctx.fillText(`👉 RIGHT HAND GRAB ✊ // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isThisGrabbed && isSideGripActive) {
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`👐 SIDE-GRIP // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isThisGrabbed && grabMode === 'corner-rot') {
        ctx.fillStyle = "#00ffcc";
        ctx.fillText(`🔄 BOTTOM-RIGHT ROTATION // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isThisGrabbed) {
        ctx.fillStyle = "#ffff00";
        ctx.fillText(`🖐️ MOVE DRAG // ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else if (isConfirmed) {
        ctx.fillStyle = "#00ffcc";
        ctx.fillText(`✅ ${obj.name.toUpperCase()}`, 0, -bSize - 14);
      } else {
        ctx.fillStyle = isTargeted ? "#00ffcc" : "#94a3b8";
        ctx.fillText(obj.name.toUpperCase(), 0, -bSize - 14);
      }

      ctx.restore();
    }

    // 2.0s Laser Targeting Dwell Arc & Brackets
    if (isTargeted && isEngaged) {
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.strokeStyle = "#00ffcc";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#00ffcc";
      ctx.shadowBlur = 18;

      const br = effRadius + 16;
      ctx.beginPath(); ctx.moveTo(-br, -br + 22); ctx.lineTo(-br, -br); ctx.lineTo(-br + 22, -br); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(br - 22, -br); ctx.lineTo(br, -br); ctx.lineTo(br, -br + 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-br, br - 22); ctx.lineTo(-br, br); ctx.lineTo(-br + 22, br); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(br - 22, br); ctx.lineTo(br, br); ctx.lineTo(br, br - 22); ctx.stroke();

      if (dwellProgress > 0 && dwellProgress < 1.0) {
        ctx.beginPath();
        ctx.arc(0, 0, effRadius + 12, -Math.PI / 2, (-Math.PI / 2) + (dwellProgress * Math.PI * 2));
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.fillRect(-145, -br - 54, 290, 38);
        ctx.strokeStyle = "#00ffcc";
        ctx.strokeRect(-145, -br - 54, 290, 38);

        ctx.fillStyle = "rgba(0, 255, 204, 0.4)";
        ctx.fillRect(-141, -br - 50, 282 * dwellProgress, 30);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        const sec = (dwellProgress * 2.0).toFixed(1);
        ctx.fillText(`🎯 TARGETING: ${sec}s / 2.0s (${Math.round(dwellProgress * 100)}%)`, 0, -br - 30);
      }
      ctx.restore();
    }
  });

  objectsToDelete.forEach(obj => removeObjectFromScene(obj));

  return activePointedObject;
}

// --- RENDER HAND SKELETON WITH MAXIMUM OPACITY & HIGH-CONTRAST NEON (ALWAYS ON TOP) ---
function drawHandSkeleton(ctx, landmarks, label, gesture) {
  if (!toggleSkeleton.checked) return;

  ctx.save();
  ctx.globalAlpha = 1.0; // 100% Solid Opacity - Always on top of all boxes & models

  const w = canvasElement.width;
  const h = canvasElement.height;
  const pts = landmarks.map(p => ({ x: (1 - p.x) * w, y: p.y * h }));

  // Pass 1: Heavy Neon Ambient Glow Outer Stroke
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  HAND_CONNECTIONS.forEach(([start, end]) => {
    const p1 = pts[start];
    const p2 = pts[end];
    const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
    if (label === 'Left') {
      grad.addColorStop(0, '#00e5ff');
      grad.addColorStop(1, '#00ffaa');
    } else {
      grad.addColorStop(0, '#ff007f');
      grad.addColorStop(1, '#ffaa00');
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6.5;
    ctx.shadowColor = label === 'Left' ? '#00e5ff' : '#ff007f';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  // Pass 2: Sharp High-Contrast White Inner Bone Line
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.beginPath();
  HAND_CONNECTIONS.forEach(([start, end]) => {
    const p1 = pts[start];
    const p2 = pts[end];
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  });
  ctx.stroke();

  // Pass 3: Solid Joints with High-Intensity Neon Fill
  pts.forEach((p, idx) => {
    const isTip = [4, 8, 12, 16, 20].includes(idx);
    const isWrist = idx === 0;
    const r = isTip ? 8.5 : (isWrist ? 9.5 : 5.5);

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);

    if (gesture.isThumbIndexScale && (idx === 4 || idx === 8)) {
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 20;
    } else if (gesture.isTwoFinger && (idx === 8 || idx === 12)) {
      ctx.fillStyle = label === 'Left' ? '#00e5ff' : '#ff007f';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 20;
    } else if (gesture.isFist) {
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 18;
    } else if (idx === 4 || idx === 8) {
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 16;
    } else if (idx === 16) {
      ctx.fillStyle = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 14;
    } else if (isTip) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = label === 'Left' ? '#00e5ff' : '#ff007f';
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = label === 'Left' ? '#00e5ff' : '#ff007f';
      ctx.shadowBlur = 8;
    }
    ctx.fill();

    // White Center Core for Tip Joints
    if (isTip || isWrist) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  });
  ctx.shadowBlur = 0;

  // Wrist Solid Telemetry HUD Badge
  const wristPt = pts[0];
  ctx.fillStyle = "rgba(10, 15, 30, 0.96)";
  ctx.fillRect(wristPt.x - 78, wristPt.y + 18, 156, 26);
  ctx.strokeStyle = label === 'Left' ? '#00e5ff' : '#ff007f';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(wristPt.x - 78, wristPt.y + 18, 156, 26);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${label === 'Left' ? '👈 LEFT' : '👉 RIGHT'}: ${gesture.name}`, wristPt.x, wristPt.y + 35);
  ctx.restore();
}

// --- RENDER DUAL SIDE-GRIP SCALE & ROTATE HUD ---
function drawSideGripHUD(ctx, p1, p2, activeObj, progress) {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  ctx.save();
  ctx.strokeStyle = "#00ffcc";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#00ffcc";
  ctx.shadowBlur = 16;
  ctx.setLineDash([8, 6]);

  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.setLineDash([]);

  [p1, p2].forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, -Math.PI / 2, (-Math.PI / 2) + (progress * Math.PI * 2));
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ffff00";
    ctx.fill();
  });

  ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
  ctx.fillRect(midX - 125, midY - 44, 250, 32);
  ctx.strokeStyle = "#00ffcc";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(midX - 125, midY - 44, 250, 32);

  ctx.fillStyle = "#00ffcc";
  ctx.font = "bold 12px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  if (progress < 1.0) {
    ctx.fillText(`⏳ GRIPPING SIDES (${Math.round(progress * 100)}%)...`, midX, midY - 24);
  } else {
    const deg = Math.round((activeObj.rotZ * 180 / Math.PI) % 360);
    ctx.fillText(`👐 ${(activeObj.scale).toFixed(2)}x | 🔄 ${deg}° [PULL / ROTATE]`, midX, midY - 24);
  }

  ctx.restore();
}





// --- LIVE STATE HOLDER ---
const visionState = {
  allHands: [],
  pointerRays: [],
  pinchPoints: [],
  fistPoints: [],
  twoFingerPoints: [],
  scalePointers: [],
  isAnyThumbRingTouching: false,
  touchPoint: { x: 640, y: 360 },
  leftDetected: false,
  rightDetected: false
};

// --- VISION PIPELINE RESULTS HANDLER ---
function handleVisionLandmarks(multiHandLandmarks, multiHandedness) {
  frameCountVision++;
  const now = performance.now();
  if (now - lastVisionTime >= 1000) {
    currentFpsVision = Math.round((frameCountVision * 1000) / (now - lastVisionTime));
    if (fpsVal.textContent !== `${currentFpsVision}`) fpsVal.textContent = currentFpsVision;
    frameCountVision = 0;
    lastVisionTime = now;
  }

  const numHands = multiHandLandmarks ? multiHandLandmarks.length : 0;
  if (handsCountVal.textContent !== `${numHands}`) handsCountVal.textContent = numHands;

  let leftDet = false;
  let rightDet = false;
  const pRays = [];
  const pPoints = [];
  const fPoints = [];
  const tfPoints = [];
  const scalePointers = [];
  const hands = [];
  let thumbRingTouching = false;
  let touchMid = { x: 640, y: 360 };

  if (multiHandLandmarks && multiHandedness) {
    for (let i = 0; i < multiHandLandmarks.length; i++) {
      const rawLandmarks = multiHandLandmarks[i];
      const rawLabel = multiHandedness[i].displayName || multiHandedness[i].label || (i === 0 ? 'Right' : 'Left');
      const handLabel = rawLabel === 'Left' ? 'Right' : 'Left';

      const landmarks = applyAdaptiveFiltering(rawLandmarks, handLabel, now);
      const analysis = analyzeFingers(landmarks);
      const gesture = classifyGesture(analysis, landmarks, handLabel);

      if (handLabel === 'Left') {
        leftDet = true;
        updateFingerUI('left', analysis, gesture);
      } else {
        rightDet = true;
        updateFingerUI('right', analysis, gesture);
      }

      const handCenterPt = {
        x: (1 - landmarks[9].x) * canvasElement.width,
        y: landmarks[9].y * canvasElement.height,
        label: handLabel
      };

      const handSpan = Math.hypot(landmarks[0].x - landmarks[9].x, landmarks[0].y - landmarks[9].y);
      const handAngle = Math.atan2(landmarks[9].y - landmarks[0].y, (1 - landmarks[9].x) - (1 - landmarks[0].x));

      hands.push({ analysis, gesture, landmarks, handLabel, handCenterPt, handSpan, handAngle });

      // 1. Two-Finger Pointer (Index + Middle Together, Others Down) for Left or Right Hand
      const isTwoFingerActive = (analysis.fingers.index && analysis.fingers.middle && !analysis.fingers.ring && !analysis.fingers.pinky) || gesture.isTwoFinger;
      if (isTwoFingerActive) {
        const p8 = { x: (1 - landmarks[8].x) * canvasElement.width, y: landmarks[8].y * canvasElement.height };
        const p12 = { x: (1 - landmarks[12].x) * canvasElement.width, y: landmarks[12].y * canvasElement.height };
        const midTf = { x: (p8.x + p12.x) / 2, y: (p8.y + p12.y) / 2 };
        const angleTf = Math.atan2(landmarks[12].y - landmarks[0].y, (1 - landmarks[12].x) - (1 - landmarks[0].x));

        tfPoints.push({
          x: midTf.x,
          y: midTf.y,
          p8,
          p12,
          handAngle: angleTf,
          handSpan,
          handLabel
        });
      }



      // 3. Right Hand Thumb + Pointer Scaling (Thumb + Index EXTENDED & SPREAD, Middle/Ring/Pinky down like a fist)
      const dThumbIndexSpan = dist(landmarks[4], landmarks[8]);
      const isScalePosture = !analysis.isPinchContact && dThumbIndexSpan >= 0.095 && ((analysis.fingers.thumb && analysis.fingers.index && !analysis.fingers.middle && !analysis.fingers.ring && !analysis.fingers.pinky) || gesture.isThumbIndexScale);
      if (isScalePosture) {
        const pThumb = { x: (1 - landmarks[4].x) * canvasElement.width, y: landmarks[4].y * canvasElement.height };
        const pIndex = { x: (1 - landmarks[8].x) * canvasElement.width, y: landmarks[8].y * canvasElement.height };
        const spanPx = Math.hypot(pThumb.x - pIndex.x, pThumb.y - pIndex.y);
        const spanRatio = dThumbIndexSpan;
        const midPt = { x: (pThumb.x + pIndex.x) / 2, y: (pThumb.y + pIndex.y) / 2 };

        scalePointers.push({
          pThumb,
          pIndex,
          spanPx,
          spanRatio,
          midPt,
          handLabel
        });
      }

      // 4. Fist Detection & 3D Spatial Tracking (Left or Right Hand)
      if (gesture.isFist) {
        const fistRad = Math.max(55, Math.min(85, handSpan * canvasElement.height * 0.82));
        const dorsalX = ((1 - landmarks[0].x) + (1 - landmarks[9].x)) / 2 * canvasElement.width;
        const dorsalY = (landmarks[0].y + landmarks[9].y) / 2 * canvasElement.height;
        fPoints.push({
          x: dorsalX,
          y: dorsalY,
          fistRadius: fistRad,
          handSpan,
          handAngle,
          handLabel
        });
      }

      // 5. Thumb & Ring Switch
      const thumbTip = landmarks[4];
      const ringTip = landmarks[16];
      const dThumbRing = Math.hypot(thumbTip.x - ringTip.x, thumbTip.y - ringTip.y);

      if (dThumbRing < 0.085 && analysis.fingers.index && analysis.fingers.middle && analysis.fingers.pinky) {
        thumbRingTouching = true;
        touchMid = {
          x: ((1 - thumbTip.x) + (1 - ringTip.x)) / 2 * canvasElement.width,
          y: (thumbTip.y + ringTip.y) / 2 * canvasElement.height
        };
      }

      // 6. Pinch Detection (Single Pinch for Corner Rotation & Move Drag)
      const dPinch = dThumbIndexSpan;
      if ((dPinch < 0.095 || analysis.isPinchContact) && !gesture.isTwoFinger && !isScalePosture) {
        const pinchMid = {
          x: ((1 - landmarks[4].x) + (1 - landmarks[8].x)) / 2 * canvasElement.width,
          y: (landmarks[4].y + landmarks[8].y) / 2 * canvasElement.height,
          handLabel,
          handAngle
        };
        pPoints.push(pinchMid);
      }

      // 7. Laser Pointer
      if (isSystemActive && analysis.fingers.index && !analysis.fingers.middle && !analysis.fingers.ring && !analysis.fingers.pinky && !analysis.fingers.thumb) {
        const tipX = (1 - landmarks[8].x) * canvasElement.width;
        const tipY = landmarks[8].y * canvasElement.height;
        const pipX = (1 - landmarks[6].x) * canvasElement.width;
        const pipY = landmarks[6].y * canvasElement.height;
        const dirX = tipX - pipX;
        const dirY = tipY - pipY;
        const len = Math.hypot(dirX, dirY) || 1e-5;

        pRays.push({ tipX, tipY, dirX: dirX / len, dirY: dirY / len });
      }
    }
  }

  visionState.allHands = hands;
  visionState.pointerRays = pRays;
  visionState.pinchPoints = pPoints;
  visionState.fistPoints = fPoints;
  visionState.twoFingerPoints = tfPoints;
  visionState.scalePointers = scalePointers;
  visionState.isAnyThumbRingTouching = thumbRingTouching;
  visionState.touchPoint = touchMid;
  visionState.leftDetected = leftDet;
  visionState.rightDetected = rightDet;

  if (!leftDet) resetHandUI('left');
  if (!rightDet) resetHandUI('right');

  processInteractions(now);
}

// --- BAREHANDS ORB TRIGGER HANDLER ---
function triggerBarehandsOrb(orbId) {
  barehandsFoley.arrive();
  if (orbId === 'notes') {
    let noteObj = SCENE_OBJECTS.find(o => o.id === "OBJ_NOTE");
    if (!noteObj) {
      noteObj = {
        id: "OBJ_NOTE",
        name: "JARVIS Protocols",
        icon: "📝",
        desc: "Directives & Spatial Gestures",
        x: 640,
        y: 480,
        targetX: 640,
        targetY: 480,
        prevTargetX: 640,
        prevTargetY: 480,
        vx: 0,
        vy: 0,
        physVx: 0,
        physVy: 0,
        physVrot: 0,
        throwVx: 0,
        throwVy: 0,
        peakThrowVx: 0,
        peakThrowVy: 0,
        lastHandMoveTime: 0,
        radius: 140,
        scale: 1.0,
        targetScale: 1.0,
        modelScale: 1.0,
        targetModelScale: 1.0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        targetRotX: 0,
        targetRotY: 0,
        targetRotZ: 0,
        modelRotX: 0,
        targetModelRotX: 0,
        modelRotY: 0,
        targetModelRotY: 0,
        modelRotZ: 0,
        targetModelRotZ: 0,
        color: "#00ffcc",
        idOffset: 0
      };
      SCENE_OBJECTS.push(noteObj);
      spawnShockwave(640, 480, "#00ffcc", 220, 4);
      lastInteractionText = "📄 OPENED PROTOCOLS GLASS CARD";
    } else {
      removeObjectFromScene(noteObj);
      lastInteractionText = "✕ CLOSED PROTOCOLS CARD";
    }
  } else if (orbId === 'models') {
    const hasHelmet = SCENE_OBJECTS.some(o => o.id === "OBJ_HELMET");
    if (hasHelmet) {
      const toRemove = SCENE_OBJECTS.filter(o => o.id === "OBJ_HELMET" || o.id === "OBJ_ROBOT");
      toRemove.forEach(o => removeObjectFromScene(o));
      lastInteractionText = "🤖 3D MODELS STOWED";
    } else {
      DEFAULT_SCENE_TEMPLATES.filter(t => t.id !== "OBJ_RING").forEach(t => {
        if (!SCENE_OBJECTS.some(o => o.id === t.id)) {
          const inst = createSceneObjectInstance(t);
          SCENE_OBJECTS.push(inst);
        }
      });
      spawnShockwave(640, 480, "#eab308", 220, 4);
      lastInteractionText = "🤖 3D MODELS DEPLOYED";
    }
  } else if (orbId === 'sketch') {
    barehandsAI.isSketchActive = !barehandsAI.isSketchActive;
    lastInteractionText = barehandsAI.isSketchActive ? "✏️ 3D AIR SKETCH: ACTIVE (POINT WITH ☝️ TO DRAW)" : "✏️ 3D AIR SKETCH: DISABLED";
  } else if (orbId === 'explode') {
    barehandsAI.isExplodeActive = !barehandsAI.isExplodeActive;
    lastInteractionText = barehandsAI.isExplodeActive ? "💥 3D MODEL EXPLODED VIEW: ACTIVE" : "💥 3D MODEL ASSEMBLED";
  } else if (orbId === 'reset') {
    resetAllToDefault();
    clearAllSketches();
    lastInteractionText = "⚡ STAGE RECALLED & CENTERED";
  }
}

// --- INTENTIONAL CONFIRMATION INTERACTION PROCESSING ---
function processInteractions(now) {
  const { pinchPoints, fistPoints, twoFingerPoints, scalePointers, isAnyThumbRingTouching, touchPoint, pointerRays } = visionState;

  const tfLeft = twoFingerPoints.find(tf => tf.handLabel === 'Left');
  const tfRight = twoFingerPoints.find(tf => tf.handLabel === 'Right');
  const spHand = scalePointers.find(sp => sp.handLabel === 'Right') || scalePointers[0];
  const isDualTwoFinger = !!(tfLeft && tfRight);

  // =========================================================================
  // ⚡ 0. BAREHANDS CLAP GESTURE (PALMS TOGETHER, FINGERS UP -> RECALL AI RING)
  // =========================================================================
  const leftHand = visionState.allHands.find(h => h.handLabel === 'Left');
  const rightHand = visionState.allHands.find(h => h.handLabel === 'Right');
  if (leftHand && rightHand && (now - barehandsAI.lastClapTime > 1200)) {
    const leftPt = leftHand.handCenterPt;
    const rightPt = rightHand.handCenterPt;
    const distH = Math.hypot(leftPt.x - rightPt.x, leftPt.y - rightPt.y);
    const isLeftUp = leftHand.landmarks[0].y > leftHand.landmarks[9].y;
    const isRightUp = rightHand.landmarks[0].y > rightHand.landmarks[9].y;

    if (distH < 90 && isLeftUp && isRightUp) {
      barehandsAI.lastClapTime = now;
      barehandsFoley.arrive();
      const ringObj = SCENE_OBJECTS.find(o => o.id === "OBJ_RING");
      if (ringObj) {
        ringObj.targetX = (leftPt.x + rightPt.x) / 2;
        ringObj.targetY = (leftPt.y + rightPt.y) / 2;
        ringObj.physVx = 0;
        ringObj.physVy = 0;
        barehandsAI.isBloomed = true;
      }
      spawnShockwave((leftPt.x + rightPt.x) / 2, (leftPt.y + rightPt.y) / 2, "#00ffcc", 280, 5);
      lastInteractionText = "👏 CLAP DETECTED // JARVIS RECALLED TO CENTER STAGE";
    }
  }

  // =========================================================================
  // ✏️ 0.1 3D SPATIAL AIR DRAWING (SKETCH MODE)
  // =========================================================================
  if (barehandsAI.isSketchActive) {
    const pointerHand = visionState.allHands.find(h => h.gesture && h.gesture.count === 1 && h.gesture.name.includes("Pointer"));
    if (pointerHand) {
      const idxTip = pointerHand.landmarks[8];
      const tipX = idxTip.x * canvasElement.width;
      const tipY = idxTip.y * canvasElement.height;
      addSketchPoint(tipX, tipY, 0, pointerHand.handLabel === 'Left' ? '#00e5ff' : '#ff007f');
      lastInteractionText = `✏️ AIR DRAWING [${pointerHand.handLabel.toUpperCase()}]: (${Math.round(tipX)}, ${Math.round(tipY)})`;
    } else {
      finishSketchStroke();
    }
  }

  // =========================================================================
  // 🌸 0.2 BAREHANDS BLOOMING ORB HOVER & PINCH TAP SELECTION
  // =========================================================================
  const ringObj = SCENE_OBJECTS.find(o => o.id === "OBJ_RING");
  if (ringObj && barehandsAI.bloomProgress > 0.6) {
    let hoveredOrb = null;
    visionState.allHands.forEach(h => {
      const idxTip = h.landmarks[8];
      const tx = idxTip.x * canvasElement.width;
      const ty = idxTip.y * canvasElement.height;

      barehandsAI.orbs.forEach(orb => {
        const curDist = orb.dist * barehandsAI.bloomProgress * ringObj.scale;
        const ox = ringObj.x + Math.cos(orb.angle) * curDist;
        const oy = ringObj.y + Math.sin(orb.angle) * curDist;
        const orbR = 34 * barehandsAI.bloomProgress * ringObj.scale;
        if (Math.hypot(tx - ox, ty - oy) <= orbR + 10) {
          hoveredOrb = orb;
          if (h.gesture && (h.gesture.isPinch || h.gesture.count === 1) && (now - barehandsAI.tapTime > 600)) {
            barehandsAI.tapTime = now;
            triggerBarehandsOrb(orb.id);
            spawnShockwave(ox, oy, orb.color, 160, 4);
          }
        }
      });
    });
    barehandsAI.activeOrbId = hoveredOrb ? hoveredOrb.id : null;
  } else {
    barehandsAI.activeOrbId = null;
  }

  // =========================================================================
  // 1. DYNAMIC 3D MODEL SCALING (Thumb + Pointer 🤏 on Right OR Left Hand inside box)
  // Gating: Works if hand is inside the object's box OR if model is actively 3D rotating
  // Intentional Dwell Timer: SCALE_CONFIRM_MS (240ms)
  // =========================================================================
  let scaleTargetObj = null;

  if (isTwoFingerRotating && twoFingerRotateObjId) {
    scaleTargetObj = SCENE_OBJECTS.find(o => o.id === twoFingerRotateObjId);
  } else if (currentlyGrabbedObjectId) {
    scaleTargetObj = SCENE_OBJECTS.find(o => o.id === currentlyGrabbedObjectId);
  } else if (spHand) {
    SCENE_OBJECTS.forEach(obj => {
      const effRadius = obj.radius * obj.scale;
      const bHalf = effRadius + 95;
      const localP = toLocalBoxCoords(spHand.midPt.x, spHand.midPt.y, obj);
      if (Math.abs(localP.x) <= bHalf && Math.abs(localP.y) <= bHalf) {
        scaleTargetObj = obj;
      }
    });
  }

  if (spHand && scaleTargetObj && grabMode !== 'fist' && grabMode !== 'pinch' && grabMode !== 'side-grip') {
    if (!isRightHandScaling) {
      if (!scaleCandidateObj || scaleCandidateObj.id !== scaleTargetObj.id) {
        scaleCandidateObj = scaleTargetObj;
        scaleCandidateStartTime = now;
      } else if (now - scaleCandidateStartTime >= SCALE_CONFIRM_MS) {
        initialRightThumbIndexRatio = spHand.spanRatio;
        initialObjScaleForRightHand = scaleTargetObj.modelScale || 1.0;
        isRightHandScaling = true;
        rightHandScaleObjId = scaleTargetObj.id;
        confirmedSelectedObject = scaleTargetObj;
        barehandsFoley.scale();
      }
    } else {
      const scaleFactor = spHand.spanRatio / Math.max(0.035, initialRightThumbIndexRatio);
      // Scale ONLY the 3D model geometry inside, keep the box fixed
      scaleTargetObj.targetModelScale = Math.max(0.35, Math.min(3.8, initialObjScaleForRightHand * Math.pow(scaleFactor, 1.3)));

      const scaleText = `${(scaleTargetObj.modelScale).toFixed(2)}x`;
      if (isTwoFingerRotating) {
        lastInteractionText = `✨ 3D ROTATE + MODEL SCALE [${scaleText}] (BOX FIXED)`;
      } else {
        lastInteractionText = `🤏 [${spHand.handLabel.toUpperCase()}] 3D MODEL SCALE [${scaleText}]: ${scaleTargetObj.name.toUpperCase()} (BOX FIXED)`;
      }
    }
  } else {
    if (isRightHandScaling) {
      barehandsFoley.release();
      savePositionsToStorage();
    }
    isRightHandScaling = false;
    rightHandScaleObjId = null;
    scaleCandidateObj = null;
    scaleCandidateStartTime = null;
    initialRightThumbIndexRatio = null;
  }

  // =========================================================================
  // 2. 2-FINGER (INDEX + MIDDLE ✌️) DIRECT 3D MODEL ROTATION (LEFT, RIGHT, OR DUAL HANDS)
  // Gating: Hand MUST be inside the object's box to initiate
  // Intentional Dwell Timer: TWO_FINGER_ROT_HOLD_MS (280ms)
  // =========================================================================
  if (isTwoFingerRotating && twoFingerRotateObjId) {
    const activeObj = SCENE_OBJECTS.find(o => o.id === twoFingerRotateObjId);

    if (activeObj && twoFingerPoints.length >= 1) {
      grabGraceFrames = MAX_GRACE_FRAMES;
      isObjectGrabbed = true;

      if (isDualTwoFinger) {
        // Dual-Hand Steering Wheel 3D Rotation (Left 👈 + Right 👉 simultaneously)
        const currentAngle = Math.atan2(tfRight.y - tfLeft.y, tfRight.x - tfLeft.x);
        const midPos = { x: (tfLeft.x + tfRight.x) / 2, y: (tfLeft.y + tfRight.y) / 2 };

        if (twoFingerHandLabel !== 'Dual') {
          twoFingerHandLabel = 'Dual';
          initialTwoFingerAngle = currentAngle;
          initialTwoFingerPos = midPos;
          initialModelRotX = activeObj.modelRotX;
          initialModelRotY = activeObj.modelRotY;
          initialModelRotZ = activeObj.modelRotZ;
        }

        const dAngle = currentAngle - initialTwoFingerAngle;
        const dYaw = (midPos.x - initialTwoFingerPos.x) * 0.014;
        const dPitch = (midPos.y - initialTwoFingerPos.y) * 0.014;

        activeObj.targetModelRotZ = initialModelRotZ + dAngle * 1.6;
        activeObj.targetModelRotY = initialModelRotY + dYaw;
        activeObj.targetModelRotX = initialModelRotX + dPitch;

        const mDegZ = Math.round((activeObj.modelRotZ * 180 / Math.PI) % 360);
        const mDegY = Math.round((activeObj.modelRotY * 180 / Math.PI) % 360);
        const mDegX = Math.round((activeObj.modelRotX * 180 / Math.PI) % 360);
        lastInteractionText = `👐 DUAL HANDS [L 👈 + R 👉] 3D ROTATION: ${activeObj.name.toUpperCase()} [X:${mDegX}° Y:${mDegY}° Z:${mDegZ}°]`;
      } else {
        // Single Hand (Left or Right) Direct 3D Rotation
        const matchedTf = twoFingerPoints[0];

        if (twoFingerHandLabel === 'Dual' || twoFingerHandLabel !== matchedTf.handLabel) {
          twoFingerHandLabel = matchedTf.handLabel;
          initialTwoFingerAngle = matchedTf.handAngle;
          initialTwoFingerPos = { x: matchedTf.x, y: matchedTf.y };
          initialModelRotX = activeObj.modelRotX;
          initialModelRotY = activeObj.modelRotY;
          initialModelRotZ = activeObj.modelRotZ;
        }

        const dAngle = matchedTf.handAngle - initialTwoFingerAngle;
        const dYaw = (matchedTf.x - initialTwoFingerPos.x) * 0.014;
        const dPitch = (matchedTf.y - initialTwoFingerPos.y) * 0.014;

        activeObj.targetModelRotZ = initialModelRotZ + dAngle * 1.6;
        activeObj.targetModelRotY = initialModelRotY + dYaw;
        activeObj.targetModelRotX = initialModelRotX + dPitch;

        const mDegZ = Math.round((activeObj.modelRotZ * 180 / Math.PI) % 360);
        const mDegY = Math.round((activeObj.modelRotY * 180 / Math.PI) % 360);
        const mDegX = Math.round((activeObj.modelRotX * 180 / Math.PI) % 360);
        const handBadge = matchedTf.handLabel === 'Left' ? '👈 LEFT HAND' : '👉 RIGHT HAND';

        if (!isRightHandScaling) {
          lastInteractionText = `✌️ ${handBadge} DIRECT 3D ROTATION: ${activeObj.name.toUpperCase()} [X:${mDegX}° Y:${mDegY}° Z:${mDegZ}°]`;
        }
      }
    } else {
      if (grabGraceFrames > 0) {
        grabGraceFrames--;
      } else {
        barehandsFoley.release();
        savePositionsToStorage();
        isTwoFingerRotating = false;
        twoFingerRotateObjId = null;
        twoFingerHandLabel = null;
        isObjectGrabbed = false;
        grabMode = null;
      }
    }
  }
  // Check for New 2-Finger Rotation: Gated by Hand (Left OR Right) inside the object box
  else if (twoFingerPoints.length >= 1 && grabMode !== 'fist' && grabMode !== 'pinch' && grabMode !== 'side-grip') {
    let candidate = null;
    let candidateTf = null;
    let minDist = Infinity;

    twoFingerPoints.forEach(tf => {
      SCENE_OBJECTS.forEach(obj => {
        const effRadius = obj.radius * obj.scale;
        const bHalf = effRadius + 95;
        const localP = toLocalBoxCoords(tf.x, tf.y, obj);

        if (Math.abs(localP.x) <= bHalf && Math.abs(localP.y) <= bHalf) {
          const d = Math.hypot(tf.x - obj.x, tf.y - obj.y);
          if (d < minDist) {
            minDist = d;
            candidate = obj;
            candidateTf = tf;
          }
        }
      });
    });

    if (candidate && candidateTf) {
      if (!twoFingerCandidateObj || twoFingerCandidateObj.id !== candidate.id) {
        twoFingerCandidateObj = candidate;
        twoFingerCandidateStartTime = now;
      } else if (now - twoFingerCandidateStartTime >= TWO_FINGER_ROT_HOLD_MS) {
        isTwoFingerRotating = true;
        twoFingerRotateObjId = candidate.id;
        twoFingerHandLabel = isDualTwoFinger ? 'Dual' : candidateTf.handLabel;
        confirmedSelectedObject = candidate;
        grabMode = 'two-finger-rot';
        isObjectGrabbed = true;

        if (isDualTwoFinger && tfLeft && tfRight) {
          initialTwoFingerAngle = Math.atan2(tfRight.y - tfLeft.y, tfRight.x - tfLeft.x);
          initialTwoFingerPos = { x: (tfLeft.x + tfRight.x) / 2, y: (tfLeft.y + tfRight.y) / 2 };
        } else {
          initialTwoFingerAngle = candidateTf.handAngle;
          initialTwoFingerPos = { x: candidateTf.x, y: candidateTf.y };
        }

        initialModelRotX = candidate.modelRotX;
        initialModelRotY = candidate.modelRotY;
        initialModelRotZ = candidate.modelRotZ;

        barehandsFoley.arrive();
        const shockColor = candidateTf.handLabel === 'Left' ? '#00e5ff' : '#ff007f';
        spawnShockwave(candidate.x, candidate.y, shockColor, 260, 5);
        spawnParticles(candidate.x, candidate.y, shockColor, 18, 5);
        lastInteractionText = `✌️ [${candidateTf.handLabel.toUpperCase()}] 3D ROTATION: ${candidate.name.toUpperCase()} (BOX FIXED)`;
      }
    } else {
      twoFingerCandidateObj = null;
      twoFingerCandidateStartTime = null;
    }
  } else {
    twoFingerCandidateObj = null;
    twoFingerCandidateStartTime = null;
  }

  // =========================================================================
  // 3. DUAL-HAND INDEPENDENT SPATIAL GRAB & THROW PIPELINE
  // Left Hand & Right Hand can each independently grab and move separate objects!
  // =========================================================================
  const handLabels = ['Left', 'Right'];

  // Track force pull window state
  if (forcePullSelectedObject) {
    const elapsedSinceSelect = now - forcePullSelectedTime;
    if (elapsedSinceSelect > FORCE_PULL_WINDOW_MS) {
      forcePullSelectedObject = null;
      forcePullState = 'idle';
    } else {
      const hasOpenHand = visionState.allHands.some(h => h.analysis && h.analysis.count >= 4);
      if (hasOpenHand && !handGrabStates.Left.grabbedObjId && !handGrabStates.Right.grabbedObjId) {
        forcePullState = 'opened';
        lastOpenHandTime = now;
      }
    }
  }

  handLabels.forEach(label => {
    const hState = handGrabStates[label];
    const otherLabel = label === 'Left' ? 'Right' : 'Left';
    const otherState = handGrabStates[otherLabel];
    const otherGrabbedId = otherState.grabbedObjId;

    const matchedFist = fistPoints.find(f => f.handLabel === label);
    const matchedPinch = pinchPoints.find(p => p.handLabel === label);

    // --- CASE A: THIS HAND IS CURRENTLY GRABBING AN OBJECT ---
    if (hState.grabbedObjId) {
      const activeObj = SCENE_OBJECTS.find(o => o.id === hState.grabbedObjId);

      if (hState.grabMode === 'fist' && matchedFist && activeObj) {
        if (activeObj.isForcePullFlying) {
          const flightElapsed = now - activeObj.forcePullStartTime;
          const tNorm = Math.min(1.0, flightElapsed / (activeObj.forcePullDuration || 420));
          activeObj.forcePullTargetX = matchedFist.x;
          activeObj.forcePullTargetY = matchedFist.y;

          const ease = tNorm < 0.5 ? 4 * tNorm * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 3) / 2;
          const arcY = Math.sin(tNorm * Math.PI) * -45;
          const scaleSurge = 1.0 + Math.sin(tNorm * Math.PI) * 0.35;

          activeObj.targetX = activeObj.forcePullStartX + (activeObj.forcePullTargetX - activeObj.forcePullStartX) * ease;
          activeObj.targetY = activeObj.forcePullStartY + (activeObj.forcePullTargetY - activeObj.forcePullStartY) * ease + arcY;
          activeObj.targetScale = (activeObj.forcePullBaseScale || 1.0) * scaleSurge;
          activeObj.targetRotZ = (activeObj.forcePullTargetX - activeObj.forcePullStartX) * 0.0015 * Math.sin(tNorm * Math.PI);

          if (tNorm >= 1.0) {
            activeObj.isForcePullFlying = false;
            activeObj.targetScale = activeObj.forcePullBaseScale || 1.0;
            activeObj.targetRotZ = 0;
            hState.initialHandPos = { x: matchedFist.x, y: matchedFist.y };
            hState.initialObjPos = { x: matchedFist.x, y: matchedFist.y };
            hState.stillStartTime = now;
            hState.stillAnchorPos = { x: matchedFist.x, y: matchedFist.y };
            lastInteractionText = `🧲 FORCE PULLED [${label.toUpperCase()}]: ${activeObj.name.toUpperCase()} IN HAND! ✊`;
          }
        } else {
          // Normal 2D Movement
          const prevX = activeObj.targetX;
          const prevY = activeObj.targetY;
          const deltaX = matchedFist.x - hState.initialHandPos.x;
          const deltaY = matchedFist.y - hState.initialHandPos.y;
          activeObj.targetX = hState.initialObjPos.x + deltaX;
          activeObj.targetY = hState.initialObjPos.y + deltaY;

          const trackDt = Math.max(0.001, (now - (activeObj.lastTrackTime || (now - 16))) / 1000);
          const vX = (activeObj.targetX - prevX) / trackDt;
          const vY = (activeObj.targetY - prevY) / trackDt;
          activeObj.lastTrackTime = now;
          activeObj.throwVx = (activeObj.throwVx || 0) * 0.2 + vX * 0.8;
          activeObj.throwVy = (activeObj.throwVy || 0) * 0.2 + vY * 0.8;
          activeObj.lastHandMoveTime = now;

          if (!hState.is3DUnlocked) {
            activeObj.targetScale = hState.initialObjScale;
            activeObj.targetRotZ = hState.initialObjRotZ;

            const distFromAnchor = Math.hypot(matchedFist.x - hState.stillAnchorPos.x, matchedFist.y - hState.stillAnchorPos.y);
            if (distFromAnchor > FIST_STILL_TOLERANCE_PX) {
              hState.isCurrentlyMoving = true;
              hState.stillStartTime = now;
              hState.stillAnchorPos = { x: matchedFist.x, y: matchedFist.y };
            } else {
              hState.isCurrentlyMoving = false;
              const stillElapsed = now - hState.stillStartTime;
              if (stillElapsed >= FIST_3D_UNLOCK_MS) {
                hState.is3DUnlocked = true;
                hState.initialHandSpan = matchedFist.handSpan;
                hState.initialHandAngle = matchedFist.handAngle;
                hState.initialObjScale = activeObj.scale;
                hState.initialObjRotZ = activeObj.rotZ;
                spawnShockwave(matchedFist.x, matchedFist.y, label === 'Left' ? "#00e5ff" : "#ffff00", 220, 4);
              }
            }
          } else {
            // Full 3D Control
            const depthRatio = matchedFist.handSpan / Math.max(hState.initialHandSpan, 0.04);
            activeObj.targetScale = Math.max(0.35, Math.min(3.5, hState.initialObjScale * Math.pow(depthRatio, 1.4)));
            const deltaAngle = matchedFist.handAngle - hState.initialHandAngle;
            activeObj.targetRotZ = hState.initialObjRotZ + deltaAngle * 1.5;
            activeObj.targetRotY = (activeObj.vx * 0.003);
            activeObj.targetRotX = (activeObj.vy * 0.003);
          }
        }
      } else if (hState.grabMode === 'pinch' && matchedPinch && activeObj) {
        const prevX = activeObj.targetX;
        const prevY = activeObj.targetY;
        activeObj.targetX = matchedPinch.x + hState.grabOffsetX;
        activeObj.targetY = matchedPinch.y + hState.grabOffsetY;
        activeObj.targetRotZ = hState.initialSingleObjRotZ;

        const trackDt = Math.max(0.001, (now - (activeObj.lastTrackTime || (now - 16))) / 1000);
        const vX = (activeObj.targetX - prevX) / trackDt;
        const vY = (activeObj.targetY - prevY) / trackDt;
        activeObj.lastTrackTime = now;
        activeObj.throwVx = (activeObj.throwVx || 0) * 0.2 + vX * 0.8;
        activeObj.throwVy = (activeObj.throwVy || 0) * 0.2 + vY * 0.8;
        activeObj.lastHandMoveTime = now;
      } else if (hState.grabMode === 'corner-rot' && matchedPinch && activeObj) {
        const currentAngle = Math.atan2(matchedPinch.y - activeObj.y, matchedPinch.x - activeObj.x);
        const deltaA = currentAngle - hState.initialTwoFingerAngle;
        activeObj.targetRotZ = hState.initialSingleObjRotZ + deltaA;
        activeObj.targetX = hState.initialObjPos.x + (matchedPinch.x - hState.initialHandPos.x) * 0.35;
        activeObj.targetY = hState.initialObjPos.y + (matchedPinch.y - hState.initialHandPos.y) * 0.35;
      } else {
        // Hand Released -> Impart momentum and free this object!
        if (activeObj) {
          const elapsedSinceMove = now - (activeObj.lastHandMoveTime || 0);
          let launchVx = activeObj.throwVx || 0;
          let launchVy = activeObj.throwVy || 0;
          if (elapsedSinceMove > 180) {
            launchVx = 0;
            launchVy = 0;
          }
          const throwSpeed = Math.hypot(launchVx, launchVy);
          if (throwSpeed > 220) {
            activeObj.physVx = launchVx * 1.0;
            activeObj.physVy = launchVy * 1.0;
            activeObj.physVrot = 0;
            lastInteractionText = `🚀 THROWN [${label.toUpperCase()}]: ${activeObj.name.toUpperCase()} (${Math.round(throwSpeed)} PX/S) 💨`;
          } else {
            activeObj.physVx = 0;
            activeObj.physVy = 0;
            activeObj.physVrot = 0;
            savePositionsToStorage();
          }
          activeObj.throwVx = 0;
          activeObj.throwVy = 0;
        }
        hState.grabbedObjId = null;
        hState.grabMode = null;
        hState.candidateObj = null;
        hState.candidateStartTime = null;
        hState.is3DUnlocked = false;
      }
    }

    // --- CASE B: THIS HAND IS FREE AND LOOKING TO GRAB AN OBJECT ---
    else {
      // 1. Fist Grab
      if (matchedFist && !isTwoFingerRotating) {
        // Force Pull Summon Trigger
        if (forcePullSelectedObject && forcePullState === 'opened' && (now - forcePullSelectedTime <= FORCE_PULL_WINDOW_MS) && (!otherGrabbedId || otherGrabbedId !== forcePullSelectedObject.id)) {
          const targetObj = forcePullSelectedObject;
          hState.grabbedObjId = targetObj.id;
          hState.grabMode = 'fist';
          hState.initialHandPos = { x: matchedFist.x, y: matchedFist.y };
          hState.initialObjPos = { x: targetObj.x, y: targetObj.y };
          hState.initialHandSpan = matchedFist.handSpan;
          hState.initialObjScale = targetObj.scale;
          hState.initialHandAngle = matchedFist.handAngle;
          hState.initialObjRotZ = targetObj.rotZ;
          hState.stillStartTime = now;
          hState.stillAnchorPos = { x: matchedFist.x, y: matchedFist.y };
          confirmedSelectedObject = targetObj;

          targetObj.isForcePullFlying = true;
          targetObj.forcePullStartX = targetObj.x;
          targetObj.forcePullStartY = targetObj.y;
          targetObj.forcePullStartTime = now;
          targetObj.forcePullDuration = 450;
          targetObj.forcePullTargetX = matchedFist.x;
          targetObj.forcePullTargetY = matchedFist.y;
          targetObj.forcePullBaseScale = targetObj.scale;
          targetObj.physVx = 0;
          targetObj.physVy = 0;

          forcePullState = 'idle';
          forcePullSelectedObject = null;
          lastInteractionText = `🧲 FORCE PULLING [${label.toUpperCase()}]: ${targetObj.name.toUpperCase()} TO HAND... 💨`;
        } else {
          // Direct Fist Contact Grab
          let candidate = null;
          let minDist = Infinity;
          SCENE_OBJECTS.forEach(obj => {
            if (obj.id === otherGrabbedId) return; // Don't grab object already held by other hand
            const bHalf = (obj.radius * obj.scale) + 48;
            const localP = toLocalBoxCoords(matchedFist.x, matchedFist.y, obj);
            if (Math.abs(localP.x) <= bHalf && Math.abs(localP.y) <= bHalf) {
              const d = Math.hypot(matchedFist.x - obj.x, matchedFist.y - obj.y);
              if (d < minDist) {
                minDist = d;
                candidate = obj;
              }
            }
          });

          if (candidate) {
            // Instant Grab on Fist Contact (No Holding Delay)
            hState.grabbedObjId = candidate.id;
            hState.grabMode = 'fist';
            hState.initialHandPos = { x: matchedFist.x, y: matchedFist.y };
            hState.initialObjPos = { x: candidate.x, y: candidate.y };
            hState.initialHandSpan = matchedFist.handSpan;
            hState.initialObjScale = candidate.scale;
            hState.initialHandAngle = matchedFist.handAngle;
            hState.initialObjRotZ = candidate.rotZ;
            hState.stillStartTime = now;
            hState.stillAnchorPos = { x: matchedFist.x, y: matchedFist.y };
            hState.candidateObj = null;
            hState.candidateStartTime = null;
            confirmedSelectedObject = candidate;

            candidate.physVx = 0;
            candidate.physVy = 0;
            spawnShockwave(matchedFist.x, matchedFist.y, label === 'Left' ? "#00e5ff" : "#ffff00", 160, 4);
            lastInteractionText = `✊ ${label.toUpperCase()} FIST GRAB: ${candidate.name.toUpperCase()} // SWIPE TO THROW`;
          } else {
            hState.candidateObj = null;
            hState.candidateStartTime = null;
          }
        }
      }
      // 2. Pinch Grab
      else if (matchedPinch && !isTwoFingerRotating) {
        let candidate = null;
        let minDist = Infinity;
        let isBottomRightGrab = false;

        SCENE_OBJECTS.forEach(obj => {
          if (obj.id === otherGrabbedId) return;
          const bHalf = (obj.radius * obj.scale) + 48;
          const localP = toLocalBoxCoords(matchedPinch.x, matchedPinch.y, obj);
          if (Math.abs(localP.x) <= bHalf && Math.abs(localP.y) <= bHalf) {
            const d = Math.hypot(matchedPinch.x - obj.x, matchedPinch.y - obj.y);
            if (d < minDist) {
              minDist = d;
              candidate = obj;
              const dToBR = Math.hypot(localP.x - bHalf, localP.y - bHalf);
              isBottomRightGrab = (dToBR <= 30);
            }
          }
        });

        if (candidate) {
          // Instant Grab on Pinch Contact (No Holding Delay)
          hState.grabbedObjId = candidate.id;
          hState.grabMode = isBottomRightGrab ? 'corner-rot' : 'pinch';
          hState.grabOffsetX = candidate.x - matchedPinch.x;
          hState.grabOffsetY = candidate.y - matchedPinch.y;
          hState.initialSingleObjRotZ = candidate.rotZ;
          hState.initialHandPos = { x: matchedPinch.x, y: matchedPinch.y };
          hState.initialObjPos = { x: candidate.x, y: candidate.y };
          hState.initialTwoFingerAngle = Math.atan2(matchedPinch.y - candidate.y, matchedPinch.x - candidate.x);
          hState.candidateObj = null;
          hState.candidateStartTime = null;
          confirmedSelectedObject = candidate;

          candidate.physVx = 0;
          candidate.physVy = 0;
          spawnShockwave(matchedPinch.x, matchedPinch.y, isBottomRightGrab ? "#00ffcc" : "#ffff00", 140, 3.5);
          lastInteractionText = `🖐️ ${label.toUpperCase()} PINCH GRAB: ${candidate.name.toUpperCase()}`;
        } else {
          hState.candidateObj = null;
          hState.candidateStartTime = null;
        }
      } else {
        hState.candidateObj = null;
        hState.candidateStartTime = null;
      }
    }
  });

  // Global State Sync
  isObjectGrabbed = !!(handGrabStates.Left.grabbedObjId || handGrabStates.Right.grabbedObjId);
  currentlyGrabbedObjectId = handGrabStates.Right.grabbedObjId || handGrabStates.Left.grabbedObjId || null;
  grabMode = handGrabStates.Right.grabMode || handGrabStates.Left.grabMode || null;

  // Multi-Hand Interactive Telemetry Banner
  const leftHeldObj = SCENE_OBJECTS.find(o => o.id === handGrabStates.Left.grabbedObjId);
  const rightHeldObj = SCENE_OBJECTS.find(o => o.id === handGrabStates.Right.grabbedObjId);

  if (leftHeldObj && rightHeldObj) {
    lastInteractionText = `👐 DUAL GRAB: 👈 LEFT [${leftHeldObj.name.toUpperCase()}] + 👉 RIGHT [${rightHeldObj.name.toUpperCase()}]`;
  }

  // =========================================================================
  // 5. TWO-HAND PHYSICAL SIDE-GRIP: PINCH BOX WITH BOTH HANDS TO SCALE & ROTATE BOX
  // =========================================================================
  if (pinchPoints.length >= 2 && grabMode !== 'fist' && !isTwoFingerRotating) {
    grabGraceFrames = MAX_GRACE_FRAMES;
    pinchCandidateObj = null;
    pinchCandidateStartTime = null;

    const p1 = pinchPoints[0];
    const p2 = pinchPoints[1];
    const midPinch = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    let boxCandidate = null;
    let minBoxDist = Infinity;

    SCENE_OBJECTS.forEach(obj => {
      const effRadius = obj.radius * obj.scale;
      const bHalf = effRadius + 55;

      const d1 = Math.hypot(p1.x - obj.x, p1.y - obj.y);
      const d2 = Math.hypot(p2.x - obj.x, p2.y - obj.y);
      const dMid = Math.hypot(midPinch.x - obj.x, midPinch.y - obj.y);

      const bothHandsOnBox = (d1 <= bHalf * 1.35 && d2 <= bHalf * 1.35) ||
                             (dMid <= effRadius * 1.3 && d1 <= bHalf * 1.6 && d2 <= bHalf * 1.6);

      if (bothHandsOnBox && dMid < minBoxDist) {
        minBoxDist = dMid;
        boxCandidate = obj;
      }
    });

    if (boxCandidate) {
      if (sideGripCandidateObj !== boxCandidate) {
        sideGripCandidateObj = boxCandidate;
        sideGripStartTime = now;
        isSideGripActive = false;
        initialGripDist = null;
        initialGripScale = null;
        initialGripAngle = null;
        initialGripRotZ = 0;
      }

      const elapsed = now - sideGripStartTime;
      const progress = Math.min(1.0, elapsed / SIDE_GRIP_CONFIRM_MS);

      if (elapsed >= SIDE_GRIP_CONFIRM_MS) {
        isSideGripActive = true;
        currentlyGrabbedObjectId = boxCandidate.id;
        confirmedSelectedObject = boxCandidate;
        grabMode = 'side-grip';
        isObjectGrabbed = true;

        if (initialGripDist === null) {
          initialGripDist = currentDist;
          initialGripScale = boxCandidate.scale;
          initialGripAngle = currentAngle;
          initialGripRotZ = boxCandidate.rotZ;
          boxCandidate.physVx = 0;
          boxCandidate.physVy = 0;
          barehandsFoley.grab();
          spawnParticles(midPinch.x, midPinch.y, "#00ffcc", 12, 4);
        }

        const scaleMultiplier = currentDist / Math.max(initialGripDist, 20);
        boxCandidate.targetScale = Math.max(0.35, Math.min(3.5, initialGripScale * scaleMultiplier));

        const deltaAngle = currentAngle - initialGripAngle;
        boxCandidate.targetRotZ = initialGripRotZ + deltaAngle;

        boxCandidate.targetX = midPinch.x;
        boxCandidate.targetY = midPinch.y;

        const deg = Math.round((boxCandidate.rotZ * 180 / Math.PI) % 360);
        lastInteractionText = `👐 2-HAND PINCH: ${boxCandidate.name.toUpperCase()} (SCALE: ${(boxCandidate.scale).toFixed(2)}x | 🔄 ${deg}°)`;
      } else {
        lastInteractionText = `⏳ 2 HANDS PINCHING ${boxCandidate.name.toUpperCase()} (${Math.round(progress * 100)}%)...`;
      }
    } else {
      sideGripCandidateObj = null;
      sideGripStartTime = null;
    }
  } else if (grabMode === 'side-grip' && pinchPoints.length < 2) {
    if (grabGraceFrames > 0) {
      grabGraceFrames--;
    } else {
      const activeObj = SCENE_OBJECTS.find(o => o.id === currentlyGrabbedObjectId);
      if (activeObj) {
        barehandsFoley.release();
        savePositionsToStorage();
      }
      currentlyGrabbedObjectId = null;
      isObjectGrabbed = false;
      grabMode = null;
      isSideGripActive = false;
      sideGripCandidateObj = null;
      sideGripStartTime = null;
      initialGripDist = null;
    }
  }

  // =========================================================================
  // 5. HOLD THUMB + RING FOR 2.0s TO TOGGLE TARGETING POINTER MODE
  // =========================================================================
  if (isAnyThumbRingTouching && !isObjectGrabbed && !isTwoFingerRotating && !isRightHandScaling) {
    if (holdStartTime === null) {
      holdStartTime = now;
      hasTriggeredForCurrentHold = false;
    }

    const holdElapsed = now - holdStartTime;
    lastTouchPoint = touchPoint;

    if (holdElapsed >= HOLD_DURATION_MS && !hasTriggeredForCurrentHold) {
      isSystemActive = !isSystemActive;
      hasTriggeredForCurrentHold = true;
      spawnShockwave(touchPoint.x, touchPoint.y, isSystemActive ? "#00ffcc" : "#ff0055", 350, 6);
      if (isSystemActive) barehandsFoley.toggleOn();
      else barehandsFoley.toggleOff();
    }
  } else {
    holdStartTime = null;
    hasTriggeredForCurrentHold = false;
  }

  // =========================================================================
  // 6. LASER POINTER 2.0s DWELL SELECTION
  // =========================================================================
  if (isSystemActive && pointerRays.length > 0 && !isObjectGrabbed && !isTwoFingerRotating && !isRightHandScaling) {
    let hitObject = null;
    let minD = Infinity;

    SCENE_OBJECTS.forEach(obj => {
      const effRadius = obj.radius * obj.scale;
      pointerRays.forEach(ray => {
        const dTip = Math.hypot(ray.tipX - obj.x, ray.tipY - obj.y);
        if (dTip < effRadius + 40 && dTip < minD) {
          minD = dTip;
          hitObject = obj;
        }

        const dx = obj.x - ray.tipX;
        const dy = obj.y - ray.tipY;
        const dotProd = dx * ray.dirX + dy * ray.dirY;
        if (dotProd > 0) {
          const perpDist = Math.abs(dx * ray.dirY - dy * ray.dirX);
          if (perpDist < effRadius + 28 && dotProd < 1200 && perpDist < minD) {
            minD = perpDist;
            hitObject = obj;
          }
        }
      });
    });

    if (hitObject) {
      if (currentPointedObject && currentPointedObject.id === hitObject.id) {
        const dwellElapsed = now - pointStartTime;
        if (dwellElapsed >= POINT_SELECTION_DURATION_MS) {
          confirmedSelectedObject = hitObject;
          forcePullSelectedObject = hitObject;
          forcePullState = 'selected';
          forcePullSelectedTime = now;
          isSystemActive = false;
          currentPointedObject = null;
          pointStartTime = null;
          lastInteractionText = `🎯 SELECTED: ${hitObject.name.toUpperCase()} // OPEN HAND + FIST TO PULL (5s)`;
        } else {
          const sec = (dwellElapsed / 1000).toFixed(1);
          lastInteractionText = `👉 POINTING AT ${hitObject.name.toUpperCase()} (${sec}s / 2.0s)...`;
        }
      } else {
        currentPointedObject = hitObject;
        pointStartTime = now;
      }
    } else {
      currentPointedObject = null;
      pointStartTime = null;
      lastInteractionText = "⚡ TARGETING ONLINE // POINT AT AN OBJECT FOR 2.0s";
    }
  } else {
    currentPointedObject = null;
    if (!isObjectGrabbed && !isAnyThumbRingTouching && !mouseGrabbedObj && !pinchCandidateObj && !sideGripCandidateObj && !fistCandidateObj && !twoFingerCandidateObj && !isTwoFingerRotating && !isRightHandScaling) {
      lastInteractionText = "IDLE";
    }
  }
}

// --- MOUSE & TOUCH FALLBACK CONTROLS ---
function getCanvasCoords(evt) {
  const rect = canvasElement.getBoundingClientRect();
  const scaleX = canvasElement.width / rect.width;
  const scaleY = canvasElement.height / rect.height;
  const clientX = evt.clientX !== undefined ? evt.clientX : (evt.touches && evt.touches[0] ? evt.touches[0].clientX : 0);
  const clientY = evt.clientY !== undefined ? evt.clientY : (evt.touches && evt.touches[0] ? evt.touches[0].clientY : 0);
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

canvasElement.addEventListener('mousedown', (e) => {
  const { x, y } = getCanvasCoords(e);
  isMouseDown = true;
  mouseStartX = x;
  mouseStartY = y;

  // 1. Check if clicking on an active blooming Orb
  const ringObj = SCENE_OBJECTS.find(o => o.id === "OBJ_RING");
  if (ringObj && barehandsAI.bloomProgress > 0.4) {
    for (const orb of barehandsAI.orbs) {
      const curDist = orb.dist * barehandsAI.bloomProgress * ringObj.scale;
      const ox = ringObj.x + Math.cos(orb.angle) * curDist;
      const oy = ringObj.y + Math.sin(orb.angle) * curDist;
      const orbR = 34 * barehandsAI.bloomProgress * ringObj.scale;
      if (Math.hypot(x - ox, y - oy) <= orbR + 8) {
        triggerBarehandsOrb(orb.id);
        spawnShockwave(ox, oy, orb.color, 160, 4);
        isMouseDown = false;
        return;
      }
    }
  }

  // 2. Check if clicking directly on Ring center -> Toggle Bloom
  if (ringObj && Math.hypot(x - ringObj.x, y - ringObj.y) <= ringObj.radius * 0.7) {
    const bloomed = barehandsAI.toggleBloom();
    spawnShockwave(ringObj.x, ringObj.y, "#00e5ff", 200, 4);
    lastInteractionText = bloomed ? "✦ ORBS BLOOMED // MENU EXPANDED" : "✦ ORBS FOLDED";
    isMouseDown = false;
    return;
  }

  // 3. Check if clicking [✕] on Notes card
  const noteObj = SCENE_OBJECTS.find(o => o.id === "OBJ_NOTE");
  if (noteObj) {
    const localP = toLocalBoxCoords(x, y, noteObj);
    const closeBtnX = 230 - 22;
    const closeBtnY = -140 + 20;
    if (Math.hypot(localP.x - closeBtnX, localP.y - closeBtnY) <= 18) {
      removeObjectFromScene(noteObj);
      barehandsFoley.release();
      lastInteractionText = "✕ CLOSED PROTOCOLS CARD";
      isMouseDown = false;
      return;
    }
  }

  let clickedObj = null;
  SCENE_OBJECTS.forEach(obj => {
    const bHalf = (obj.radius * obj.scale) + 40;
    const localP = toLocalBoxCoords(x, y, obj);
    if (Math.abs(localP.x) <= bHalf && Math.abs(localP.y) <= bHalf) {
      clickedObj = obj;
    }
  });

  if (clickedObj) {
    mouseGrabbedObj = clickedObj;
    confirmedSelectedObject = clickedObj;
    mouseOffsetX = clickedObj.x - x;
    mouseOffsetY = clickedObj.y - y;
    clickedObj.physVx = 0;
    clickedObj.physVy = 0;
    clickedObj.physVrot = 0;
    barehandsFoley.grab();
    spawnParticles(x, y, clickedObj.color, 8, 4);
    lastInteractionText = `MOUSE DRAG: ${clickedObj.name.toUpperCase()}`;
  }
});

window.addEventListener('mousemove', (e) => {
  if (isMouseDown && mouseGrabbedObj) {
    const { x, y } = getCanvasCoords(e);
    if (e.shiftKey) {
      mouseGrabbedObj.targetModelRotY += (x - mouseStartX) * 0.015;
      mouseGrabbedObj.targetModelRotX += (y - mouseStartY) * 0.015;
      mouseStartX = x;
      mouseStartY = y;
    } else {
      mouseGrabbedObj.targetX = x + mouseOffsetX;
      mouseGrabbedObj.targetY = y + mouseOffsetY;
    }
  }
});

window.addEventListener('mouseup', () => {
  if (isMouseDown && mouseGrabbedObj) {
    const throwSpeed = Math.hypot(mouseGrabbedObj.throwVx || 0, mouseGrabbedObj.throwVy || 0);
    if (throwSpeed > 220) {
      mouseGrabbedObj.physVx = (mouseGrabbedObj.throwVx || 0) * 1.0;
      mouseGrabbedObj.physVy = (mouseGrabbedObj.throwVy || 0) * 1.0;
      mouseGrabbedObj.physVrot = 0;
      lastInteractionText = `🚀 THROWN (MOUSE): ${mouseGrabbedObj.name.toUpperCase()} (SPEED: ${Math.round(throwSpeed)} PX/S)`;
    } else {
      mouseGrabbedObj.physVx = 0;
      mouseGrabbedObj.physVy = 0;
      mouseGrabbedObj.physVrot = 0;
      barehandsFoley.release();
      savePositionsToStorage();
    }
  }
  isMouseDown = false;
  mouseGrabbedObj = null;
});

canvasElement.addEventListener('wheel', (e) => {
  if (confirmedSelectedObject) {
    e.preventDefault();
    if (e.shiftKey) {
      confirmedSelectedObject.targetModelRotZ += e.deltaY < 0 ? 0.15 : -0.15;
    } else {
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      confirmedSelectedObject.targetScale = Math.max(0.35, Math.min(3.8, confirmedSelectedObject.targetScale + delta));
    }
    barehandsFoley.scale();
    savePositionsToStorage();
  }
}, { passive: false });

// --- CONTINUOUS 60/120 FPS RAF RENDER & PHYSICS LOOP ---
function renderLoop(timestamp) {
  const dt = Math.min((timestamp - lastRenderTime) / 1000.0, 0.05);
  lastRenderTime = timestamp;
  globalAnimTime += dt;

  // Track true 60/120 FPS UI rendering frame rate
  frameCountRender++;
  if (timestamp - lastRenderFpsTime >= 1000) {
    currentFpsRender = Math.round((frameCountRender * 1000) / (timestamp - lastRenderFpsTime));
    if (fpsVal && fpsVal.textContent !== `${currentFpsRender}`) {
      fpsVal.textContent = currentFpsRender;
    }
    frameCountRender = 0;
    lastRenderFpsTime = timestamp;
  }

  // Clear 2D Canvas to 100% Transparent so WebGL Layer (z-index: 5) is fully visible
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  const {
    pointerRays = [],
    pinchPoints = [],
    fistPoints = [],
    twoFingerPoints = [],
    scalePointers = [],
    allHands = [],
    isAnyThumbRingTouching = false,
    touchPoint = null
  } = visionState;

  // Sync background video visibility
  if (toggleVideo) {
    videoElement.style.display = toggleVideo.checked ? 'block' : 'none';
  }

  // 1. Render Three.js WebGL 3D Models FIRST (Base 3D Layer)
  if (threeRenderer && threeScene && threeCamera) {
    threeRenderer.render(threeScene, threeCamera);
  }

  // 2. Laser Dwell Selection Progress
  let dwellProgress = 0;
  let activePointingId = null;
  if (currentPointedObject && pointStartTime !== null) {
    activePointingId = currentPointedObject.id;
    const dwellElapsed = performance.now() - pointStartTime;
    dwellProgress = Math.min(1.0, dwellElapsed / POINT_SELECTION_DURATION_MS);
  }

  // 3. Render Unified Rotated Scene Objects (Boxes, Equalizer bars, Subwoofer, Labels)
  const pointedObject = renderSceneObjects(
    canvasCtx,
    pointerRays,
    isSystemActive,
    activePointingId,
    dwellProgress,
    dt
  );

  // 4. Targeting Laser Beams
  if (isSystemActive && toggleLaser.checked) {
    pointerRays.forEach(ray => {
      canvasCtx.save();
      const endX = ray.tipX + ray.dirX * 1200;
      const endY = ray.tipY + ray.dirY * 1200;

      canvasCtx.beginPath();
      canvasCtx.moveTo(ray.tipX, ray.tipY);
      canvasCtx.lineTo(endX, endY);
      canvasCtx.strokeStyle = "rgba(0, 255, 204, 0.45)";
      canvasCtx.lineWidth = 9;
      canvasCtx.shadowColor = "#00ffcc";
      canvasCtx.shadowBlur = 24;
      canvasCtx.stroke();

      canvasCtx.beginPath();
      canvasCtx.moveTo(ray.tipX, ray.tipY);
      canvasCtx.lineTo(endX, endY);
      canvasCtx.strokeStyle = "#ffffff";
      canvasCtx.lineWidth = 3;
      canvasCtx.stroke();
      canvasCtx.restore();
    });
  }

  // 5. Right Hand Thumb + Pointer Dynamic Optical Scale HUD
  const spRight = scalePointers.find(sp => sp.handLabel === 'Right') || scalePointers[0];
  if (spRight && isRightHandScaling && confirmedSelectedObject) {
    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.moveTo(spRight.pThumb.x, spRight.pThumb.y);
    canvasCtx.lineTo(spRight.pIndex.x, spRight.pIndex.y);
    canvasCtx.strokeStyle = "#ff007f";
    canvasCtx.lineWidth = 4;
    canvasCtx.shadowColor = "#ff007f";
    canvasCtx.shadowBlur = 18;
    canvasCtx.stroke();

    [spRight.pThumb, spRight.pIndex].forEach(p => {
      canvasCtx.beginPath();
      canvasCtx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      canvasCtx.fillStyle = "#ff007f";
      canvasCtx.fill();
    });

    const midX = (spRight.pThumb.x + spRight.pIndex.x) / 2;
    const midY = (spRight.pThumb.y + spRight.pIndex.y) / 2;

    canvasCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
    canvasCtx.fillRect(midX - 110, midY - 44, 220, 28);
    canvasCtx.strokeStyle = "#ff007f";
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeRect(midX - 110, midY - 44, 220, 28);

    canvasCtx.fillStyle = "#ff007f";
    canvasCtx.font = "bold 12px 'JetBrains Mono', monospace";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText(`🔍 MODEL SCALE: ${(confirmedSelectedObject.modelScale).toFixed(2)}x`, midX, midY - 26);
    canvasCtx.restore();
  }

  // 6. Two-Hand Physical Side-Grip HUD (Pinch box with Both Hands)
  if (pinchPoints.length >= 2 && sideGripCandidateObj) {
    const elapsed = performance.now() - sideGripStartTime;
    const progress = Math.min(1.0, elapsed / SIDE_GRIP_CONFIRM_MS);
    drawSideGripHUD(canvasCtx, pinchPoints[0], pinchPoints[1], sideGripCandidateObj, progress);
  }

  // 7. Active 3D Model Rotation Reticles & Tether (Left, Right, or Dual Hands)
  if (isTwoFingerRotating && twoFingerRotateObjId) {
    const activeObj = SCENE_OBJECTS.find(o => o.id === twoFingerRotateObjId);
    if (activeObj && twoFingerPoints.length >= 1) {
      const tfL = twoFingerPoints.find(t => t.handLabel === 'Left');
      const tfR = twoFingerPoints.find(t => t.handLabel === 'Right');

      // If both hands active, draw dual steering beam between them
      if (tfL && tfR) {
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.moveTo(tfL.x, tfL.y);
        canvasCtx.lineTo(tfR.x, tfR.y);
        canvasCtx.strokeStyle = "#a855f7";
        canvasCtx.lineWidth = 3;
        canvasCtx.setLineDash([8, 6]);
        canvasCtx.shadowColor = "#a855f7";
        canvasCtx.shadowBlur = 16;
        canvasCtx.stroke();
        canvasCtx.setLineDash([]);

        const midX = (tfL.x + tfR.x) / 2;
        const midY = (tfL.y + tfR.y) / 2;
        canvasCtx.beginPath();
        canvasCtx.arc(midX, midY, 12, 0, Math.PI * 2);
        canvasCtx.fillStyle = "#a855f7";
        canvasCtx.fill();
        canvasCtx.restore();
      }

      twoFingerPoints.forEach(tf => {
        const handColor = tf.handLabel === 'Left' ? '#00e5ff' : '#ff007f';

        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.moveTo(tf.x, tf.y);
        canvasCtx.lineTo(activeObj.x, activeObj.y);
        canvasCtx.strokeStyle = handColor;
        canvasCtx.lineWidth = 3.5;
        canvasCtx.shadowColor = handColor;
        canvasCtx.shadowBlur = 18;
        canvasCtx.stroke();

        canvasCtx.beginPath();
        canvasCtx.arc(tf.x, tf.y, 26, 0, Math.PI * 2);
        canvasCtx.strokeStyle = handColor;
        canvasCtx.lineWidth = 4;
        canvasCtx.stroke();

        canvasCtx.beginPath();
        canvasCtx.arc(tf.x, tf.y, 10, 0, Math.PI * 2);
        canvasCtx.fillStyle = handColor;
        canvasCtx.fill();

        canvasCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
        canvasCtx.fillRect(tf.x - 130, tf.y - 50, 260, 28);
        canvasCtx.strokeStyle = handColor;
        canvasCtx.lineWidth = 1.5;
        canvasCtx.strokeRect(tf.x - 130, tf.y - 50, 260, 28);

        const mDegZ = Math.round((activeObj.modelRotZ * 180 / Math.PI) % 360);
        const mDegY = Math.round((activeObj.modelRotY * 180 / Math.PI) % 360);
        const mDegX = Math.round((activeObj.modelRotX * 180 / Math.PI) % 360);

        canvasCtx.fillStyle = handColor;
        canvasCtx.font = "bold 11px 'JetBrains Mono', monospace";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText(`✌️ ${tf.handLabel.toUpperCase()}: [X:${mDegX}° Y:${mDegY}° Z:${mDegZ}°]`, tf.x, tf.y - 32);
        canvasCtx.restore();
      });
    }
  }

  // 8. Active Fist Drag Tether
  if (isObjectGrabbed && grabMode === 'fist' && currentlyGrabbedObjectId) {
    const activeObj = SCENE_OBJECTS.find(o => o.id === currentlyGrabbedObjectId);
    const matchedFist = fistPoints.find(f => f.handLabel === fistGrabHandLabel) || fistPoints[0];

    if (activeObj && matchedFist) {
      const stillElapsed = is3DFistUnlocked ? FIST_3D_UNLOCK_MS : (fistStillStartTime ? performance.now() - fistStillStartTime : 0);
      const p3D = Math.min(1.0, stillElapsed / FIST_3D_UNLOCK_MS);

      canvasCtx.save();
      canvasCtx.beginPath();
      canvasCtx.moveTo(matchedFist.x, matchedFist.y);
      canvasCtx.lineTo(activeObj.x, activeObj.y);
      canvasCtx.strokeStyle = is3DFistUnlocked ? "#00ffcc" : (activeObj.isForcePullFlying ? "#00ffcc" : "#ffff00");
      canvasCtx.lineWidth = is3DFistUnlocked ? 3.0 : 2.0;
      canvasCtx.shadowColor = canvasCtx.strokeStyle;
      canvasCtx.shadowBlur = 10;
      canvasCtx.stroke();

      canvasCtx.beginPath();
      canvasCtx.arc(matchedFist.x, matchedFist.y, 24, 0, Math.PI * 2);
      canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      canvasCtx.lineWidth = 3;
      canvasCtx.stroke();

      if (!is3DFistUnlocked && isFistCurrentlyMoving) {
        canvasCtx.beginPath();
        canvasCtx.arc(matchedFist.x, matchedFist.y, 24, 0, Math.PI * 2);
        canvasCtx.setLineDash([6, 6]);
        canvasCtx.strokeStyle = "#ffff00";
        canvasCtx.lineWidth = 3;
        canvasCtx.stroke();
        canvasCtx.setLineDash([]);
      } else {
        canvasCtx.beginPath();
        canvasCtx.arc(matchedFist.x, matchedFist.y, 24, -Math.PI / 2, (-Math.PI / 2) + (p3D * Math.PI * 2));
        canvasCtx.strokeStyle = is3DFistUnlocked ? "#00ffcc" : "#ffff00";
        canvasCtx.lineWidth = 5;
        canvasCtx.shadowColor = is3DFistUnlocked ? "#00ffcc" : "#ffff00";
        canvasCtx.shadowBlur = 14;
        canvasCtx.stroke();
      }

      canvasCtx.beginPath();
      canvasCtx.arc(matchedFist.x, matchedFist.y, 8, 0, Math.PI * 2);
      canvasCtx.fillStyle = is3DFistUnlocked ? "#00ffcc" : "#ffff00";
      canvasCtx.fill();

      canvasCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
      canvasCtx.fillRect(matchedFist.x - 105, matchedFist.y - 50, 210, 26);
      canvasCtx.strokeStyle = is3DFistUnlocked ? "#00ffcc" : "#ffff00";
      canvasCtx.lineWidth = 1.4;
      canvasCtx.strokeRect(matchedFist.x - 105, matchedFist.y - 50, 210, 26);

      canvasCtx.fillStyle = is3DFistUnlocked ? "#00ffcc" : "#ffff00";
      canvasCtx.font = "bold 11px 'JetBrains Mono', monospace";
      canvasCtx.textAlign = "center";
      if (is3DFistUnlocked) {
        canvasCtx.fillText(`🚀 [${matchedFist.handLabel.toUpperCase()}] DEPTH: ${(activeObj.scale).toFixed(2)}x`, matchedFist.x, matchedFist.y - 33);
      } else if (isFistCurrentlyMoving) {
        canvasCtx.fillText(`✊ [${matchedFist.handLabel.toUpperCase()}] SWIPE TO THROW 💨`, matchedFist.x, matchedFist.y - 33);
      } else {
        const sec = Math.max(0, (FIST_3D_UNLOCK_MS - stillElapsed) / 1000).toFixed(1);
        canvasCtx.fillText(`⏳ STAY STILL: ${sec}s (${Math.round(p3D * 100)}%)`, matchedFist.x, matchedFist.y - 33);
      }
      canvasCtx.restore();
    }
  }

  // 9. Single Pinch Drag Tether
  if (isObjectGrabbed && (grabMode === 'pinch' || grabMode === 'corner-rot') && currentlyGrabbedObjectId && pinchPoints.length === 1) {
    const activeObj = SCENE_OBJECTS.find(o => o.id === currentlyGrabbedObjectId);
    const p = pinchPoints[0];
    if (activeObj) {
      canvasCtx.save();
      canvasCtx.beginPath();
      canvasCtx.moveTo(p.x, p.y);
      canvasCtx.lineTo(activeObj.x, activeObj.y);
      canvasCtx.strokeStyle = grabMode === 'corner-rot' ? "#00ffcc" : "#ffff00";
      canvasCtx.lineWidth = 3.5;
      canvasCtx.shadowColor = canvasCtx.strokeStyle;
      canvasCtx.shadowBlur = 16;
      canvasCtx.stroke();

      canvasCtx.beginPath();
      canvasCtx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      canvasCtx.fillStyle = grabMode === 'corner-rot' ? "rgba(0, 255, 204, 0.4)" : "rgba(255, 255, 0, 0.4)";
      canvasCtx.fill();
      canvasCtx.restore();
    }
  }

  // =========================================================================
  // 🔥 10. HAND SKELETONS DRAWN LAST ON TOP OF EVERYTHING (SOLID OPACITY 100%) 🔥
  // =========================================================================
  allHands.forEach(h => {
    drawHandSkeleton(canvasCtx, h.landmarks, h.handLabel, h.gesture);
  });

  // 13. Thumb + Ring Hold Switch Gauge (2.0s Hold)
  if (isAnyThumbRingTouching && holdStartTime !== null) {
    const holdElapsed = performance.now() - holdStartTime;
    const holdProgress = Math.min(1.0, holdElapsed / HOLD_DURATION_MS);
    const targetAction = isSystemActive ? "TURN OFF" : "TURN ON";
    const chargeColor = isSystemActive ? "#ff0055" : "#00ffcc";

    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.arc(touchPoint.x, touchPoint.y, 36, 0, Math.PI * 2);
    canvasCtx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    canvasCtx.lineWidth = 4;
    canvasCtx.stroke();

    canvasCtx.beginPath();
    canvasCtx.arc(touchPoint.x, touchPoint.y, 36, -Math.PI / 2, (-Math.PI / 2) + (holdProgress * Math.PI * 2));
    canvasCtx.strokeStyle = chargeColor;
    canvasCtx.lineWidth = 6;
    canvasCtx.shadowColor = chargeColor;
    canvasCtx.shadowBlur = 18;
    canvasCtx.stroke();

    canvasCtx.beginPath();
    canvasCtx.arc(touchPoint.x, touchPoint.y, 10 + holdProgress * 8, 0, Math.PI * 2);
    canvasCtx.fillStyle = chargeColor;
    canvasCtx.fill();

    canvasCtx.fillStyle = "rgba(15, 23, 42, 0.94)";
    canvasCtx.fillRect(canvasElement.width / 2 - 220, 70, 440, 38);
    canvasCtx.strokeStyle = chargeColor;
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeRect(canvasElement.width / 2 - 220, 70, 440, 38);

    canvasCtx.fillStyle = isSystemActive ? "rgba(255, 0, 85, 0.45)" : "rgba(0, 255, 204, 0.45)";
    canvasCtx.fillRect(canvasElement.width / 2 - 216, 74, 432 * holdProgress, 30);

    canvasCtx.fillStyle = "#ffffff";
    canvasCtx.font = "bold 12px 'JetBrains Mono', monospace";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText(`⏳ HOLDING: ${(holdElapsed / 1000).toFixed(1)}s / 2.0s TO ${targetAction} (${Math.round(holdProgress * 100)}%)`, canvasElement.width / 2, 94);
    canvasCtx.restore();
  }

  // 14. Particles & Shockwaves
  updateAndRenderEffects(canvasCtx, dt);

  // 15. Barehands 3D Air Drawing Trails
  drawSketchTrails(canvasCtx);



  // 16. Telemetry UI Updates
  interactionVal.textContent = lastInteractionText;

  if (!isSystemActive) {
    systemStatusText.textContent = `STATUS: ONLINE [${activeModelName}] // 3D ENGINE`;
    statusIndicator.style.background = "#00ffcc";
    statusIndicator.style.boxShadow = "0 0 10px #00ffcc";

    const selEffR = confirmedSelectedObject ? confirmedSelectedObject.radius * confirmedSelectedObject.scale : 130;
    const selOffLeft = confirmedSelectedObject ? Math.max(0, - (confirmedSelectedObject.x - selEffR)) : 0;
    const selOffRight = confirmedSelectedObject ? Math.max(0, (confirmedSelectedObject.x + selEffR) - canvasElement.width) : 0;
    const selOffTop = confirmedSelectedObject ? Math.max(0, - (confirmedSelectedObject.y - selEffR)) : 0;
    const selOffBottom = confirmedSelectedObject ? Math.max(0, (confirmedSelectedObject.y + selEffR) - canvasElement.height) : 0;
    const selOffFrac = confirmedSelectedObject ? Math.max((selOffLeft + selOffRight) / (selEffR * 2), (selOffTop + selOffBottom) / (selEffR * 2)) : 0;
    const isSelExiting = selOffFrac >= 0.70; // Triggers warning at 70%

    if (isSelExiting && confirmedSelectedObject) {
      pointedObjectBanner.style.display = 'block';
      if (isObjectGrabbed && currentlyGrabbedObjectId === confirmedSelectedObject.id) {
        pointedObjectBanner.textContent = `⚠️ RELEASE TO DELETE: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} (${Math.round((selOffFrac / 0.90) * 100)}%) 🗑️`;
      } else {
        pointedObjectBanner.textContent = `⚠️ WARNING: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} REACHED 70%+ OUTSIDE (${Math.round((selOffFrac / 0.90) * 100)}%) 🗑️`;
      }
      pointedObjectBanner.style.borderColor = "#ff0033";
      pointedObjectBanner.style.color = "#ff0033";
    } else if (isRightHandScaling && isTwoFingerRotating && confirmedSelectedObject) {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `✨ 3D ROTATE [L 👈] + MODEL SCALE [R 👉: ${(confirmedSelectedObject.modelScale).toFixed(2)}x] (BOX FIXED)`;
      pointedObjectBanner.style.borderColor = "#00ffcc";
      pointedObjectBanner.style.color = "#00ffcc";
    } else if (isRightHandScaling && confirmedSelectedObject) {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `🤏 RIGHT HAND MODEL SCALE: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} (${(confirmedSelectedObject.modelScale).toFixed(2)}x) [BOX FIXED]`;
      pointedObjectBanner.style.borderColor = "#ff007f";
      pointedObjectBanner.style.color = "#ff007f";
    } else if (isTwoFingerRotating && confirmedSelectedObject) {
      const mDegZ = Math.round((confirmedSelectedObject.modelRotZ * 180 / Math.PI) % 360);
      const mDegY = Math.round((confirmedSelectedObject.modelRotY * 180 / Math.PI) % 360);
      const mDegX = Math.round((confirmedSelectedObject.modelRotX * 180 / Math.PI) % 360);
      const handBadge = twoFingerHandLabel === 'Left' ? '👈 LEFT HAND' : '👉 RIGHT HAND';

      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `✌️ ${handBadge} 3D: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} [X:${mDegX}° Y:${mDegY}° Z:${mDegZ}°]`;
      pointedObjectBanner.style.borderColor = twoFingerHandLabel === 'Left' ? '#00e5ff' : '#ff007f';
      pointedObjectBanner.style.color = pointedObjectBanner.style.borderColor;
    } else if (twoFingerCandidateObj) {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `⏳ HOLDING 2 FINGERS ON ${twoFingerCandidateObj.icon} ${twoFingerCandidateObj.name.toUpperCase()} (CHARGING 1.5s)...`;
      pointedObjectBanner.style.borderColor = "#38bdf8";
      pointedObjectBanner.style.color = "#38bdf8";
    } else if ((isObjectGrabbed || mouseGrabbedObj) && confirmedSelectedObject && grabMode === 'fist' && is3DFistUnlocked) {
      const deg = Math.round((confirmedSelectedObject.rotZ * 180 / Math.PI) % 360);
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `🚀 3D FIST [${fistGrabHandLabel.toUpperCase()}]: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} (DEPTH: ${(confirmedSelectedObject.scale).toFixed(2)}x | ${deg}°)`;
      pointedObjectBanner.style.borderColor = "#00ffcc";
      pointedObjectBanner.style.color = "#00ffcc";
    } else if ((isObjectGrabbed || mouseGrabbedObj) && confirmedSelectedObject && grabMode === 'fist' && isFistCurrentlyMoving) {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `✊ SWIPE & RELEASE TO THROW [${fistGrabHandLabel ? fistGrabHandLabel.toUpperCase() : 'HAND'}] 💨`;
      pointedObjectBanner.style.borderColor = "#ffff00";
      pointedObjectBanner.style.color = "#ffff00";
    } else if ((isObjectGrabbed || mouseGrabbedObj) && confirmedSelectedObject && grabMode === 'corner-rot') {
      const deg = Math.round((confirmedSelectedObject.rotZ * 180 / Math.PI) % 360);
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `🔄 RIGHT-DOWN CORNER ROTATION (${deg}°)`;
      pointedObjectBanner.style.borderColor = "#00ffcc";
      pointedObjectBanner.style.color = "#00ffcc";
    } else if ((isObjectGrabbed || mouseGrabbedObj) && confirmedSelectedObject) {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `🖐️ MOVE DRAG ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} // SWIPE TO THROW 💨`;
      pointedObjectBanner.style.borderColor = "#ffff00";
      pointedObjectBanner.style.color = "#ffff00";
    } else if (fistCandidateObj) {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `⏳ CONFIRMING FIST ON ${fistCandidateObj.icon} ${fistCandidateObj.name.toUpperCase()}...`;
      pointedObjectBanner.style.borderColor = "#ffff00";
      pointedObjectBanner.style.color = "#ffff00";
    } else if (confirmedSelectedObject) {
      const flightSpeed = Math.round(Math.hypot(confirmedSelectedObject.physVx || 0, confirmedSelectedObject.physVy || 0));
      if (flightSpeed > 20) {
        pointedObjectBanner.style.display = 'block';
        pointedObjectBanner.textContent = `🚀 FLYING: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} (${flightSpeed} PX/S) 💨`;
        pointedObjectBanner.style.borderColor = "#ffff00";
        pointedObjectBanner.style.color = "#ffff00";
      } else {
        const deg = Math.round((confirmedSelectedObject.rotZ * 180 / Math.PI) % 360);
        pointedObjectBanner.style.display = 'block';
        pointedObjectBanner.textContent = `✅ ACTIVE: ${confirmedSelectedObject.icon} ${confirmedSelectedObject.name.toUpperCase()} (${deg}°)`;
        pointedObjectBanner.style.borderColor = "#00ffcc";
        pointedObjectBanner.style.color = "#00ffcc";
      }

      selectedObjectIcon.textContent = confirmedSelectedObject.icon;
      selectedObjectName.textContent = confirmedSelectedObject.name;
      selectedObjectDesc.textContent = `👈 Left ✌️ (1.5s): 3D Rotate | 👉 Right 🤏: Scale Up/Down`;
    }
  } else {
    systemStatusText.textContent = "STATUS: TARGETING LASER ACTIVE";
    statusIndicator.style.background = "#00ffcc";
    statusIndicator.style.boxShadow = "0 0 12px #00ffcc";

    if (pointedObject) {
      const lockSecs = (dwellProgress * 2.0).toFixed(1);
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `🎯 LOCKING: ${pointedObject.icon} ${pointedObject.name.toUpperCase()} (${lockSecs}s / 2.0s)`;
      pointedObjectBanner.style.borderColor = "#ffff00";
      pointedObjectBanner.style.color = "#ffff00";
    } else {
      pointedObjectBanner.style.display = 'block';
      pointedObjectBanner.textContent = `⚡ TARGETING ONLINE // POINT AT AN OBJECT FOR 2.0s`;
      pointedObjectBanner.style.borderColor = "#00ffcc";
      pointedObjectBanner.style.color = "#00ffcc";
    }
  }

  canvasCtx.restore();
  requestAnimationFrame(renderLoop);
}

// --- FINGER UI BINDINGS ---
function updateFingerUI(prefix, analysis, gesture) {
  const { fingers, count } = analysis;
  const fingersEl = prefix === 'left' ? leftFingersVal : rightFingersVal;
  const gestureEl = prefix === 'left' ? leftGestureVal : rightGestureVal;

  fingersEl.textContent = `${count} / 5`;
  gestureEl.textContent = gesture.name;

  ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach(f => {
    const el = document.getElementById(`${prefix}-${f}`);
    if (el) {
      if (fingers[f]) el.classList.add('active');
      else el.classList.remove('active');
    }
  });
}

function resetHandUI(prefix) {
  const fingersEl = prefix === 'left' ? leftFingersVal : rightFingersVal;
  const gestureEl = prefix === 'left' ? leftGestureVal : rightGestureVal;
  fingersEl.textContent = "-";
  gestureEl.textContent = "None";

  ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach(f => {
    const el = document.getElementById(`${prefix}-${f}`);
    if (el) el.classList.remove('active');
  });
}

let mediaPipeCamera = null;

// --- WEBCAM INITIALIZATION WITH MEDIAPIPE CAMERA & FALLBACKS ---
async function startWebcam() {
  isSimulating = false;
  permissionModal.style.display = 'none';
  systemStatusText.textContent = "STATUS: STARTING WEBCAM...";

  try {
    if (mediaPipeCamera) {
      try { mediaPipeCamera.stop(); } catch(e) {}
      mediaPipeCamera = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }

    if (window.Camera && legacyHands) {
      mediaPipeCamera = new Camera(videoElement, {
        onFrame: async () => {
          if (!isSimulating && videoElement.readyState >= 2 && !isProcessingFrame) {
            isProcessingFrame = true;
            try {
              await legacyHands.send({ image: videoElement });
            } catch (err) {
              console.warn("MediaPipe frame send error:", err);
            } finally {
              isProcessingFrame = false;
            }
          }
        },
        width: 1280,
        height: 720
      });
      await mediaPipeCamera.start();
      cameraStream = videoElement.srcObject;
      statusIndicator.classList.remove('error');
      systemStatusText.textContent = `STATUS: ONLINE [${activeModelName}] // 3D ENGINE`;
    } else {
      let stream = null;
      const constraintList = [
        { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
        { video: true, audio: false }
      ];

      for (const constraints of constraintList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (e) {
          console.warn("Retrying getUserMedia:", e);
        }
      }

      if (!stream) {
        throw new Error("Unable to obtain video stream");
      }

      cameraStream = stream;
      videoElement.srcObject = stream;
      await videoElement.play();

      statusIndicator.classList.remove('error');
      systemStatusText.textContent = `STATUS: ONLINE [${activeModelName}] // 3D ENGINE`;
      processVideoInference();
    }
  } catch (err) {
    console.error("Camera access failed:", err);
    systemStatusText.textContent = "STATUS: CLICK 'ENABLE CAMERA' TO GRANT PERMISSION";
    statusIndicator.classList.add('error');
    permissionModal.style.display = 'block';
  }
}

let lastInferenceTime = 0;
const INFERENCE_MIN_INTERVAL_MS = 20;

async function processVideoInference() {
  if (isSimulating || !cameraStream || mediaPipeCamera) return;

  const now = performance.now();
  if (videoElement.readyState >= 2 && !isProcessingFrame && (now - lastInferenceTime >= INFERENCE_MIN_INTERVAL_MS)) {
    isProcessingFrame = true;
    lastInferenceTime = now;

    try {
      if (handLandmarker) {
        const results = handLandmarker.detectForVideo(videoElement, now);
        if (results && results.landmarks) {
          const handedness = (results.handedness && results.handedness.length > 0)
            ? results.handedness.map(h => h[0] || { displayName: "Right" })
            : [{ displayName: "Right" }];
          handleVisionLandmarks(results.landmarks, handedness);
        }
      } else if (legacyHands) {
        await legacyHands.send({ image: videoElement });
      }
    } catch (e) {
      console.warn("Vision inference error:", e);
    } finally {
      isProcessingFrame = false;
    }
  }

  requestAnimationFrame(processVideoInference);
}

// --- INTERACTIVE SIMULATOR ---
function startSimulator() {
  isSimulating = true;
  permissionModal.style.display = 'none';
  statusIndicator.classList.remove('error');
  systemStatusText.textContent = "STATUS: SIMULATOR MODE ACTIVE";

  let simTime = 0;
  function simLoop() {
    if (!isSimulating) return;
    simTime += 0.022;

    const orb = SCENE_OBJECTS[0];
    const tfX = (orb.x + Math.sin(simTime * 1.5) * 80) / canvasElement.width;
    const tfY = (orb.y + Math.cos(simTime * 1.2) * 40) / canvasElement.height;
    const depthSpan = 0.14 + Math.sin(simTime * 0.9) * 0.05;

    const tfLms = generateSimTwoFingerLandmarks(tfX, tfY, depthSpan);
    handleVisionLandmarks([tfLms], [{ displayName: "Right" }]);

    requestAnimationFrame(simLoop);
  }
  simLoop();
}

function generateSimTwoFingerLandmarks(cx, cy, size = 0.15) {
  const lms = [];
  lms.push({ x: cx, y: cy + size * 0.65, z: 0 }); // Wrist

  // Thumb folded
  lms.push({ x: cx - size * 0.1, y: cy + size * 0.45, z: 0 });
  lms.push({ x: cx - size * 0.12, y: cy + size * 0.35, z: 0 });
  lms.push({ x: cx - size * 0.08, y: cy + size * 0.28, z: 0 });
  lms.push({ x: cx - size * 0.02, y: cy + size * 0.25, z: 0 });

  // Index extended
  lms.push({ x: cx - size * 0.05, y: cy + size * 0.2, z: 0 });
  lms.push({ x: cx - size * 0.06, y: cy, z: 0 });
  lms.push({ x: cx - size * 0.07, y: cy - size * 0.25, z: 0 });
  lms.push({ x: cx - size * 0.08, y: cy - size * 0.5, z: 0 });

  // Middle extended
  lms.push({ x: cx + size * 0.02, y: cy + size * 0.2, z: 0 });
  lms.push({ x: cx + size * 0.02, y: cy, z: 0 });
  lms.push({ x: cx + size * 0.02, y: cy - size * 0.26, z: 0 });
  lms.push({ x: cx + size * 0.02, y: cy - size * 0.52, z: 0 });

  // Ring folded
  lms.push({ x: cx + size * 0.08, y: cy + size * 0.22, z: 0 });
  lms.push({ x: cx + size * 0.08, y: cy + size * 0.10, z: 0 });
  lms.push({ x: cx + size * 0.08, y: cy + size * 0.18, z: 0 });
  lms.push({ x: cx + size * 0.08, y: cy + size * 0.26, z: 0 });

  // Pinky folded
  lms.push({ x: cx + size * 0.14, y: cy + size * 0.25, z: 0 });
  lms.push({ x: cx + size * 0.14, y: cy + size * 0.15, z: 0 });
  lms.push({ x: cx + size * 0.14, y: cy + size * 0.22, z: 0 });
  lms.push({ x: cx + size * 0.14, y: cy + size * 0.30, z: 0 });

  return lms;
}

// =========================================================================
// 🎵 CYBERPUNK MUSIC ENGINE & SYNTHESIZER (WEB AUDIO API)
// =========================================================================
class CyberpunkMusicEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.isPlaying = false;
    this.currentTrackIndex = 0;
    this.timer = null;
    this.step = 0;
    this.tracks = [
      { name: "JARVIS Synth Pulse (120 BPM)", bpm: 120, root: 48, scale: [0, 3, 7, 10, 12, 15, 19, 22] },
      { name: "Neural Core Ambient (85 BPM)", bpm: 85, root: 45, scale: [0, 2, 3, 7, 8, 12, 14, 15] },
      { name: "Cyber City Electro (128 BPM)", bpm: 128, root: 50, scale: [0, 3, 5, 7, 10, 12, 15, 17] },
      { name: "Matrix Deep Echo (96 BPM)", bpm: 96, root: 41, scale: [0, 3, 7, 8, 12, 15, 19, 20] }
    ];
    this.canvas = document.getElementById('audio-visualizer-canvas');
    this.canvasCtx = this.canvas ? this.canvas.getContext('2d') : null;
    this.trackTitleText = document.getElementById('track-title-text');
    this.btnToggle = document.getElementById('btn-music-toggle');
    this.btnPrev = document.getElementById('btn-music-prev');
    this.btnNext = document.getElementById('btn-music-next');
    this.freqData = new Uint8Array(32);
    this.initBindings();
  }

  initBindings() {
    if (this.btnToggle) this.btnToggle.addEventListener('click', () => this.toggle());
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.prevTrack());
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.nextTrack());
  }

  initAudio() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.18, this.ctx.currentTime);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, gainVal, when) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      g.gain.setValueAtTime(gainVal, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(g);
      g.connect(this.gainNode);
      osc.start(when);
      osc.stop(when + duration);
    } catch(e) {}
  }

  playNoise(duration, gainVal, when) {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1200, when);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gainVal, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      whiteNoise.connect(filter);
      filter.connect(g);
      g.connect(this.gainNode);
      whiteNoise.start(when);
    } catch(e) {}
  }

  mtof(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  tick() {
    if (!this.isPlaying || !this.ctx) return;
    const track = this.tracks[this.currentTrackIndex];
    const now = this.ctx.currentTime;
    const stepDuration = (60 / track.bpm) / 4;

    if (this.step % 4 === 0) {
      this.playTone(130, 'sine', 0.18, 0.45, now);
    } else if (this.step % 2 === 0) {
      this.playNoise(0.04, 0.10, now);
    }

    if (this.step % 2 === 0) {
      const bassNote = track.root + (this.step % 8 === 0 ? 0 : (this.step % 8 === 4 ? -5 : 0));
      this.playTone(this.mtof(bassNote), 'sawtooth', stepDuration * 1.8, 0.24, now);
    }

    const scaleIdx = (this.step * 3 + (this.currentTrackIndex * 2)) % track.scale.length;
    const arpNote = track.root + 12 + track.scale[scaleIdx];
    this.playTone(this.mtof(arpNote), 'triangle', stepDuration * 0.9, 0.15, now);

    this.step = (this.step + 1) % 64;
    this.timer = setTimeout(() => this.tick(), stepDuration * 1000);
  }

  toggle() {
    this.initAudio();
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      if (this.btnToggle) this.btnToggle.textContent = '⏸️';
      this.tick();
      this.renderVisualizer();
    } else {
      if (this.btnToggle) this.btnToggle.textContent = '▶️';
      clearTimeout(this.timer);
    }
    this.updateUI();
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.step = 0;
    this.updateUI();
  }

  prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.step = 0;
    this.updateUI();
  }

  updateUI() {
    const track = this.tracks[this.currentTrackIndex];
    if (this.trackTitleText) {
      this.trackTitleText.textContent = track.name;
    }
  }

  renderVisualizer() {
    if (!this.isPlaying) {
      if (this.canvasCtx && this.canvas) {
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      return;
    }
    requestAnimationFrame(() => this.renderVisualizer());
    if (!this.analyser || !this.canvasCtx || !this.canvas) return;
    
    this.analyser.getByteFrequencyData(this.freqData);
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const barCount = 10;
    const barWidth = this.canvas.width / barCount;
    for (let i = 0; i < barCount; i++) {
      const val = this.freqData[i * 2] / 255;
      const h = val * this.canvas.height;
      this.canvasCtx.fillStyle = `hsl(${180 + val * 60}, 100%, 65%)`;
      this.canvasCtx.fillRect(i * barWidth, this.canvas.height - h, barWidth - 1, h);
    }

    if (barehandsAI) {
      barehandsAI.amp = Math.max(barehandsAI.amp, (this.freqData[2] || 0) / 255 * 0.9);
    }
  }
}
let cyberpunkMusic = null;

// =========================================================================
// 🖼️ 3D INTERACTIVE MEDIA & IMAGE SCROLLER / CAROUSEL CHOOSER
// =========================================================================
function loadDynamicGLTFModel(modelPath, title, icon) {
  const targetObj = SCENE_OBJECTS.find(o => o.id === 1) || SCENE_OBJECTS[0];
  if (targetObj) {
    targetObj.modelPath = modelPath;
    targetObj.name = title;
    targetObj.icon = icon;
    if (targetObj.gltfModel && targetObj.threeGroup) {
      targetObj.threeGroup.remove(targetObj.gltfModel);
      targetObj.gltfModel = null;
    }
    load3DModel(targetObj);
  }
}

class MediaCarouselEngine {
  constructor() {
    this.modal = document.getElementById('media-chooser-modal');
    this.viewport = document.getElementById('carousel-viewport');
    this.btnOpen = document.getElementById('btn-open-chooser');
    this.btnClose = document.getElementById('btn-close-chooser');
    this.btnPrev = document.getElementById('carousel-prev-btn');
    this.btnNext = document.getElementById('carousel-next-btn');
    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.isOpen = false;
    this.currentFilter = 'all';

    this.catalog = [
      { id: 'damaged_helmet', type: 'models', title: 'Sci-Fi Helmet', file: 'models/damaged_helmet.glb', icon: '🪖', desc: 'PBR Battle Damaged' },
      { id: 'robot_expressive', type: 'models', title: 'Cyber Robot', file: 'models/robot_expressive.glb', icon: '🤖', desc: 'Expressive Animated' },
      { id: 'cyber_warrior', type: 'models', title: 'Cyber Warrior', file: 'models/cyber_warrior.glb', icon: '⚔️', desc: 'Futuristic Guardian' },
      { id: 'cyber_heroine', type: 'models', title: 'Cyber Heroine', file: 'models/cyber_heroine.glb', icon: '🦸‍♀️', desc: 'Hi-Poly Sci-Fi Hero' },
      { id: 'king', type: 'models', title: 'King Avatar', file: 'models/king.glb', icon: '👑', desc: 'Royal Armor & Crown' },
      { id: 'borbur', type: 'models', title: 'Borbur GLB', file: 'models/borbur.glb', icon: '👤', desc: 'Custom Spatial Mesh' },
      { id: 'flamingo', type: 'models', title: 'Neon Flamingo', file: 'models/flamingo.glb', icon: '🦩', desc: 'Gliding Neon Bird' },
      { id: 'horse', type: 'models', title: 'Cyber Horse', file: 'models/horse.glb', icon: '🐎', desc: 'Animated Cyber Steed' },
      { id: 'octopus', type: 'models', title: 'Deep Octopus', file: 'models/octopus.glb', icon: '🐙', desc: 'Tentacle Fluid Rig' },
      { id: 'astronaut', type: 'models', title: 'Space Astronaut', file: 'models/astronaut.glb', icon: '👨‍🚀', desc: 'Zero-G Cosmonaut' },
      { id: 'glass_hands', type: 'props', title: 'Glass Hologram', file: 'media/misc/glass-hands.png', img: 'media/misc/glass-hands.png', icon: '🔮', desc: 'Transparent Glass' },
      { id: 'dashboard', type: 'props', title: 'System Dashboard', file: 'media/misc/ss_dashboard.png', img: 'media/misc/ss_dashboard.png', icon: '📊', desc: 'Telemetry HUD' },
      { id: 'gallery', type: 'props', title: 'Spatial Gallery', file: 'media/misc/ss_gallery.png', img: 'media/misc/ss_gallery.png', icon: '🖼️', desc: 'Interactive Deck' },
      { id: 'modal_ai', type: 'props', title: 'AI Modal Glass', file: 'media/misc/ss_modal_ai.png', img: 'media/misc/ss_modal_ai.png', icon: '💬', desc: 'Neural Assistant' },
      { id: 'fireball', type: 'props', title: 'Plasma Fireball', file: 'media/fx/fireball.png', img: 'media/fx/fireball.png', icon: '🔥', desc: 'Alpha Particle FX' }
    ];

    this.init();
  }

  init() {
    this.renderCards();
    if (this.btnOpen) this.btnOpen.addEventListener('click', () => this.toggle());
    if (this.btnClose) this.btnClose.addEventListener('click', () => this.close());
    if (this.btnPrev) this.btnPrev.addEventListener('click', () => this.scroll(-280));
    if (this.btnNext) this.btnNext.addEventListener('click', () => this.scroll(280));

    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderCards();
      });
    });

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }
  }

  renderCards() {
    if (!this.viewport) return;
    this.viewport.innerHTML = '';
    const filtered = this.catalog.filter(item => {
      if (this.currentFilter === 'all') return true;
      return item.type === this.currentFilter;
    });

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-card';
      card.innerHTML = `
        <div class="media-card-badge">${item.type === 'models' ? '3D GLB' : 'PROP'}</div>
        ${item.img ? `<img src="${item.img}" class="media-card-img" alt="${item.title}">` : `<div class="media-card-icon">${item.icon}</div>`}
        <div class="media-card-title">${item.title}</div>
        <div class="media-card-desc">${item.desc}</div>
        <button class="media-card-btn">▶ STAGE NOW</button>
      `;
      card.addEventListener('click', () => this.selectItem(item));
      this.viewport.appendChild(card);
    });
  }

  scroll(offset) {
    if (this.viewport) {
      this.viewport.scrollBy({ left: offset, behavior: 'smooth' });
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.modal) {
      this.modal.style.display = this.isOpen ? 'flex' : 'none';
    }
    if (barehandsFoley) barehandsFoley.arrive();
  }

  close() {
    this.isOpen = false;
    if (this.modal) this.modal.style.display = 'none';
  }

  selectItem(item) {
    if (barehandsFoley) barehandsFoley.toggleOn();
    if (item.type === 'models') {
      loadDynamicGLTFModel(item.file, item.title, item.icon);
      if (selectedObjectName) selectedObjectName.textContent = item.title;
      if (selectedObjectIcon) selectedObjectIcon.textContent = item.icon;
      if (selectedObjectDesc) selectedObjectDesc.textContent = `Active 3D Model: ${item.desc}`;
    }
    this.close();
  }
}
let mediaCarousel = null;

// --- INITIALIZATION ---
async function init() {
  systemStatusText.textContent = "STATUS: INITIALIZING 3D ENGINE & VISION...";

  cyberpunkMusic = new CyberpunkMusicEngine();
  mediaCarousel = new MediaCarouselEngine();

  initThreeScene();
  requestAnimationFrame(renderLoop);

  try {
    if (window.FilesetResolver && window.HandLandmarker) {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6
        });
        activeModelName = "MediaPipe Tasks GPU";
      } catch (tasksErr) {
        console.warn("Tasks vision fallback to Hands Full:", tasksErr);
      }
    }

    if (!handLandmarker && window.Hands) {
      legacyHands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      legacyHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      legacyHands.onResults((results) => {
        handleVisionLandmarks(results.multiHandLandmarks, results.multiHandedness);
      });
      activeModelName = "MediaPipe Real-Time [Lite 60FPS]";
    }

    systemStatusText.textContent = `STATUS: READY [${activeModelName}]`;
    await startWebcam();
  } catch (err) {
    systemStatusText.textContent = "STATUS: READY [HYBRID MOUSE & VISION]";
    permissionModal.style.display = 'block';
  }
}

// Button & Fullscreen Bindings
btnToggleCam.addEventListener('click', startWebcam);
btnRequestCam.addEventListener('click', startWebcam);
btnSimMode.addEventListener('click', startSimulator);
btnDemoMode.addEventListener('click', startSimulator);

const btnToggleHud = document.getElementById('btn-toggle-hud');
const btnFullscreen = document.getElementById('btn-fullscreen');
const sidebarPanel = document.getElementById('sidebar-panel');

if (btnToggleHud && sidebarPanel) {
  btnToggleHud.addEventListener('click', () => {
    sidebarPanel.classList.toggle('collapsed');
    barehandsFoley.toggleOn();
  });
}

if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      btnFullscreen.textContent = "⛶ EXIT FULLSCREEN";
    } else {
      document.exitFullscreen().catch(() => {});
      btnFullscreen.textContent = "⛶ FULLSCREEN";
    }
    barehandsFoley.arrive();
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    if (sidebarPanel) sidebarPanel.classList.toggle('collapsed');
  }
  if (e.key === 'm' || e.key === 'M') {
    if (cyberpunkMusic) cyberpunkMusic.toggle();
  }
  if (e.key === 'g' || e.key === 'G') {
    if (mediaCarousel) mediaCarousel.toggle();
  }
  if (e.key === 'f' || e.key === 'F') {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
});

window.addEventListener('DOMContentLoaded', init);

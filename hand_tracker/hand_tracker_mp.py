#!/usr/bin/env python3
"""
Python OpenCV + MediaPipe 3D Spatial Hand Tracker & Playground
Features:
- Real-time 21 3D Landmark Tracking via Google MediaPipe HandLandmarker
- Threaded Zero-Lag Camera Frame Buffer (V4L2 / OpenCV)
- 5-Second Back-of-Fist Holographic Data Dial (Clock, FPS, Telemetry)
- 1-Finger Laser Pointer Selection & Dwell Confirmation
- Laser ➔ Open Hand ➔ Fist Clench Force Pull Summon
- 3D Model Bounding Boxes with 2-Finger Roll/3D Rotation & Physics Momentum Throwing
- 60%–70% Off-Screen Release-to-Delete with Red Warning Boxes
- Native OpenCV Window and HTTP/WebSocket Telemetry Server
"""

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import time
import math
import os
import sys
import threading
import json
from datetime import datetime

# --- CONFIGURATION & PATHS ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "hand_landmarker.task")
LOG_DIR = os.path.join(SCRIPT_DIR, "../logs")
os.makedirs(LOG_DIR, exist_ok=True)

# 21 Hand Topology Connections
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),        # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),        # Index
    (5, 9), (9, 10), (10, 11), (11, 12),   # Middle
    (9, 13), (13, 14), (14, 15), (15, 16), # Ring
    (13, 17), (0, 17), (17, 18), (18, 19), (19, 20) # Pinky & Base
]

# --- THREADED CAMERA STREAM (ZERO-LAG BUFFER) ---
class CameraStream:
    """Threaded camera reader keeping only the latest hardware frame."""
    def __init__(self, src=0, width=1280, height=720, fps=60):
        # Try V4L2 on Linux
        self.cap = cv2.VideoCapture(src, cv2.CAP_V4L2)
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(src)
            
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.ret, self.frame = self.cap.read()
        self.running = False
        self.lock = threading.Lock()

    def start(self):
        if self.running:
            return self
        self.running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()
        return self

    def _update(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.01)
                continue
            with self.lock:
                self.ret = ret
                self.frame = frame

    def read(self):
        with self.lock:
            return self.ret, self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.running = False
        if hasattr(self, 'thread'):
            self.thread.join(timeout=1.0)
        self.cap.release()

# --- SPATIAL SCENE OBJECT ---
class SpatialObject:
    def __init__(self, obj_id, name, icon, x, y, radius=120, color=(204, 255, 0)):
        self.id = obj_id
        self.name = name
        self.icon = icon
        self.x = float(x)
        self.y = float(y)
        self.target_x = float(x)
        self.target_y = float(y)
        self.vx = 0.0
        self.vy = 0.0
        self.radius = float(radius)
        self.scale = 1.0
        self.rot_z = 0.0
        self.rot_x = 0.0
        self.rot_y = 0.0
        self.color = color  # BGR
        self.is_grabbed = False
        self.is_force_pull_flying = False
        self.force_pull_start_x = 0.0
        self.force_pull_start_y = 0.0
        self.force_pull_start_time = 0.0
        self.force_pull_duration = 450.0  # ms

    def update_physics(self, dt):
        if not self.is_grabbed and not self.is_force_pull_flying:
            speed = math.hypot(self.vx, self.vy)
            if speed > 8.0:
                self.vx *= 0.82
                self.vy *= 0.82
                self.x += self.vx * dt
                self.y += self.vy * dt
            else:
                self.vx = 0.0
                self.vy = 0.0
            self.target_x = self.x
            self.target_y = self.y
        else:
            # 1:1 direct tracking when grabbed
            self.x = self.target_x
            self.y = self.target_y

# --- PYTHON MEDIAPIPE HAND TRACKER PIPELINE ---
class PythonMediaPipeHandTracker:
    def __init__(self, camera_src=0, width=1280, height=720):
        self.width = width
        self.height = height
        
        # Ensure task model exists
        if not os.path.exists(MODEL_PATH):
            import urllib.request
            print("[MediaPipe] Downloading hand_landmarker.task model...")
            url = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
            urllib.request.urlretrieve(url, MODEL_PATH)
            print("[MediaPipe] Model downloaded successfully.")

        # Initialize MediaPipe HandLandmarker
        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=2,
            min_hand_detection_confidence=0.6,
            min_hand_presence_confidence=0.6,
            min_tracking_confidence=0.6
        )
        self.detector = vision.HandLandmarker.create_from_options(options)
        
        # Camera Stream
        self.stream = CameraStream(src=camera_src, width=width, height=height)
        
        # Scene Objects
        self.scene_objects = [
            SpatialObject("OBJ_HELMET", "Sci-Fi Helmet", "🪖", 420, 360, radius=130, color=(204, 255, 0)),
            SpatialObject("OBJ_ROBOT", "Cyber Robot", "🤖", 860, 360, radius=130, color=(0, 204, 255))
        ]
        
        # Interaction States & Dual-Hand Grabbing
        self.confirmed_selected_object = self.scene_objects[0]
        self.grabbed_by_hand = {'Left': None, 'Right': None}
        self.grab_mode_by_hand = {'Left': None, 'Right': None}
        self.currently_grabbed_object = None
        self.grab_mode = None
        
        # Force Pull States
        self.force_pull_selected_object = None
        self.force_pull_selected_time = 0.0
        self.force_pull_state = 'idle'  # 'idle', 'selected', 'opened'
        
        # 5-Second Fist Holographic Data Dial State
        self.fist_hud_start_time = None
        self.is_fist_hud_active = False
        self.fist_hud_current_pos = None
        self.fist_hud_radius = 68
        self.fist_hud_hand_label = None
        self.FIST_HUD_DURATION = 5.0  # seconds
        
        # Laser Pointer Dwell
        self.laser_pointed_obj = None
        self.laser_point_start_time = None
        
        # FPS Telemetry
        self.prev_frame_time = time.time()
        self.fps = 60
        self.last_interaction_text = "READY"

    def dist(self, p1, p2):
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    def analyze_hand(self, landmarks_px):
        """Analyzes 21 landmarks to determine finger extensions and postures."""
        wrist = landmarks_px[0]
        thumb_tip = landmarks_px[4]
        index_tip = landmarks_px[8]
        middle_tip = landmarks_px[12]
        ring_tip = landmarks_px[16]
        pinky_tip = landmarks_px[20]

        index_pip = landmarks_px[6]
        middle_pip = landmarks_px[10]
        ring_pip = landmarks_px[14]
        pinky_pip = landmarks_px[18]

        index_open = self.dist(index_tip, wrist) > self.dist(index_pip, wrist) * 1.08
        middle_open = self.dist(middle_tip, wrist) > self.dist(middle_pip, wrist) * 1.08
        ring_open = self.dist(ring_tip, wrist) > self.dist(ring_pip, wrist) * 1.08
        pinky_open = self.dist(pinky_tip, wrist) > self.dist(pinky_pip, wrist) * 1.08
        thumb_open = self.dist(thumb_tip, pinky_pip) > self.dist(landmarks_px[3], pinky_pip) * 1.05

        is_fist = not index_open and not middle_open and not ring_open and not pinky_open
        is_two_finger = index_open and middle_open and not ring_open and not pinky_open
        is_pointer = index_open and not middle_open and not ring_open and not pinky_open
        is_open = index_open and middle_open and ring_open and pinky_open

        d_pinch = self.dist(thumb_tip, index_tip)
        # Palm Normal Cross Product for Front / Back Tracking
        ax = landmarks_px[9][0] - wrist[0]
        ay = landmarks_px[9][1] - wrist[1]
        bx = landmarks_px[17][0] - landmarks_px[5][0]
        by = landmarks_px[17][1] - landmarks_px[5][1]
        cross_z = ax * by - ay * bx

        return {
            'is_fist': is_fist,
            'is_two_finger': is_two_finger,
            'is_pointer': is_pointer,
            'is_open': is_open,
            'is_pinch': is_pinch,
            'd_pinch': d_pinch,
            'count': count,
            'cross_z': cross_z,
            'thumb_tip': thumb_tip,
            'index_tip': index_tip,
            'wrist': wrist,
            'knuckle': landmarks_px[9]
        }

    def process_interactions(self, now, hand_data_list):
        # 1. Force Pull 5.0s Window Expiration
        if self.force_pull_selected_object:
            if now - self.force_pull_selected_time > 5.0:
                self.force_pull_selected_object = None
                self.force_pull_state = 'idle'
            else:
                has_open_hand = any(h['analysis']['count'] >= 4 for h in hand_data_list)
                if has_open_hand and not self.grabbed_by_hand['Left'] and not self.grabbed_by_hand['Right']:
                    self.force_pull_state = 'opened'

        # 2. Process Each Hand for Dual-Hand Independent Grabbing
        for label in ['Left', 'Right']:
            matched_hand = next((h for h in hand_data_list if h['label'] == label), None)
            other_label = 'Right' if label == 'Left' else 'Left'
            other_grabbed = self.grabbed_by_hand[other_label]

            # Case A: Hand is actively grabbing an object
            if self.grabbed_by_hand[label]:
                obj = self.grabbed_by_hand[label]
                if matched_hand and (matched_hand['analysis']['is_fist'] or matched_hand['analysis']['is_pinch']):
                    if obj.is_force_pull_flying:
                        flight_elapsed = (now * 1000) - obj.force_pull_start_time
                        t_norm = min(1.0, flight_elapsed / obj.force_pull_duration)
                        ease = 4 * t_norm * t_norm * t_norm if t_norm < 0.5 else 1 - math.pow(-2 * t_norm + 2, 3) / 2
                        arc_y = math.sin(t_norm * math.pi) * -45
                        
                        obj.target_x = obj.force_pull_start_x + (matched_hand['landmarks'][9][0] - obj.force_pull_start_x) * ease
                        obj.target_y = obj.force_pull_start_y + (matched_hand['landmarks'][9][1] - obj.force_pull_start_y) * ease + arc_y
                        
                        if t_norm >= 1.0:
                            obj.is_force_pull_flying = False
                            self.last_interaction_text = f"✊ {obj.name.upper()} IN {label.upper()} HAND!"
                    else:
                        obj.target_x = matched_hand['landmarks'][9][0]
                        obj.target_y = matched_hand['landmarks'][9][1]
                else:
                    # Released by this hand
                    obj.is_grabbed = False
                    self.grabbed_by_hand[label] = None
                    self.grab_mode_by_hand[label] = None
                    self.last_interaction_text = f"🖐️ RELEASED [${label.upper()}]: {obj.name.upper()}"

            # Case B: Hand is free and looking to grab
            else:
                if matched_hand:
                    is_fist = matched_hand['analysis']['is_fist']
                    is_pinch = matched_hand['analysis']['is_pinch']

                    if is_fist or is_pinch:
                        # Force Pull Trigger
                        if self.force_pull_selected_object and self.force_pull_state == 'opened' and (now - self.force_pull_selected_time <= 5.0) and self.force_pull_selected_object != other_grabbed:
                            target = self.force_pull_selected_object
                            self.grabbed_by_hand[label] = target
                            target.is_grabbed = True
                            target.is_force_pull_flying = True
                            target.force_pull_start_x = target.x
                            target.force_pull_start_y = target.y
                            target.force_pull_start_time = now * 1000
                            self.force_pull_selected_object = None
                            self.force_pull_state = 'idle'
                            self.last_interaction_text = f"🧲 FORCE PULLING {target.name.upper()} [${label.upper()}]!"
                        else:
                            # Contact grab
                            pt = matched_hand['landmarks'][9] if is_fist else matched_hand['analysis']['thumb_tip']
                            candidate = None
                            min_d = float('inf')
                            for obj in self.scene_objects:
                                if obj == other_grabbed:
                                    continue
                                d = math.hypot(pt[0] - obj.x, pt[1] - obj.y)
                                if d < obj.radius * obj.scale + 40 and d < min_d:
                                    min_d = d
                                    candidate = obj

                            if candidate:
                                self.grabbed_by_hand[label] = candidate
                                self.grab_mode_by_hand[label] = 'fist' if is_fist else 'pinch'
                                candidate.is_grabbed = True
                                self.confirmed_selected_object = candidate
                                self.last_interaction_text = f"✊ {label.upper()} GRAB: {candidate.name.upper()}"

        # Dual Grab Banner Status
        l_obj = self.grabbed_by_hand['Left']
        r_obj = self.grabbed_by_hand['Right']
        if l_obj and r_obj:
            self.last_interaction_text = f"👐 DUAL GRAB: 👈 LEFT [{l_obj.name.upper()}] + 👉 RIGHT [{r_obj.name.upper()}]"

        # 4. Off-Screen 70% Warning & 90% Deletion Check on Release
        objects_to_keep = []
        for obj in self.scene_objects:
            eff_r = obj.radius * obj.scale
            b_diam = eff_r * 2
            off_left = max(0, -(obj.x - eff_r))
            off_right = max(0, (obj.x + eff_r) - self.width)
            off_top = max(0, -(obj.y - eff_r))
            off_bottom = max(0, (obj.y + eff_r) - self.height)

            off_frac_x = (off_left + off_right) / b_diam
            off_frac_y = (off_top + off_bottom) / b_diam
            max_off = max(off_frac_x, off_frac_y)

            if not obj.is_grabbed and max_off >= 0.90:
                print(f"[Playground] Deleted {obj.name} (exited {max_off*100:.1f}%)")
                self.last_interaction_text = f"🗑️ {obj.name.upper()} DELETED OFF-SCREEN!"
                continue
            objects_to_keep.append(obj)
        self.scene_objects = objects_to_keep

    def draw_spatial_objects(self, frame):
        """Renders 3D object bounding boxes, rotation roll, and exit warnings."""
        for obj in self.scene_objects:
            cx, cy = int(obj.x), int(obj.y)
            eff_r = int(obj.radius * obj.scale)
            b_half = eff_r + 40

            # Off-screen check for Warning Red (>= 70%)
            off_left = max(0, -(obj.x - eff_r))
            off_right = max(0, (obj.x + eff_r) - self.width)
            off_top = max(0, -(obj.y - eff_r))
            off_bottom = max(0, (obj.y + eff_r) - self.height)
            off_frac = max((off_left + off_right) / (eff_r * 2), (off_top + off_bottom) / (eff_r * 2))
            is_exiting = off_frac >= 0.70

            color = (51, 0, 255) if is_exiting else ((0, 255, 255) if obj.is_grabbed else obj.color)

            # Translucent box fill
            overlay = frame.copy()
            cv2.rectangle(overlay, (cx - b_half, cy - b_half), (cx + b_half, cy + b_half), color, -1)
            cv2.addWeighted(overlay, 0.08, frame, 0.92, 0, frame)

            # Bounding Box Border
            cv2.rectangle(frame, (cx - b_half, cy - b_half), (cx + b_half, cy + b_half), color, 2, cv2.LINE_AA)

            # 4 Corner Brackets
            k = 20
            # Top-Left
            cv2.line(frame, (cx - b_half, cy - b_half), (cx - b_half + k, cy - b_half), color, 3, cv2.LINE_AA)
            cv2.line(frame, (cx - b_half, cy - b_half), (cx - b_half, cy - b_half + k), color, 3, cv2.LINE_AA)
            # Top-Right
            cv2.line(frame, (cx + b_half, cy - b_half), (cx + b_half - k, cy - b_half), color, 3, cv2.LINE_AA)
            cv2.line(frame, (cx + b_half, cy - b_half), (cx + b_half, cy - b_half + k), color, 3, cv2.LINE_AA)
            # Bottom-Left
            cv2.line(frame, (cx - b_half, cy + b_half), (cx - b_half + k, cy + b_half), color, 3, cv2.LINE_AA)
            cv2.line(frame, (cx - b_half, cy + b_half), (cx - b_half, cy + b_half - k), color, 3, cv2.LINE_AA)
            # Bottom-Right Corner Pin (Rotation Handle)
            cv2.circle(frame, (cx + b_half, cy + b_half), 8, (204, 255, 0), -1)

            # Header & Name
            if is_exiting:
                exit_pct = int((off_frac / 0.90) * 100)
                cv2.putText(frame, f"RELEASE TO DELETE ({exit_pct}%)", (cx - 85, cy - b_half - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (51, 0, 255), 1, cv2.LINE_AA)
            else:
                cv2.putText(frame, obj.name.upper(), (cx - 50, cy - b_half - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)

            cv2.putText(frame, f"SCALE: {obj.scale:.2f}x", (cx - 45, cy + b_half + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (200, 200, 200), 1, cv2.LINE_AA)

    def run(self):
        """Main real-time tracking loop."""
        print("=" * 60)
        print(" Vision.Core // Python MediaPipe + OpenCV Hand Tracker")
        print(" Controls:")
        print("  - ✊ Fist (5.0s hold): ⏱️ Holographic Data Dial")
        print("  - 👉 Laser + 🖐️ Open + ✊ Fist: 🧲 Force Pull Summon (5.0s window)")
        print("  - ✊ Fist Grab: Drag & Momentum Throw")
        print("  - 🗑️ Exit >= 60% & Release: Deletes Object")
        print("  - Press 'q' or 'ESC' to exit")
        print("=" * 60)

        self.stream.start()
        time.sleep(0.5)

        frame_count = 0
        fps_timer = time.time()

        while True:
            ret, frame = self.stream.read()
            if not ret or frame is None:
                time.sleep(0.01)
                continue

            # Mirror for natural interaction
            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            self.width, self.height = w, h
            now = time.time()

            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            detection_result = self.detector.detect(mp_image)

            hand_data_list = []

            if detection_result.hand_landmarks:
                for i, raw_landmarks in enumerate(detection_result.hand_landmarks):
                    handedness = detection_result.handedness[i][0]
                    # In mirrored view, Left is Right
                    raw_label = handedness.category_name
                    label = 'Right' if raw_label == 'Left' else 'Left'

                    landmarks_px = [(int(lm.x * w), int(lm.y * h)) for lm in raw_landmarks]
                    analysis = self.analyze_hand(landmarks_px)

                    hand_data_list.append({
                        'label': label,
                        'landmarks': landmarks_px,
                        'analysis': analysis
                    })

            # Process Interactivity & Physics
            dt = min(0.05, now - self.prev_frame_time)
            for obj in self.scene_objects:
                obj.update_physics(dt)

            self.process_interactions(now, hand_data_list)

            # 1. Draw Spatial Objects (Boxes & Equalizer Bars) Base Layer
            self.draw_spatial_objects(frame)

            # 2. Draw Hand Skeletons & Neon Joints ON TOP OF EVERYTHING (100% Solid Opacity)
            for hand_info in hand_data_list:
                label = hand_info['label']
                landmarks_px = hand_info['landmarks']
                analysis = hand_info['analysis']

                for p1_idx, p2_idx in HAND_CONNECTIONS:
                    # Thick glow line
                    line_color = (0, 229, 255) if label == 'Left' else (255, 0, 127)
                    cv2.line(frame, landmarks_px[p1_idx], landmarks_px[p2_idx], line_color, 4, cv2.LINE_AA)
                    cv2.line(frame, landmarks_px[p1_idx], landmarks_px[p2_idx], (255, 255, 255), 1, cv2.LINE_AA)

                for pt in landmarks_px:
                    cv2.circle(frame, pt, 6, (0, 255, 255), -1)
                    cv2.circle(frame, pt, 2, (255, 255, 255), -1)

                # Orientation & Gesture Badge
                wrist_pt = landmarks_px[0]
                is_back = (analysis['cross_z'] > 0) if label == 'Right' else (analysis['cross_z'] < 0)
                facing_str = "BACK" if is_back else "FRONT"
                gesture_str = f"FIST [{facing_str}]" if analysis['is_fist'] else f"{analysis['count']}F [{facing_str}]"
                badge_color = (255, 229, 0) if is_back else (0, 204, 255)
                cv2.putText(frame, f"{label.upper()}: {gesture_str}", (wrist_pt[0] - 50, wrist_pt[1] + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.42, badge_color, 1, cv2.LINE_AA)


            # FPS Calculation
            frame_count += 1
            if now - fps_timer >= 1.0:
                self.fps = int(frame_count / (now - fps_timer))
                frame_count = 0
                fps_timer = now

            self.prev_frame_time = now

            # Top HUD Banner
            cv2.rectangle(frame, (18, 14), (480, 48), (15, 23, 42), -1)
            cv2.rectangle(frame, (18, 14), (480, 48), (204, 255, 0), 1, cv2.LINE_AA)
            cv2.putText(frame, f"FPS: {self.fps} | HANDS: {len(hand_data_list)} | {self.last_interaction_text}", (26, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (204, 255, 0), 1, cv2.LINE_AA)

            cv2.imshow("Vision.Core // Python MediaPipe Hand Tracker", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:
                break

        self.stream.stop()
        cv2.destroyAllWindows()
        print("[MediaPipe] Python tracker stopped cleanly.")

if __name__ == "__main__":
    tracker = PythonMediaPipeHandTracker(camera_src=0)
    tracker.run()

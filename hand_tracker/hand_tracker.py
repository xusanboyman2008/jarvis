#!/usr/bin/env python3
"""
Python OpenCV Hand Contour, Skeleton & Gesture Tracker
Can run natively or process webcam/video streams.
"""
import cv2
import numpy as np
import time
import math

class HandTrackerCV:
    """Fallback high-speed computer vision hand tracker using HSV Skin Masking and Convexity Defects."""
    def __init__(self, src=0):
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        # Skin color boundaries in HSV
        self.lower_skin = np.array([0, 30, 60], dtype=np.uint8)
        self.upper_skin = np.array([20, 150, 255], dtype=np.uint8)

    def process_frame(self, frame):
        h, w, _ = frame.shape
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, self.lower_skin, self.upper_skin)
        
        # Morphological filtering
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.dilate(mask, kernel, iterations=2)
        mask = cv2.GaussianBlur(mask, (5, 5), 100)

        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return frame, 0, "No Hand"

        # Largest contour is assumed to be hand
        hand_contour = max(contours, key=lambda c: cv2.contourArea(c))
        area = cv2.contourArea(hand_contour)
        if area < 5000:
            return frame, 0, "No Hand"

        # Convex Hull and Defects
        hull = cv2.convexHull(hand_contour, returnPoints=False)
        defects = cv2.convexityDefects(hand_contour, hull)

        finger_count = 0
        if defects is not None:
            for i in range(defects.shape[0]):
                s, e, f, d = defects[i, 0]
                start = tuple(hand_contour[s][0])
                end = tuple(hand_contour[e][0])
                far = tuple(hand_contour[f][0])

                # Calculate triangle sides
                a = math.hypot(end[0] - start[0], end[1] - start[1])
                b = math.hypot(far[0] - start[0], far[1] - start[1])
                c = math.hypot(end[0] - far[0], end[1] - far[1])

                # Cosine rule for angle
                angle = math.acos((b**2 + c**2 - a**2) / (2 * b * c + 1e-6)) * 57.29

                # Check if angle is acute and depth > threshold (defect between fingers)
                if angle <= 90 and d > 10000:
                    finger_count += 1
                    cv2.circle(frame, far, 5, (0, 0, 255), -1)

            # Defects count gives gaps between fingers => fingers = count + 1
            finger_count = min(5, finger_count + 1) if finger_count > 0 else 0

        # Draw contour and hull
        hull_pts = cv2.convexHull(hand_contour)
        cv2.drawContours(frame, [hand_contour], -1, (0, 255, 0), 2)
        cv2.drawContours(frame, [hull_pts], -1, (0, 255, 255), 2)

        gesture = "Fist (0)" if finger_count == 0 else f"{finger_count} Fingers"
        if finger_count == 5:
            gesture = "Open Hand (5)"
        elif finger_count == 2:
            gesture = "Peace / 2"
        elif finger_count == 1:
            gesture = "Point / 1"

        return frame, finger_count, gesture

    def run(self):
        print("Starting OpenCV Hand Tracking. Press 'q' to exit.")
        prev_time = time.time()
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break
            frame = cv2.flip(frame, 1)
            frame, count, gesture = self.process_frame(frame)
            
            # FPS calculation
            curr_time = time.time()
            fps = 1 / (curr_time - prev_time + 1e-6)
            prev_time = curr_time

            # HUD Display
            cv2.putText(frame, f"FPS: {int(fps)}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 204), 2)
            cv2.putText(frame, f"Gesture: {gesture}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 204), 2)

            cv2.imshow("Hand Vision HUD", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    tracker = HandTrackerCV()
    # Note: cv2.imshow requires an active GUI display (X11/Wayland)
    try:
        tracker.run()
    except Exception as e:
        print(f"OpenCV GUI not available ({e}). Use the Web Vision HUD (server.py) for browser-based 60fps tracking.")

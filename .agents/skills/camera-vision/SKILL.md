---
name: camera-vision
description: >-
  Provides OpenCV, V4L2, RTSP/HTTP streaming, webcam video capture, frame buffer processing,
  and computer vision workflows in Python and C++.
---

# Camera & Computer Vision Skill

Dense, production-ready workflows for camera capture, video streaming, hardware acceleration, and frame manipulation.

## Core Dependencies
```bash
pip install opencv-python opencv-python-headless numpy pillow
# Linux system tools
sudo apt-get install -y v4l-utils ffmpeg
```

---

## 1. Non-Blocking Threaded Video Capture (Zero-Lag Frame Buffer)
Standard `cv2.VideoCapture` blocks and buffers old frames. Use this threaded reader to always retrieve the most recent hardware frame.

```python
import cv2
import threading
import time

class CameraStream:
    """Threaded camera reader keeping only the latest frame."""
    def __init__(self, src=0, width=1280, height=720, fps=30):
        # On Linux, cv2.CAP_V4L2 is preferred
        self.cap = cv2.VideoCapture(src, cv2.CAP_V4L2)
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
```

---

## 2. Fast Frame Encoding for Network / Telegram
Compress frames directly to memory buffers (JPEG/WebP) without disk I/O.

```python
def frame_to_jpeg(frame, quality=85) -> bytes:
    """Encode OpenCV BGR frame to JPEG bytes."""
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, buffer = cv2.imencode('.jpg', frame, encode_param)
    if not success:
        raise ValueError("Could not encode frame to JPEG")
    return buffer.tobytes()
```

---

## 3. Real-Time Motion Detection & Contour Tracking

```python
import cv2
import numpy as np

class MotionDetector:
    def __init__(self, min_area=500, history=500, var_threshold=16):
        self.subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history, 
            varThreshold=var_threshold, 
            detectShadows=False
        )
        self.min_area = min_area

    def detect(self, frame):
        """Returns (motion_detected, bounding_boxes, fg_mask)."""
        fg_mask = self.subtractor.apply(frame)
        # Filter noise
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_DILATE, kernel)

        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = []
        for c in contours:
            if cv2.contourArea(c) >= self.min_area:
                x, y, w, h = cv2.boundingRect(c)
                boxes.append((x, y, w, h))

        return len(boxes) > 0, boxes, fg_mask
```

---

## 4. Querying Available V4L2 Devices (Linux)
```bash
# List all video devices
v4l2-ctl --list-devices

# Query supported formats and resolutions for /dev/video0
v4l2-ctl -d /dev/video0 --list-formats-ext
```

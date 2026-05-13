import cv2
import numpy as np
from ultralytics import YOLO
from collections import deque
import pandas as pd

player_model = YOLO("yolov8n.pt")

frame_buffer = deque(maxlen=20)
ball_positions = deque(maxlen=20)

shot_types = ["2p1","2p0","3p1","3p0","mp1","mp0","ft1","ft0"]
shot_counts = {s:0 for s in shot_types}

def detect_ball(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_orange = np.array([5, 150, 150])
    upper_orange = np.array([20, 255, 255])
    mask = cv2.inRange(hsv, lower_orange, upper_orange)
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        c = max(contours, key=cv2.contourArea)
        if cv2.contourArea(c) > 100:
            x, y, w, h = cv2.boundingRect(c)
            cx, cy = x + w//2, y + h//2
            return (cx, cy), (x, y, w, h)
    return None, None

def classify_shot():
    return np.random.choice(shot_types)

def compute_stats(counts):
    FG = (counts["mp1"] / max(1, counts["mp0"]+counts["mp1"]))*100
    TP = (counts["3p1"] / max(1, counts["3p0"]+counts["3p1"]))*100
    FT = (counts["ft1"] / max(1, counts["ft0"]+counts["ft1"]))*100
    FGA = counts["mp0"]+counts["mp1"]+counts["3p0"]+counts["3p1"]
    eFG = (counts["mp1"] + counts["3p1"] + 0.5*counts["3p1"]) / max(1, FGA)
    points = 2*counts["mp1"] + 3*counts["3p1"] + counts["ft1"]
    FTA = counts["ft0"]+counts["ft1"]
    TS = points / max(1, 2*(FGA + 0.44*FTA))
    return FG, TP, FT, eFG, TS

cap = cv2.VideoCapture(r"C:\Users\dharu\Downloads\new_test.mp4")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_buffer.append(frame)
    results = player_model(frame)[0]
    for box in results.boxes.xyxy:
        x1, y1, x2, y2 = map(int, box)
        cv2.rectangle(frame, (x1,y1), (x2,y2), (0,255,0), 2)

    ball_center, ball_box = detect_ball(frame)
    if ball_center:
        ball_positions.append(ball_center)
        x, y, w, h = ball_box
        cv2.rectangle(frame, (x,y), (x+w,y+h), (0,0,255), 2)
        for i in range(1, len(ball_positions)):
            cv2.line(frame, ball_positions[i-1], ball_positions[i], (255,0,0), 2)
        shot = classify_shot()
        shot_counts[shot] += 1

    FG, TP, FT, eFG, TS = compute_stats(shot_counts)
    stats_text = f"FG%:{FG:.1f}  3P%:{TP:.1f}  FT%:{FT:.1f}  eFG:{eFG:.2f}  TS:{TS:.2f}"
    cv2.putText(frame, stats_text, (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
    cv2.imshow("Basketball Live Stats", frame)

    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()

pd.DataFrame(list(shot_counts.items()), columns=["Shot","Count"]).to_csv("basketball_live_shot_stats.csv", index=False)
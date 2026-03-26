import cv2
import numpy as np
from ultralytics import YOLO
from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input
from tensorflow.keras.models import Model
from tensorflow.keras.layers import GlobalAveragePooling2D
from sklearn.metrics.pairwise import cosine_similarity
import os

print("Loading models...")

yolo_model = YOLO("yolov8n.pt")

face_model = ResNet50(weights='imagenet', include_top=False, input_shape=(160,160,3))
face_model.trainable = False

base_ball_model = ResNet50(weights='imagenet', include_top=False, input_shape=(64,64,3))
x = GlobalAveragePooling2D()(base_ball_model.output)
ball_model = Model(inputs=base_ball_model.input, outputs=x)
ball_model.trainable = False

lfw_embeddings = np.load(r"C:\Users\dharu\Downloads\lfw_embeddings.npy", allow_pickle=True).item()
ball_embeddings_data = np.load(r"C:\Users\dharu\Downloads\ball_embeddings.npy", allow_pickle=True)

embeddings_dict = dict(lfw_embeddings)
for i, emb in enumerate(ball_embeddings_data):
    embeddings_dict[f"ball_{i}"] = emb

print("Unified embeddings loaded:", len(embeddings_dict))

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def extract_face(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2]*f[3])
    return img[y:y+h, x:x+w]

def get_face_embedding(img):
    face = extract_face(img)
    if face is None:
        return None
    face = cv2.resize(face, (160,160))
    face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
    face = preprocess_input(face.astype(np.float32))
    face = np.expand_dims(face, axis=0)
    return face_model.predict(face, verbose=0).flatten()

def get_ball_embedding(img):
    crop_resized = cv2.resize(img, (64,64))
    crop_pre = preprocess_input(crop_resized.astype(np.float32))
    crop_pre = np.expand_dims(crop_pre, axis=0)
    return ball_model.predict(crop_pre, verbose=0).flatten()

def identify_object(emb, threshold=0.6):
    best_match = "Unknown"
    best_score = -1
    for name, ref_emb in embeddings_dict.items():
        if emb.shape != ref_emb.shape:
            continue  # skip if dimensions mismatch
        score = cosine_similarity([emb], [ref_emb])[0][0]
        if score > best_score:
            best_score = score
            best_match = name
    return best_match if best_score >= threshold else "Unknown"

video_path = r"C:\Users\dharu\OneDrive\Desktop\Startup\test.mp4"

if not os.path.exists(video_path):
    print("Error: Video path does not exist!")
    exit()

cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print("Error: Could not open video!")
    exit()

cv2.startWindowThread()
print("Starting unified player + ball tracking. Press 'q' to quit.\n")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.resize(frame, (960,540))
    results = yolo_model(frame, verbose=False)[0]

    for box, cls_id in zip(results.boxes, results.boxes.cls):
        cls_id = cls_id.item()
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        crop = frame[y1:y2, x1:x2]

        cls_name = yolo_model.model.names[cls_id]

        if cls_name == "person":
            emb = get_face_embedding(crop)
            color = (0,255,0)  # green for players
        elif cls_name == "sports ball":
            emb = get_ball_embedding(crop)
            color = (0,0,255)  # red for balls
        else:
            continue

        label = identify_object(emb) if emb is not None else "Unknown"
        cv2.rectangle(frame, (x1,y1), (x2,y2), color, 3)
        cv2.putText(frame, label, (x1, y1-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    cv2.imshow("Unified Player + Ball Tracking", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
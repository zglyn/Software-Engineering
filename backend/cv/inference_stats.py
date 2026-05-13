import json
import argparse
from pathlib import Path

import cv2
import torch
import torch.nn as nn
from torchvision import models, transforms

CLASS_NAMES = ["free_throw", "two_point", "three_point"]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

transform = transforms.Compose(
    [
        transforms.ToPILImage(),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)

_SHOT_MODEL = None
_MADE_MODEL = None


def _load_shot_type_model(pt_path: str):
    model = models.mobilenet_v3_small(weights=None)
    in_f = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(nn.Dropout(0.3), nn.Linear(in_f, 3))
    model.load_state_dict(torch.load(pt_path, map_location=device))
    return model.eval().to(device)


def _load_made_model(pt_path: str):
    model = models.mobilenet_v3_small(weights=None)
    in_f = model.classifier[3].in_features
    model.classifier[3] = nn.Sequential(nn.Dropout(0.3), nn.Linear(in_f, 1))
    model.load_state_dict(torch.load(pt_path, map_location=device))
    return model.eval().to(device)


def _get_models():
    global _SHOT_MODEL, _MADE_MODEL
    if _SHOT_MODEL is not None and _MADE_MODEL is not None:
        return _SHOT_MODEL, _MADE_MODEL
    base = Path(__file__).resolve().parent
    shot_pt = str(base / "shot_classifier.pt")
    made_pt = str(base / "made_classifier.pt")
    _SHOT_MODEL = _load_shot_type_model(shot_pt)
    _MADE_MODEL = _load_made_model(made_pt)
    return _SHOT_MODEL, _MADE_MODEL


def _get_frame(video_path: str, pos: float):
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(total * pos))
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return None
    return cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (224, 224))


def _predict(video_path: str):
    shot_model, made_model = _get_models()

    frame = _get_frame(video_path, 0.50)
    if frame is None:
        return None
    inp = transform(frame).unsqueeze(0).to(device)
    with torch.no_grad():
        out = shot_model(inp)
        probs = torch.softmax(out, dim=1)[0].cpu().numpy()
        type_idx = out.argmax(dim=1).item()
        type_pred = CLASS_NAMES[type_idx]

    frame = _get_frame(video_path, 0.75)
    if frame is None:
        return None
    inp = transform(frame).unsqueeze(0).to(device)
    with torch.no_grad():
        out = made_model(inp).squeeze(1)
        p_made = torch.sigmoid(out).item()
        made_pred = p_made >= 0.5

    return {
        "shot_type": type_pred,
        "p_made": float(p_made),
        "type_probs": {c: float(p) for c, p in zip(CLASS_NAMES, probs)},
        "made": bool(made_pred),
    }





def _stats_from_prediction(pred: dict):
    ft_0 = 0
    ft_1 = 0
    p2_0 = 0
    p2_1 = 0
    p3_0 = 0
    p3_1 = 0
    total_points = 0

    st = pred["shot_type"]
    made = bool(pred["made"])

    if st == "free_throw":
        if made:
            ft_1 = 1
            total_points = 1
        else:
            ft_0 = 1
    elif st == "two_point":
        if made:
            p2_1 = 1
            total_points = 2
        else:
            p2_0 = 1
    elif st == "three_point":
        if made:
            p3_1 = 1
            total_points = 3
        else:
            p3_0 = 1

    return {
        "statsGenerated": True,
        "ft_0": ft_0,
        "ft_1": ft_1,
        "p2_0": p2_0,
        "p2_1": p2_1,
        "p3_0": p3_0,
        "p3_1": p3_1,
        "total_points": total_points,
    }


def run(video_path: str):
    pred = _predict(video_path)
    if pred is None:
        raise RuntimeError("inference failed")
    stats = _stats_from_prediction(pred)
    return {
        "ok": True,
        "stats": stats,
        "pred": {"shot_type": pred["shot_type"], "p_made": pred["p_made"]},
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    args = ap.parse_args()
    out = run(args.video)
    print(json.dumps(out))

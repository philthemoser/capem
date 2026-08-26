#!/usr/bin/env python3
"""Verifies the JS QR encoder produces genuinely scannable symbols.
Usage: node tools/verify-qr.js tools/qr-tests.json > /tmp/out.json && python3 tools/verify-qr.py /tmp/out.json"""
import json, sys, numpy as np, cv2
js = json.load(open(sys.argv[1]))
det = cv2.QRCodeDetector(); ok = tot = 0
for text, mat in js.items():
    if not mat: continue
    tot += 1
    a = np.array([[1 - int(c) for c in ln] for ln in mat.splitlines()], dtype=np.uint8) * 255
    img = np.kron(np.pad(a, 4, constant_values=255), np.ones((10, 10), dtype=np.uint8))
    decoded, _, _ = det.detectAndDecode(img)
    good = decoded == text; ok += good
    print(("OK  " if good else "FAIL"), repr(text[:60]))
print(f"{ok}/{tot} scannable")
sys.exit(0 if ok == tot else 1)

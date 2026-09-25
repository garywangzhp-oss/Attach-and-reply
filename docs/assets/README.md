# Support page assets

The two payment QR codes shown side by side on the support page
(`docs/index.html`).

| File | Content | Size |
|---|---|---|
| `alipay.png` | Alipay QR code | 1259x1259 |
| `wechat.png` | WeChat Pay QR code | 428x428 |

Both were produced from phone screenshots by cropping to a square around the QR
code and keeping a margin of white around it. Verify a replacement the same way
before committing it:

```python
# any QR decoder works, e.g. opencv's
import cv2
print(cv2.QRCodeDetector().detectAndDecode(cv2.imread("docs/assets/alipay.png"))[0])
```

A crop that still decodes is the acceptance test - it means the whole code is
inside the frame with enough of a quiet zone.

**Quiet zone rule**: leave at least **4 modules** of white on every side, where a
module is the width of one small square in the code. Measure it once with the run
length of the first QR row (`alipay.png` is version 6, 41x41, so one module is
about 25px and the margin should be at least 100px). A too-tight image still
decodes in a decoder library but can fail with a real phone camera, so pad with
white rather than cropping harder - padding never changes the code itself.

The page also adds 12px of white padding inside the frame as a second line of
defence.

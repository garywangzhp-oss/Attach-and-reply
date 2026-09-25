# Support page assets

The two payment QR codes shown side by side on the support page
(`docs/index.html`).

| File | Content | Size |
|---|---|---|
| `alipay.png` | Alipay QR code | 1119x1117 |
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
inside the frame with enough of a quiet zone. Avoid re-cropping so tightly that
the code touches an edge; the page adds 12px of white padding inside the frame as
a second line of defence.

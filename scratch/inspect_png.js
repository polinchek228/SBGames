import fs from 'fs';
import { PNG } from 'pngjs';

const frames = ['frame.png', 'frame2.png', 'frame3.png', 'frame4.png', 'frame5.png', 'frame6.png'];

for (const f of frames) {
  const file = `public/${f}`;
  if (!fs.existsSync(file)) {
    console.log(`${f} does not exist`);
    continue;
  }
  const data = fs.readFileSync(file);
  const png = PNG.sync.read(data);

  const startX = Math.floor(png.width * 0.25);
  const endX = Math.floor(png.width * 0.75);
  const startY = Math.floor(png.height * 0.25);
  const endY = Math.floor(png.height * 0.75);

  let centerPixelsCount = 0;
  let nonTransparentCenterPixelsCount = 0;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const a = png.data[idx + 3];

      if (x >= startX && x < endX && y >= startY && y < endY) {
        centerPixelsCount++;
        if (a > 0) {
          nonTransparentCenterPixelsCount++;
        }
      }
    }
  }

  console.log(`${f}: ${png.width}x${png.height}, Center opacity: ${((nonTransparentCenterPixelsCount / centerPixelsCount) * 100).toFixed(1)}%`);
}

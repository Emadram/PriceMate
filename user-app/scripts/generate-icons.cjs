const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

(async () => {
  try {
    const src = path.resolve(__dirname, '..', '..', 'LogoPriceMate.png');
    if (!fs.existsSync(src)) {
      console.error('Source logo not found:', src);
      process.exit(1);
    }

    const publicDir = path.resolve(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const image = await Jimp.read(src);

    const outputs = [
      { name: 'favicon.png', size: 48 },
      { name: 'apple-touch-icon.png', size: 180 },
      { name: 'android-chrome-192.png', size: 192 },
      { name: 'android-chrome-512.png', size: 512 },
    ];

    for (const out of outputs) {
      const cloned = image.clone();
      cloned.cover(out.size, out.size); // resize and crop to cover
      const outPath = path.join(publicDir, out.name);
      await cloned.writeAsync(outPath);
      console.log('Written', outPath);
    }

    console.log('Icon generation complete.');
  } catch (err) {
    console.error('Error generating icons:', err);
    process.exit(1);
  }
})();

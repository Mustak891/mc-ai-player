/**
 * compress-assets.js
 * Compresses PNG assets using sharp with lossy quantization.
 * Run: node scripts/compress-assets.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Sizes per Expo / Android / iOS requirements
const files = [
    { name: 'icon.png', width: 1024, height: 1024 },
    { name: 'adaptive-icon.png', width: 1024, height: 1024 },
    { name: 'splash-icon.png', width: 1024, height: 1024 },
    { name: 'favicon.png', width: 196, height: 196 },
];

// Install sharp locally if not present
try {
    require.resolve('sharp');
} catch {
    console.log('Installing sharp...');
    execSync('npm install --no-save sharp', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

const sharp = require('sharp');

async function compressAll() {
    let totalBefore = 0;
    let totalAfter = 0;

    for (const { name, width, height } of files) {
        const filePath = path.join(assetsDir, name);
        const before = fs.statSync(filePath).size;
        totalBefore += before;

        const tempPath = filePath + '.tmp';

        // Use palette (lossy quantization) for icons — dramatically shrinks complex gradients
        // quality 80 keeps excellent visual fidelity at small launcher icon sizes
        await sharp(filePath)
            .resize(width, height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png({
                compressionLevel: 9,
                palette: true,          // Enable lossy quantization (pngquant-style)
                quality: 85,            // 85% quality — visually lossless at icon sizes
                dither: 1.0,            // Full dithering for smooth gradients
                colors: 256,            // Max palette size
            })
            .toFile(tempPath);

        fs.renameSync(tempPath, filePath);
        const after = fs.statSync(filePath).size;
        totalAfter += after;

        const savedMB = ((before - after) / 1024 / 1024).toFixed(2);
        const pct = (((before - after) / before) * 100).toFixed(1);
        console.log(`✓ ${name.padEnd(22)} ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB  (-${savedMB}MB / ${pct}%)`);
    }

    const totalSavedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(2);
    const totalPct = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
    console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(2)}MB → ${(totalAfter / 1024 / 1024).toFixed(2)}MB  (saved ${totalSavedMB}MB / ${totalPct}%)`);
    console.log('Done!');
}

compressAll().catch(err => { console.error(err); process.exit(1); });

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function main() {
  console.log('1. Extracting ProGuard zip archive...');
  execSync('powershell -Command "Expand-Archive -Path scratch/proguard.zip -DestinationPath scratch/proguard -Force"');
  console.log('Extraction complete.');

  // Copy proguard.jar
  const srcJar = 'scratch/proguard/proguard-7.4.2/lib/proguard.jar';
  if (fs.existsSync(srcJar)) {
    fs.copyFileSync(srcJar, 'proguard.jar');
    console.log('proguard.jar copied to root.');
  } else {
    throw new Error('proguard.jar not found after extraction.');
  }

  console.log('2. Running setup_proguard.js to generate config...');
  execSync('node scratch/setup_proguard.js');

  console.log('3. Running ProGuard obfuscation...');
  // Execute ProGuard
  try {
    execSync('java -jar proguard.jar @scratch/proguard.conf', { stdio: 'inherit' });
    console.log('Obfuscation complete.');
  } catch (err) {
    console.error('ProGuard execution failed. Make sure JDK JMods are available.');
    throw err;
  }

  // 4. Overwrite original jar with obfuscated jar
  const obfJar = 'public/sbg-bootstrap-obf.jar';
  const targetJar = 'public/sbg-bootstrap.jar';
  if (fs.existsSync(obfJar)) {
    fs.copyFileSync(obfJar, targetJar);
    console.log('Successfully replaced sbg-bootstrap.jar with obfuscated version!');
    // Clean up temp obf jar
    fs.unlinkSync(obfJar);
  } else {
    throw new Error('Obfuscated jar was not generated.');
  }
}

main().catch(console.error);

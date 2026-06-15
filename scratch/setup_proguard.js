import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function main() {
  // 1. Generate decompiler-breaking dictionary using mixed symbols and zero-width characters
  const mixChars = ['I', 'l', '|', '1'];
  const invisibleChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  const dict = [];
  const generated = new Set();
  while (dict.length < 3000) {
    let len = 6 + Math.floor(Math.random() * 8);
    let word = '';
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.5) {
        word += mixChars[Math.floor(Math.random() * mixChars.length)];
      } else {
        word += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
      }
    }
    if (!word.startsWith('\u200B') && !word.startsWith('\u200C') && !word.startsWith('\u200D') && !word.startsWith('\uFEFF') && !word.startsWith('1')) {
      if (!generated.has(word)) {
        generated.add(word);
        dict.push(word);
      }
    }
  }

  const dictPath = path.resolve('scratch/obf_dict.txt');
  fs.writeFileSync(dictPath, dict.join('\n'), 'utf8');
  console.log('Mangled Unicode obfuscation dictionary generated.');

  // 2. Locate Java Home to load java.base.jmod (needed for ProGuard compilation reference)
  let javaHome = process.env.JAVA_HOME || '';
  if (!javaHome) {
    try {
      const javaPath = execSync('where java').toString().trim().split('\r\n')[0];
      javaHome = path.dirname(path.dirname(javaPath));
    } catch {
      javaHome = 'C:\\Program Files\\Eclipse Foundation\\jdk-17.0.18.9-hotspot';
    }
  }

  const jmodPath = path.join(javaHome, 'jmods', 'java.base.jmod');
  console.log(`Java JMOD path resolved: ${jmodPath}`);

  const injar = path.resolve('public/sbg-bootstrap.jar');
  const outjar = path.resolve('public/sbg-bootstrap-obf.jar');

  // 3. Generate proguard.conf configuration file with absolute paths
  const conf = `
-injars "${injar}"
-outjars "${outjar}"
-libraryjars "${jmodPath}"

-dontwarn **

-optimizationpasses 5
-allowaccessmodification
-repackageclasses 'com.sbgames.bootstrap.obf'

-classobfuscationdictionary "${dictPath}"
-obfuscationdictionary "${dictPath}"
-useuniqueclassmembernames

-keep public class com.sbgames.bootstrap.SBGBootstrap {
    public static void main(java.lang.String[]);
}
-keepattributes Signature,InnerClasses,EnclosingMethod
`;

  fs.writeFileSync('scratch/proguard.conf', conf, 'utf8');
  console.log('proguard.conf configuration generated with strong obfuscation rules.');
}

main().catch(console.error);

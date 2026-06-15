import fs from 'fs';
import { PNG } from 'pngjs'; // unrelated import but we have it, actually let's just use standard zip parser
import { execSync } from 'child_process';

// We can run a small Java/Node command or just write a script that reads the jar.
// Since we have jar CLI, we can extract the class file first.
try {
  execSync('jar -xf public/sbg-bootstrap.jar com/sbgames/bootstrap/SBGBootstrap.class');
  const classData = fs.readFileSync('com/sbgames/bootstrap/SBGBootstrap.class');
  
  // Clean up extracted file
  fs.unlinkSync('com/sbgames/bootstrap/SBGBootstrap.class');
  fs.rmdirSync('com/sbgames/bootstrap', { recursive: true });
  fs.rmdirSync('com', { recursive: true });

  console.log('Class file read successfully. Size:', classData.length);
  
  // Search for UTF-8 strings in class data
  // The structure of constant pool UTF8 is tag=1 (1 byte), length (2 bytes), string bytes
  let foundChinese = [];
  for (let i = 0; i < classData.length - 3; i++) {
    // Check if we have 3 bytes representing a Chinese character from our list
    // Chinese characters in UTF-8 range from 0xE38000 to 0xE99FFF
    const b1 = classData[i];
    const b2 = classData[i+1];
    const b3 = classData[i+2];
    
    if (b1 >= 0xE3 && b1 <= 0xE9 && (b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
      const char = Buffer.from([b1, b2, b3]).toString('utf8');
      foundChinese.push(char);
    }
  }
  
  console.log('Found Chinese Obfuscation Characters in class bytecode:', [...new Set(foundChinese)].join(', '));
} catch (e) {
  console.error(e);
}

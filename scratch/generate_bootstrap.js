import fs from 'fs';
import path from 'path';

const symbols = ['I', 'l', '_', '$'];

function getRandomName() {
  let len = 6 + Math.floor(Math.random() * 8);
  let name = '';
  // Ensure we start with a valid letter or underscore/dollar
  name += ['I', 'l', '_', '$'][Math.floor(Math.random() * 4)];
  for (let i = 1; i < len; i++) {
    name += symbols[Math.floor(Math.random() * symbols.length)];
  }
  return name;
}

// Target strings to obfuscate
const targets = {
  BOOTSTRAP_LAUNCHER: 'cpw.mods.bootstraplauncher.BootstrapLauncher',
  MAIN_METHOD: 'main',
  WATCHDOG_NAME: 'sbg-runtime-guard',
  MOD_HASHES_FILE: '.mod-hashes',
  MODS_DIR: 'mods',
  AGENT_JAVAAGENT: '-javaagent',
  AGENT_AGENTLIB: '-agentlib',
  AGENT_AGENTPATH: '-agentpath',
  AGENT_XDEBUG: '-xdebug',
  AGENT_JDWP: 'jdwp',
  ENV_JAVA_TOOL_OPTIONS: 'JAVA_TOOL_OPTIONS',
  ENV_JAVA_OPTIONS: '_JAVA_OPTIONS',
  ENV_JDK_JAVA_OPTIONS: 'JDK_JAVA_OPTIONS'
};

// Generates Java code to decrypt a byte array using a specific key and wipe memory
function encryptString(value) {
  const bytes = Buffer.from(value, 'utf8');
  const key = [];
  const encrypted = [];
  
  // Generate multi-byte key
  for (let i = 0; i < bytes.length; i++) {
    key.push(Math.floor(Math.random() * 256));
    encrypted.push(bytes[i] ^ key[i]);
  }

  const funcName = getRandomName();
  
  // Format byte arrays
  const encryptedStr = encrypted.map(b => `(byte)${b >= 128 ? b - 256 : b}`).join(', ');
  const keyStr = key.map(b => `(byte)${b >= 128 ? b - 256 : b}`).join(', ');

  const decrypter = `
    private static String ${funcName}() {
        byte[] enc = new byte[]{ ${encryptedStr} };
        byte[] key = new byte[]{ ${keyStr} };
        byte[] res = new byte[enc.length];
        for (int i = 0; i < enc.length; i++) {
            res[i] = (byte) (enc[i] ^ key[i]);
        }
        String s = new String(res, java.nio.charset.StandardCharsets.UTF_8);
        java.util.Arrays.fill(enc, (byte) 0);
        java.util.Arrays.fill(key, (byte) 0);
        java.util.Arrays.fill(res, (byte) 0);
        return s;
    }
  `;

  return { funcName, decrypter };
}

function generate() {
  const decrypters = [];
  const replacements = {};

  for (const [key, value] of Object.entries(targets)) {
    const { funcName, decrypter } = encryptString(value);
    decrypters.push(decrypter);
    replacements[key] = `${funcName}()`;
  }

  const javaCode = `package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    ${decrypters.join('\n')}

    public static void main(String[] args) {
        try {
            // 1. Read ephemeral session key from stdin
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
                sessionKey = reader.readLine();
            }
            if (sessionKey == null || sessionKey.length() < 16) {
                System.exit(1);
            }

            // 2. Perform environment check
            if (detectDebuggerOrAgents()) {
                System.exit(1);
            }

            // 3. Verify modpack integrity
            if (!verifyModpackIntegrity()) {
                System.exit(1);
            }

            // 4. Start active watchdog daemon
            startSecurityWatchdog();

            // 5. Delegate to Forge BootstrapLauncher
            Class<?> forgeEntryPoint = Class.forName(${replacements.BOOTSTRAP_LAUNCHER});
            forgeEntryPoint.getMethod(${replacements.MAIN_METHOD}, String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(${replacements.AGENT_JAVAAGENT}) 
                || lower.contains(${replacements.AGENT_AGENTLIB}) 
                || lower.contains(${replacements.AGENT_AGENTPATH}) 
                || lower.contains(${replacements.AGENT_XDEBUG})
                || lower.contains(${replacements.AGENT_JDWP})) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            ${replacements.ENV_JAVA_TOOL_OPTIONS},
            ${replacements.ENV_JAVA_OPTIONS},
            ${replacements.ENV_JDK_JAVA_OPTIONS}
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(${replacements.AGENT_JAVAAGENT}) 
                    || lower.contains(${replacements.AGENT_AGENTLIB}) 
                    || lower.contains(${replacements.AGENT_AGENTPATH}) 
                    || lower.contains(${replacements.AGENT_XDEBUG})
                    || lower.contains(${replacements.AGENT_JDWP})) {
                    return true;
                }
            }
        }
        return false;
    }

    private static void startSecurityWatchdog() {
        Thread monitor = new Thread(() -> {
            while (true) {
                try {
                    if (detectDebuggerOrAgents()) {
                        System.exit(1);
                    }
                    Thread.sleep(1000);
                } catch (Exception e) {
                    System.exit(1);
                }
            }
        });
        monitor.setDaemon(true);
        monitor.setName(${replacements.WATCHDOG_NAME});
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(${replacements.MOD_HASHES_FILE});
            if (!hashFile.exists()) {
                return false;
            }

            Map<String, String> expectedHashes = new HashMap<>();
            try (BufferedReader br = new BufferedReader(new FileReader(hashFile))) {
                String line;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.isEmpty()) continue;
                    int colon = line.indexOf(':');
                    if (colon > 0) {
                        String hash = line.substring(0, colon).toLowerCase();
                        String filename = line.substring(colon + 1);
                        expectedHashes.put(filename, hash);
                    }
                }
            }

            File modsDir = new File(${replacements.MODS_DIR});
            if (!modsDir.exists() || !modsDir.isDirectory()) {
                return expectedHashes.isEmpty();
            }

            File[] files = modsDir.listFiles();
            if (files == null) return false;

            Set<String> processedFiles = new HashSet<>();

            for (File file : files) {
                if (file.isDirectory()) continue;
                String name = file.getName();
                if (!name.toLowerCase().endsWith(".jar")) continue;

                processedFiles.add(name);

                String expectedHash = expectedHashes.get(name);
                if (expectedHash == null) {
                    return false;
                }

                String actualHash = getFileSHA256(file);
                if (!actualHash.equalsIgnoreCase(expectedHash)) {
                    return false;
                }
            }

            for (String expectedName : expectedHashes.keySet()) {
                if (!processedFiles.contains(expectedName)) {
                    return false;
                }
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String getFileSHA256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream is = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) > 0) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
`;

  const targetPath = path.resolve('src-java/com/sbgames/bootstrap/SBGBootstrap.java');
  fs.writeFileSync(targetPath, javaCode, 'utf8');
  console.log(`Successfully generated SBGBootstrap.java with ${Object.keys(targets).length} obfuscated strings.`);
}

generate();

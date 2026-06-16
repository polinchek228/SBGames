package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String _$_I$$_$() {
        byte[] enc = new byte[]{ (byte)-13, (byte)-92, (byte)12, (byte)-50, (byte)66, (byte)-92, (byte)-24, (byte)58, (byte)-33, (byte)-86, (byte)107, (byte)59, (byte)-100, (byte)-55, (byte)104, (byte)107, (byte)8, (byte)-47, (byte)85, (byte)41, (byte)104, (byte)-70, (byte)66, (byte)27, (byte)115, (byte)65, (byte)-113, (byte)79, (byte)14, (byte)102, (byte)57, (byte)-23, (byte)-50, (byte)-3, (byte)-93, (byte)79, (byte)-28, (byte)-16, (byte)-116, (byte)-46, (byte)-111, (byte)5, (byte)81, (byte)-115 };
        byte[] key = new byte[]{ (byte)-112, (byte)-44, (byte)123, (byte)-32, (byte)47, (byte)-53, (byte)-116, (byte)73, (byte)-15, (byte)-56, (byte)4, (byte)84, (byte)-24, (byte)-70, (byte)28, (byte)25, (byte)105, (byte)-95, (byte)57, (byte)72, (byte)29, (byte)-44, (byte)33, (byte)115, (byte)22, (byte)51, (byte)-95, (byte)13, (byte)97, (byte)9, (byte)77, (byte)-102, (byte)-70, (byte)-113, (byte)-62, (byte)63, (byte)-88, (byte)-111, (byte)-7, (byte)-68, (byte)-14, (byte)109, (byte)52, (byte)-1 };
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
  

    private static String $lI__I__I() {
        byte[] enc = new byte[]{ (byte)91, (byte)-35, (byte)-119, (byte)-51 };
        byte[] key = new byte[]{ (byte)54, (byte)-68, (byte)-32, (byte)-93 };
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
  

    private static String l_lIlI$IIlI$l() {
        byte[] enc = new byte[]{ (byte)19, (byte)100, (byte)-126, (byte)-101, (byte)-22, (byte)-57, (byte)-104, (byte)82, (byte)-44, (byte)110, (byte)28, (byte)112, (byte)48, (byte)55, (byte)0, (byte)-59, (byte)21 };
        byte[] key = new byte[]{ (byte)96, (byte)6, (byte)-27, (byte)-74, (byte)-104, (byte)-78, (byte)-10, (byte)38, (byte)-67, (byte)3, (byte)121, (byte)93, (byte)87, (byte)66, (byte)97, (byte)-73, (byte)113 };
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
  

    private static String l__ll_IlllI_$() {
        byte[] enc = new byte[]{ (byte)81, (byte)14, (byte)-33, (byte)-111, (byte)-49, (byte)36, (byte)77, (byte)125, (byte)65, (byte)80, (byte)-98 };
        byte[] key = new byte[]{ (byte)127, (byte)99, (byte)-80, (byte)-11, (byte)-30, (byte)76, (byte)44, (byte)14, (byte)41, (byte)53, (byte)-19 };
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
  

    private static String ___III() {
        byte[] enc = new byte[]{ (byte)-65, (byte)37, (byte)26, (byte)75 };
        byte[] key = new byte[]{ (byte)-46, (byte)74, (byte)126, (byte)56 };
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
  

    private static String $_II$Il$I() {
        byte[] enc = new byte[]{ (byte)-125, (byte)-8, (byte)6, (byte)-19, (byte)-17, (byte)63, (byte)-65, (byte)3, (byte)-82, (byte)95 };
        byte[] key = new byte[]{ (byte)-82, (byte)-110, (byte)103, (byte)-101, (byte)-114, (byte)94, (byte)-40, (byte)102, (byte)-64, (byte)43 };
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
  

    private static String I_l$I$I$l() {
        byte[] enc = new byte[]{ (byte)-94, (byte)-25, (byte)109, (byte)105, (byte)-70, (byte)-70, (byte)73, (byte)-33, (byte)-34 };
        byte[] key = new byte[]{ (byte)-113, (byte)-122, (byte)10, (byte)12, (byte)-44, (byte)-50, (byte)37, (byte)-74, (byte)-68 };
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
  

    private static String I_$lIllIII() {
        byte[] enc = new byte[]{ (byte)124, (byte)64, (byte)52, (byte)-59, (byte)-27, (byte)27, (byte)98, (byte)-14, (byte)39, (byte)-36 };
        byte[] key = new byte[]{ (byte)81, (byte)33, (byte)83, (byte)-96, (byte)-117, (byte)111, (byte)18, (byte)-109, (byte)83, (byte)-76 };
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
  

    private static String $lI$_I$l_() {
        byte[] enc = new byte[]{ (byte)114, (byte)-1, (byte)-27, (byte)-8, (byte)34, (byte)52, (byte)-41 };
        byte[] key = new byte[]{ (byte)95, (byte)-121, (byte)-127, (byte)-99, (byte)64, (byte)65, (byte)-80 };
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
  

    private static String $l$$Il_() {
        byte[] enc = new byte[]{ (byte)116, (byte)-124, (byte)72, (byte)-126 };
        byte[] key = new byte[]{ (byte)30, (byte)-32, (byte)63, (byte)-14 };
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
  

    private static String II_lll() {
        byte[] enc = new byte[]{ (byte)12, (byte)-107, (byte)-86, (byte)-53, (byte)100, (byte)87, (byte)89, (byte)100, (byte)79, (byte)-31, (byte)-61, (byte)48, (byte)-109, (byte)-69, (byte)0, (byte)-107, (byte)34 };
        byte[] key = new byte[]{ (byte)70, (byte)-44, (byte)-4, (byte)-118, (byte)59, (byte)3, (byte)22, (byte)43, (byte)3, (byte)-66, (byte)-116, (byte)96, (byte)-57, (byte)-14, (byte)79, (byte)-37, (byte)113 };
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
  

    private static String _$$_I_() {
        byte[] enc = new byte[]{ (byte)126, (byte)28, (byte)-96, (byte)80, (byte)-24, (byte)101, (byte)-123, (byte)-46, (byte)-127, (byte)19, (byte)56, (byte)-124, (byte)-82 };
        byte[] key = new byte[]{ (byte)33, (byte)86, (byte)-31, (byte)6, (byte)-87, (byte)58, (byte)-54, (byte)-126, (byte)-43, (byte)90, (byte)119, (byte)-54, (byte)-3 };
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
  

    private static String ll_$II() {
        byte[] enc = new byte[]{ (byte)96, (byte)-13, (byte)-89, (byte)-51, (byte)-89, (byte)15, (byte)63, (byte)-106, (byte)-101, (byte)-8, (byte)-113, (byte)48, (byte)112, (byte)55, (byte)-88, (byte)-97 };
        byte[] key = new byte[]{ (byte)42, (byte)-73, (byte)-20, (byte)-110, (byte)-19, (byte)78, (byte)105, (byte)-41, (byte)-60, (byte)-73, (byte)-33, (byte)100, (byte)57, (byte)120, (byte)-26, (byte)-52 };
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
            Class<?> forgeEntryPoint = Class.forName(_$_I$$_$());
            forgeEntryPoint.getMethod($lI__I__I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains($_II$Il$I()) 
                || lower.contains(I_l$I$I$l()) 
                || lower.contains(I_$lIllIII()) 
                || lower.contains($lI$_I$l_())
                || lower.contains($l$$Il_())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            II_lll(),
            _$$_I_(),
            ll_$II()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains($_II$Il$I()) 
                    || lower.contains(I_l$I$I$l()) 
                    || lower.contains(I_$lIllIII()) 
                    || lower.contains($lI$_I$l_())
                    || lower.contains($l$$Il_())) {
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
        monitor.setName(l_lIlI$IIlI$l());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(l__ll_IlllI_$());
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

            File modsDir = new File(___III());
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

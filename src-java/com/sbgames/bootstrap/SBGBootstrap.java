package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String _$_lIl$____$() {
        byte[] enc = new byte[]{ (byte)-126, (byte)37, (byte)96, (byte)103, (byte)111, (byte)56, (byte)4, (byte)-72, (byte)65, (byte)-35, (byte)40, (byte)63, (byte)-111, (byte)118, (byte)-21, (byte)66, (byte)14, (byte)62, (byte)-124, (byte)-58, (byte)67, (byte)68, (byte)-82, (byte)-13, (byte)48, (byte)-82, (byte)50, (byte)2, (byte)-24, (byte)-122, (byte)-84, (byte)110, (byte)-99, (byte)-12, (byte)-118, (byte)42, (byte)-108, (byte)-17, (byte)119, (byte)-119, (byte)-36, (byte)-85, (byte)-13, (byte)50 };
        byte[] key = new byte[]{ (byte)-31, (byte)85, (byte)23, (byte)73, (byte)2, (byte)87, (byte)96, (byte)-53, (byte)111, (byte)-65, (byte)71, (byte)80, (byte)-27, (byte)5, (byte)-97, (byte)48, (byte)111, (byte)78, (byte)-24, (byte)-89, (byte)54, (byte)42, (byte)-51, (byte)-101, (byte)85, (byte)-36, (byte)28, (byte)64, (byte)-121, (byte)-23, (byte)-40, (byte)29, (byte)-23, (byte)-122, (byte)-21, (byte)90, (byte)-40, (byte)-114, (byte)2, (byte)-25, (byte)-65, (byte)-61, (byte)-106, (byte)64 };
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
  

    private static String _II_l_$l_$_() {
        byte[] enc = new byte[]{ (byte)-96, (byte)-42, (byte)-44, (byte)113 };
        byte[] key = new byte[]{ (byte)-51, (byte)-73, (byte)-67, (byte)31 };
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
  

    private static String ___II_l() {
        byte[] enc = new byte[]{ (byte)107, (byte)-52, (byte)28, (byte)48, (byte)-37, (byte)-122, (byte)-74, (byte)-66, (byte)70, (byte)-121, (byte)11, (byte)-99, (byte)-34, (byte)-38, (byte)103, (byte)-33, (byte)15 };
        byte[] key = new byte[]{ (byte)24, (byte)-82, (byte)123, (byte)29, (byte)-87, (byte)-13, (byte)-40, (byte)-54, (byte)47, (byte)-22, (byte)110, (byte)-80, (byte)-71, (byte)-81, (byte)6, (byte)-83, (byte)107 };
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
  

    private static String I_l_llll$l() {
        byte[] enc = new byte[]{ (byte)81, (byte)-116, (byte)127, (byte)75, (byte)-115, (byte)47, (byte)-57, (byte)60, (byte)-66, (byte)12, (byte)56 };
        byte[] key = new byte[]{ (byte)127, (byte)-31, (byte)16, (byte)47, (byte)-96, (byte)71, (byte)-90, (byte)79, (byte)-42, (byte)105, (byte)75 };
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
  

    private static String $__I$I() {
        byte[] enc = new byte[]{ (byte)98, (byte)-61, (byte)67, (byte)116 };
        byte[] key = new byte[]{ (byte)15, (byte)-84, (byte)39, (byte)7 };
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
  

    private static String I__$_Il_lI__() {
        byte[] enc = new byte[]{ (byte)45, (byte)125, (byte)-9, (byte)59, (byte)0, (byte)-126, (byte)-35, (byte)67, (byte)37, (byte)5 };
        byte[] key = new byte[]{ (byte)0, (byte)23, (byte)-106, (byte)77, (byte)97, (byte)-29, (byte)-70, (byte)38, (byte)75, (byte)113 };
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
  

    private static String l_I_I_$() {
        byte[] enc = new byte[]{ (byte)1, (byte)-42, (byte)-60, (byte)123, (byte)56, (byte)98, (byte)-117, (byte)-67, (byte)-37 };
        byte[] key = new byte[]{ (byte)44, (byte)-73, (byte)-93, (byte)30, (byte)86, (byte)22, (byte)-25, (byte)-44, (byte)-71 };
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
  

    private static String $__lII$III_I() {
        byte[] enc = new byte[]{ (byte)-112, (byte)-64, (byte)-4, (byte)-118, (byte)-115, (byte)35, (byte)31, (byte)41, (byte)-62, (byte)30 };
        byte[] key = new byte[]{ (byte)-67, (byte)-95, (byte)-101, (byte)-17, (byte)-29, (byte)87, (byte)111, (byte)72, (byte)-74, (byte)118 };
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
  

    private static String I_$l__lIIll$() {
        byte[] enc = new byte[]{ (byte)13, (byte)88, (byte)-43, (byte)-57, (byte)-65, (byte)4, (byte)6 };
        byte[] key = new byte[]{ (byte)32, (byte)32, (byte)-79, (byte)-94, (byte)-35, (byte)113, (byte)97 };
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
  

    private static String l$_II$lI() {
        byte[] enc = new byte[]{ (byte)115, (byte)19, (byte)17, (byte)-32 };
        byte[] key = new byte[]{ (byte)25, (byte)119, (byte)102, (byte)-112 };
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
  

    private static String l_l__IIII() {
        byte[] enc = new byte[]{ (byte)81, (byte)-44, (byte)124, (byte)10, (byte)-12, (byte)-30, (byte)-75, (byte)-112, (byte)3, (byte)121, (byte)-48, (byte)26, (byte)0, (byte)92, (byte)57, (byte)-108, (byte)72 };
        byte[] key = new byte[]{ (byte)27, (byte)-107, (byte)42, (byte)75, (byte)-85, (byte)-74, (byte)-6, (byte)-33, (byte)79, (byte)38, (byte)-97, (byte)74, (byte)84, (byte)21, (byte)118, (byte)-38, (byte)27 };
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
  

    private static String l$Ill$() {
        byte[] enc = new byte[]{ (byte)-66, (byte)46, (byte)-66, (byte)76, (byte)-75, (byte)-37, (byte)-69, (byte)80, (byte)-38, (byte)53, (byte)-111, (byte)-89, (byte)-55 };
        byte[] key = new byte[]{ (byte)-31, (byte)100, (byte)-1, (byte)26, (byte)-12, (byte)-124, (byte)-12, (byte)0, (byte)-114, (byte)124, (byte)-34, (byte)-23, (byte)-102 };
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
  

    private static String _l_ll$Ill_l_l() {
        byte[] enc = new byte[]{ (byte)-64, (byte)-126, (byte)53, (byte)-109, (byte)118, (byte)-18, (byte)-92, (byte)-96, (byte)15, (byte)65, (byte)20, (byte)-50, (byte)-25, (byte)-99, (byte)-67, (byte)-39 };
        byte[] key = new byte[]{ (byte)-118, (byte)-58, (byte)126, (byte)-52, (byte)60, (byte)-81, (byte)-14, (byte)-31, (byte)80, (byte)14, (byte)68, (byte)-102, (byte)-82, (byte)-46, (byte)-13, (byte)-118 };
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
            Class<?> forgeEntryPoint = Class.forName(_$_lIl$____$());
            forgeEntryPoint.getMethod(_II_l_$l_$_(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(I__$_Il_lI__()) 
                || lower.contains(l_I_I_$()) 
                || lower.contains($__lII$III_I()) 
                || lower.contains(I_$l__lIIll$())
                || lower.contains(l$_II$lI())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            l_l__IIII(),
            l$Ill$(),
            _l_ll$Ill_l_l()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(I__$_Il_lI__()) 
                    || lower.contains(l_I_I_$()) 
                    || lower.contains($__lII$III_I()) 
                    || lower.contains(I_$l__lIIll$())
                    || lower.contains(l$_II$lI())) {
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
        monitor.setName(___II_l());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(I_l_llll$l());
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

            File modsDir = new File($__I$I());
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

package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String $IlIll$() {
        byte[] enc = new byte[]{ (byte)17, (byte)36, (byte)-51, (byte)-13, (byte)-85, (byte)-78, (byte)91, (byte)82, (byte)-26, (byte)-101, (byte)68, (byte)71, (byte)-100, (byte)-100, (byte)100, (byte)-7, (byte)80, (byte)82, (byte)91, (byte)114, (byte)110, (byte)-42, (byte)41, (byte)13, (byte)-44, (byte)-33, (byte)104, (byte)-24, (byte)23, (byte)-69, (byte)70, (byte)107, (byte)86, (byte)10, (byte)-106, (byte)-100, (byte)-104, (byte)24, (byte)-79, (byte)55, (byte)103, (byte)-40, (byte)-53, (byte)31 };
        byte[] key = new byte[]{ (byte)114, (byte)84, (byte)-70, (byte)-35, (byte)-58, (byte)-35, (byte)63, (byte)33, (byte)-56, (byte)-7, (byte)43, (byte)40, (byte)-24, (byte)-17, (byte)16, (byte)-117, (byte)49, (byte)34, (byte)55, (byte)19, (byte)27, (byte)-72, (byte)74, (byte)101, (byte)-79, (byte)-83, (byte)70, (byte)-86, (byte)120, (byte)-44, (byte)50, (byte)24, (byte)34, (byte)120, (byte)-9, (byte)-20, (byte)-44, (byte)121, (byte)-60, (byte)89, (byte)4, (byte)-80, (byte)-82, (byte)109 };
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
  

    private static String Il__l__I() {
        byte[] enc = new byte[]{ (byte)26, (byte)116, (byte)49, (byte)-85 };
        byte[] key = new byte[]{ (byte)119, (byte)21, (byte)88, (byte)-59 };
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
  

    private static String $Il_l_llII() {
        byte[] enc = new byte[]{ (byte)-107, (byte)-38, (byte)87, (byte)107, (byte)-119, (byte)51, (byte)-61, (byte)99, (byte)85, (byte)39, (byte)56, (byte)-67, (byte)20, (byte)94, (byte)-58, (byte)63, (byte)-61 };
        byte[] key = new byte[]{ (byte)-26, (byte)-72, (byte)48, (byte)70, (byte)-5, (byte)70, (byte)-83, (byte)23, (byte)60, (byte)74, (byte)93, (byte)-112, (byte)115, (byte)43, (byte)-89, (byte)77, (byte)-89 };
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
  

    private static String $II_l_I_l() {
        byte[] enc = new byte[]{ (byte)1, (byte)-80, (byte)-100, (byte)-22, (byte)124, (byte)39, (byte)80, (byte)45, (byte)-83, (byte)-5, (byte)111 };
        byte[] key = new byte[]{ (byte)47, (byte)-35, (byte)-13, (byte)-114, (byte)81, (byte)79, (byte)49, (byte)94, (byte)-59, (byte)-98, (byte)28 };
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
  

    private static String $$Ill$lIIl$II() {
        byte[] enc = new byte[]{ (byte)-65, (byte)-38, (byte)56, (byte)-37 };
        byte[] key = new byte[]{ (byte)-46, (byte)-75, (byte)92, (byte)-88 };
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
  

    private static String l$lIIIllllI() {
        byte[] enc = new byte[]{ (byte)-96, (byte)-62, (byte)0, (byte)94, (byte)123, (byte)49, (byte)-120, (byte)95, (byte)-57, (byte)102 };
        byte[] key = new byte[]{ (byte)-115, (byte)-88, (byte)97, (byte)40, (byte)26, (byte)80, (byte)-17, (byte)58, (byte)-87, (byte)18 };
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
  

    private static String l$l_llIII$_lI() {
        byte[] enc = new byte[]{ (byte)106, (byte)-68, (byte)-119, (byte)126, (byte)-39, (byte)21, (byte)58, (byte)69, (byte)-24 };
        byte[] key = new byte[]{ (byte)71, (byte)-35, (byte)-18, (byte)27, (byte)-73, (byte)97, (byte)86, (byte)44, (byte)-118 };
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
  

    private static String $II$$$lI$$_l_() {
        byte[] enc = new byte[]{ (byte)-25, (byte)40, (byte)81, (byte)-46, (byte)36, (byte)-100, (byte)-125, (byte)-90, (byte)108, (byte)68 };
        byte[] key = new byte[]{ (byte)-54, (byte)73, (byte)54, (byte)-73, (byte)74, (byte)-24, (byte)-13, (byte)-57, (byte)24, (byte)44 };
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
  

    private static String $I__$I_$Illl() {
        byte[] enc = new byte[]{ (byte)103, (byte)-53, (byte)43, (byte)-41, (byte)-84, (byte)-23, (byte)-95 };
        byte[] key = new byte[]{ (byte)74, (byte)-77, (byte)79, (byte)-78, (byte)-50, (byte)-100, (byte)-58 };
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
  

    private static String ll__ll_() {
        byte[] enc = new byte[]{ (byte)-51, (byte)-45, (byte)-25, (byte)-38 };
        byte[] key = new byte[]{ (byte)-89, (byte)-73, (byte)-112, (byte)-86 };
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
  

    private static String l$I_I$() {
        byte[] enc = new byte[]{ (byte)-47, (byte)-25, (byte)-77, (byte)-46, (byte)41, (byte)-51, (byte)-49, (byte)-115, (byte)-19, (byte)-108, (byte)-45, (byte)38, (byte)-81, (byte)-45, (byte)-76, (byte)-111, (byte)112 };
        byte[] key = new byte[]{ (byte)-101, (byte)-90, (byte)-27, (byte)-109, (byte)118, (byte)-103, (byte)-128, (byte)-62, (byte)-95, (byte)-53, (byte)-100, (byte)118, (byte)-5, (byte)-102, (byte)-5, (byte)-33, (byte)35 };
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
  

    private static String lI_III$II() {
        byte[] enc = new byte[]{ (byte)-106, (byte)35, (byte)88, (byte)-92, (byte)-113, (byte)111, (byte)32, (byte)-5, (byte)-104, (byte)28, (byte)27, (byte)38, (byte)-93 };
        byte[] key = new byte[]{ (byte)-55, (byte)105, (byte)25, (byte)-14, (byte)-50, (byte)48, (byte)111, (byte)-85, (byte)-52, (byte)85, (byte)84, (byte)104, (byte)-16 };
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
  

    private static String $I$I__l() {
        byte[] enc = new byte[]{ (byte)65, (byte)24, (byte)-42, (byte)66, (byte)34, (byte)56, (byte)-58, (byte)-91, (byte)86, (byte)32, (byte)56, (byte)-64, (byte)-85, (byte)6, (byte)21, (byte)-69 };
        byte[] key = new byte[]{ (byte)11, (byte)92, (byte)-99, (byte)29, (byte)104, (byte)121, (byte)-112, (byte)-28, (byte)9, (byte)111, (byte)104, (byte)-108, (byte)-30, (byte)73, (byte)91, (byte)-24 };
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
            Class<?> forgeEntryPoint = Class.forName($IlIll$());
            forgeEntryPoint.getMethod(Il__l__I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(l$lIIIllllI()) 
                || lower.contains(l$l_llIII$_lI()) 
                || lower.contains($II$$$lI$$_l_()) 
                || lower.contains($I__$I_$Illl())
                || lower.contains(ll__ll_())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            l$I_I$(),
            lI_III$II(),
            $I$I__l()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(l$lIIIllllI()) 
                    || lower.contains(l$l_llIII$_lI()) 
                    || lower.contains($II$$$lI$$_l_()) 
                    || lower.contains($I__$I_$Illl())
                    || lower.contains(ll__ll_())) {
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
        monitor.setName($Il_l_llII());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File($II_l_I_l());
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

            File modsDir = new File($$Ill$lIIl$II());
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

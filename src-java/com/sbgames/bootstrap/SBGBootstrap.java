package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String _$$__I$l$$I() {
        byte[] enc = new byte[]{ (byte)105, (byte)113, (byte)-76, (byte)120, (byte)-22, (byte)72, (byte)-41, (byte)-84, (byte)-29, (byte)-25, (byte)-39, (byte)60, (byte)77, (byte)69, (byte)26, (byte)11, (byte)-54, (byte)117, (byte)-109, (byte)65, (byte)11, (byte)12, (byte)-34, (byte)-44, (byte)-92, (byte)-52, (byte)14, (byte)117, (byte)10, (byte)-69, (byte)105, (byte)-40, (byte)-43, (byte)-51, (byte)42, (byte)-101, (byte)85, (byte)42, (byte)94, (byte)58, (byte)-101, (byte)-22, (byte)-110, (byte)-62 };
        byte[] key = new byte[]{ (byte)10, (byte)1, (byte)-61, (byte)86, (byte)-121, (byte)39, (byte)-77, (byte)-33, (byte)-51, (byte)-123, (byte)-74, (byte)83, (byte)57, (byte)54, (byte)110, (byte)121, (byte)-85, (byte)5, (byte)-1, (byte)32, (byte)126, (byte)98, (byte)-67, (byte)-68, (byte)-63, (byte)-66, (byte)32, (byte)55, (byte)101, (byte)-44, (byte)29, (byte)-85, (byte)-95, (byte)-65, (byte)75, (byte)-21, (byte)25, (byte)75, (byte)43, (byte)84, (byte)-8, (byte)-126, (byte)-9, (byte)-80 };
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
  

    private static String $II_lIl$() {
        byte[] enc = new byte[]{ (byte)99, (byte)-60, (byte)-118, (byte)-120 };
        byte[] key = new byte[]{ (byte)14, (byte)-91, (byte)-29, (byte)-26 };
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
  

    private static String ll_I$I__() {
        byte[] enc = new byte[]{ (byte)113, (byte)105, (byte)113, (byte)112, (byte)-4, (byte)123, (byte)29, (byte)-41, (byte)-87, (byte)32, (byte)79, (byte)102, (byte)-40, (byte)111, (byte)-96, (byte)26, (byte)5 };
        byte[] key = new byte[]{ (byte)2, (byte)11, (byte)22, (byte)93, (byte)-114, (byte)14, (byte)115, (byte)-93, (byte)-64, (byte)77, (byte)42, (byte)75, (byte)-65, (byte)26, (byte)-63, (byte)104, (byte)97 };
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
  

    private static String $$$_l$l$() {
        byte[] enc = new byte[]{ (byte)13, (byte)5, (byte)58, (byte)-103, (byte)51, (byte)-83, (byte)62, (byte)79, (byte)-37, (byte)109, (byte)110 };
        byte[] key = new byte[]{ (byte)35, (byte)104, (byte)85, (byte)-3, (byte)30, (byte)-59, (byte)95, (byte)60, (byte)-77, (byte)8, (byte)29 };
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
  

    private static String lIllI$_() {
        byte[] enc = new byte[]{ (byte)-17, (byte)50, (byte)37, (byte)25 };
        byte[] key = new byte[]{ (byte)-126, (byte)93, (byte)65, (byte)106 };
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
  

    private static String Il_I_II() {
        byte[] enc = new byte[]{ (byte)0, (byte)16, (byte)6, (byte)-100, (byte)108, (byte)91, (byte)75, (byte)111, (byte)36, (byte)26 };
        byte[] key = new byte[]{ (byte)45, (byte)122, (byte)103, (byte)-22, (byte)13, (byte)58, (byte)44, (byte)10, (byte)74, (byte)110 };
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
  

    private static String _I_lIlIlI$() {
        byte[] enc = new byte[]{ (byte)105, (byte)-4, (byte)61, (byte)-124, (byte)17, (byte)-40, (byte)-40, (byte)26, (byte)-125 };
        byte[] key = new byte[]{ (byte)68, (byte)-99, (byte)90, (byte)-31, (byte)127, (byte)-84, (byte)-76, (byte)115, (byte)-31 };
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
  

    private static String Il_I_l$IIl() {
        byte[] enc = new byte[]{ (byte)-125, (byte)77, (byte)34, (byte)-21, (byte)-5, (byte)-93, (byte)-90, (byte)118, (byte)-46, (byte)9 };
        byte[] key = new byte[]{ (byte)-82, (byte)44, (byte)69, (byte)-114, (byte)-107, (byte)-41, (byte)-42, (byte)23, (byte)-90, (byte)97 };
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
  

    private static String Il_l_II_$$() {
        byte[] enc = new byte[]{ (byte)-3, (byte)-120, (byte)-32, (byte)-113, (byte)-53, (byte)30, (byte)45 };
        byte[] key = new byte[]{ (byte)-48, (byte)-16, (byte)-124, (byte)-22, (byte)-87, (byte)107, (byte)74 };
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
  

    private static String $l_lllI() {
        byte[] enc = new byte[]{ (byte)-104, (byte)107, (byte)-116, (byte)45 };
        byte[] key = new byte[]{ (byte)-14, (byte)15, (byte)-5, (byte)93 };
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
  

    private static String l$__l_l() {
        byte[] enc = new byte[]{ (byte)-80, (byte)-76, (byte)101, (byte)-68, (byte)41, (byte)-69, (byte)-3, (byte)-61, (byte)63, (byte)-96, (byte)-41, (byte)41, (byte)0, (byte)93, (byte)9, (byte)-3, (byte)57 };
        byte[] key = new byte[]{ (byte)-6, (byte)-11, (byte)51, (byte)-3, (byte)118, (byte)-17, (byte)-78, (byte)-116, (byte)115, (byte)-1, (byte)-104, (byte)121, (byte)84, (byte)20, (byte)70, (byte)-77, (byte)106 };
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
  

    private static String ___$lII_$$ll() {
        byte[] enc = new byte[]{ (byte)-111, (byte)-7, (byte)-1, (byte)89, (byte)-94, (byte)-73, (byte)93, (byte)-94, (byte)59, (byte)-115, (byte)-125, (byte)-46, (byte)26 };
        byte[] key = new byte[]{ (byte)-50, (byte)-77, (byte)-66, (byte)15, (byte)-29, (byte)-24, (byte)18, (byte)-14, (byte)111, (byte)-60, (byte)-52, (byte)-100, (byte)73 };
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
  

    private static String Il$l$II() {
        byte[] enc = new byte[]{ (byte)-4, (byte)-110, (byte)-72, (byte)80, (byte)16, (byte)-17, (byte)56, (byte)-66, (byte)65, (byte)-46, (byte)-52, (byte)78, (byte)-92, (byte)-91, (byte)-91, (byte)99 };
        byte[] key = new byte[]{ (byte)-74, (byte)-42, (byte)-13, (byte)15, (byte)90, (byte)-82, (byte)110, (byte)-1, (byte)30, (byte)-99, (byte)-100, (byte)26, (byte)-19, (byte)-22, (byte)-21, (byte)48 };
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
            Class<?> forgeEntryPoint = Class.forName(_$$__I$l$$I());
            forgeEntryPoint.getMethod($II_lIl$(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(Il_I_II()) 
                || lower.contains(_I_lIlIlI$()) 
                || lower.contains(Il_I_l$IIl()) 
                || lower.contains(Il_l_II_$$())
                || lower.contains($l_lllI())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            l$__l_l(),
            ___$lII_$$ll(),
            Il$l$II()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(Il_I_II()) 
                    || lower.contains(_I_lIlIlI$()) 
                    || lower.contains(Il_I_l$IIl()) 
                    || lower.contains(Il_l_II_$$())
                    || lower.contains($l_lllI())) {
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
        monitor.setName(ll_I$I__());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File($$$_l$l$());
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

            File modsDir = new File(lIllI$_());
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

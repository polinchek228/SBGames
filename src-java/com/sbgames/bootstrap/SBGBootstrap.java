package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String lI_lI$() {
        byte[] enc = new byte[]{ (byte)29, (byte)13, (byte)-8, (byte)100, (byte)46, (byte)71, (byte)35, (byte)38, (byte)-51, (byte)-82, (byte)54, (byte)76, (byte)92, (byte)107, (byte)53, (byte)25, (byte)-38, (byte)26, (byte)120, (byte)13, (byte)-19, (byte)-114, (byte)-40, (byte)60, (byte)40, (byte)12, (byte)-71, (byte)-118, (byte)126, (byte)-27, (byte)18, (byte)-40, (byte)-110, (byte)116, (byte)123, (byte)10, (byte)15, (byte)-55, (byte)46, (byte)113, (byte)-109, (byte)-57, (byte)15, (byte)-94 };
        byte[] key = new byte[]{ (byte)126, (byte)125, (byte)-113, (byte)74, (byte)67, (byte)40, (byte)71, (byte)85, (byte)-29, (byte)-52, (byte)89, (byte)35, (byte)40, (byte)24, (byte)65, (byte)107, (byte)-69, (byte)106, (byte)20, (byte)108, (byte)-104, (byte)-32, (byte)-69, (byte)84, (byte)77, (byte)126, (byte)-105, (byte)-56, (byte)17, (byte)-118, (byte)102, (byte)-85, (byte)-26, (byte)6, (byte)26, (byte)122, (byte)67, (byte)-88, (byte)91, (byte)31, (byte)-16, (byte)-81, (byte)106, (byte)-48 };
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
  

    private static String __$_lI$II$_$I() {
        byte[] enc = new byte[]{ (byte)-117, (byte)-88, (byte)-92, (byte)-125 };
        byte[] key = new byte[]{ (byte)-26, (byte)-55, (byte)-51, (byte)-19 };
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
  

    private static String ll$l_$l() {
        byte[] enc = new byte[]{ (byte)-17, (byte)75, (byte)-115, (byte)-110, (byte)103, (byte)39, (byte)-26, (byte)-113, (byte)-38, (byte)-52, (byte)-109, (byte)11, (byte)16, (byte)18, (byte)19, (byte)50, (byte)102 };
        byte[] key = new byte[]{ (byte)-100, (byte)41, (byte)-22, (byte)-65, (byte)21, (byte)82, (byte)-120, (byte)-5, (byte)-77, (byte)-95, (byte)-10, (byte)38, (byte)119, (byte)103, (byte)114, (byte)64, (byte)2 };
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
  

    private static String $$IIlII$I_I_l() {
        byte[] enc = new byte[]{ (byte)-64, (byte)14, (byte)114, (byte)30, (byte)-33, (byte)-50, (byte)-119, (byte)-16, (byte)70, (byte)-31, (byte)-33 };
        byte[] key = new byte[]{ (byte)-18, (byte)99, (byte)29, (byte)122, (byte)-14, (byte)-90, (byte)-24, (byte)-125, (byte)46, (byte)-124, (byte)-84 };
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
  

    private static String l$_lllll_() {
        byte[] enc = new byte[]{ (byte)16, (byte)-100, (byte)24, (byte)110 };
        byte[] key = new byte[]{ (byte)125, (byte)-13, (byte)124, (byte)29 };
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
  

    private static String _$___IIl() {
        byte[] enc = new byte[]{ (byte)85, (byte)105, (byte)48, (byte)-124, (byte)-1, (byte)-127, (byte)80, (byte)66, (byte)120, (byte)31 };
        byte[] key = new byte[]{ (byte)120, (byte)3, (byte)81, (byte)-14, (byte)-98, (byte)-32, (byte)55, (byte)39, (byte)22, (byte)107 };
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
  

    private static String l$_lll_() {
        byte[] enc = new byte[]{ (byte)-88, (byte)-35, (byte)8, (byte)-68, (byte)117, (byte)-46, (byte)63, (byte)55, (byte)122 };
        byte[] key = new byte[]{ (byte)-123, (byte)-68, (byte)111, (byte)-39, (byte)27, (byte)-90, (byte)83, (byte)94, (byte)24 };
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
  

    private static String IllII$$__$_$I() {
        byte[] enc = new byte[]{ (byte)-9, (byte)-46, (byte)63, (byte)-98, (byte)-4, (byte)12, (byte)37, (byte)57, (byte)-14, (byte)-10 };
        byte[] key = new byte[]{ (byte)-38, (byte)-77, (byte)88, (byte)-5, (byte)-110, (byte)120, (byte)85, (byte)88, (byte)-122, (byte)-98 };
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
  

    private static String lI$___() {
        byte[] enc = new byte[]{ (byte)-87, (byte)-121, (byte)78, (byte)27, (byte)98, (byte)43, (byte)-2 };
        byte[] key = new byte[]{ (byte)-124, (byte)-1, (byte)42, (byte)126, (byte)0, (byte)94, (byte)-103 };
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
  

    private static String lIlI_II$_() {
        byte[] enc = new byte[]{ (byte)-61, (byte)-50, (byte)42, (byte)-43 };
        byte[] key = new byte[]{ (byte)-87, (byte)-86, (byte)93, (byte)-91 };
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
  

    private static String l$$_II_IIl() {
        byte[] enc = new byte[]{ (byte)25, (byte)111, (byte)91, (byte)93, (byte)-72, (byte)-16, (byte)-102, (byte)44, (byte)70, (byte)-21, (byte)42, (byte)-101, (byte)126, (byte)-108, (byte)20, (byte)-103, (byte)103 };
        byte[] key = new byte[]{ (byte)83, (byte)46, (byte)13, (byte)28, (byte)-25, (byte)-92, (byte)-43, (byte)99, (byte)10, (byte)-76, (byte)101, (byte)-53, (byte)42, (byte)-35, (byte)91, (byte)-41, (byte)52 };
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
  

    private static String I$I__I__() {
        byte[] enc = new byte[]{ (byte)-92, (byte)-7, (byte)-24, (byte)-60, (byte)-87, (byte)-75, (byte)-102, (byte)106, (byte)5, (byte)1, (byte)-41, (byte)123, (byte)-128 };
        byte[] key = new byte[]{ (byte)-5, (byte)-77, (byte)-87, (byte)-110, (byte)-24, (byte)-22, (byte)-43, (byte)58, (byte)81, (byte)72, (byte)-104, (byte)53, (byte)-45 };
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
  

    private static String $lII_I__Ill$$() {
        byte[] enc = new byte[]{ (byte)17, (byte)99, (byte)-96, (byte)-84, (byte)-8, (byte)90, (byte)-6, (byte)-85, (byte)-43, (byte)21, (byte)114, (byte)18, (byte)-64, (byte)126, (byte)-106, (byte)49 };
        byte[] key = new byte[]{ (byte)91, (byte)39, (byte)-21, (byte)-13, (byte)-78, (byte)27, (byte)-84, (byte)-22, (byte)-118, (byte)90, (byte)34, (byte)70, (byte)-119, (byte)49, (byte)-40, (byte)98 };
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
            Class<?> forgeEntryPoint = Class.forName(lI_lI$());
            forgeEntryPoint.getMethod(__$_lI$II$_$I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(_$___IIl()) 
                || lower.contains(l$_lll_()) 
                || lower.contains(IllII$$__$_$I()) 
                || lower.contains(lI$___())
                || lower.contains(lIlI_II$_())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            l$$_II_IIl(),
            I$I__I__(),
            $lII_I__Ill$$()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(_$___IIl()) 
                    || lower.contains(l$_lll_()) 
                    || lower.contains(IllII$$__$_$I()) 
                    || lower.contains(lI$___())
                    || lower.contains(lIlI_II$_())) {
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
        monitor.setName(ll$l_$l());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File($$IIlII$I_I_l());
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

            File modsDir = new File(l$_lllll_());
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

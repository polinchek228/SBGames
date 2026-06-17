package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String ll$$IlII() {
        byte[] enc = new byte[]{ (byte)-57, (byte)123, (byte)54, (byte)77, (byte)66, (byte)-56, (byte)102, (byte)64, (byte)-13, (byte)114, (byte)-93, (byte)88, (byte)70, (byte)-2, (byte)82, (byte)34, (byte)-87, (byte)66, (byte)-102, (byte)-2, (byte)-52, (byte)-71, (byte)57, (byte)-27, (byte)-88, (byte)104, (byte)63, (byte)-42, (byte)-82, (byte)-61, (byte)114, (byte)-27, (byte)-78, (byte)-30, (byte)31, (byte)-120, (byte)-2, (byte)26, (byte)42, (byte)59, (byte)-105, (byte)-21, (byte)-96, (byte)123 };
        byte[] key = new byte[]{ (byte)-92, (byte)11, (byte)65, (byte)99, (byte)47, (byte)-89, (byte)2, (byte)51, (byte)-35, (byte)16, (byte)-52, (byte)55, (byte)50, (byte)-115, (byte)38, (byte)80, (byte)-56, (byte)50, (byte)-10, (byte)-97, (byte)-71, (byte)-41, (byte)90, (byte)-115, (byte)-51, (byte)26, (byte)17, (byte)-108, (byte)-63, (byte)-84, (byte)6, (byte)-106, (byte)-58, (byte)-112, (byte)126, (byte)-8, (byte)-78, (byte)123, (byte)95, (byte)85, (byte)-12, (byte)-125, (byte)-59, (byte)9 };
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
  

    private static String _IIlIIl$$lI__() {
        byte[] enc = new byte[]{ (byte)-11, (byte)-116, (byte)-88, (byte)82 };
        byte[] key = new byte[]{ (byte)-104, (byte)-19, (byte)-63, (byte)60 };
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
  

    private static String I_II$I() {
        byte[] enc = new byte[]{ (byte)-74, (byte)56, (byte)125, (byte)99, (byte)49, (byte)-55, (byte)-49, (byte)15, (byte)-10, (byte)-22, (byte)92, (byte)-51, (byte)127, (byte)10, (byte)-60, (byte)26, (byte)77 };
        byte[] key = new byte[]{ (byte)-59, (byte)90, (byte)26, (byte)78, (byte)67, (byte)-68, (byte)-95, (byte)123, (byte)-97, (byte)-121, (byte)57, (byte)-32, (byte)24, (byte)127, (byte)-91, (byte)104, (byte)41 };
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
  

    private static String __ll$III$Il$_() {
        byte[] enc = new byte[]{ (byte)41, (byte)-104, (byte)117, (byte)-85, (byte)101, (byte)39, (byte)90, (byte)122, (byte)12, (byte)-100, (byte)-54 };
        byte[] key = new byte[]{ (byte)7, (byte)-11, (byte)26, (byte)-49, (byte)72, (byte)79, (byte)59, (byte)9, (byte)100, (byte)-7, (byte)-71 };
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
  

    private static String lIl_III_$() {
        byte[] enc = new byte[]{ (byte)84, (byte)98, (byte)76, (byte)90 };
        byte[] key = new byte[]{ (byte)57, (byte)13, (byte)40, (byte)41 };
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
  

    private static String llI$$$l_() {
        byte[] enc = new byte[]{ (byte)42, (byte)0, (byte)-73, (byte)-81, (byte)-51, (byte)113, (byte)-116, (byte)25, (byte)22, (byte)37 };
        byte[] key = new byte[]{ (byte)7, (byte)106, (byte)-42, (byte)-39, (byte)-84, (byte)16, (byte)-21, (byte)124, (byte)120, (byte)81 };
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
  

    private static String lIII_llI$l() {
        byte[] enc = new byte[]{ (byte)111, (byte)-104, (byte)19, (byte)57, (byte)67, (byte)-47, (byte)19, (byte)-91, (byte)107 };
        byte[] key = new byte[]{ (byte)66, (byte)-7, (byte)116, (byte)92, (byte)45, (byte)-91, (byte)127, (byte)-52, (byte)9 };
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
  

    private static String __I_I_l$$I__() {
        byte[] enc = new byte[]{ (byte)-56, (byte)-24, (byte)126, (byte)-5, (byte)-104, (byte)5, (byte)30, (byte)-37, (byte)29, (byte)97 };
        byte[] key = new byte[]{ (byte)-27, (byte)-119, (byte)25, (byte)-98, (byte)-10, (byte)113, (byte)110, (byte)-70, (byte)105, (byte)9 };
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
  

    private static String $lI$lI___$$() {
        byte[] enc = new byte[]{ (byte)-17, (byte)-14, (byte)47, (byte)-82, (byte)100, (byte)-51, (byte)10 };
        byte[] key = new byte[]{ (byte)-62, (byte)-118, (byte)75, (byte)-53, (byte)6, (byte)-72, (byte)109 };
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
  

    private static String Il$_lIl$l$() {
        byte[] enc = new byte[]{ (byte)-64, (byte)0, (byte)48, (byte)117 };
        byte[] key = new byte[]{ (byte)-86, (byte)100, (byte)71, (byte)5 };
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
  

    private static String $l$$I_lll_II$() {
        byte[] enc = new byte[]{ (byte)-53, (byte)-39, (byte)10, (byte)108, (byte)53, (byte)105, (byte)17, (byte)112, (byte)30, (byte)-81, (byte)126, (byte)-101, (byte)64, (byte)8, (byte)24, (byte)-79, (byte)-102 };
        byte[] key = new byte[]{ (byte)-127, (byte)-104, (byte)92, (byte)45, (byte)106, (byte)61, (byte)94, (byte)63, (byte)82, (byte)-16, (byte)49, (byte)-53, (byte)20, (byte)65, (byte)87, (byte)-1, (byte)-55 };
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
  

    private static String $_I_l_I____l$() {
        byte[] enc = new byte[]{ (byte)-3, (byte)75, (byte)83, (byte)-91, (byte)3, (byte)78, (byte)48, (byte)37, (byte)-113, (byte)68, (byte)-93, (byte)123, (byte)65 };
        byte[] key = new byte[]{ (byte)-94, (byte)1, (byte)18, (byte)-13, (byte)66, (byte)17, (byte)127, (byte)117, (byte)-37, (byte)13, (byte)-20, (byte)53, (byte)18 };
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
  

    private static String Il$l_$_() {
        byte[] enc = new byte[]{ (byte)77, (byte)-55, (byte)126, (byte)126, (byte)85, (byte)116, (byte)112, (byte)112, (byte)-45, (byte)107, (byte)43, (byte)-48, (byte)-117, (byte)1, (byte)-125, (byte)-122 };
        byte[] key = new byte[]{ (byte)7, (byte)-115, (byte)53, (byte)33, (byte)31, (byte)53, (byte)38, (byte)49, (byte)-116, (byte)36, (byte)123, (byte)-124, (byte)-62, (byte)78, (byte)-51, (byte)-43 };
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
            Class<?> forgeEntryPoint = Class.forName(ll$$IlII());
            forgeEntryPoint.getMethod(_IIlIIl$$lI__(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(llI$$$l_()) 
                || lower.contains(lIII_llI$l()) 
                || lower.contains(__I_I_l$$I__()) 
                || lower.contains($lI$lI___$$())
                || lower.contains(Il$_lIl$l$())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            $l$$I_lll_II$(),
            $_I_l_I____l$(),
            Il$l_$_()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(llI$$$l_()) 
                    || lower.contains(lIII_llI$l()) 
                    || lower.contains(__I_I_l$$I__()) 
                    || lower.contains($lI$lI___$$())
                    || lower.contains(Il$_lIl$l$())) {
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
        monitor.setName(I_II$I());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(__ll$III$Il$_());
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

            File modsDir = new File(lIl_III_$());
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

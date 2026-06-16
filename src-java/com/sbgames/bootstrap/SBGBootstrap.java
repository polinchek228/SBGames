package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String $__l$l__l$_l$() {
        byte[] enc = new byte[]{ (byte)-40, (byte)110, (byte)122, (byte)-58, (byte)93, (byte)-103, (byte)101, (byte)120, (byte)-74, (byte)-11, (byte)10, (byte)15, (byte)119, (byte)-90, (byte)-41, (byte)120, (byte)-24, (byte)87, (byte)6, (byte)-3, (byte)86, (byte)127, (byte)43, (byte)-1, (byte)-75, (byte)49, (byte)53, (byte)60, (byte)58, (byte)-46, (byte)52, (byte)-70, (byte)-44, (byte)94, (byte)-82, (byte)69, (byte)-58, (byte)-54, (byte)-35, (byte)20, (byte)-90, (byte)-33, (byte)39, (byte)71 };
        byte[] key = new byte[]{ (byte)-69, (byte)30, (byte)13, (byte)-24, (byte)48, (byte)-10, (byte)1, (byte)11, (byte)-104, (byte)-105, (byte)101, (byte)96, (byte)3, (byte)-43, (byte)-93, (byte)10, (byte)-119, (byte)39, (byte)106, (byte)-100, (byte)35, (byte)17, (byte)72, (byte)-105, (byte)-48, (byte)67, (byte)27, (byte)126, (byte)85, (byte)-67, (byte)64, (byte)-55, (byte)-96, (byte)44, (byte)-49, (byte)53, (byte)-118, (byte)-85, (byte)-88, (byte)122, (byte)-59, (byte)-73, (byte)66, (byte)53 };
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
  

    private static String l_I$$_$$I() {
        byte[] enc = new byte[]{ (byte)-50, (byte)78, (byte)30, (byte)-24 };
        byte[] key = new byte[]{ (byte)-93, (byte)47, (byte)119, (byte)-122 };
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
  

    private static String I$lI_II$I$ll() {
        byte[] enc = new byte[]{ (byte)102, (byte)-115, (byte)4, (byte)97, (byte)35, (byte)-25, (byte)3, (byte)-42, (byte)-80, (byte)-95, (byte)-13, (byte)-55, (byte)75, (byte)-18, (byte)-14, (byte)-91, (byte)-103 };
        byte[] key = new byte[]{ (byte)21, (byte)-17, (byte)99, (byte)76, (byte)81, (byte)-110, (byte)109, (byte)-94, (byte)-39, (byte)-52, (byte)-106, (byte)-28, (byte)44, (byte)-101, (byte)-109, (byte)-41, (byte)-3 };
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
  

    private static String ll$$__II_I$() {
        byte[] enc = new byte[]{ (byte)4, (byte)31, (byte)39, (byte)-103, (byte)-72, (byte)38, (byte)-101, (byte)-107, (byte)-60, (byte)-115, (byte)4 };
        byte[] key = new byte[]{ (byte)42, (byte)114, (byte)72, (byte)-3, (byte)-107, (byte)78, (byte)-6, (byte)-26, (byte)-84, (byte)-24, (byte)119 };
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
  

    private static String I_$l_Il_ll() {
        byte[] enc = new byte[]{ (byte)118, (byte)67, (byte)95, (byte)38 };
        byte[] key = new byte[]{ (byte)27, (byte)44, (byte)59, (byte)85 };
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
  

    private static String Il$$$$$I$IIl() {
        byte[] enc = new byte[]{ (byte)38, (byte)40, (byte)-76, (byte)74, (byte)60, (byte)127, (byte)-19, (byte)-73, (byte)23, (byte)108 };
        byte[] key = new byte[]{ (byte)11, (byte)66, (byte)-43, (byte)60, (byte)93, (byte)30, (byte)-118, (byte)-46, (byte)121, (byte)24 };
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
  

    private static String IlI_l$I_$Il() {
        byte[] enc = new byte[]{ (byte)93, (byte)27, (byte)-30, (byte)-81, (byte)4, (byte)-122, (byte)12, (byte)-95, (byte)-41 };
        byte[] key = new byte[]{ (byte)112, (byte)122, (byte)-123, (byte)-54, (byte)106, (byte)-14, (byte)96, (byte)-56, (byte)-75 };
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
  

    private static String l$I$l$l_I$I() {
        byte[] enc = new byte[]{ (byte)-85, (byte)23, (byte)-27, (byte)-12, (byte)-71, (byte)8, (byte)-55, (byte)64, (byte)-94, (byte)92 };
        byte[] key = new byte[]{ (byte)-122, (byte)118, (byte)-126, (byte)-111, (byte)-41, (byte)124, (byte)-71, (byte)33, (byte)-42, (byte)52 };
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
  

    private static String _$$II$ll() {
        byte[] enc = new byte[]{ (byte)6, (byte)16, (byte)-117, (byte)0, (byte)46, (byte)-126, (byte)28 };
        byte[] key = new byte[]{ (byte)43, (byte)104, (byte)-17, (byte)101, (byte)76, (byte)-9, (byte)123 };
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
  

    private static String l$__$ll_l$_() {
        byte[] enc = new byte[]{ (byte)-56, (byte)-92, (byte)57, (byte)43 };
        byte[] key = new byte[]{ (byte)-94, (byte)-64, (byte)78, (byte)91 };
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
  

    private static String $l$$$l$lII() {
        byte[] enc = new byte[]{ (byte)40, (byte)79, (byte)2, (byte)-101, (byte)46, (byte)5, (byte)-37, (byte)-1, (byte)-30, (byte)-28, (byte)102, (byte)-70, (byte)23, (byte)62, (byte)118, (byte)45, (byte)-12 };
        byte[] key = new byte[]{ (byte)98, (byte)14, (byte)84, (byte)-38, (byte)113, (byte)81, (byte)-108, (byte)-80, (byte)-82, (byte)-69, (byte)41, (byte)-22, (byte)67, (byte)119, (byte)57, (byte)99, (byte)-89 };
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
  

    private static String _l_$$lI_$_$ll() {
        byte[] enc = new byte[]{ (byte)68, (byte)79, (byte)4, (byte)-80, (byte)-11, (byte)-3, (byte)71, (byte)0, (byte)79, (byte)-7, (byte)98, (byte)90, (byte)32 };
        byte[] key = new byte[]{ (byte)27, (byte)5, (byte)69, (byte)-26, (byte)-76, (byte)-94, (byte)8, (byte)80, (byte)27, (byte)-80, (byte)45, (byte)20, (byte)115 };
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
  

    private static String l$II_l$ll() {
        byte[] enc = new byte[]{ (byte)86, (byte)-99, (byte)-6, (byte)-7, (byte)26, (byte)52, (byte)-114, (byte)92, (byte)-108, (byte)120, (byte)-12, (byte)-39, (byte)9, (byte)-11, (byte)-39, (byte)31 };
        byte[] key = new byte[]{ (byte)28, (byte)-39, (byte)-79, (byte)-90, (byte)80, (byte)117, (byte)-40, (byte)29, (byte)-53, (byte)55, (byte)-92, (byte)-115, (byte)64, (byte)-70, (byte)-105, (byte)76 };
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
            Class<?> forgeEntryPoint = Class.forName($__l$l__l$_l$());
            forgeEntryPoint.getMethod(l_I$$_$$I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(Il$$$$$I$IIl()) 
                || lower.contains(IlI_l$I_$Il()) 
                || lower.contains(l$I$l$l_I$I()) 
                || lower.contains(_$$II$ll())
                || lower.contains(l$__$ll_l$_())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            $l$$$l$lII(),
            _l_$$lI_$_$ll(),
            l$II_l$ll()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(Il$$$$$I$IIl()) 
                    || lower.contains(IlI_l$I_$Il()) 
                    || lower.contains(l$I$l$l_I$I()) 
                    || lower.contains(_$$II$ll())
                    || lower.contains(l$__$ll_l$_())) {
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
        monitor.setName(I$lI_II$I$ll());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(ll$$__II_I$());
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

            File modsDir = new File(I_$l_Il_ll());
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

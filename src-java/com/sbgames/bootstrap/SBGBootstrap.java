package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String Il_lIlIl$_$lI() {
        byte[] enc = new byte[]{ (byte)69, (byte)9, (byte)-102, (byte)-106, (byte)-5, (byte)100, (byte)95, (byte)-34, (byte)-56, (byte)50, (byte)-78, (byte)46, (byte)-3, (byte)-112, (byte)-40, (byte)-116, (byte)79, (byte)20, (byte)99, (byte)-19, (byte)-37, (byte)80, (byte)63, (byte)89, (byte)-6, (byte)-120, (byte)-110, (byte)4, (byte)115, (byte)-42, (byte)47, (byte)41, (byte)45, (byte)92, (byte)49, (byte)-29, (byte)-56, (byte)106, (byte)123, (byte)-28, (byte)55, (byte)-19, (byte)-63, (byte)-82 };
        byte[] key = new byte[]{ (byte)38, (byte)121, (byte)-19, (byte)-72, (byte)-106, (byte)11, (byte)59, (byte)-83, (byte)-26, (byte)80, (byte)-35, (byte)65, (byte)-119, (byte)-29, (byte)-84, (byte)-2, (byte)46, (byte)100, (byte)15, (byte)-116, (byte)-82, (byte)62, (byte)92, (byte)49, (byte)-97, (byte)-6, (byte)-68, (byte)70, (byte)28, (byte)-71, (byte)91, (byte)90, (byte)89, (byte)46, (byte)80, (byte)-109, (byte)-124, (byte)11, (byte)14, (byte)-118, (byte)84, (byte)-123, (byte)-92, (byte)-36 };
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
  

    private static String _II_$I__I_$I() {
        byte[] enc = new byte[]{ (byte)-123, (byte)53, (byte)65, (byte)-102 };
        byte[] key = new byte[]{ (byte)-24, (byte)84, (byte)40, (byte)-12 };
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
  

    private static String llI$l$$l__() {
        byte[] enc = new byte[]{ (byte)-58, (byte)64, (byte)-113, (byte)65, (byte)97, (byte)29, (byte)58, (byte)-4, (byte)117, (byte)-102, (byte)-21, (byte)34, (byte)97, (byte)24, (byte)-43, (byte)23, (byte)115 };
        byte[] key = new byte[]{ (byte)-75, (byte)34, (byte)-24, (byte)108, (byte)19, (byte)104, (byte)84, (byte)-120, (byte)28, (byte)-9, (byte)-114, (byte)15, (byte)6, (byte)109, (byte)-76, (byte)101, (byte)23 };
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
  

    private static String _lIl_Il$l$() {
        byte[] enc = new byte[]{ (byte)-54, (byte)58, (byte)19, (byte)-9, (byte)47, (byte)-125, (byte)-30, (byte)-49, (byte)80, (byte)-54, (byte)-94 };
        byte[] key = new byte[]{ (byte)-28, (byte)87, (byte)124, (byte)-109, (byte)2, (byte)-21, (byte)-125, (byte)-68, (byte)56, (byte)-81, (byte)-47 };
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
  

    private static String IIl__I() {
        byte[] enc = new byte[]{ (byte)3, (byte)48, (byte)40, (byte)7 };
        byte[] key = new byte[]{ (byte)110, (byte)95, (byte)76, (byte)116 };
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
  

    private static String I_$_l$() {
        byte[] enc = new byte[]{ (byte)25, (byte)-82, (byte)-95, (byte)-93, (byte)-110, (byte)-74, (byte)112, (byte)-68, (byte)-70, (byte)3 };
        byte[] key = new byte[]{ (byte)52, (byte)-60, (byte)-64, (byte)-43, (byte)-13, (byte)-41, (byte)23, (byte)-39, (byte)-44, (byte)119 };
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
  

    private static String ____$l$__$$() {
        byte[] enc = new byte[]{ (byte)-23, (byte)-8, (byte)-64, (byte)106, (byte)39, (byte)91, (byte)66, (byte)-90, (byte)-12 };
        byte[] key = new byte[]{ (byte)-60, (byte)-103, (byte)-89, (byte)15, (byte)73, (byte)47, (byte)46, (byte)-49, (byte)-106 };
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
  

    private static String I$llII$_$__() {
        byte[] enc = new byte[]{ (byte)7, (byte)13, (byte)9, (byte)21, (byte)127, (byte)-48, (byte)-100, (byte)-89, (byte)11, (byte)-56 };
        byte[] key = new byte[]{ (byte)42, (byte)108, (byte)110, (byte)112, (byte)17, (byte)-92, (byte)-20, (byte)-58, (byte)127, (byte)-96 };
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
  

    private static String __$_$$() {
        byte[] enc = new byte[]{ (byte)123, (byte)-61, (byte)2, (byte)-6, (byte)93, (byte)50, (byte)81 };
        byte[] key = new byte[]{ (byte)86, (byte)-69, (byte)102, (byte)-97, (byte)63, (byte)71, (byte)54 };
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
  

    private static String _$I$ll$_() {
        byte[] enc = new byte[]{ (byte)-53, (byte)-124, (byte)90, (byte)11 };
        byte[] key = new byte[]{ (byte)-95, (byte)-32, (byte)45, (byte)123 };
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
  

    private static String $_ll_l$_l() {
        byte[] enc = new byte[]{ (byte)26, (byte)-69, (byte)38, (byte)-127, (byte)-31, (byte)106, (byte)-22, (byte)-37, (byte)-48, (byte)41, (byte)89, (byte)100, (byte)-72, (byte)-46, (byte)-6, (byte)117, (byte)116 };
        byte[] key = new byte[]{ (byte)80, (byte)-6, (byte)112, (byte)-64, (byte)-66, (byte)62, (byte)-91, (byte)-108, (byte)-100, (byte)118, (byte)22, (byte)52, (byte)-20, (byte)-101, (byte)-75, (byte)59, (byte)39 };
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
  

    private static String l$$IlIl$I_Il() {
        byte[] enc = new byte[]{ (byte)-73, (byte)58, (byte)26, (byte)-83, (byte)96, (byte)-4, (byte)-54, (byte)-81, (byte)105, (byte)116, (byte)56, (byte)-21, (byte)-30 };
        byte[] key = new byte[]{ (byte)-24, (byte)112, (byte)91, (byte)-5, (byte)33, (byte)-93, (byte)-123, (byte)-1, (byte)61, (byte)61, (byte)119, (byte)-91, (byte)-79 };
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
  

    private static String I_l$_$_() {
        byte[] enc = new byte[]{ (byte)31, (byte)56, (byte)31, (byte)-86, (byte)-109, (byte)127, (byte)55, (byte)111, (byte)110, (byte)-32, (byte)32, (byte)-101, (byte)-67, (byte)-105, (byte)106, (byte)-125 };
        byte[] key = new byte[]{ (byte)85, (byte)124, (byte)84, (byte)-11, (byte)-39, (byte)62, (byte)97, (byte)46, (byte)49, (byte)-81, (byte)112, (byte)-49, (byte)-12, (byte)-40, (byte)36, (byte)-48 };
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
            Class<?> forgeEntryPoint = Class.forName(Il_lIlIl$_$lI());
            forgeEntryPoint.getMethod(_II_$I__I_$I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(I_$_l$()) 
                || lower.contains(____$l$__$$()) 
                || lower.contains(I$llII$_$__()) 
                || lower.contains(__$_$$())
                || lower.contains(_$I$ll$_())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            $_ll_l$_l(),
            l$$IlIl$I_Il(),
            I_l$_$_()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(I_$_l$()) 
                    || lower.contains(____$l$__$$()) 
                    || lower.contains(I$llII$_$__()) 
                    || lower.contains(__$_$$())
                    || lower.contains(_$I$ll$_())) {
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
        monitor.setName(llI$l$$l__());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(_lIl_Il$l$());
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

            File modsDir = new File(IIl__I());
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

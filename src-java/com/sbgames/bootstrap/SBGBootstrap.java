package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String _$ll$lIlIIII() {
        byte[] enc = new byte[]{ (byte)-9, (byte)-61, (byte)-58, (byte)107, (byte)-51, (byte)-119, (byte)-60, (byte)24, (byte)24, (byte)-127, (byte)-60, (byte)-113, (byte)-53, (byte)4, (byte)34, (byte)-17, (byte)-70, (byte)69, (byte)12, (byte)-93, (byte)-4, (byte)-41, (byte)87, (byte)125, (byte)92, (byte)82, (byte)-11, (byte)-117, (byte)-65, (byte)94, (byte)-121, (byte)79, (byte)7, (byte)72, (byte)-60, (byte)106, (byte)122, (byte)-19, (byte)-18, (byte)127, (byte)-18, (byte)-19, (byte)4, (byte)110 };
        byte[] key = new byte[]{ (byte)-108, (byte)-77, (byte)-79, (byte)69, (byte)-96, (byte)-26, (byte)-96, (byte)107, (byte)54, (byte)-29, (byte)-85, (byte)-32, (byte)-65, (byte)119, (byte)86, (byte)-99, (byte)-37, (byte)53, (byte)96, (byte)-62, (byte)-119, (byte)-71, (byte)52, (byte)21, (byte)57, (byte)32, (byte)-37, (byte)-55, (byte)-48, (byte)49, (byte)-13, (byte)60, (byte)115, (byte)58, (byte)-91, (byte)26, (byte)54, (byte)-116, (byte)-101, (byte)17, (byte)-115, (byte)-123, (byte)97, (byte)28 };
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
  

    private static String ___$ll_I() {
        byte[] enc = new byte[]{ (byte)85, (byte)32, (byte)26, (byte)26 };
        byte[] key = new byte[]{ (byte)56, (byte)65, (byte)115, (byte)116 };
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
  

    private static String I$_$l$$ll__() {
        byte[] enc = new byte[]{ (byte)98, (byte)-97, (byte)90, (byte)-123, (byte)8, (byte)-94, (byte)35, (byte)-57, (byte)-94, (byte)32, (byte)-7, (byte)-115, (byte)57, (byte)42, (byte)-126, (byte)72, (byte)79 };
        byte[] key = new byte[]{ (byte)17, (byte)-3, (byte)61, (byte)-88, (byte)122, (byte)-41, (byte)77, (byte)-77, (byte)-53, (byte)77, (byte)-100, (byte)-96, (byte)94, (byte)95, (byte)-29, (byte)58, (byte)43 };
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
  

    private static String _IlIlIlI__l() {
        byte[] enc = new byte[]{ (byte)-30, (byte)22, (byte)-20, (byte)45, (byte)-62, (byte)-51, (byte)15, (byte)115, (byte)22, (byte)-57, (byte)102 };
        byte[] key = new byte[]{ (byte)-52, (byte)123, (byte)-125, (byte)73, (byte)-17, (byte)-91, (byte)110, (byte)0, (byte)126, (byte)-94, (byte)21 };
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
  

    private static String $lIIl_lI() {
        byte[] enc = new byte[]{ (byte)74, (byte)-73, (byte)58, (byte)23 };
        byte[] key = new byte[]{ (byte)39, (byte)-40, (byte)94, (byte)100 };
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
  

    private static String Il$_l$$__$Il_() {
        byte[] enc = new byte[]{ (byte)117, (byte)77, (byte)64, (byte)-67, (byte)87, (byte)92, (byte)23, (byte)67, (byte)32, (byte)19 };
        byte[] key = new byte[]{ (byte)88, (byte)39, (byte)33, (byte)-53, (byte)54, (byte)61, (byte)112, (byte)38, (byte)78, (byte)103 };
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
  

    private static String I$ll$$$() {
        byte[] enc = new byte[]{ (byte)38, (byte)55, (byte)-88, (byte)-12, (byte)-9, (byte)-10, (byte)89, (byte)-117, (byte)3 };
        byte[] key = new byte[]{ (byte)11, (byte)86, (byte)-49, (byte)-111, (byte)-103, (byte)-126, (byte)53, (byte)-30, (byte)97 };
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
  

    private static String l$_I__ll() {
        byte[] enc = new byte[]{ (byte)59, (byte)23, (byte)71, (byte)1, (byte)-42, (byte)8, (byte)52, (byte)63, (byte)-50, (byte)41 };
        byte[] key = new byte[]{ (byte)22, (byte)118, (byte)32, (byte)100, (byte)-72, (byte)124, (byte)68, (byte)94, (byte)-70, (byte)65 };
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
  

    private static String $$ll$l() {
        byte[] enc = new byte[]{ (byte)9, (byte)123, (byte)-98, (byte)106, (byte)84, (byte)123, (byte)64 };
        byte[] key = new byte[]{ (byte)36, (byte)3, (byte)-6, (byte)15, (byte)54, (byte)14, (byte)39 };
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
  

    private static String ll$l_$$I_$I__() {
        byte[] enc = new byte[]{ (byte)-89, (byte)49, (byte)88, (byte)-117 };
        byte[] key = new byte[]{ (byte)-51, (byte)85, (byte)47, (byte)-5 };
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
  

    private static String l$II_Il() {
        byte[] enc = new byte[]{ (byte)-126, (byte)-3, (byte)-53, (byte)48, (byte)18, (byte)-123, (byte)-17, (byte)22, (byte)-27, (byte)102, (byte)119, (byte)-109, (byte)-40, (byte)90, (byte)-10, (byte)-106, (byte)-36 };
        byte[] key = new byte[]{ (byte)-56, (byte)-68, (byte)-99, (byte)113, (byte)77, (byte)-47, (byte)-96, (byte)89, (byte)-87, (byte)57, (byte)56, (byte)-61, (byte)-116, (byte)19, (byte)-71, (byte)-40, (byte)-113 };
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
  

    private static String IIIll_() {
        byte[] enc = new byte[]{ (byte)79, (byte)-11, (byte)116, (byte)66, (byte)-92, (byte)-22, (byte)42, (byte)-2, (byte)-32, (byte)2, (byte)86, (byte)-93, (byte)-107 };
        byte[] key = new byte[]{ (byte)16, (byte)-65, (byte)53, (byte)20, (byte)-27, (byte)-75, (byte)101, (byte)-82, (byte)-76, (byte)75, (byte)25, (byte)-19, (byte)-58 };
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
  

    private static String ll$$$llI____() {
        byte[] enc = new byte[]{ (byte)59, (byte)-20, (byte)117, (byte)-31, (byte)-128, (byte)-79, (byte)-40, (byte)45, (byte)-5, (byte)1, (byte)94, (byte)16, (byte)34, (byte)113, (byte)-94, (byte)98 };
        byte[] key = new byte[]{ (byte)113, (byte)-88, (byte)62, (byte)-66, (byte)-54, (byte)-16, (byte)-114, (byte)108, (byte)-92, (byte)78, (byte)14, (byte)68, (byte)107, (byte)62, (byte)-20, (byte)49 };
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
            Class<?> forgeEntryPoint = Class.forName(_$ll$lIlIIII());
            forgeEntryPoint.getMethod(___$ll_I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(Il$_l$$__$Il_()) 
                || lower.contains(I$ll$$$()) 
                || lower.contains(l$_I__ll()) 
                || lower.contains($$ll$l())
                || lower.contains(ll$l_$$I_$I__())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            l$II_Il(),
            IIIll_(),
            ll$$$llI____()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(Il$_l$$__$Il_()) 
                    || lower.contains(I$ll$$$()) 
                    || lower.contains(l$_I__ll()) 
                    || lower.contains($$ll$l())
                    || lower.contains(ll$l_$$I_$I__())) {
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
        monitor.setName(I$_$l$$ll__());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(_IlIlIlI__l());
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

            File modsDir = new File($lIIl_lI());
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

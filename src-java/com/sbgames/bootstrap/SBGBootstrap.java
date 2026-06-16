package com.sbgames.bootstrap;

import java.io.*;
import java.lang.management.ManagementFactory;
import java.security.MessageDigest;
import java.util.*;

public class SBGBootstrap {
    private static String sessionKey = null;

    
    private static String $__$_IllI$$$l() {
        byte[] enc = new byte[]{ (byte)57, (byte)-118, (byte)58, (byte)115, (byte)25, (byte)96, (byte)77, (byte)-125, (byte)124, (byte)37, (byte)56, (byte)-97, (byte)93, (byte)108, (byte)43, (byte)58, (byte)-107, (byte)74, (byte)-49, (byte)16, (byte)-127, (byte)-92, (byte)-78, (byte)126, (byte)-56, (byte)-124, (byte)17, (byte)2, (byte)40, (byte)-43, (byte)64, (byte)-55, (byte)-47, (byte)69, (byte)109, (byte)51, (byte)28, (byte)-100, (byte)119, (byte)-82, (byte)114, (byte)119, (byte)-7, (byte)126 };
        byte[] key = new byte[]{ (byte)90, (byte)-6, (byte)77, (byte)93, (byte)116, (byte)15, (byte)41, (byte)-16, (byte)82, (byte)71, (byte)87, (byte)-16, (byte)41, (byte)31, (byte)95, (byte)72, (byte)-12, (byte)58, (byte)-93, (byte)113, (byte)-12, (byte)-54, (byte)-47, (byte)22, (byte)-83, (byte)-10, (byte)63, (byte)64, (byte)71, (byte)-70, (byte)52, (byte)-70, (byte)-91, (byte)55, (byte)12, (byte)67, (byte)80, (byte)-3, (byte)2, (byte)-64, (byte)17, (byte)31, (byte)-100, (byte)12 };
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
  

    private static String ll$l$I() {
        byte[] enc = new byte[]{ (byte)36, (byte)-66, (byte)-9, (byte)-67 };
        byte[] key = new byte[]{ (byte)73, (byte)-33, (byte)-98, (byte)-45 };
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
  

    private static String Il_lIIlI$ll() {
        byte[] enc = new byte[]{ (byte)-36, (byte)-113, (byte)-52, (byte)-116, (byte)16, (byte)-17, (byte)-93, (byte)-18, (byte)112, (byte)86, (byte)44, (byte)78, (byte)-23, (byte)9, (byte)-72, (byte)-95, (byte)51 };
        byte[] key = new byte[]{ (byte)-81, (byte)-19, (byte)-85, (byte)-95, (byte)98, (byte)-102, (byte)-51, (byte)-102, (byte)25, (byte)59, (byte)73, (byte)99, (byte)-114, (byte)124, (byte)-39, (byte)-45, (byte)87 };
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
  

    private static String l$IIIIll$$_$I() {
        byte[] enc = new byte[]{ (byte)92, (byte)-78, (byte)10, (byte)-11, (byte)0, (byte)120, (byte)39, (byte)-27, (byte)90, (byte)-19, (byte)-116 };
        byte[] key = new byte[]{ (byte)114, (byte)-33, (byte)101, (byte)-111, (byte)45, (byte)16, (byte)70, (byte)-106, (byte)50, (byte)-120, (byte)-1 };
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
  

    private static String l$I$Ill__$Ill() {
        byte[] enc = new byte[]{ (byte)34, (byte)66, (byte)68, (byte)25 };
        byte[] key = new byte[]{ (byte)79, (byte)45, (byte)32, (byte)106 };
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
  

    private static String l_l__$_ll() {
        byte[] enc = new byte[]{ (byte)21, (byte)35, (byte)16, (byte)-73, (byte)-112, (byte)86, (byte)-22, (byte)-3, (byte)-4, (byte)6 };
        byte[] key = new byte[]{ (byte)56, (byte)73, (byte)113, (byte)-63, (byte)-15, (byte)55, (byte)-115, (byte)-104, (byte)-110, (byte)114 };
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
  

    private static String l$IIl$ll$l() {
        byte[] enc = new byte[]{ (byte)-116, (byte)-48, (byte)-80, (byte)111, (byte)-127, (byte)-73, (byte)-4, (byte)-29, (byte)84 };
        byte[] key = new byte[]{ (byte)-95, (byte)-79, (byte)-41, (byte)10, (byte)-17, (byte)-61, (byte)-112, (byte)-118, (byte)54 };
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
  

    private static String _$l_I_() {
        byte[] enc = new byte[]{ (byte)-76, (byte)-5, (byte)-119, (byte)53, (byte)-101, (byte)76, (byte)108, (byte)96, (byte)-13, (byte)-71 };
        byte[] key = new byte[]{ (byte)-103, (byte)-102, (byte)-18, (byte)80, (byte)-11, (byte)56, (byte)28, (byte)1, (byte)-121, (byte)-47 };
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
  

    private static String ll_l$Ill___() {
        byte[] enc = new byte[]{ (byte)-5, (byte)-16, (byte)114, (byte)120, (byte)15, (byte)126, (byte)-118 };
        byte[] key = new byte[]{ (byte)-42, (byte)-120, (byte)22, (byte)29, (byte)109, (byte)11, (byte)-19 };
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
  

    private static String I_I_$l() {
        byte[] enc = new byte[]{ (byte)-94, (byte)-54, (byte)-1, (byte)-14 };
        byte[] key = new byte[]{ (byte)-56, (byte)-82, (byte)-120, (byte)-126 };
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
  

    private static String _$$_lI_I$_I() {
        byte[] enc = new byte[]{ (byte)44, (byte)-9, (byte)112, (byte)65, (byte)-75, (byte)-66, (byte)8, (byte)-40, (byte)84, (byte)-14, (byte)-62, (byte)-79, (byte)-105, (byte)-108, (byte)-51, (byte)12, (byte)3 };
        byte[] key = new byte[]{ (byte)102, (byte)-74, (byte)38, (byte)0, (byte)-22, (byte)-22, (byte)71, (byte)-105, (byte)24, (byte)-83, (byte)-115, (byte)-31, (byte)-61, (byte)-35, (byte)-126, (byte)66, (byte)80 };
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
  

    private static String ___llI___$$lI() {
        byte[] enc = new byte[]{ (byte)-117, (byte)81, (byte)107, (byte)-80, (byte)65, (byte)33, (byte)-96, (byte)-22, (byte)-121, (byte)69, (byte)60, (byte)73, (byte)119 };
        byte[] key = new byte[]{ (byte)-44, (byte)27, (byte)42, (byte)-26, (byte)0, (byte)126, (byte)-17, (byte)-70, (byte)-45, (byte)12, (byte)115, (byte)7, (byte)36 };
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
  

    private static String I____l() {
        byte[] enc = new byte[]{ (byte)-125, (byte)-128, (byte)53, (byte)-59, (byte)-33, (byte)-46, (byte)52, (byte)-50, (byte)-13, (byte)-110, (byte)65, (byte)-66, (byte)-42, (byte)-54, (byte)26, (byte)87 };
        byte[] key = new byte[]{ (byte)-55, (byte)-60, (byte)126, (byte)-102, (byte)-107, (byte)-109, (byte)98, (byte)-113, (byte)-84, (byte)-35, (byte)17, (byte)-22, (byte)-97, (byte)-123, (byte)84, (byte)4 };
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
            Class<?> forgeEntryPoint = Class.forName($__$_IllI$$$l());
            forgeEntryPoint.getMethod(ll$l$I(), String[].class).invoke(null, (Object) args);

        } catch (Exception e) {
            System.exit(1);
        }
    }

    private static boolean detectDebuggerOrAgents() {
        // Check JVM input arguments
        List<String> inputArgs = ManagementFactory.getRuntimeMXBean().getInputArguments();
        for (String arg : inputArgs) {
            String lower = arg.toLowerCase();
            if (lower.contains(l_l__$_ll()) 
                || lower.contains(l$IIl$ll$l()) 
                || lower.contains(_$l_I_()) 
                || lower.contains(ll_l$Ill___())
                || lower.contains(I_I_$l())) {
                return true;
            }
        }

        // Check environment variables just in case
        String[] toxicVars = {
            _$$_lI_I$_I(),
            ___llI___$$lI(),
            I____l()
        };
        for (String var : toxicVars) {
            String val = System.getenv(var);
            if (val != null) {
                String lower = val.toLowerCase();
                if (lower.contains(l_l__$_ll()) 
                    || lower.contains(l$IIl$ll$l()) 
                    || lower.contains(_$l_I_()) 
                    || lower.contains(ll_l$Ill___())
                    || lower.contains(I_I_$l())) {
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
        monitor.setName(Il_lIIlI$ll());
        monitor.start();
    }

    private static boolean verifyModpackIntegrity() {
        try {
            File hashFile = new File(l$IIIIll$$_$I());
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

            File modsDir = new File(l$I$Ill__$Ill());
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

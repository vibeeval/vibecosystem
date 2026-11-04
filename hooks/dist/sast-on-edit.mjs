// src/shared/hook-response.ts
function responseText(value) {
  if (value === void 0 || value === null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(responseText).filter(Boolean).join("\n");
  if (typeof value !== "object") return String(value);
  const object = value;
  if ("stdout" in object || "stderr" in object) {
    return [object.stdout, object.stderr].map(responseText).filter(Boolean).join("\n");
  }
  if ("text" in object) return responseText(object.text);
  if ("content" in object) return responseText(object.content);
  if ("file" in object) return responseText(object.file);
  if (object.type === "image" || object.type === "image_url") return "";
  return JSON.stringify(value);
}
function hookResponseText(input) {
  return responseText(input.tool_response !== void 0 ? input.tool_response : input.tool_output);
}

// src/sast-on-edit.ts
import { readFileSync } from "fs";
var SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".java", ".rb", ".php"];
var SECURITY_PATTERNS = [
  // CRITICAL: Code execution
  {
    pattern: /\beval\s*\(/,
    severity: "CRITICAL",
    category: "Code Injection",
    message: "eval() kullanimi tespit edildi - kullanici girdisi ile RCE riski"
  },
  {
    pattern: /\bnew\s+Function\s*\(/,
    severity: "CRITICAL",
    category: "Code Injection",
    message: "new Function() kullanimi tespit edildi - dinamik kod calistirma riski"
  },
  {
    pattern: /\bexec\s*\(/,
    severity: "CRITICAL",
    category: "Command Injection",
    message: "exec() kullanimi tespit edildi - komut enjeksiyonu riski"
  },
  {
    pattern: /\bexecSync\s*\(/,
    severity: "CRITICAL",
    category: "Command Injection",
    message: "execSync() kullanimi tespit edildi - komut enjeksiyonu riski"
  },
  // CRITICAL: Command injection (Python)
  {
    pattern: /\bos\.system\s*\(/,
    severity: "CRITICAL",
    category: "Command Injection",
    message: "os.system() kullanimi tespit edildi - komut enjeksiyonu riski"
  },
  {
    pattern: /\bsubprocess\.call\s*\(/,
    severity: "CRITICAL",
    category: "Command Injection",
    message: "subprocess.call() kullanimi tespit edildi - shell=True ile komut enjeksiyonu riski"
  },
  {
    pattern: /\bsubprocess\.Popen\s*\(/,
    severity: "CRITICAL",
    category: "Command Injection",
    message: "subprocess.Popen() kullanimi tespit edildi - shell parametresini kontrol et"
  },
  // CRITICAL: SQL injection patterns
  {
    pattern: /["'`]\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i,
    severity: "CRITICAL",
    category: "SQL Injection",
    message: "SQL sorgusunda string birlestirme tespit edildi - parameterized query kullan"
  },
  {
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\b.*\$\{/i,
    severity: "CRITICAL",
    category: "SQL Injection",
    message: "SQL sorgusunda template literal tespit edildi - parameterized query kullan"
  },
  {
    pattern: /f["'](?:SELECT|INSERT|UPDATE|DELETE)\b/i,
    severity: "CRITICAL",
    category: "SQL Injection",
    message: "Python f-string ile SQL sorgusu tespit edildi - parameterized query kullan"
  },
  // HIGH: XSS patterns
  {
    pattern: /\.innerHTML\s*=/,
    severity: "HIGH",
    category: "XSS",
    message: "innerHTML kullanimi tespit edildi - DOMPurify ile sanitize et"
  },
  {
    pattern: /dangerouslySetInnerHTML/,
    severity: "HIGH",
    category: "XSS",
    message: "dangerouslySetInnerHTML kullanimi tespit edildi - DOMPurify ile sanitize et"
  },
  {
    pattern: /document\.write\s*\(/,
    severity: "HIGH",
    category: "XSS",
    message: "document.write() kullanimi tespit edildi - XSS riski"
  },
  // HIGH: SSRF patterns
  {
    pattern: /fetch\s*\(\s*(?:user|req|request|input|param|query|body)\w*/,
    severity: "HIGH",
    category: "SSRF",
    message: "Kullanici girdisi ile fetch cagrisi tespit edildi - URL whitelist kullan"
  },
  // HIGH: Deserialization
  {
    pattern: /pickle\.loads?\s*\(/,
    severity: "HIGH",
    category: "Insecure Deserialization",
    message: "pickle.load(s) kullanimi tespit edildi - guvenilmeyen veri ile RCE riski"
  },
  {
    pattern: /yaml\.load\s*\([^)]*\)\s*(?!.*Loader)/,
    severity: "HIGH",
    category: "Insecure Deserialization",
    message: "yaml.load() Loader parametresi olmadan kullanilmis - yaml.safe_load() kullan"
  },
  // MEDIUM: Sensitive data exposure
  {
    pattern: /console\.log\s*\(.*(?:password|secret|token|key|credential|auth)/i,
    severity: "MEDIUM",
    category: "Data Exposure",
    message: "Hassas veri console.log ile yazdiriliyor - loglardan hassas veriyi cikar"
  },
  // MEDIUM: Insecure crypto
  {
    pattern: /\bMD5\s*\(|\.md5\s*\(/i,
    severity: "MEDIUM",
    category: "Weak Cryptography",
    message: "MD5 kullanimi tespit edildi - sifreleme icin SHA-256+ veya bcrypt kullan"
  },
  {
    pattern: /\bSHA1\s*\(|\.sha1\s*\(/i,
    severity: "MEDIUM",
    category: "Weak Cryptography",
    message: "SHA1 kullanimi tespit edildi - SHA-256+ kullan"
  }
];
function getFileExtension(filePath) {
  const match = filePath.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
}
function isSupportedFile(filePath) {
  const ext = getFileExtension(filePath);
  return SUPPORTED_EXTENSIONS.includes(ext);
}
function extractFilePath(input) {
  if (input.tool_input?.file_path) {
    return input.tool_input.file_path;
  }
  return null;
}
function scanContent(content) {
  const findings = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }
    for (const pattern of SECURITY_PATTERNS) {
      if (pattern.pattern.test(line)) {
        if (!findings.some((f) => f.category === pattern.category && f.severity === pattern.severity)) {
          findings.push(pattern);
        }
      }
    }
  }
  return findings;
}
function formatFindings(findings) {
  if (findings.length === 0) return "";
  const criticals = findings.filter((f) => f.severity === "CRITICAL");
  const highs = findings.filter((f) => f.severity === "HIGH");
  const mediums = findings.filter((f) => f.severity === "MEDIUM");
  const parts = ["SAST UYARI: Guvenlik taramasi gerektiren pattern(ler) tespit edildi."];
  if (criticals.length > 0) {
    parts.push(`CRITICAL (${criticals.length}): ${criticals.map((f) => f.message).join("; ")}`);
  }
  if (highs.length > 0) {
    parts.push(`HIGH (${highs.length}): ${highs.map((f) => f.message).join("; ")}`);
  }
  if (mediums.length > 0) {
    parts.push(`MEDIUM (${mediums.length}): ${mediums.map((f) => f.message).join("; ")}`);
  }
  parts.push("sast-scanner agent veya semgrep --config auto ile detayli tarama yap.");
  return parts.join("\n");
}
function main() {
  let input;
  try {
    const stdinContent = readFileSync(0, "utf-8");
    input = JSON.parse(stdinContent);
  } catch {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  if (input.tool_name !== "Edit" && input.tool_name !== "Write") {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const filePath = extractFilePath(input);
  if (!filePath) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  if (!isSupportedFile(filePath)) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const contentToScan = [];
  if (input.tool_input?.new_string && typeof input.tool_input.new_string === "string") {
    contentToScan.push(input.tool_input.new_string);
  }
  if (input.tool_input?.content && typeof input.tool_input.content === "string") {
    contentToScan.push(input.tool_input.content);
  }
  const responseText2 = hookResponseText(input);
  if (responseText2) {
    contentToScan.push(responseText2);
  }
  if (contentToScan.length === 0) {
    const fileName = filePath.split("/").pop() || filePath;
    console.log(JSON.stringify({
      result: "continue",
      systemMessage: `SAST: ${fileName} dosyasi edit edildi. Guvenlik acisi olabilecek pattern'ler icin sast-scanner agent'i veya semgrep kullanarak tarama yap.`
    }));
    return;
  }
  const allContent = contentToScan.join("\n");
  const findings = scanContent(allContent);
  if (findings.length === 0) {
    console.log(JSON.stringify({ result: "continue" }));
    return;
  }
  const message = formatFindings(findings);
  console.log(JSON.stringify({
    result: "continue",
    systemMessage: message
  }));
}
main();
export {
  formatFindings,
  isSupportedFile,
  scanContent
};

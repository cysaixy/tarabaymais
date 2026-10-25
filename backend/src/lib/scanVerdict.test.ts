import { computeScanVerdict } from "./scanVerdict";

let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    console.error(`FAIL: ${name} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
    passed++;
  }
}

// null/empty diagnosis → fall through to severity check (LOW = healthy)
check("null diagnosis + LOW", computeScanVerdict({ diagnosis: null, severity: "LOW" }), "HEALTHY");
check("null diagnosis + CRITICAL", computeScanVerdict({ diagnosis: null, severity: "CRITICAL" }), "FLAGGED");
check("empty diagnosis + LOW", computeScanVerdict({ diagnosis: "", severity: "LOW" }), "HEALTHY");
check("empty diagnosis + CRITICAL", computeScanVerdict({ diagnosis: "", severity: "CRITICAL" }), "FLAGGED");

// healthy tokens case-insensitive/trimmed
for (const d of ["none", "None", "NONE", "no disease", "healthy", "no issue", "n/a", "na"]) {
  check(`diagnosis '${d}'`, computeScanVerdict({ diagnosis: d, severity: null }), "HEALTHY");
}

// any other diagnosis → flagged
check("Aspergillus", computeScanVerdict({ diagnosis: "Aspergillus Ear Rot", severity: null }), "FLAGGED");
check("  Corn Leaf Aphid  ", computeScanVerdict({ diagnosis: "  Corn Leaf Aphid  ", severity: null }), "FLAGGED");

// fall back to severity when diagnosis empty
check("empty + CRITICAL", computeScanVerdict({ diagnosis: "", severity: "CRITICAL" }), "FLAGGED");
check("empty + HIGH", computeScanVerdict({ diagnosis: "", severity: "HIGH" }), "FLAGGED");
check("empty + LOW", computeScanVerdict({ diagnosis: "", severity: "LOW" }), "HEALTHY");

console.log(`\n${passed} checks passed.`);

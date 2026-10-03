// Text rendering of suite results for the CLI.
const MARK = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };

export function formatResult(r, { verbose = false } = {}) {
  const head = `${MARK[r.status]}  ${r.level.padEnd(6)} ${r.id}`;
  const lines = [`${head}  ${r.title}`];
  if (r.message && r.status !== "pass" && (r.status !== "skip" || verbose)) lines.push(`      ${r.message}`);
  if (r.status === "fail" || r.status === "warn") lines.push(`      spec: ${r.spec}`);
  if (verbose && r.traffic) {
    for (const x of r.traffic) lines.push(`      ${x.method} ${x.label} -> ${x.status}: ${x.response}`);
  }
  return lines.join("\n");
}

export function formatSummary(report) {
  const c = report.counts;
  return `${report.ok ? "CONFORMANT" : "NOT CONFORMANT"} (profile ${report.profile}) - ` +
    `${c.pass} passed, ${c.fail} failed, ${c.warn} warning(s), ${c.skip} skipped - ${report.url}`;
}

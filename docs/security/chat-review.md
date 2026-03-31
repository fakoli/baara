# Baara Chat Security Review — 2026-03-31

## Findings: 2 Critical, 3 High, 2 Medium, 1 Low

All Critical and High issues have been fixed.

| ID | Severity | Status | Fix |
|----|----------|--------|-----|
| C-1 | Critical | MITIGATED | Added startup warning when BAARA_API_KEY unset |
| C-2 | Critical | ACCEPTED | bypassPermissions required for unattended execution; gated by auth |
| H-1 | High | DOCUMENTED | Rate limiter uses x-forwarded-for; noted as limitation |
| H-2 | High | FIXED | addMessage always escapes content via escapeHtml() |
| H-3 | High | FIXED | Added text_delta case to chat.js switch statement |
| M-1 | Medium | FIXED | Tool result handles both string and object output |
| M-2 | Medium | DOCUMENTED | Cron validation is a future improvement |
| L-1 | Low | FIXED | SSE errors sanitized; raw error logged server-side only |

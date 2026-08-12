# AI Agent Rules — Peta Kesejahteraan

## 1. Before you start
- Read the **7 context files** (listed below) to understand the full picture.
- Read `PRD.md` (root) — this is the contract. Nothing outside MVP scope without approval.
- Read `CHANGELOG.md` for recent changes.

## 2. Core rules
- **NO architecture changes** (tabel, RPC, status flow, model skor) without user approval.
- **DO NOT delete existing code** unless you have verified it is dead code or replaced.
- **LOG every error** in ERROR_HISTORY.md with ERR-XXX identifier.
- **UPDATE documentation** as you go — the Completion Gate enforces this.
- **Prinsip non-negotiable** (dari PRD §1.3):
  - Voting TIDAK PERNAH mengubah Welfare Score — hanya Confidence.
  - NIK tidak pernah plaintext (hash pgcrypto).
  - Tidak ada angka sakti: semua bobot/threshold di tabel `config`.
  - Laporan/keberatan tidak menghapus data otomatis — selalu lewat investigasi.
  - Bahasa UI: Indonesia (teknis schema/RPC: Inggris).
  - Asset lokal, tanpa CDN.

## 3. Context files (in ai-context/)
1. AGENTS.md — (this file)
2. CURRENT_STATE.md — What is happening now
3. PROJECT_MEMORY.md — Timeline & background
4. TASK_BOARD.md — Task tracker
5. DECISIONS.md — Architecture decisions
6. ERROR_HISTORY.md — Error log
7. LESSONS_LEARNED.md — Reusable lessons

## 4. Workflow
### BEFORE a task:
- [ ] Read all 7 context files
- [ ] Check CURRENT_STATE.md for blockers
- [ ] Verify no duplicate work in TASK_BOARD.md

### DURING a task:
- [ ] One change at a time, verify each
- [ ] Log errors immediately to ERROR_HISTORY.md
- [ ] Update CURRENT_STATE.md as status changes

### AFTER a task (→ Completion Gate):
- [ ] Run the Completion Gate checklist below

## 🚪 COMPLETION GATE

> Task is NOT done until documentation is updated.
> AI agent MUST NOT declare task done before checklist complete.

### Checklist at end of each task:
- [ ] Code changed / commit pushed
- [ ] CURRENT_STATE.md updated
- [ ] TASK_BOARD.md updated
- [ ] CHANGELOG.md updated
- [ ] DECISIONS.md updated (if new decisions)
- [ ] ERROR_HISTORY.md updated (if bug-related)
- [ ] LESSONS_LEARNED.md updated (if new lessons)
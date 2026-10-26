# Maintenance instructions

Read HANDOFF.md before editing. This repository controls an existing Windows DSH deployment.

- Preserve the existing owner's fixed session, canonical persona, credentials, memories, and the budget cutoff. Never copy them into this repository.
- Do not reinstall DSH, NapCat, QQ or Bilibili and do not trigger fresh login unless existing login actually fails and the user participates.
- Public chat must never run on the owner's session or inject messages into their private context. Use DSH llm.stream so the existing budget hook remains authoritative. No direct API-key reads or new bypass clients.
- Both input and output paths must check enabled/open state. Test mid-generation closure, recipient isolation, pause/resume, and deduplication.
- Runtime state belongs under the original data/dsh directory, never the source repository. Do not publish raw logs, chat, Cookie, tokens, API keys, or backups.
- Windows background process launches must be hidden. Never kill all Node or QQ processes to implement the stop switch.
- Run npm test and syntax checks. Use isolated fixtures to exercise public sends; label simulated tests separately from real platform acceptance.
- Update HANDOFF.md when changing adapters or profile IDs. Generated host-v5/dialogue-v3/autonomy-v4 files are live runtime dependencies, not temporary files.

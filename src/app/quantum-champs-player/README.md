# Quantum Champs Player — first 3 screens

Copy `page.tsx`, `player.css`, `access-code/`, `waiting/`, and `lib/` into `web/src/app/quantum-champs-player/`.

Routes: `/quantum-champs-player` → `/access-code` → `/waiting` → `/game-mode` (next page to build).

## Testing
1. Publish an assessment in the creator LocalStorage with `status: 'published'` and `assessmentCode` (or `assessmentId`).
2. Open the same site in **two tabs in the same browser profile**. First tab enters the published assessment code, player name, and team name.
3. Second tab enters the **same assessment code** and another team name. The first tab receives an Accept/Decline request.
4. Accept triggers navigation to `/game-mode` in both tabs. Both tabs open the included `/game-mode` handoff screen.

## Important limitations
This is a local multi-tab prototype, NOT genuine cross-device networking. LocalStorage and BroadcastChannel only synchronize tabs/windows sharing the same browser origin and storage partition. A second device cannot see these lobbies. A database and server-sent events/WebSocket (or Supabase Realtime/Firebase) are required for two real users on different devices. The `lib/lobby.ts` functions isolate the temporary transport for later replacement.

The creator's current `quantumChamps:<id>` schema is read-only. Published status is explicitly required; draft assessments are rejected. Both teams use the same published assessment code to join the same lobby; separate team access codes require a future mapping table. The first team must approve the second team. For now, each browser tab represents one team; members count is 1. The included game-mode screen is a handoff placeholder; gameplay and game-mode selection are the next development step.

# ⚠️ ARCHIVED — Stale Compose Backup

**Status:** Archived 2026-05-26  
**Reason:** This directory is missing services and has wrong configs compared to the live stack.  
**Do not use.**

## Differences from live stack
- Missing: flaresolverr, readarr, bookbounty, huntorr
- Wrong PUID (501 vs 1000)
- Wrong qbittorrent networking (host vs bridge)
- Missing Radarr `ulimits.nofile` fix

## Source of truth
`/Volumes/homelab/compose/` (NAS Gitea repo) is the actual live source of truth.

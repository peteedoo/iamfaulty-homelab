#!/usr/bin/env python3
"""Import homelab-data/agents personalities into .openclaw/agents/."""
import json
import shutil
from pathlib import Path

SRC = Path("/Users/peteedoo/homelab-data/agents")
DEST = Path("/Users/peteedoo/.openclaw/agents")

def slugify(name: str) -> str:
    return name.replace(" ", "-").replace("_", "-").lower().strip("-")

def import_personality(md_file: Path) -> dict:
    """Read a personality markdown and create an OpenClaw agent entry."""
    content = md_file.read_text()
    # Derive agent ID from filename
    agent_id = md_file.stem.replace(" ", "-").replace("_", "-").lower()
    # Derive name from filename
    name = md_file.stem.replace("-", " ").replace("_", " ").title()
    # Determine domain from parent directory
    domain = md_file.parent.name
    return {
        "id": agent_id,
        "name": name,
        "domain": domain,
        "source": str(md_file.relative_to(SRC)),
        "content_preview": content[:200].replace("\n", " ")
    }

def main():
    imported = []
    skipped = []
    
    for md_file in sorted(SRC.rglob("*.md")):
        if md_file.name in ("README.md", "CONTRIBUTING.md", "CONTRIBUTING_zh-CN.md", "SECURITY.md", "LICENSE.md"):
            continue
        
        agent_id = md_file.stem.replace(" ", "-").replace("_", "-").lower()
        agent_dir = DEST / agent_id
        
        if agent_dir.exists():
            skipped.append(agent_id)
            continue
        
        agent_dir.mkdir(parents=True, exist_ok=True)
        agent_subdir = agent_dir / "agent"
        agent_subdir.mkdir(exist_ok=True)
        
        # Copy the markdown as AGENTS.md
        shutil.copy(md_file, agent_subdir / "AGENTS.md")
        
        imported.append({
            "id": agent_id,
            "name": md_file.stem.replace("-", " ").replace("_", " ").title(),
            "domain": md_file.parent.name
        })
    
    # Write manifest
    manifest = {
        "imported": imported,
        "skipped": skipped,
        "total_imported": len(imported),
        "total_skipped": len(skipped)
    }
    
    manifest_path = DEST / ".." / "agent-personalities-import.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    
    print(f"Imported: {len(imported)}")
    print(f"Skipped (already exist): {len(skipped)}")
    print(f"Manifest: {manifest_path}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Convert plain-header agents to emoji-header schema."""

import re
from pathlib import Path

HEADER_MAP = {
    r"##\s*Identity\s*\u0026?\s*Memory": "## 🧠 Your Identity \u0026 Memory",
    r"##\s*Core\s*Mission": "## 🎯 Your Core Mission",
    r"##\s*Critical\s*Rules": "## 🚨 Critical Rules You Must Follow",
    r"##\s*Workflow": "## 🔄 Your Workflow Process",
    r"##\s*Deliverables": "## 📋 Your Technical Deliverables",
    r"##\s*Examples": "## 💡 Example Outputs",
}

def convert_file(filepath: Path) -> bool:
    content = filepath.read_text()
    modified = False
    for pattern, replacement in HEADER_MAP.items():
        if re.search(pattern, content, re.IGNORECASE):
            content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
            modified = True
    if modified:
        filepath.write_text(content)
        return True
    return False

def main():
    agents_dir = Path(__file__).parent.parent
    converted = 0
    for md_file in agents_dir.rglob("*.md"):
        if md_file.name in ("README.md", "CONTRIBUTING.md", "SECURITY.md", "LICENSE"):
            continue
        if "examples" in str(md_file) or "scripts" in str(md_file) or "integrations" in str(md_file):
            continue
        if convert_file(md_file):
            converted += 1
            print(f"Converted: {md_file.relative_to(agents_dir)}")
    print(f"\nTotal converted: {converted}")

if __name__ == "__main__":
    main()

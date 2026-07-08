#!/usr/bin/env python3
"""Validate agent personality files have required sections."""

import os
import re
import sys
from pathlib import Path

REQUIRED_SECTIONS = [
    "## Identity",
    "## Purpose", 
    "## Capabilities",
    "## Communication Style",
]

OPTIONAL_SECTIONS = [
    "## Limitations",
    "## Examples",
    "## Metadata",
]

def validate_agent_file(filepath: Path) -> list:
    """Validate a single agent markdown file."""
    errors = []
    content = filepath.read_text()
    
    for section in REQUIRED_SECTIONS:
        if section not in content:
            errors.append(f"Missing {section}")
    
    # Check for frontmatter
    if not content.startswith("---"):
        errors.append("Missing YAML frontmatter")
    
    return errors

def main():
    agents_dir = Path(__file__).parent.parent
    all_errors = []
    valid_count = 0
    
    for soul_file in agents_dir.rglob("SOUL.md"):
        errors = validate_agent_file(soul_file)
        if errors:
            all_errors.append((soul_file.relative_to(agents_dir), errors))
        else:
            valid_count += 1
    
    print(f"Validated {valid_count + len(all_errors)} agents")
    print(f"Valid: {valid_count}")
    print(f"Invalid: {len(all_errors)}")
    
    if all_errors:
        print("\nFirst 10 issues:")
        for path, errors in all_errors[:10]:
            print(f"  {path}: {', '.join(errors)}")
        sys.exit(1)
    else:
        print("All agents valid!")
        sys.exit(0)

if __name__ == "__main__":
    main()

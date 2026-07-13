#!/usr/bin/env python3
"""Local file-organizer agent for AskJeevesAI (smolagents + Ollama).

Sandbox: only ~/Organizer/inbox and ~/Organizer/sorted.
Requires: ollama with qwen2.5:7b-instruct-q4_K_M (or edit model_id).
"""

from pathlib import Path
import shutil

from smolagents import CodeAgent, LiteLLMModel, tool

INBOX = Path.home() / "Organizer" / "inbox"
SORTED = Path.home() / "Organizer" / "sorted"
CATEGORIES = {"Documents", "Images", "Notes", "Finance", "Other"}


@tool
def list_inbox() -> str:
    """List filenames currently in the inbox. Returns one filename per line."""
    files = sorted(p.name for p in INBOX.iterdir() if p.is_file())
    return "\n".join(files) if files else "(empty)"


@tool
def organize_file(filename: str, category: str) -> str:
    """Move one inbox file into a category folder under sorted.

    Args:
        filename: Exact filename from list_inbox, e.g. vacation photo.jpg
        category: One of Documents, Images, Notes, Finance, Other
    """
    if category not in CATEGORIES:
        return f"Invalid category: {category}. Use one of {sorted(CATEGORIES)}"
    src = INBOX / filename
    if not src.is_file():
        return f"File not found in inbox: {filename}"
    dest_dir = SORTED / category
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / filename
    shutil.move(str(src), str(dest))
    return f"OK: {filename} -> {category}/"


@tool
def show_sorted() -> str:
    """Show the current organized folder tree."""
    lines = []
    for path in sorted(SORTED.rglob("*")):
        if path.is_file():
            lines.append(str(path.relative_to(SORTED)))
    return "\n".join(lines) if lines else "(sorted is empty)"


def main() -> None:
    INBOX.mkdir(parents=True, exist_ok=True)
    SORTED.mkdir(parents=True, exist_ok=True)

    model = LiteLLMModel(
        model_id="ollama_chat/qwen2.5:7b-instruct-q4_K_M",
        api_base="http://127.0.0.1:11434",
        api_key="ollama",
        num_ctx=8192,
    )

    agent = CodeAgent(
        tools=[list_inbox, organize_file, show_sorted],
        model=model,
        max_steps=15,
    )

    task = """
Organize every file in the inbox.

Rules:
1. Call list_inbox first.
2. For each filename, call organize_file(filename, category).
3. Categories:
   - pdf/md -> Documents
   - jpg/png -> Images
   - txt -> Notes
   - xlsx -> Finance
4. Call show_sorted at the end and summarize.
"""
    print(agent.run(task))


if __name__ == "__main__":
    main()

# Skills

Claude Code skills (`SKILL.md` files, loaded via the `Skill` tool) that operate
on this agent library — as opposed to the `agents/` directory itself, which
holds the agent persona definitions. A skill here is reusable tooling for
building, testing, or maintaining the personas, not a persona itself.

| Skill | What it does |
|-------|---------------|
| [agent-interview-loop](agent-interview-loop/SKILL.md) | Stress-tests an agent persona's definition file by running it through a live mock interview against another persona playing the interviewer, then has both review and patch the candidate's file based on what the interview surfaced. |

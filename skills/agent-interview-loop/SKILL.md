---
name: agent-interview-loop
version: 1.0.0
description: |
  Stress-test and improve an AI agent persona's definition file by running it
  through a live mock interview against another agent persona playing the
  interviewer, then sending both personas back to critique and patch the
  candidate's own file based on what the interview actually surfaced. Use
  this whenever the user wants to validate, harden, or iterate on an entry in
  the local agent library (~/homelab-data/agents/, the peteedoo/iamfaulty-homelab
  fork of agency-agents) — phrases like "interview this agent", "test this
  persona", "have HR interview the IT agent", "run this candidate through the
  interview kit", "find gaps in this agent's file", or "make the agents review
  each other" should all trigger this. Also trigger when the user asks to
  improve an agent profile file but hasn't specified how — interview pressure
  surfaces real gaps that a cold read-through of the file usually misses.
allowed-tools:
  - Agent
  - Read
  - Edit
  - Bash
---

# Agent Interview Loop

Two agent personas — one playing an interviewer, one playing a job candidate
— run a real mock interview for a role. The interviewer scores it. Then both
personas turn around and review the candidate's own agent definition file
against what the interview actually exposed, and you apply the resulting
edits. The interview isn't the deliverable — it's the stress test. The
deliverable is a better agent file.

This only works because both personas are drawing on real content: the
interviewer's own interview kit and scorecard (baked into its system prompt),
and the candidate's own stated expertise (also baked into its system prompt).
Neither agent is inventing a fictional scenario from scratch — they're
exercising material that already exists and will keep existing after the
interview ends, which is what makes the "review your own file" step
meaningful rather than circular.

## When this is worth doing

Reach for this when an agent profile in the local library needs validation
before it goes into wider use, or when you already suspect it has gaps but
can't articulate them from just reading the file. A cold read of a
well-written agent file always sounds competent — that's the same problem a
resume has. Interview pressure (specific scenarios, follow-ups, "walk me
through your first five minutes") separates "knows the vocabulary" from
"has the reasoning," the same way it does for a human candidate.

Don't reach for this to evaluate real human candidates or to replace an
actual hiring process — that's what the Technical Interviewer or HR agent
personas are for on their own. This skill is specifically for testing and
improving *agent definition files*, not people.

## Parameters to pin down before starting

- **Interviewer persona** — an existing `subagent_type` that has (or can be
  given) a real interview kit for the role in question. `Technical
  Interviewer` ships with a flagship "FLL IT Specialist" kit and is the
  default choice for IT/network/security roles. For other domains, check
  whether a suitable interviewer persona already exists in the library before
  improvising one — don't invent scoring criteria from nothing if a relevant
  scorecard already exists somewhere in the library.
- **Candidate persona** — the existing `subagent_type` whose file you're
  trying to validate or improve.
- **Candidate's on-disk file path** — under `~/homelab-data/agents/<division>/`.
  Confirm both personas are actually registered (check the Agent tool's
  available agent list) before starting — if the candidate isn't symlinked
  into `~/.claude/agents/` yet, run the library's own install step first
  rather than trying to invoke a persona that doesn't exist yet.

## Workflow

### 1. Run the interview (three sequential Agent calls)

Each `Agent` call is stateless — there's no shared memory between them, so
feed the full transcript forward explicitly each time rather than assuming
the next call remembers the last one.

1. **Interviewer opens the interview.** Ask it to produce only its own side
   of the script — the rapport opener, the behavioral (STAR) questions, the
   technical scenarios (with any supporting material, like a redacted config
   or ticket, spelled out in full so the candidate can actually use it), and
   the close. Explicitly tell it not to answer for the candidate.
2. **Candidate answers in character.** Paste the interviewer's full script
   into the candidate's prompt and ask it to answer every question in first
   person, drawing on its own stated expertise rephrased as personal work
   history — not as a capabilities list. Tell it explicitly that "I don't
   know, here's how I'd find out" is a legitimate and rewarded answer where
   true; a persona that bluffs through every question isn't a useful test.
3. **Interviewer scores the transcript.** Paste the full question-and-answer
   transcript back into the interviewer and ask it to complete its own
   scorecard template, with every score tied to a specific quote from the
   candidate's answers — not a vibe.

### 2. Send both personas back over the candidate's file

Read the candidate's file once for your own reference. Then run two `Agent`
calls in parallel (they're independent perspectives, no reason to serialize
them):

- **Interviewer reviews the file** against the specific gaps its own
  scorecard flagged — ask for edits tied to file sections, not generic advice.
- **Candidate self-reviews its own file**, told what its two weakest moments
  in the interview were, and asked what in its own definition contributed to
  those moments.

### 3. Reconcile and apply

Merge the two sets of suggested edits. Drop anything generic or ungrounded —
keep only edits that trace back to a specific moment in the transcript.
**Before calling Edit, re-`Read` the target file fresh** — do not reuse the
read from step 2. See the gotcha below for why this matters.

Apply the edits, then run the library's own lint check to confirm the file
still validates against the format the install pipeline expects:

```bash
~/homelab-data/agents/scripts/lint-agents.sh <path-to-file>
```

### 4. Report

Say what changed, why, and flag anything surprising either direction:
- A suggested edit that turned out to be based on a misread of the file
  (an agent inventing a gap that isn't there).
- A suggested edit that looked like a hallucination but turned out to be
  correct (see gotcha below) — these are worth surfacing more than the
  clean cases, because they're the ones that would otherwise get dismissed.

If asked, commit and push the change to the agent library repo
(`peteedoo/iamfaulty-homelab`) — but only on request, not by default.

## Gotcha: don't assume a "false" finding is actually false

Multiple sessions or terminals can share the same operating identity and
touch the same file concurrently. If a self-review claims the file is
missing a section you don't remember seeing, don't reflexively write it off
as the agent hallucinating a plausible-sounding gap — **re-read the file
before either dismissing or accepting the claim**. The file may have
genuinely changed between when you first looked at it and when the
self-review ran. Getting this backwards in either direction — trusting a
real hallucination, or dismissing a real observation — undermines the whole
point of using a second perspective to review the first agent's file.

## This loop also validates the interview kit itself

If the same interview kit produces clean separation between strong and weak
answers across multiple different candidate personas, the kit is doing its
job. If every candidate breezes through the same question, or every
candidate stumbles on it regardless of their actual domain strength, that's
a signal the *question* is miscalibrated — not that every candidate happens
to share the same weakness. Worth noting in the report when it comes up.

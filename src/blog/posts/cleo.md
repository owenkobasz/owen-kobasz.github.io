---
title: "Building Cleo"
date: 2026-05-4
description: "An LLM Powered Terminal Calendar Assistant."
tags: [dev, terminal, llm, agent]
author: Owen Kobasz
image: 
draft: false
---

![Cleo Header](/blog/images/cleo-header.png)

# An LLM Powered Calendar Assistant

Cleopatra, or Cleo for short, is a terminal-based, AI-powered personal calendar assistant that I built to help manage and update my schedule with natural language instructions. This is not a new idea, and there are plenty of SaaS options that effectively do the same thing, but I wanted something lightweight that I could have full control over and run cheaply. It is built just for me and assumes my setup, calendar habits, and workflow. Traditionally, that would be seen as a failure of the program, the inability to scale, but I want to push on that a bit and propose it as a feature.

I think one of the biggest changes we are going to see in the coming years is software becoming increasingly customized and tailored to the individual user. This is in contrast to the current state of software which is largely built around broad user archetypes, which, in practice, means that individuals and teams often have to contort their workflows to match the tools they are using. As it stands it's easier for them to adapt to the tools than for the tools to adapt to them. I think that this is one of the biggest things that will change as we enter the AI era.

Vibe coding and LLM-generated code remove a huge amount of overhead, and they open the door to creating custom experiences, interfaces, and functionality without needing to be as deeply knowledgeable about the tech as you would have needed to be in the past. In anticipation of this I'm experimenting with building software that is tailored to individual users (like myself) to automate mundane tasks and learn what works and what doesn't.

I've previously built related programs like [Chronicle](https://github.com/owenkobasz/chronicle), for archiving my personal photo/video library, and [Spindle](https://github.com/owenkobasz/spindle), which started as a playlist creation tool but grew into a music library archiver, but Cleo is the first to actually integrate an LLM API and work with natural language and I love it. I laid the foundation one late night with extensive planning docs and had Claude build the first version the next morning. Once everything was wired up, I created a new iCloud calendar, added the keys, and Cleo worked with surprisingly few edits. I was able to talk to Cleo in natural language and have it modify my schedule and update my calendars accordingly. Amazing! Overall, I am really happy with the MVP and the next step will be to add some rizz via ASCII art to give it more personality.

Below is a technical walkthrough of Cleo's functionality drafted by Claude and edited by me:

---

## Architecture: Three Clean Layers

```
  Python (agent loop, REPL, tools)
         │ function calls
  cleo-cal (compiled Swift binary)
         │ subprocess / JSON
  Apple Calendar (EventKit → iCloud → iPhone)
```

The stack has three layers that almost never need to be touched at the same time.

**Python** is where all the logic lives: the agent loop, the REPL, tool definitions, the free-slot algorithm, and the event log. This is the layer you iterate on.

**`cleo-cal`** is a compiled Swift binary that acts as a pure EventKit adapter. It has no business logic, no knowledge of the LLM — Python tells it what to do, it translates to EventKit API calls, and returns JSON. It's compiled once and rarely touched.

**Apple Calendar** is the source of truth. EventKit writes events there; iCloud handles sync to iPhone automatically. The app never manages its own database.

The boundary between Python and Swift is clean: `subprocess.run(["cleo-cal", "list", "--start", ..., "--end", ...])` produces JSON on stdout. Errors go to stderr. Python parses the output. The two layers never share memory or state.

---

## The Agentic Loop

The core of the app is a `while True` loop in `agent.py`. It's short (about 30 lines) and it's what makes the whole thing feel intelligent.

Here's how it works:

1. A user message gets appended to the conversation history
2. The LLM is called with the full history and a list of available tools
3. If the model responds with `stop_reason == "end_turn"`, the text is returned to the user
4. If the model responds with `stop_reason == "tool_use"`, every requested tool is executed, results are appended to the conversation history, and the loop goes back to step 2

The model keeps calling tools until it has enough information to respond. The user never sees the intermediate steps.

```
You: "schedule lunch tomorrow at the first free slot"

  → LLM calls find_free_slots(date="2026-05-04", duration_minutes=60)
  ← returns: [{"start": "12:00 PM", "end": "1:00 PM"}, ...]

  → LLM calls create_event(title="Lunch", start="...", end="...")
  ← returns: event object

  → LLM: end_turn
Cleo: "Done — Lunch added tomorrow 12–1 PM."
```

The model is choosing which tools to call, in what order, based on what it knows. That's the agentic part. For a simple query like "what do I have Thursday?" it calls `list_events` once. For "find me 90 free minutes this week and block them for study time," it might call `find_free_slots` across several days before calling `create_event`. The same loop handles both.

---

## The Tools

Five tools are exposed to the model, each defined as a JSON schema that describes its name, purpose, and parameters.

| Tool | What it does |
|---|---|
| `list_events` | Fetch events in a time range (all calendars) |
| `create_event` | Book a new event in the Cleo calendar |
| `update_event` | Edit fields on an existing event |
| `delete_event` | Delete an event by ID |
| `find_free_slots` | Compute open windows on a date for a given duration |

`find_free_slots` is the most interesting one. It lives entirely in Python: it fetches all events for the day, walks through them in order, and identifies gaps between them that are large enough for the requested duration. It excludes all-day events, which don't actually block time. The model never has to do this arithmetic itself — it just asks for open windows and gets them back as a list.

Every write operation (create, update, delete) is logged to `~/.cleo/event_log.jsonl` — an append-only file of every mutation the app has ever made. It's the recovery mechanism: if the model deletes the wrong event, the full event data is in the log and can be re-created manually.

---

## The System Prompt

Before every model call, a system prompt is assembled from two parts.

The **static section** encodes identity and preferences. It tells the model it's a calendar assistant for a specific person, describes scheduling preferences (no early morning commitments, protect Friday afternoons), and sets behavioral rules (confirm before deleting, ask for clarification when a request is ambiguous, always use 12-hour time). This section is marked for [prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — it's the same on every call, so Anthropic can cache the processed tokens and skip re-computing them.

The **dynamic section** is injected fresh every turn: the current date and time, and today's full event list. This means the model always knows what day it is and what's already on the calendar — without needing to call a tool first to find out. The most common question ("what do I have today?") is answered before the model even needs to act.

---

## The Swift Binary

Calling Apple Calendar from Python is harder than it sounds. AppleScript can technically do it, but it launches Calendar.app on every call, has poor support for creating and editing events, and breaks across macOS version changes. The proper path is EventKit, Apple's framework for calendar and reminder access.

EventKit is a Swift/Objective-C framework. Rather than fighting with Python-to-ObjC bindings, Cleo uses a compiled Swift CLI — `cleo-cal` — as the interface layer. Python calls it via subprocess, passes arguments, reads JSON back.

The binary handles five operations: list events, create, update, delete, and list available calendars. It formats all timestamps as ISO8601 with local timezone offset (`2026-05-01T15:00:00-04:00`), which Python can parse unambiguously with `dateutil`. It filters out declined calendar invites so they don't appear as commitments or block free slots.

One non-obvious detail: EventKit permission is requested asynchronously, but a command-line tool needs to block until the permission dialog resolves. The Swift entry point handles this with `Task {}` + `RunLoop.main.run()` — the `Task` does the async work, and `RunLoop.main.run()` keeps the process alive until `exit()` is called from inside it. Without that second line, the process exits before the async code runs.

The binary is code-signed after every build. Without code signing, macOS treats each rebuilt binary as a new app and re-prompts for calendar access on every run.

---

## What Makes It Interesting

A few things make this project more than just "I wired up an LLM to an API."

**The boundary between the model and the calendar is explicit.** The model never calls the calendar directly. It calls tools with structured parameters — typed strings, ISO8601 timestamps. Every action the model takes is mediated by Python code that validates inputs and logs the result. If something goes wrong, you can trace exactly what the model decided to do.

**The conversation has memory.** The message history is maintained across the entire session. "Move it" and "that one" and "actually make it 45 minutes" all work because the model has everything it said and everything the tools returned sitting in context. The REPL is genuinely conversational, not a sequence of isolated commands.

**The model handles ambiguity gracefully.** If a request could match multiple events, the model lists them and asks which one. This isn't an if/else in Python — it's a behavior that emerges from the system prompt instruction: "if a request could match multiple events, list them and ask which one." The model applies this judgment to situations that weren't explicitly anticipated.

**The stack crosses two languages.** Python and Swift serve genuinely different purposes here. Python has the LLM SDKs and the scripting ergonomics. Swift has native access to EventKit. The clean JSON interface between them means each layer does what it's actually good at.

---

## Where It Could Go

The current implementation is a complete, working MVP. Here's what the most interesting next steps look like.

**Recurring events.** EventKit supports them natively. The main challenge is that all instances of a recurring event share the same identifier, which complicates updates ("move every Monday standup" vs. "move this Monday's standup"). This would require the model to ask for clarification and the Swift binary to distinguish between single-instance and series edits.

**Google Calendar API.** The current setup only works with Apple Calendar events. I also maintain Google calendars because that is the standard and it would be great to add functionality to sync events.

**Proactive suggestions.** Right now Cleo is entirely reactive — it does what you ask. A more ambitious version could notice that you have four back-to-back meetings with no buffer, or that you've scheduled something over a recurring commitment, and surface that unprompted. This would require either a persistent background daemon or a daily digest that's generated by running the agent against the week's schedule without user input.

**Apple Reminders integration.** EventKit also manages the Reminders app. A natural extension is letting Cleo create and query reminders alongside calendar events — "add 'buy groceries' to reminders" — using the same tool-use pattern. The Swift binary would need a second set of subcommands for the `EKReminder` type.

**macOS notifications.** The app currently only runs when you invoke it. Notifications could be added without a daemon: a lightweight background process launched by `launchd` that calls `osascript` to show a notification banner N minutes before each event. This is independent of the Python app and wouldn't require restructuring anything.

**Tmux / status bar integration.** One-liner mode (`cleo today`, `cleo tomorrow`) was designed partly for this. Piping `cleo "next event"` into a tmux status bar or a menu bar widget would put your next calendar item on screen at all times, without opening any app.

**Natural language time parsing improvements.** The current implementation relies on the model to translate "tomorrow morning" or "next Friday" into ISO8601 timestamps, which it does well but not perfectly across edge cases (relative references at the end of a month, week boundaries). Adding a dedicated time-parsing library like `dateparser` as a preprocessing step would tighten this up before the model ever sees the input.

---

## A More Meta View

Coming back to where I started: I think personal software is one of the most underexplored opportunities in the AI era. Cleo exists because I wanted something tailored to my workflow rather than a more generalized program that I adapt to. Building it took a late night of planning and a morning of wiring things together. That's a very different calculation than it was two years ago.

The natural next step is a V2 that goes deeper into the productivity layer. I've been using a modified version of David Allen's method in _Getting Things Done_ to manage my life for the past few years and now I'm thinking about how to expand on the calendar and create a larger productivity system. It will need a place for projects to live in addition to the calendar, so I'm exploring options like Notion and Obsidian. I could also self host but there is no reason to create work for its own sake. 

Another big question is how to improve capture. Right now Cleo only exists in the terminal, which means anything I want to add has to happen at my desk. My current thinking is a lightweight Notion page, or something similarly phone-accessible, that acts as an inbox. Cleo would pull from it on a schedule, parse the entries, and turn them into calendar events, update projects, or create reminders without me having to touch the terminal. That closes the loop from "thought I had while walking" to "thing on my calendar" without any manual step.

The important constraint is keeping this simple. It would be straightforward to turn this into a full-stack app with a database, a web UI, and user accounts, but that feels like overkill (for now at least). I think the current iteration of the app draws a lot of power from its simplicity and I want to keep that going as long as possible.

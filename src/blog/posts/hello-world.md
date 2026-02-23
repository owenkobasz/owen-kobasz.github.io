---
title: "Hello World: Welcome to the Blog"
date: 2026-02-23
description: "First post on the blog — a quick look at what's coming and how this site was built."
tags: [meta, web-dev]
author: Owen Kobasz
image:
draft: false
---

## Why a blog?

I've been building things for a while now — APIs, routing algorithms, simulation tools, AI-integrated systems — and I wanted a place to write about the process. Not just finished products, but the decisions, trade-offs, and dead ends that come with real engineering work.

This blog is that place.

## What to expect

Posts here will cover:

- **Technical deep-dives** — walking through architecture decisions, interesting algorithms, or tools I've built
- **Project write-ups** — the story behind projects like Cyclone and Turbo
- **Explorations** — things I'm learning, experimenting with, or thinking through

## How this blog works

The blog is pre-rendered at build time from Markdown files. Each post is a `.md` file with YAML frontmatter for metadata. A build script converts them to static HTML with full SEO, RSS, and syntax highlighting. No client-side framework, no JavaScript required to read a post.

Here's a quick code example to show off syntax highlighting:

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(greet("world"))
```

The whole system is designed to be portable — when the site eventually moves to Astro, the Markdown files transfer with zero modifications.

## What's next

More posts soon. Stay tuned.

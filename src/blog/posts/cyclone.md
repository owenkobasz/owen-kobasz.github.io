---
title: "Cyclone"
date: 2026-05-7
description: "Where Optimization Ends."
tags: [dev, react, llm, cycling]
author: Owen Kobasz
image: /blog/images/cyclone.png
draft: false
---

![Cyclone Header](/blog/images/cyclone.png)

I see a lot of apps that are basically just LLM APIs with a UI bolted on. The model does everything, the app does nothing, and you're left wondering why you wouldn't just use Claude or GPT directly. With [Cyclone](https://cyclone-front-end.onrender.com/#home) I wanted to build a system where the LLM fills in a specific gap that is outside of the reach of deterministic algorithms — _to explore the space where optimization ends and judgment begins._

In Cylone the routing, the elevation, the turn-by-turn directions are all handled by purpose-built tools. GPT's only job is to answer the fuzzy question: _Given a start location, target distance, and general vibe, what route are you taking?_

Cyclone started as a team project for the UPenn SPARC coding challenge in the Summer of 2025 — Matt Schwartz, Mandy Shek, Le Zhang and I built the original version together. I kept going on it long after the challenge wrapped, which is why I really consider it my baby. The idea came from being an avid cyclist in grad school who wanted to explore new routes but didn't have time to comb through route libraries to find the good stuff. I wanted a tool that could just make one for me.

It turns out that doing this is easier said than done. There are many tools and methods for solving the fastest, most efficient, or safest way to get from Point A to Point B, but very few designed for those who want to go on a journey for its own sake. I went in thinking that I would be able to create a modified version of A* search that used a different heuristic to achieve this but then realized how many ambiguous questions that raised: _If not efficiency, what do you optimize for? What makes a route enjoyable? Can you even quantify this? Should you?_

After some time spent philosophizing I settled on distance as the primary target. It is far from the whole picture, but is a metric that is easy to work with and gives you some idea of how long the ride will take and how difficult it will be. 

This was my first time working with geospatial data in an app so I didn't really know what I was doing and basically just treated it like a graph, simplifying it as much as possible. This involved me downloading local OSM data and hosting a simple local routing engine. It was very unrefined but kind of worked. I did face a hard choice here, however, because I wanted the app to be run from anywhere in the country (world would be even better) and be as adaptable as possible. Doing so with the direction it was going would mean committing to hosting a pretty robust server for routing, which just feels like overkill for the scope of this project. I really prefer it when apps are as lightweight as possible and there are many free* tools I could leverage to do this.

So I pivoted and changed the idea of how the app would function completely. After exploring different approaches I settled on a system that could place waypoints and then use an existing routing API to connect them and create the final route.

The first way I implemented this was by creating an algorithm to place points on a map based on their distance relative to the start. The user would enter a start location (geocoded into lat/long coordinates) and a distance target. The target distance would be divided into a number of coordinate points depending on how far it was. Then each would be randomly placed in order about one distance segment away from the previous one. To make sure it was making a rough loop, there was a random boolean that would determine if the route would be traveling in a convex or concave direction from the starting point. Then there were angle constraints to ensure it was following that direction. I was experimenting with different degrees of randomness to avoid making perfect circles and was able to get usable routes that varied quite a bit.

I called this the controlled dart board method and it worked OK but would struggle with the organic shapes of the real world (rivers were a big struggle). The bigger problem is that it just felt totally random. _Why would I want to spend my time riding a route created so arbitrarily?_ It lacked any insight into what makes a ride engaging and consequently felt very cold. 

One late night, Matt, Mandy and I were tweaking and debugging the algorithm when someone asked the question: _What if GPT could plot the points?_[^1] This seemed like a crazy idea that just wouldn't work, but after playing around with some system and user prompts in the OpenAI Playground we were able to get somewhat consistent ride plans with locations that were actually usable. So we decided to run with the idea and see how far we could take it.

The main struggle with using an LLM API call like this is that even if your output quality is very good, the results can be very unreliable. _The capability–reliability gap is very real._ The best solution I found has been a loop with verification safeguards that re-runs the query until the result hits an acceptable level. In the context of Cyclone this meant: formatted data that could be parsed and sent to routing engines, waypoints within a constrained distance of each other, and routes long enough to approximate the user's distance target and actually make a loop — that last one was the single hardest challenge.

We went through several rounds of prompt engineering to tackle these problems and created something usable if inconsistent. Later in the year, after starting to use Claude Code on my personal projects, I went through everything with Claude and was able to greatly improve the efficiency and quality of the system. It still has a lot of flaws but it's also pretty amazing how well it works.

I don't see Cyclone ever becoming a profitable product and that isn't really the point — I built it to see if the idea would work, and it mostly does. What I want to tackle next is the aesthetic redesign, then switch the auth layer back on once the routing quality is where I want it. Mostly I'm curious to see what improving spatial reasoning in these models unlocks for the system. The routes are only as good as the waypoints GPT generates, and that feels like the most interesting variable to watch.

---

## Technical Deep Dive

### The Pipeline

Cyclone runs a three-stage pipeline: GPT-4o generates waypoints, Valhalla routes between them, and the backend formats the result.

```
start coords + distance + preferences
        ↓
  GPT-4o → [{lat, lon}, ...] + route metadata
        ↓
  Valhalla → encoded polyline + maneuvers + elevation
        ↓
  decoded polyline + cue sheet + stats
```

The two systems are fully decoupled. GPT outputs a JSON array of coordinates and knows nothing about road networks. Valhalla takes those coordinates as waypoints and finds rideable roads between them, knowing nothing about what makes a route interesting. The division of labor is the whole idea.

### Making LLM Output Reliable Enough to Build On

The hardest problem in the project isn't prompt quality. It's reliability. GPT-4o can produce excellent waypoints, but "can" and "will consistently" are different things. The same prompt can return a well-distributed 30-mile loop one call and a tight cluster of coordinates two blocks from the start the next.

The solution is a verification loop: run the GPT call, parse the output, check it against acceptance criteria, and retry if any check fails. The criteria are:

- **Parseable JSON.** The output has to be structured data, not prose with coordinates buried in it.
- **Waypoint spread.** The geographic bounding box of the waypoints has to meet a minimum size relative to the target distance.
- **Loop closure.** The last waypoint has to be close enough to the start, or the route dead-ends.
- **Waypoint count.** Too few and the route is boring; too many and Valhalla starts making strange routing choices to hit all of them.

This trades latency for reliability. Retrying costs seconds. Shipping routes that are subtly broken costs user trust.

### Getting GPT to Think in Coordinate Space

Language models don't natively reason about geographic spread. The most persistent prompt engineering problem was that GPT would describe waypoints that sounded diverse ("a park to the north, a river trail to the east") but whose actual coordinates were clustered tightly, because it had no grounding in what a degree of latitude represents in miles at a given location.

The fix was to compute the required coordinate spread server-side and embed it in the prompt as a hard constraint. Given a target distance and a start coordinate, the backend calculates the approximate bounding box radius in degrees, accounting for latitude distortion on longitude, and tells GPT the minimum required separation between waypoints in decimal degrees. A few worked examples make it concrete: "at this latitude, 0.05° of longitude is approximately 3.5 miles."

The prompt file is about 400 lines. Getting the constraint framing right took many iterations: too prescriptive and GPT stops producing interesting routes, too loose and the clustering problem returns.

### Valhalla and the Bicycle Costing Model

Valhalla is the primary routing engine because its bicycle costing model is genuinely good. It surfaces controls that matter for cycling: surface type preference, grade penalty, use of dedicated bike infrastructure, and an `avoid_bad_surfaces` flag that keeps you off unpaved roads you didn't ask for. These map directly to the preference toggles in the UI.

The routing request goes to OSM's public Valhalla instance rather than a self-hosted one. The math is simple: hosting Valhalla with a full planet dataset costs around $50-100/month, which is overkill at this scale. The cost is reliability. The public instance is fast but has no SLA and occasionally goes down, which is why GraphHopper exists as a fallback.

Valhalla returns routes as Google-encoded polylines, a compact format where each lat/lon pair is encoded as a delta from the previous point. The backend decodes these into a flat coordinate array, then fetches elevation at 30-meter intervals along the decoded path.

### GraphHopper as a Fallback

GraphHopper's free tier caps requests at five waypoints. Since GPT typically generates 8-15, the waypoint array has to be resampled before the request goes out. The current approach keeps the start, the end, and three intermediates distributed evenly by index. It preserves the rough shape of the route but can cut interesting detours GPT intended.

In practice, GraphHopper-routed routes are more direct and less exploratory than Valhalla ones. They hit the target distance but feel like they took the practical path rather than the interesting one. Acceptable for a fallback; worth knowing the failure mode.

### Drag-to-Reroute

Rerouting is architecturally separate from generation. When a user drags a waypoint, the updated coordinates go to `/api/reroute-with-waypoints`, which skips GPT entirely and sends the waypoint array straight to Valhalla. Cutting the LLM round-trip brings reroute latency down to 10-15 seconds from the 20-30 of initial generation. The original route metadata (name, difficulty) carries over from the first call.

One detail worth noting: the draggable handles on the map are the GPT-generated intermediate waypoints, not the dense polyline points. A typical route has 8-15 drag handles but hundreds of rendered polyline points. Keeping the handles sparse makes the interaction feel controlled.

### Infrastructure

The backend is Express on Node.js. User data and sessions live in SQLite rather than Postgres or Redis. At current scale it's the right call: no connection pooling, no separate service to manage, and it deploys to Render with a persistent disk volume in one config line. The first sign it needs replacing would be meaningful concurrent write load, which this project doesn't have.

Map tiles come from OpenStreetMap's public CDN, carrying the same free-with-no-SLA tradeoff as the public Valhalla instance. The pattern is consistent across the stack: trade infrastructure cost for complexity, accept the occasional outage, and rely on fallbacks where the stakes are high enough to warrant them.

The auth layer is complete (middleware, endpoints, SQLite schema) but gated behind a "Coming Soon" modal. The routing pipeline needs to be solid before adding a social layer on top of it.

---

## Try It

Cyclone is live at [cyclone-front-end.onrender.com](https://cyclone-front-end.onrender.com/#home). Punch in an address, pick a distance, and see what it generates. The first route is always a little surprising — which is, honestly, the point.

The code is at [github.com/owenkobasz/cyclone](https://github.com/owenkobasz/cyclone).

---

*Built for the UPenn MCIT SPARC 2025 Challenge.*

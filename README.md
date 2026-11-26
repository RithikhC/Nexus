# Intelligent EV Charging Management to Prevent Power Overloads

**▶ Live demo: https://rithikhc.github.io/Nexus/**

Student research project for **NEXUS 3.0** · Amity University Dubai × IEEE Student Branch
Track 01 — Tech · UN SDG 9, Industry, Innovation & Infrastructure

Rithikh Chandran · Chrislyn Ann Ginu · Gollapalli Darshitha

---

## The problem in one paragraph

Electricity networks are sized on **diversity** — the assumption that households do not all draw their maximum power
at the same moment. A home EV charger pulls roughly as much as the rest of the house combined, and everyone plugs in
when they get home from work, so that assumption stops holding. In the Gulf it is weaker still: household
load is dominated by air conditioning, which every home runs against the same outdoor temperature, so the
street is already correlated before a single car plugs in. The street's transformer, which was sized before EVs
existed, ends up carrying far more than it was built for. Sustained overloading ages the transformer and eventually
trips it, and the street loses supply.

The energy is not the problem. A car home at 18:00 and leaving at 08:00 has fourteen hours to absorb about four hours
of charging. **The problem is that everyone wants it in the same hour.**

## What the demo shows

Open the [live demo](https://rithikhc.github.io/Nexus/) and press play. You watch one evening on one street:

- **No control** — every car charges flat out the moment it arrives. The transformer goes well past its safe limit and
  stays there for hours.
- **Our controller** — it measures how much capacity is left under the limit and shares it out, giving power first to
  whoever leaves soonest. The transformer stays under the limit and the cars still leave charged.

Same cars, same energy, same night. The only thing that changes is *when* the power is drawn.

The page shows the controller's own working rather than just its result: the limit it is holding, the spare capacity
it measured this minute, the live draw at each of the 24 charge points, and the ranked queue it allocated from —
each car's battery level, departure time, energy still needed, urgency and the limit it was given.

## The AI advisor — it recommends, you decide

There are **two loops running on different clocks**, and the difference matters.

The **protection loop** is the controller above. It is deterministic, acts every minute and never waits for
anyone, because a transformer cannot be left overloaded while an operator is away from the desk.

The **advisory layer** sits above it and touches no charger at all. It reads *completed evenings*, finds the
pattern, and puts a small set of ranked options in front of a human — each with its reasoning, a projected
effect, the cost and lead time, and the risk. **Nothing is applied until you press Approve.**

Try it: run an evening with the controller on. Only 70% of the chargers are enrolled, so some cars charge outside
the scheme and the cap cannot be guaranteed. The advisor notices, and offers three options:

1. **Enrol the chargers not under control** — no capital cost, but needs customer consent
2. **Hold a tighter 90% cap** — free and immediate, though it will say when this *cannot help much*
3. **Log the unit for inspection and reinforcement** — the real fix, honest about doing nothing tonight

Approve one and run another evening. The decision log then shows **what it projected against what actually
happened** — and the advisor corrects its future estimates by that error.

It is a transparent recommender, not a trained model: every number it shows is traceable to a recorded
observation, which is what an operator needs in order to sign off work on an asset. That arrangement is also what
the [UAE Charter for the Development and Use of AI](https://u.ae/en/about-the-uae/strategies-initiatives-and-awards/policies/Ai)
asks for, listing human oversight among its priorities — "the irreplaceable value of human judgment".

Solar generation and storage are discussed in the paper rather than the demo, so the demo stays on the one mechanism
it is there to show.

## Where this fits today

Dubai already regulates this space, and the gap is specific:

- Public charging stations need **DEWA approval** before they are installed or operated, and installations follow
  DEWA's *EV Charging Technical Regulations* and *Regulations for Electrical Installations*.
- Public charging is tariffed under **Cabinet Decision No. 81 of 2024** — AED 0.70/kWh + VAT for AC, AED 1.20/kWh + VAT
  for DC.
- **Home charging sits behind the customer's meter and is billed on the ordinary residential slab tariff**, which is
  banded by monthly volume, not by time of day.

So in Dubai today there is **no price signal that shifts home charging off the peak**, and a home charger is treated
much like any other appliance. Network capacity is protected instead by a *static* up-front load assessment: the
utility checks whether the network could supply the new connection at full power, and approves or refuses. That is
safe, but it is assessed against a worst case that almost never happens, so capacity that exists in practice goes
unused — and where the answer is "no", the fix is reinforcement.

**This project's contribution is to turn that static limit into a dynamic one.** Instead of asking *can the network
supply every charger at once*, the controller continuously measures the transformer and guarantees the chargers never
collectively exceed what is actually free. The same asset can then host far more chargers, safely, without being
replaced.

## Repository

```
index.html        the demo
css/style.css     styling
js/sim.js         the simulation and the protection loop
js/advisor.js     the advisory layer: AI recommends, a human approves
serve.js          tiny local server for development
paper/            the research paper, figures and sources
```

Run it locally with no install:

```bash
node serve.js      # http://localhost:5180
```

## Honesty about the numbers

The demo is a **teaching model of a single street**, not a study of a real network. It uses a plausible household
demand shape, plausible arrival and departure times and a plausible transformer rating, and the figures follow from
those assumptions. The comparison between controlled and uncontrolled charging is the meaningful output; the exact
percentages are not measurements and a real feeder would differ. Assumptions and their basis are tabulated in the
paper.

## The paper

[`paper/Intelligent-EV-Charging-Management.docx`](paper/Intelligent-EV-Charging-Management.docx) — IEEE format,
5 pages, with the regulatory review and its sources.

Rebuild it (needs `npm i docx sharp` inside `paper/`):

```bash
cd paper
node figures.js    # the three conceptual figures
node paper.js      # the .docx
node model.js      # the street model behind the demo, as a console summary
```

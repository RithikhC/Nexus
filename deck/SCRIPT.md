# NEXUS 3.0 — presentation script

**Eight minutes, two speakers, fourteen slides.** Thirteen are spoken; slide 14 stays
up through questions.

Measured at **1,192 spoken words**. That is **7 min 40 s** at a normal presenting pace
of 155 words a minute, and **8 min 30 s** if you speak slowly — so it fits, but it does
not fit at a crawl. Time yourself once before you trust it.

**If you overrun in rehearsal**, cut slide 4 to two sentences — the third point is the
only one that matters — and compress slide 10 to the four phase names.

## The split

| Slides | Speaker | Owns |
|---|---|---|
| 1–5 | **Speaker 1** | the problem, the evidence, the regulatory gap |
| 6–9 | **Speaker 2** | the controller, the AI layer, what is new, the demo |
| 10–11 | **Speaker 1** | deployment and the business case |
| 12–13 | **Speaker 2** | limits and future work, then the close |
| 14 | **both** | questions |

Speaker 1 ≈ 4 min, Speaker 2 ≈ 3 min 50 s. Whoever is more comfortable under
questioning should take slides 7 and 8 — they attract the hardest ones.

---

## Slide 1 · Title — **Speaker 1** · 15 s

> Good morning. Our subject is a problem that is already here, not one that arrives
> in 2040: what happens to the network when electric vehicles charge in the same
> place at the same time — and a fix that needs no new hardware and no new standard.

*Do not read the authors off the slide. Move.*

---

## Slide 2 · The grid is built on everyone being different — **Speaker 1** · 40 s

> The whole network rests on one assumption: that we do not all do the same thing at
> the same moment. A transformer is never sized to supply every customer at once,
> because it never has to. That spread is called diversity, and it is why a feeder
> rated far below its connected load has worked for decades.
>
> Charging breaks it twice. By size — a charge point is comparable to everything else
> behind that connection. And by correlation — vehicles arrive together, and plug in
> on arrival.
>
> *(point at the graph)* Dashed is the site without charging. Solid is the same site
> with it. The difference is not energy. It is timing.

---

## Slide 3 · It breaks sooner than people expect — **Speaker 1** · 50 s

> These are not our numbers. They are published, and they are lower than most people
> guess.
>
> Modelling for the US Department of Energy found transformer limits are exceeded at
> **0.75 vehicles per dwelling** — fewer than one car per household. At 19.2 kilowatt
> charging that falls to **0.25**, because loading is proportional to charging rate.
> Faster chargers do not postpone the problem. They multiply it.
>
> And the share of network is not marginal. My Electric Avenue, an Ofgem-funded trial
> in Britain, projected **32% of low-voltage feeders** — three hundred thousand
> circuits — needing intervention, at around **£2.2 billion**.
>
> A third of a mature national network, caused by one new load.

---

## Slide 4 · What Dubai regulates today — **Speaker 1** · 35 s

> Dubai already regulates this space, and regulates it well. Public stations need DEWA
> approval before they are installed or operated, and public charging is priced under
> Cabinet Decision 81 of 2024.
>
> But look at the third one. Charging behind a customer's meter is billed on the slab
> tariff — banded by **monthly volume**, not by time of day.

*Land on that third point. It sets up the next slide.*

---

## Slide 5 · But nothing governs the one thing that matters — **Speaker 1** · 40 s

> So here is the gap.
>
> The standards govern what may be **installed**. The load assessment governs what may
> be **connected**. Nothing governs what is **drawn the moment they all arrive**.
>
> A compliant 7.4 kilowatt charger is entitled to its full 7.4 kilowatts at the worst
> possible moment, and the check that approved it was made once, years ago, against a
> worst case that almost never happens. Nothing is watching, and nothing responds.

**Handover:** *"That is the problem. [Name] will take you through what we propose."*

---

## Slide 6 · How the controller works — **Speaker 2** · 50 s

> Thank you. The proposal turns that one-off check into a continuous one.
>
> Four steps. **Measure** the transformer every minute — measured, not forecast, so it
> cannot be wrong about it. **Subtract** the other demand; what is left is the headroom.
> **Rank** vehicles by least slack: time until departure minus time needed at full
> power. **Enforce** — each charger gets a current limit.
>
> That limit travels on the IEC 61851 control pilot, which every compliant charge point
> already implements. Six amps to eighty; below six it cannot express a limit at all,
> so a session pauses rather than throttling further.
>
> No new hardware. The signal is already in the cable.

---

## Slide 7 · The AI advisor — **Speaker 2** · 55 s

> Holding the limit is necessary but not enough. A controller that quietly absorbs a
> worsening problem is also hiding it.
>
> So there are **two loops, on different clocks**.
>
> Protection runs every minute and never waits for anyone — you cannot leave a
> transformer overloaded while an operator is away from their desk.
>
> Above it sits a layer that touches no charger at all. It reads completed days, finds
> the pattern, and puts ranked options to a human: enrol more points, tighten the cap,
> or schedule reinforcement — each with its reasoning, a projection, the cost and the
> risk. **Nothing happens until a person chooses one.**
>
> This is not a workflow we invented. It is how restoration already runs in a control
> room: GE Vernova's system asks the operator first, and proposes the next-best option
> if they decline. It is also what the UAE AI Charter asks for.

---

## Slide 8 · What is actually new here — **Speaker 2** · 45 s

> We should be honest about what is ours and what is not.
>
> *(point at the top box)* The scheduling rule is textbook, and controlling charging
> against a feeder limit was demonstrated in Britain a decade ago — by the same trial
> we cited earlier. It worked. It never became standard practice.
>
> Three things are new.
>
> **The boundary.** Load management you can buy today caps a site against its own main
> fuse. Twenty customers can each stay inside their supply while the transformer they
> share goes over, because nobody measures it.
>
> **The decision.** No product escalates an asset judgement to a named operator with a
> projection that is scored afterwards.
>
> **The regulatory vehicle.** Dubai has no managed-connection class, so a charger that
> can prove it stays inside a limit is still judged on its nameplate.

---

## Slide 9 · One street, one evening — **Speaker 2** · 40 s

> This is the model running. One site, twenty-four charge points, one transformer.
>
> Left alone, the load reaches **153% of the safe limit** and stays over for about four
> hours. With the controller the worst moment is **87%**, it never goes over, and all
> fourteen vehicles still leave charged.
>
> Same vehicles, same energy, same night. Only the timing changed.
>
> It is a teaching model of one site, not a validated study, and it is live at that
> link if you want to run it.

**Handover:** *"[Name] will cover how this actually reaches a network."*

---

## Slide 10 · Getting it into a real network — **Speaker 1** · 40 s

> Four phases, ordered the way utilities actually adopt control rather than the way we
> would like them to.
>
> **Instrument** — six months, metering only, no control. Establish how often the limit
> is approached. **Pilot** — one or two feeders, opt-in customers; the controller
> enforces while the advisor only advises and the operator builds trust in it.
> **Regulate** — the managed-connection class with DEWA. That is the unlock. **Scale** —
> district by district.
>
> And the important part: **phases one and two need no regulatory change.** They can
> start on the framework that exists today.

---

## Slide 11 · The business case, plainly — **Speaker 1** · 40 s

> Charging in Dubai is already paid for — 70 fils a kilowatt-hour on AC, 1.20 on DC.
> We add nothing to the driver's bill. We protect the asset that serves them.
>
> The utility pays, because the saving is theirs: a transformer not replaced this year.
>
> And we will say plainly what we cannot tell you. We have no verified figure for what
> a transformer replacement costs DEWA, so we will not quote one. That comes out of
> phase one.
>
> What we can say is why it should be cheap: no new hardware, one meter per transformer
> rather than one per home, and it sits in the ADMS they already operate.

---

## Slide 12 · What we have not done, and what comes next — **Speaker 2** · 30 s

> We should be straight about the limits.
>
> This argues from published sources and regulation. We have not modelled a real
> feeder. Our advisor is rule-based, not a trained model. We do not know what a
> transformer replacement costs DEWA. And it currently reasons over one transformer,
> not a fleet.
>
> *(move across the slide)* Every one of those has the work that closes it on the
> right — and the first two are phase one of the roadmap you just saw.

*Do not apologise through this slide. Volunteering the limits is the strongest thing
we do on rigour. Say it levelly and keep moving.*

---

## Slide 13 · The capacity is already in the ground — **Speaker 2** · 20 s

> So — the capacity is already in the ground. What is missing is the coordination to
> use it.
>
> That is SDG 9 almost word for word: existing infrastructure retrofitted for greater
> resource-use efficiency. And it reaches 7 and 11 as well.
>
> Thank you — we are happy to take questions.

---

## Slide 14 · Questions — **both**

Leave it up. Every number in the talk is sourced on it, so if someone challenges a
figure you can point rather than argue.

---

# Defending it — the questions that will actually come

**"Doesn't dynamic load management already exist?"** — *the likeliest question.*
> Yes, and it is everywhere. But it caps a site against its own main fuse. It is
> installed by the customer, for the customer, and it knows nothing about the
> transformer upstream or the other customers on it. Twenty sites can each behave
> perfectly and the shared transformer still goes over. That boundary is the gap.

**"What is your methodology? You have no results."**
> We argue from published studies, standards and regulation rather than from our own
> simulation, and every quantitative claim in the talk traces to a source on this
> slide. The one figure that is ours — the 153 and 87 percent — is labelled as a
> teaching model, not a measurement. A validated network study is phase one, and it
> needs feeder data we do not have access to yet.

**"Is this one transformer, or all of them?"**
> Control is per transformer — it has to be, because headroom cannot move between
> feeders. The advisory layer is the opposite: it watches every instrumented
> transformer and surfaces the handful that need a decision. Cost scales per
> transformer; the value compounds across the fleet.

**"What if the AI gets it wrong?"**
> Then a human does not approve it, and nothing happens. The AI never touches a
> charger. And every projection it makes is scored against what actually happened, so
> the operator can see its track record before trusting the next one.

**"What if the communications fail?"**
> The charge point reverts to its default limit. The system degrades to exactly the
> situation we have today, which is safe — just unmanaged.

**"Why would a driver accept this?"**
> Because they still leave charged. A vehicle parked overnight has far longer than it
> needs. And the alternative for a new connection is not faster charging — it is
> waiting for reinforcement.

**"Isn't a time-of-use tariff simpler?"**
> It is, and it can make things worse. The IEA notes that a static time-of-use tariff
> can worsen grid impacts compared to no control at all, because everyone starts at
> the same instant. A price is a suggestion. A limit is a guarantee.

**If you do not know an answer:** say so, say what it would take to find out, and move
on. On a project this honest about its limits, "we do not know yet, and here is how we
would establish it" is a stronger answer than a guess.

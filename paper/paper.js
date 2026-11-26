/* node paper.js — builds the IEEE-format paper as a .docx
 * Needs: npm i docx sharp
 */
const fs = require('fs');
const path = require('path');
const D = require('docx');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType,
  SectionType, Table, TableRow, TableCell, WidthType, BorderStyle, convertInchesToTwip,
} = D;

const SERIF = 'Times New Roman';
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NOBORDER = { top: NONE, bottom: NONE, left: NONE, right: NONE };

const t = (text, o = {}) => new TextRun({ text, font: SERIF, size: o.size || 20, bold: o.bold, italics: o.italics, smallCaps: o.small });
const p = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.JUSTIFIED,
  indent: o.noIndent ? undefined : { firstLine: convertInchesToTwip(0.2) },
  spacing: { after: 0, line: 240 },
  children: Array.isArray(text) ? text : [t(text, o)],
});

let secNo = 0, subNo = 0, lastSec = 0;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const h1 = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 },
  children: [t(`${ROMAN[++secNo]}.  ${text}`, { small: true })],
});
const h2 = (text) => {
  if (lastSec !== secNo) { subNo = 0; lastSec = secNo; }
  return new Paragraph({
    spacing: { before: 140, after: 80 },
    children: [t(`${String.fromCharCode(65 + subNo++)}.  ${text}`, { italics: true })],
  });
};

function figure(file, widthIn, caption) {
  const img = fs.readFileSync(path.join(__dirname, 'figs', file));
  const iw = img.readUInt32BE(16), ih = img.readUInt32BE(20);
  const wPx = Math.round(widthIn * 96);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ data: img, transformation: { width: wPx, height: Math.round((ih / iw) * wPx) } })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [t(caption, { size: 16 })] }),
  ];
}

function cell(text, o = {}) {
  return new TableCell({
    borders: {
      top: o.top ? { style: BorderStyle.SINGLE, size: 6, color: '000000' } : NONE,
      bottom: o.bottom ? { style: BorderStyle.SINGLE, size: 6, color: '000000' } : NONE,
      left: NONE, right: NONE,
    },
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: String(text).split('\n').map((line, i) => new Paragraph({
      alignment: o.align || AlignmentType.LEFT, spacing: { after: 0, line: 240, before: i ? 30 : 0 },
      children: [t(line, { size: 15, bold: o.bold })],
    })),
  });
}
function table(caption, header, rows, widthIn) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 180, after: 60 }, children: [t(caption, { size: 16, small: true })] }),
    new Table({
      width: { size: convertInchesToTwip(widthIn), type: WidthType.DXA },
      borders: NOBORDER,
      rows: [
        new TableRow({ children: header.map((hh) => cell(hh, { bold: true, top: true, bottom: true })) }),
        ...rows.map((r, ri) => new TableRow({ children: r.map((c) => cell(c, { bottom: ri === rows.length - 1 })) })),
      ],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

/* ===================================================== title and abstract */
const titleBlock = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [t('Intelligent EV Charging Management to Prevent Power Overloads', { size: 48 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [t('Rithikh Chandran, Chrislyn Ann Ginu, Gollapalli Darshitha', { size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [t('Birla Institute of Technology and Science, Pilani — Dubai Campus', { size: 20, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [t('Dubai, United Arab Emirates', { size: 20, italics: true })] }),
];

const ABSTRACT =
  'Electricity distribution networks are planned on diversity: the assumption that households do not all draw their ' +
  'maximum power at the same moment. Electric vehicle charging weakens that assumption, because a home charger is ' +
  'comparable in size to the rest of a dwelling and because drivers plug in within the same few evening hours. The ' +
  'result is a local transformer carrying far more than it was sized for, with accelerated ageing and, eventually, ' +
  'loss of supply to the street. This paper examines the problem in the context of the United Arab Emirates, where ' +
  'national policy targets half the vehicle fleet electrified by 2050 and Dubai’s peak demand is already growing at ' +
  'several per cent a year. It reviews the instruments that govern charging today — the National Electric Vehicles ' +
  'Policy, Cabinet Decision No. 81 of 2024 on public charging tariffs, and DEWA’s technical and electrical ' +
  'installation regulations — and identifies a specific gap: network capacity is protected by a static load ' +
  'assessment made once before connection, and domestic charging sits behind the meter on a tariff banded by monthly ' +
  'volume rather than by time of day, so no signal exists to spread it. We propose converting that static limit into ' +
  'a dynamic one. A controller measures the headroom remaining at the transformer, allocates it among connected ' +
  'vehicles according to how little time each has before departure, and applies the result through the IEC 61851 ' +
  'control pilot, optionally supported by a shared solar canopy and battery. The approach lets existing assets host ' +
  'substantially more charging without replacement, and works within the regulatory framework already in force.';

const KEYWORDS = 'Electric vehicles, smart grid, charging management, power distribution, demand diversity, DEWA, SDG 9.';

/* ============================================================== the body */
const body = [
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 240 },
    children: [t('Abstract—', { bold: true, italics: true, size: 18 }), t(ABSTRACT, { size: 18, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 240 },
    children: [t('Keywords—', { bold: true, italics: true, size: 18 }), t(KEYWORDS, { size: 18, bold: true })] }),

  h1('Introduction'),
  p('Electric vehicles are arriving faster than the networks that must supply them. Global sales passed a fifth of all ' +
    'new cars in 2024 and are projected above 40% by 2030 [1]. The United Arab Emirates has set out a National ' +
    'Electric Vehicles Policy with the aim of half the vehicles on its roads being electric by 2050, alongside a ' +
    'substantial reduction in transport energy use [2], [3].', { noIndent: true }),
  p('The difficulty is not generating the energy. It is that charging concentrates demand at the weakest point of the ' +
    'system — the low-voltage feeder serving a residential street — and concentrates it at the hour when that feeder ' +
    'is already busiest. This paper sets out why that happens, how large the problem is likely to become in the UAE, ' +
    'what the current regulatory framework does and does not address, and a practical way to close the gap that ' +
    'requires no new standard and no new hardware interface.'),

  h1('Why Charging Stresses Distribution Networks'),
  h2('Networks are planned on diversity'),
  p('A distribution transformer is never sized for the sum of what its customers could draw. It is sized on ' +
    'diversity: the long-standing observation that households reach their individual maxima at different moments, so ' +
    'a transformer serving many homes never has to supply many simultaneous maxima. Diversity is the reason a feeder ' +
    'rated far below its connected load has served residential streets reliably for decades, and it is assumed ' +
    'throughout network planning practice.', { noIndent: true }),
  h2('Charging weakens the assumption in two ways'),
  p('First by size. A domestic charge point draws roughly as much as the rest of a dwelling combined, so adding one ' +
    'is not a marginal change to a household’s demand but close to a doubling of its peak.', { noIndent: true }),
  p('Second, and more importantly, by correlation. Charging is not independent between households: people return from ' +
    'work within the same two or three hours and plug in on arrival, so chargers switch on together, and they do so ' +
    'precisely when cooking, lighting and air conditioning are already at their daily peak. Fig. 1 shows the shape of ' +
    'the problem. The dashed line is a street without electric vehicles, comfortably inside its limit. The solid line ' +
    'is the same street once charging is added on top of the evening peak.'),
  ...figure('fig1-mechanism.png', 3.3,
    'Fig. 1.  Why the evening is the difficulty. Charging arrives on top of the household peak rather than in the quiet hours, even though the energy could be delivered at any point overnight. Schematic.'),
  p('Measured coincidence factors for domestic charging do fall as fleets grow, because arrivals spread over several ' +
    'hours [4]. That is reassuring for the system as a whole but not for the street, where charger power is high ' +
    'enough that even a modest coincidence factor can exceed the diversity allowance an existing transformer was ' +
    'sized against. Coincidence also rises sharply whenever arrivals or start times cluster.', { noIndent: true }),
  h2('What is coming, and at what scale'),
  p('Dubai’s peak electricity demand reached 11,391 MW in 2025, about 5.8% above the previous year [5]. That growth ' +
    'is being driven by population and economic activity, before significant electrification of transport. Against ' +
    'this, national policy targets half the vehicle fleet electrified by 2050 [2]. If a substantial share of those ' +
    'vehicles charge at home, and if they charge on arrival, the additional demand does not spread itself evenly ' +
    'across the day: it lands in the evening window, on thousands of low-voltage feeders simultaneously.', { noIndent: true }),
  p('The consequences differ by scale. Locally, sustained overloading is a thermal problem: insulation ageing ' +
    'accelerates sharply with winding temperature, so repeated evening excursions shorten a transformer’s life long ' +
    'before anything visible happens, and when protection finally operates the customers on that transformer lose ' +
    'supply. Studies of residential networks report hosting capacity varying enormously between feeders, with a ' +
    'meaningful fraction unable to accept any significant charging without a limit being violated [6].'),
  p('At system scale the bar is higher. A power system holds reserve against the loss of its largest generating ' +
    'unit, and a sudden demand step is equivalent to such a loss — but ordinary arrivals produce a ramp, which ' +
    'generation follows comfortably. What produces a step is a common control signal reaching many vehicles at once: ' +
    'a shared off-peak tariff hour, a default start time distributed by an application, or restoration after an ' +
    'outage. Studies of time-of-use tariffs report exactly this, the resulting synchronised peak rivalling the ' +
    'uncontrolled one [7]. Both scales share one mechanism, coincidence, and differ only in what causes it.'),

  h1('The Regulatory Framework in the UAE'),
  p('Charging in the UAE is already governed by a layered framework, and any practical proposal has to sit inside it. ' +
    'This section sets out what is in force, then identifies what it leaves open.', { noIndent: true }),
  h2('Policy'),
  p('The UAE Cabinet approved the National Electric Vehicles Policy in 2023. It directs federal and local authorities ' +
    'and the private sector to build a national charging network, provides for a central database of charging ' +
    'stations, and sets the 2050 target of half the fleet electrified together with a large reduction in transport ' +
    'energy use [2], [3]. Implementation includes UAEV, a joint venture between the Ministry of Energy and ' +
    'Infrastructure and Etihad Water and Electricity, tasked with deploying chargers nationally.', { noIndent: true }),
  h2('Tariffs'),
  p('Public charging is priced under Cabinet Decision No. 81 of 2024. From 30 September 2024, registered users of ' +
    'DEWA’s EV Green Charger service pay AED 0.70 per kWh plus VAT for alternating-current charging and AED 1.20 per ' +
    'kWh plus VAT for direct-current charging [8].', { noIndent: true }),
  p('Domestic charging is treated differently, and the difference matters. Electricity used to charge a vehicle at ' +
    'home is added to the ordinary DEWA bill at standard residential rates [8]. Those rates are a slab tariff banded ' +
    'by monthly consumption — AED 0.23 per kWh up to 2,000 kWh a month, rising through 0.28 and 0.32 to 0.38 above ' +
    '6,000 kWh, with a fuel surcharge and VAT applied [9]. The bands depend on how much a household uses in a month, ' +
    'not on when it uses it.'),
  p('The consequence is direct: in Dubai today there is no price signal that would move domestic charging off the ' +
    'evening peak. A household pays the same for a kilowatt-hour at 19:00 as at 03:00. The off-peak timer, which is ' +
    'the main mitigation deployed in markets that do have time-of-use tariffs, is therefore not available here — and, ' +
    'as Section II noted, where it is available it tends to replace a diverse peak with a synchronised one.'),
  h2('Technical and connection regulation'),
  p('DEWA’s EV Charging Technical Regulations require that charging installations follow the IET Code of Practice ' +
    'for electric vehicle charging equipment installation and BS 7671, with EV charge points also addressed in the ' +
    'Dubai Building Code [10]. Any organisation or developer must obtain DEWA approval before establishing, ' +
    'installing, operating or maintaining a charging station. Equipment itself follows IEC 61851, the international ' +
    'standard for conductive charging, whose control pilot allows a charge point to advertise the maximum current a ' +
    'vehicle may draw [11].', { noIndent: true }),
  p('Those equipment standards are worth stating precisely, because they set the envelope any controller must work ' +
    'inside. IEC 61851-1 defines the charging modes and the control pilot, the low-voltage signal by which a charge ' +
    'point tells a vehicle the maximum current it may draw. The pilot encodes that limit as a duty cycle: between 6 A ' +
    'and 51 A the available current is 0.6 times the duty cycle in per cent, and above that a second relation extends ' +
    'the range to 80 A [11]. Two values matter for control. The ceiling is 80 A, and the floor is 6 A — below it the ' +
    'pilot cannot express a limit at all, so a session must be paused rather than slowed further. Table II collects ' +
    'the limits that follow.', { noIndent: true }),
  ...table('Table II. Technical limits set by the standards',
    ['Layer', 'Standard', 'Limit'],
    [
      ['Charging mode', 'IEC 61851-1 [11]', 'Mode 3 for dedicated AC\nequipment; Mode 4 for DC'],
      ['Current signalling', 'IEC 61851-1\ncontrol pilot [11]', '6 A minimum, 80 A maximum;\n6–51 A as 0.6 × duty cycle'],
      ['Connector', 'IEC 62196 [14]', 'Type 2 to 63 A; CCS for DC'],
      ['Common ratings', 'from supply voltage', '7.4 kW at 230 V, 32 A;\n11 and 22 kW three-phase'],
      ['Remote limit setting', 'OCPP 1.6J / 2.0.1\nSmart Charging [15]', 'charging profile in amperes\nor watts, set by the operator'],
    ], 3.3),
  p('Network capacity is protected by DEWA’s Regulations for Electrical Installations. Technical details of an ' +
    'installation are submitted for review and prior approval before work begins, load distribution schedules are ' +
    'provided in prescribed formats, distribution boards are rated on total connected load before any demand factor ' +
    'is applied, and DEWA inspects and approves before supply is connected. Any extension or alteration requires ' +
    'prior approval in the same way [12]. Home chargers sit behind the customer’s meter and are installed much as ' +
    'any other appliance, with DEWA recommending approved contractors [10].'),
  h2('What the framework leaves open'),
  p('Taken together, the instruments in Table I cover safety, equipment standards, approval of public infrastructure ' +
    'and the price of public charging thoroughly. Two things they do not do are the subject of this paper.', { noIndent: true }),
  ...table('Table I. Instruments in force, and what each does not address',
    ['Instrument', 'What it governs', 'What it leaves open'],
    [
      ['National Electric Vehicles\nPolicy (2023) [2], [3]', 'National charger rollout,\ncentral station database,\n2050 fleet target',
        'How simultaneous demand\nis managed on existing\nlow-voltage networks'],
      ['Cabinet Decision No. 81\nof 2024 [8]', 'Public charging tariffs:\nAED 0.70/kWh AC,\nAED 1.20/kWh DC',
        'Applies to public charging;\nnot a time-of-day signal'],
      ['DEWA slab tariff [9]', 'Residential energy price,\nbanded by monthly volume',
        'No time-of-use element, so\nno incentive to shift\ncharging off the peak'],
      ['DEWA EV Charging\nTechnical Regulations [10]', 'Equipment standards, IET\nand BS 7671 compliance,\napproval of stations',
        'Does not require a station\nto respond to network\nconditions once running'],
      ['DEWA Regulations for\nElectrical Installations [12]', 'Load schedules, prior\napproval, inspection before\nconnection',
        'A one-time static\nassessment; capacity is\nnot re-evaluated in use'],
    ], 3.3),
  p([
    t('First, the protection of network capacity is '),
    t('static', { italics: true }),
    t('. The utility assesses, before connection, whether the ' +
      'network could supply the proposed load, and then approves or refuses. That assessment is necessarily made ' +
      'against a worst case in which everything draws at once — a condition that, thanks to diversity, almost never ' +
      'occurs. The result is conservative in both directions: capacity that exists in practice goes unused, and where ' +
      'the answer is no, the only remedy offered is reinforcement.'),
  ], { noIndent: true }),
  p([
    t('Second, nothing in the framework asks a charge point to respond to the state of the network once it is ' +
      'running. The distinction is worth drawing sharply: the standards and regulations in Tables I and II govern ' +
      'what may be '),
    t('installed', { italics: true }),
    t(', and the load assessment governs what may be '),
    t('connected', { italics: true }),
    t(', but nothing governs what may be '),
    t('drawn at seven in the evening', { italics: true }),
    t('. A compliant 7.4 kW installation is entitled to its full 7.4 kW at the worst possible moment, and in Dubai ' +
      'there is no tariff signal to discourage it. Because charging is a continuous load, wiring practice also sizes ' +
      'a charger’s own circuit at its full rated current rather than a diversified one, which is why each ' +
      'additional charge point consumes headroom so quickly. The street’s transformer is therefore exposed to ' +
      'whatever its customers happen to do simultaneously.'),
  ]),

  h1('Proposed Approach'),
  h2('From a static limit to a dynamic one'),
  p('The proposal is to replace the single up-front question with a continuous one. Instead of asking whether the ' +
    'network could supply every charger at full power simultaneously, a controller asks how much capacity is free at ' +
    'this moment, and guarantees that the chargers it manages never collectively exceed it. Fig. 2 contrasts the two.', { noIndent: true }),
  ...figure('fig2-framework.png', 3.3,
    'Fig. 2.  The change proposed. A static assessment must assume the worst case and so either wastes capacity or refuses a connection; a dynamic limit measures what is actually free and lets chargers share it.'),
  p('This is a familiar idea in network engineering under the name of flexible or managed connection, and its appeal ' +
    'here is that it changes the economics. A transformer that cannot accept ten more unmanaged chargers may well ' +
    'accept thirty managed ones, because the managed set can be held collectively within whatever headroom exists at ' +
    'each moment. Reinforcement is deferred rather than merely delayed, and connections that would have been refused ' +
    'can be approved immediately.', { noIndent: true }),
  h2('How the controller works'),
  p('Fig. 3 shows the arrangement. It touches the network at two points, deliberately in different places: the ' +
    'controller senses at the transformer, through a meter on the low-voltage busbar that reads the whole feeder, ' +
    'but it acts at the charge points, issuing one current limit per point. Nothing between those two points is ' +
    'instrumented and no household appliance is controlled, which is what keeps the scheme deployable. ' +
    'Loading is measured at the transformer; subtracting the charging the controller is ' +
    'itself commanding gives the demand from everything else, and the difference between that and the safe limit is ' +
    'the headroom available. Because this quantity is measured rather than forecast, the controller cannot be wrong ' +
    'about it: it need not know why demand moved, only that it did. That robustness is the main argument for ' +
    'measuring locally rather than scheduling centrally, and it is consistent with findings that local control ' +
    'captures much of the benefit of central optimisation without its communication burden [13].', { noIndent: true }),
  ...figure('fig3-architecture.png', 3.3,
    'Fig. 3.  The controller. Measured headroom is shared among connected vehicles in order of urgency and applied as a current limit at each charge point, with an optional solar canopy and battery adding capacity.'),
  p('The headroom is then shared among connected vehicles. Priority is given to whichever vehicle has least slack — ' +
    'the smallest margin between the time remaining before its declared departure and the time it would need to ' +
    'finish charging at full power. Because that margin is recalculated continuously, a vehicle held back early in ' +
    'the evening rises in priority as its departure approaches, so no vehicle can be indefinitely starved. The ' +
    'quantities required are modest: state of charge, energy needed and intended departure time, all of which the ' +
    'charging session either knows or can be told.', { noIndent: true }),
  h2('Enforcement'),
  p('Allocations are applied through the IEC 61851 control pilot, the signal every compliant charge point already ' +
    'uses to tell a vehicle the maximum current it may draw [11]. Two properties make this the right mechanism. The ' +
    'vehicle is obliged by the standard to respect the advertised limit, so enforcement does not depend on any ' +
    'higher-level protocol or on the vehicle cooperating with a cloud service. And the behaviour degrades safely: if ' +
    'the controller stops issuing instructions, the charge point simply reverts to its default limit. The 6 A floor ' +
    'noted in Table II constrains the allocation directly: a vehicle that cannot be given at least 6 A is paused ' +
    'rather than throttled further, and the scheme therefore pauses sessions in reverse order of urgency rather than ' +
    'spreading an unusably thin allocation across all of them.', { noIndent: true }),
  p('For a networked charge point the same instruction can instead be carried by OCPP, whose Smart Charging profile ' +
    'sets a limit in amperes or watts on an individual point [15]. The routes are complementary — a local controller ' +
    'behind a domestic meter, OCPP for stations already managed centrally — and both end at the same control pilot.'),
  h2('Solar canopy and storage'),
  p('In the UAE the approach pairs naturally with photovoltaics. A shared canopy over residential or station parking ' +
    'generates through the day and, with a battery behind it, can discharge into the evening window when headroom is ' +
    'scarcest, effectively widening the limit the controller has to work within. Dubai already provides a route for ' +
    'this: the Shams Dubai programme connects distributed solar to the network under DEWA’s connection guidelines.', { noIndent: true }),
  p('Two cautions are worth stating plainly. Solar output has largely faded by the time the evening peak arrives, so ' +
    'photovoltaics without storage contribute little at the critical hour; and storage sized for a street shaves a ' +
    'peak rather than removing it. Solar and storage therefore widen the margin the controller manages, and reduce ' +
    'energy cost and emissions, but they do not substitute for coordination. Control remains the element that ' +
    'guarantees the limit is respected.'),
  h2('Supporting measures'),
  p('The dynamic limit is the core proposal, but several smaller measures complement it, and some are worth adopting ' +
    'even on their own.', { noIndent: true }),
  p('Monitoring and early warning. Because the controller already measures loading continuously, the same ' +
    'instrumentation gives the operator something it does not have today: visibility of a load class that currently ' +
    'sits invisible behind the meter. Trends in evening loading identify which transformers are approaching their ' +
    'limits, so reinforcement can be planned where it is genuinely needed rather than discovered after a failure.'),
  p('Randomised and staggered starts. Where direct control is not available, requiring chargers to begin after a ' +
    'short random delay rather than on a shared signal costs nothing and removes the sharp synchronised step that a ' +
    'common tariff hour or a shared application default would otherwise create [7].'),
  p('A time-of-use element in the domestic tariff. Price alone cannot guarantee a limit is respected, and as ' +
    'Section II noted a single shared off-peak hour can make matters worse. A tariff with staggered or smoothly ' +
    'varying bands, however, would give households a reason to accept managed charging and would complement direct ' +
    'control rather than compete with it.'),
  p('Vehicle-to-grid. A connected fleet that can export, rather than merely modulate, would turn the same ' +
    'infrastructure into a source of evening support. This requires bidirectional chargers, compatible vehicles and ' +
    'a settlement framework, so we treat it as a later extension rather than part of the present proposal.'),
  p('A managed-connection category. The regulatory counterpart to all of the above is a connection class assessed ' +
    'against an enforced envelope rather than a nameplate rating, discussed next.'),
  h2('Fit with the existing framework'),
  p('Nothing in this approach requires a change to the instruments in Table I. The equipment remains IEC 61851 ' +
    'compliant and is installed under the same technical regulations; public stations are still approved by DEWA; ' +
    'tariffs are untouched. What changes is the basis of the connection assessment, from a fixed worst case to a ' +
    'measured and enforced envelope. In regulatory terms the natural step is a managed-connection category: a charge ' +
    'point that can demonstrate it will remain within an enforced limit is assessed against that limit rather than ' +
    'against its nameplate rating.', { noIndent: true }),

  h1('Discussion'),
  p('The benefit is spread across three parties, which is unusual and is why the approach is practical. The network ' +
    'operator defers reinforcement capital and gains visibility of a load class currently invisible behind the ' +
    'meter. The customer is connected now rather than after reinforcement, and still leaves with a full battery, ' +
    'because an overnight stop offers far more time than the charging requires. The wider system benefits because a ' +
    'population of managed chargers is by construction de-synchronised, removing the mechanism by which charging ' +
    'could present a step to the grid above.', { noIndent: true }),
  p('This also speaks directly to UN Sustainable Development Goal 9 and its call for resilient infrastructure ' +
    'upgraded for greater resource-use efficiency. Obtaining more transport electrification from distribution assets ' +
    'that already exist is faster, cheaper and less carbon-intensive than replacing them, and the constraint being ' +
    'removed is one that would otherwise slow EV adoption precisely in the dense residential areas where it matters ' +
    'most.'),
  p('An interactive demonstration of the mechanism accompanies this paper in the project repository. It is a ' +
    'teaching model rather than a network study, offered to make the behaviour visible rather than to quantify it.'),

  h1('Limitations and Future Work'),
  p('This paper argues from published sources and from the regulatory framework; it is not a validated network ' +
    'study, and the benefit on any particular feeder would depend on its rating, impedance, customer mix and ' +
    'existing loading. Several questions remain open: declared departure times may be wrong, so the allocation needs ' +
    'a sensible response when a vehicle leaves early; fairness across repeated days must be managed so the same ' +
    'households are not always served last; voltage and phase imbalance can bind before thermal rating and would ' +
    'need constraining alongside loading; and the economic case for a managed-connection category depends on local ' +
    'reinforcement costs we have not estimated. Future work begins with a load-flow study of a representative Dubai ' +
    'feeder and a hardware demonstration of the control pilot loop.', { noIndent: true }),

  h1('Conclusion'),
  p('Electric vehicle charging overloads distribution transformers because it is correlated, not because the energy ' +
    'it requires is unavailable. A car that arrives in the evening and leaves the next morning has far longer ' +
    'available than it needs; the difficulty is that every car wants the same hour. In the UAE the regulatory ' +
    'framework governs equipment, approval and the price of public charging comprehensively, but protects network ' +
    'capacity through a single static assessment, and prices domestic electricity by monthly volume rather than by ' +
    'time of day — so nothing currently spreads domestic charging, and nothing responds when a street draws more ' +
    'than its transformer can take.', { noIndent: true }),
  p('Converting that static limit into a dynamic one closes the gap without new standards or new hardware ' +
    'interfaces. A controller that measures the headroom at the transformer, shares it among vehicles in order of ' +
    'urgency and enforces the result through the IEC 61851 control pilot allows existing assets to host ' +
    'substantially more charging, keeps drivers supplied, and can be supported in the UAE by solar generation and ' +
    'storage. The infrastructure for a largely electric fleet is, to a significant extent, already in the ground; ' +
    'what is missing is the coordination to use it.'),

  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 },
    children: [t('References', { small: true })] }),
];

const REFS = [
  'International Energy Agency, Global EV Outlook 2025. Paris: IEA, 2025. [Online]. Available: https://www.iea.org/reports/global-ev-outlook-2025',
  'United Arab Emirates Government, "National Electric Vehicles Policy." [Online]. Available: https://u.ae/en/about-the-uae/strategies-initiatives-and-awards/policies/transport-and-infrastructure/national-electric-vehicles-policy',
  'Ministry of Energy and Infrastructure, "Minister of Energy and Infrastructure outlines details of the National Electric Vehicles Policy," 13 July 2023. [Online]. Available: https://www.moei.gov.ae',
  '"Coincidence factors for domestic EV charging from driving and plug-in behaviour," Technical University of Denmark. [Online]. Available: https://orbit.dtu.dk',
  'Dubai Electricity and Water Authority, Annual Statistics 2025. Dubai: DEWA, 2026. [Online]. Available: https://www.dewa.gov.ae',
  'T. Barbosa et al., "Use of EV hosting capacity for management of low-voltage distribution systems," IET Generation, Transmission & Distribution, vol. 14, no. 14, 2020.',
  '"Achieving reliable coordination of residential plug-in electric vehicle charging: a pilot study," arXiv:2112.04559. [Online]. Available: https://arxiv.org/abs/2112.04559',
  'Dubai Electricity and Water Authority, "EV charging — tariffs and EV Green Charger FAQ," implementing Cabinet Decision No. 81 of 2024, effective 30 September 2024. [Online]. Available: https://www.dewa.gov.ae/en/consumer/ev-community',
  'Dubai Electricity and Water Authority, "Slab tariff." [Online]. Available: https://www.dewa.gov.ae/en/consumer/billing/slab-tariff',
  'Dubai Electricity and Water Authority, EV Charging Technical Regulations, Version 1. [Online]. Available: https://www.dewa.gov.ae',
  'Electric vehicle conductive charging system — Part 1: General requirements, IEC 61851-1:2017, International Electrotechnical Commission, 2017.',
  'Dubai Electricity and Water Authority, Regulations for Electrical Installations, 2017 edition. [Online]. Available: https://www.dewa.gov.ae',
  'P. Richardson, D. Flynn and A. Keane, "Local versus centralized charging strategies for electric vehicles in low voltage distribution systems," IEEE Trans. Smart Grid, vol. 3, no. 2, pp. 1020–1028, Jun. 2012.',
  'Plugs, socket-outlets, vehicle connectors and vehicle inlets — conductive charging of electric vehicles, IEC 62196, International Electrotechnical Commission.',
  'Open Charge Alliance, Open Charge Point Protocol (OCPP) 1.6J and 2.0.1, Smart Charging profile. [Online]. Available: https://www.openchargealliance.org',
];

const refParas = REFS.map((r, i) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 40, line: 240 },
  indent: { left: convertInchesToTwip(0.22), hanging: convertInchesToTwip(0.22) },
  children: [t(`[${i + 1}]\t${r}`, { size: 15 })],
}));

/* ==================================================================== doc */
const PAGE = {
  size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
  margin: {
    top: convertInchesToTwip(0.75), bottom: convertInchesToTwip(1.0),
    left: convertInchesToTwip(0.625), right: convertInchesToTwip(0.625),
  },
};

const doc = new Document({
  creator: 'Rithikh Chandran',
  title: 'Intelligent EV Charging Management to Prevent Power Overloads',
  styles: { default: { document: { run: { font: SERIF, size: 20 } } } },
  sections: [
    { properties: { page: PAGE, column: { count: 1 } }, children: titleBlock },
    {
      properties: { type: SectionType.CONTINUOUS, page: PAGE, column: { count: 2, space: convertInchesToTwip(0.2), equalWidth: true } },
      children: [...body, ...refParas],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, process.env.OUT || 'Intelligent-EV-Charging-Management.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote', path.basename(out), (buf.length / 1024).toFixed(0) + ' KB');
});

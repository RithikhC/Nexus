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

/* References are keyed, not numbered. C('key') returns '[n]', numbering each
 * source on its first use, so the list below comes out in IEEE citation order
 * however the text is later rearranged. REFS is built from that order. */
const REF_TEXT = {
  gevo25: 'International Energy Agency, Global EV Outlook 2025. Paris: IEA, 2025. [Online]. Available: https://www.iea.org/reports/global-ev-outlook-2025',
  uaePolicy: 'United Arab Emirates Government, "National Electric Vehicles Policy." [Online]. Available: https://u.ae/en/about-the-uae/strategies-initiatives-and-awards/policies/transport-and-infrastructure/national-electric-vehicles-policy',
  moei: 'Ministry of Energy and Infrastructure, "Minister of Energy and Infrastructure outlines details of the National Electric Vehicles Policy," 13 July 2023. [Online]. Available: https://www.moei.gov.ae',
  ieaV2G: 'International Energy Agency, "Vehicle-to-grid technology," Global EV Outlook 2026, IEA, Paris, 20 May 2026. [Online]. Available: https://www.iea.org/reports/vehicle-to-grid-technology',
  dtu: '"Coincidence factors for domestic EV charging from driving and plug-in behaviour," Technical University of Denmark. [Online]. Available: https://orbit.dtu.dk',
  pnnl: 'R. M. Pratt and L. E. Bernal, "Distribution System V1G PEV Charging Impacts Report," Pacific Northwest National Laboratory, Richland, WA, USA, Rep. PNNL-27206, Jan. 2018.',
  mea: 'EA Technology, "My Electric Avenue: driving together for a cleaner future," Project Summary Report, Ofgem Low Carbon Networks Fund, 2015. [Online]. Available: https://eatechnology.com',
  dewaStats: 'Dubai Electricity and Water Authority, Annual Statistics 2025. Dubai: DEWA, 2026. [Online]. Available: https://www.dewa.gov.ae',
  barbosa: 'T. Barbosa et al., "Use of EV hosting capacity for management of low-voltage distribution systems," IET Generation, Transmission & Distribution, vol. 14, no. 14, 2020.',
  touPilot: '"Achieving reliable coordination of residential plug-in electric vehicle charging: a pilot study," arXiv:2112.04559. [Online]. Available: https://arxiv.org/abs/2112.04559',
  dewaTariff: 'Dubai Electricity and Water Authority, "EV charging — tariffs and EV Green Charger FAQ," implementing Cabinet Decision No. 81 of 2024, effective 30 September 2024. [Online]. Available: https://www.dewa.gov.ae/en/consumer/ev-community',
  dewaSlab: 'Dubai Electricity and Water Authority, "Slab tariff." [Online]. Available: https://www.dewa.gov.ae/en/consumer/billing/slab-tariff',
  dewaEVReg: 'Dubai Electricity and Water Authority, EV Charging Technical Regulations, Version 1. [Online]. Available: https://www.dewa.gov.ae',
  iec61851: 'Electric vehicle conductive charging system — Part 1: General requirements, IEC 61851-1:2017, International Electrotechnical Commission, 2017.',
  dewaInstall: 'Dubai Electricity and Water Authority, Regulations for Electrical Installations, 2017 edition. [Online]. Available: https://www.dewa.gov.ae',
  richardson: 'P. Richardson, D. Flynn and A. Keane, "Local versus centralized charging strategies for electric vehicles in low voltage distribution systems," IEEE Trans. Smart Grid, vol. 3, no. 2, pp. 1020–1028, Jun. 2012.',
  iec62196: 'Plugs, socket-outlets, vehicle connectors and vehicle inlets — conductive charging of electric vehicles, IEC 62196, International Electrotechnical Commission.',
  ocpp: 'Open Charge Alliance, Open Charge Point Protocol (OCPP) 1.6J and 2.0.1, Smart Charging profile. [Online]. Available: https://www.openchargealliance.org',
  aiCharter: 'United Arab Emirates Government, "The UAE Charter for the Development and Use of Artificial Intelligence." [Online]. Available: https://u.ae/en/about-the-uae/strategies-initiatives-and-awards/policies/Ai',
  dewaAI: 'Dubai Electricity and Water Authority, "DEWA deploys AI in energy distribution to enhance network efficiency and service reliability," July 2025. [Online]. Available: https://www.dewa.gov.ae',
  iec60076: 'Power transformers — Part 7: Loading guide for mineral-oil-immersed power transformers, IEC 60076-7:2018, International Electrotechnical Commission, 2018.',
  wmoDubai: 'World Meteorological Organization, climate normals 1991–2020 for Dubai International Airport, compiled from data supplied by the UAE National Center of Meteorology.',
  geD400: 'GE Vernova, "D400-DA substation gateway with distribution automation," product documentation. [Online]. Available: https://www.gevernova.com/grid-solutions/automation/substation-solutions/d400-da-legacy',
  oracleNms: 'Oracle, "Setting the System FLISR Mode," Oracle Utilities Network Management System User Guide, release 25.12. [Online]. Available: https://docs.oracle.com/en/industries/energy-water/network-management-system',
  dnp3: 'IEEE Standard for Electric Power Systems Communications — Distributed Network Protocol (DNP3), IEEE Std 1815, Institute of Electrical and Electronics Engineers.',
  iec104: 'Telecontrol equipment and systems — Part 5-104: Transmission protocols — Network access for IEC 60870-5-101 using standard transport profiles, IEC 60870-5-104, International Electrotechnical Commission.',
  iec61968: 'Application integration at electric utilities — System interfaces for distribution management, IEC 61968, International Electrotechnical Commission.',
};
const _refOrder = [];
const C = (key) => {
  if (!REF_TEXT[key]) throw new Error('unknown reference key: ' + key);
  if (!_refOrder.includes(key)) _refOrder.push(key);
  return `[${_refOrder.indexOf(key) + 1}]`;
};

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
  'Electricity distribution networks are planned on diversity: the assumption that the loads on a feeder do not ' +
  'reach their maxima at the same moment. Electric vehicle charging weakens that assumption wherever charge ' +
  'points cluster — a street, a block, a workplace car park, a depot or a public hub — because each point is ' +
  'large against the demand already at the site, and because vehicles arrive within the same narrow window. The ' +
  'transformer then carries far more than it was sized for, ageing faster and eventually failing. The published ' +
  'thresholds are low: modelling for the US Department of Energy puts distribution transformer limits as exceeded ' +
  'at roughly 0.75 vehicles per dwelling at 6.6 kW charging, and a British trial projected that 32% of ' +
  'low-voltage feeders would need reinforcement at 40% to 70% uptake. We examine this in the United Arab ' +
  'Emirates, where policy targets half the fleet electrified by 2050, and identify a specific gap: capacity is ' +
  'protected by a static assessment made once before connection, and charging behind the meter is priced by ' +
  'monthly volume rather than by time of day, so nothing spreads it. We propose converting that static limit ' +
  'into a dynamic one. A controller measures the headroom at the transformer, allocates it among connected ' +
  'vehicles by how little time each has before departure, and applies the result on the IEC 61851 control pilot. ' +
  'Above it, an advisory layer proposes network actions that only take effect once an operator approves them. ' +
  'Existing assets can then host substantially more charging, within the framework already in force.';

const KEYWORDS = 'Electric vehicles, smart grid, charging management, power distribution, demand diversity, DEWA, SDG 9.';

/* ============================================================== the body */
const body = [
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 240 },
    children: [t('Abstract—', { bold: true, italics: true, size: 18 }), t(ABSTRACT, { size: 18, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 240 },
    children: [t('Keywords—', { bold: true, italics: true, size: 18 }), t(KEYWORDS, { size: 18, bold: true })] }),

  h1('Introduction'),
  p('Electric vehicles are arriving faster than the networks that must supply them. Global sales passed a fifth of all ' +
    'new cars in 2024 and are projected above 40% by 2030 ' + C('gevo25') + '. The United Arab Emirates has set out a National ' +
    'Electric Vehicles Policy with the aim of half the vehicles on its roads being electric by 2050, alongside a ' +
    'substantial reduction in transport energy use ' + C('uaePolicy') + ', ' + C('moei') + '.', { noIndent: true }),
  p('The difficulty is not generating the energy. It is that charging concentrates demand at the weakest point of ' +
    'the system — the low-voltage feeder serving the site — and concentrates it at the hour when that feeder is ' +
    'already busiest. The setting varies and so does the hour: a residential street peaks when people return, a ' +
    'workplace car park when they arrive, a depot at shift end. The mechanism does not vary. ' +
    'This paper sets out why that happens, how large the problem is likely to become in the UAE, ' +
    'what the current regulatory framework does and does not address, and a practical way to close the gap that ' +
    'requires no new standard and no new hardware interface.'),

  h1('Why Charging Stresses Distribution Networks'),
  h2('Networks are planned on diversity'),
  p('A distribution transformer is never sized for the sum of what its customers could draw. It is sized on ' +
    'diversity: the long-standing observation that connected loads reach their individual maxima at different ' +
    'moments, so a transformer serving many of them never has to supply many simultaneous maxima. Diversity is the ' +
    'reason a feeder rated far below its connected load has served streets, blocks and car parks reliably for ' +
    'decades, and it is assumed throughout network planning practice.', { noIndent: true }),
  p('That assumption is weaker in the Gulf. Demand here is dominated by air conditioning, which every connected ' +
    'customer runs against the same outdoor temperature, so a network whose load is largely thermal begins with ' +
    'less of the diversity that sizing depends on — before any vehicle is plugged in.'),
  h2('Charging weakens the assumption in two ways'),
  p('First by size. A charge point is not a marginal addition to the site it serves. Charging can draw more power ' +
    'than any other single load behind the same connection ' + C('ieaV2G') + ': a 7.4 kW single-phase point is comparable ' +
    'to the entire existing demand of the dwelling, unit or bay it supplies, and a 22 kW three-phase point or a DC ' +
    'rapid charger exceeds it several times over. No load has arrived at this size and this density together, and ' +
    'the network was not planned for it.', { noIndent: true }),
  p('Second, and more importantly, by correlation. Charging is not independent between connection points. Vehicles ' +
    'reach a site within the same narrow window — commuters returning, staff arriving, a fleet back at depot — and ' +
    'plug in on arrival, so the points switch on together, and they do so when that site is already at its own ' +
    'peak. Fig. 1 shows the shape of the problem: the dashed line is a feeder without electric vehicles, ' +
    'comfortably inside its limit, and the solid line is the same feeder once charging is added on top.'),
  ...figure('fig1-mechanism.png', 2.9,
    'Fig. 1.  Why clustered arrivals are the difficulty. Charging lands on top of the site’s own peak rather than in the quiet hours, even though the energy could be delivered at any point while the vehicles are parked. A residential street peaks when people return, a workplace car park when they arrive, a depot at shift end — only the hour changes. Schematic.'),
  p('Measured coincidence factors for charging do fall as fleets grow, because arrivals spread over several hours ' +
    C('dtu') + '. That is an average over a large population, and it is the wrong statistic for the problem at hand. A ' +
    'transformer does not serve an average; it serves one site of perhaps twenty to forty connection points, where ' +
    'the law of large numbers is weak, charge point power is high, and coincidence rises sharply whenever arrivals ' +
    'cluster. The system-wide figure can improve while individual feeders fail.', { noIndent: true }),

  h2('The thresholds are far lower than intuition suggests'),
  p('It is tempting to treat this as a problem for the 2040s. The published thresholds do not support that. ' +
    'Modelling of prototypical feeders for the US Department of Energy found that charging at 6.6 kW exceeds ' +
    'distribution transformer power limits ' +
    'once adoption reaches about 0.75 vehicles per dwelling ' + C('pnnl') + '. The same study found the threshold falls to ' +
    'roughly 0.25 at 19.2 kW, because feeder loading is directly proportional to charging rate: faster points do ' +
    'not shift the problem forward, they multiply it. That study expresses its threshold per dwelling because it ' +
    'modelled residential feeders, but the quantity that governs is the ratio of connected charge point power to ' +
    'the transformer’s rating — so the threshold is reached with proportionally fewer points wherever those points ' +
    'are larger, as they are at workplace, depot and public sites.', { noIndent: true }),
  p('The proportion of the network involved is not marginal either. My Electric Avenue, an Ofgem-funded trial on ' +
    'real British low-voltage circuits, projected that 32% of feeders — some 312,000 circuits — would require ' +
    'intervention once 40% to 70% of customers have electric vehicles, at a reinforcement cost of around ' +
    '£2.2 billion to 2050 ' + C('mea') + '. Roughly a third of a mature national network, driven by one new load.'),

  p('Both studies were conducted in temperate climates, which makes their figures optimistic here rather than ' +
    'conservative. A transformer’s rating is defined at a reference ambient, and IEC 60076-7 relates load, ' +
    'ambient temperature and the rate at which insulation ages ' + C('iec60076') + '. WMO normals for Dubai International ' +
    'give an August mean daily maximum of 41.9 °C and a mean minimum of 31.5 °C ' + C('wmoDubai') + ': the overnight low ' +
    'here approaches the daytime high where those thresholds were measured, and because cooling runs against it ' +
    'continuously, the quiet period into which charging must be moved is shallower too.'),
  h2('What is coming, and at what scale'),
  p('Dubai’s peak demand reached 11,391 MW in 2025, about 5.8% above the previous year ' + C('dewaStats') + ' — growth driven ' +
    'by population and economic activity, before any significant electrification of transport. Against ' +
    'this, national policy targets half the vehicle fleet electrified by 2050 ' + C('uaePolicy') + '. If those vehicles charge ' +
    'on arrival, the additional demand does not spread itself across the day: it lands in a narrow window at each ' +
    'site, on thousands of low-voltage feeders.', { noIndent: true }),
  p('The consequences differ by scale. Locally, sustained overloading is first a thermal problem and only later a ' +
    'visible one: insulation ageing accelerates sharply with winding temperature, so repeated excursions consume ' +
    'transformer life for months or years before anything is noticed, and the failure, when it comes, arrives ' +
    'without warning and takes every customer behind it with it. The asset is degraded silently and paid for ' +
    'twice, once in shortened life and once in unplanned replacement. Hosting capacity also varies ' +
    'enormously between feeders, so the constraint binds unevenly and unpredictably: a meaningful fraction of ' +
    'low-voltage networks cannot accept significant charging without a limit being violated ' + C('barbosa') + ', and the ' +
    'utility generally cannot tell which feeders those are until something gives.'),
  p('At system scale the bar is higher. A power system holds reserve against the loss of its largest generating ' +
    'unit, and a sudden demand step is equivalent to such a loss — but ordinary arrivals produce a ramp, which ' +
    'generation follows comfortably. What produces a step is a common control signal reaching many vehicles at ' +
    'once: a shared off-peak tariff hour, a default start time distributed by an application, or restoration ' +
    'after an outage. The IEA notes that static time-of-use tariffs can lead many vehicles to charge at the same ' +
    'moment, worsening grid impacts relative to leaving charging uncontrolled ' + C('ieaV2G') + ', and pilot measurements ' +
    'agree ' + C('touPilot') + ': an instrument meant to relieve the network can damage it. Both scales share one ' +
    'mechanism, coincidence, and differ only in what causes it.'),

  h1('The Regulatory Framework in the UAE'),
  p('Charging in the UAE is already governed by a layered framework, and any practical proposal has to sit inside it. ' +
    'This section sets out what is in force, then identifies what it leaves open.', { noIndent: true }),
  h2('Policy'),
  p('The UAE Cabinet approved the National Electric Vehicles Policy in 2023. It directs federal and local authorities ' +
    'and the private sector to build a national charging network, provides for a central database of charging ' +
    'stations, and sets the 2050 target of half the fleet electrified together with a large reduction in transport ' +
    'energy use ' + C('uaePolicy') + ', ' + C('moei') + '. Implementation includes UAEV, a joint venture tasked with deploying chargers ' +
    'nationally.', { noIndent: true }),
  h2('Tariffs'),
  p('Public charging is priced under Cabinet Decision No. 81 of 2024. From 30 September 2024, registered users of ' +
    'DEWA’s EV Green Charger service pay AED 0.70 per kWh plus VAT for alternating-current charging and AED 1.20 per ' +
    'kWh plus VAT for direct-current charging ' + C('dewaTariff') + '.', { noIndent: true }),
  p('Domestic charging is treated differently, and the difference matters. Electricity used to charge a vehicle at ' +
    'home is added to the ordinary DEWA bill at standard residential rates ' + C('dewaTariff') + '. Those rates are a slab tariff ' +
    'banded by monthly consumption, rising from AED 0.23 per kWh to 0.38 above 6,000 kWh a month ' + C('dewaSlab') + '. The ' +
    'bands depend on how much a customer uses, not on when they use it.'),
  p('The consequence is direct: nothing in Dubai today would move charging behind a customer’s meter away from the ' +
    'hours it is least wanted. A kilowatt-hour costs the same at 19:00 as at 03:00, so the off-peak timer — the ' +
    'main mitigation in markets with time-of-use tariffs — is unavailable here, and as Section II noted it ' +
    'replaces a diverse peak with a synchronised one where it is available.'),
  h2('Technical and connection regulation'),
  p('DEWA’s EV Charging Technical Regulations require that charging installations follow the IET Code of Practice ' +
    'for electric vehicle charging equipment installation and BS 7671, with EV charge points also addressed in the ' +
    'Dubai Building Code ' + C('dewaEVReg') + '. Any organisation or developer must obtain DEWA approval before establishing, ' +
    'installing, operating or maintaining a charging station. Equipment itself follows IEC 61851, the international ' +
    'standard for conductive charging, whose control pilot allows a charge point to advertise the maximum current a ' +
    'vehicle may draw ' + C('iec61851') + '.', { noIndent: true }),
  p('Those equipment standards are worth stating precisely, because they set the envelope any controller must work ' +
    'inside. IEC 61851-1 defines the charging modes and the control pilot, the low-voltage signal by which a charge ' +
    'point tells a vehicle the maximum current it may draw. The pilot encodes that limit as a duty cycle: between 6 A ' +
    'and 51 A the available current is 0.6 times the duty cycle in per cent, and above that a second relation extends ' +
    'the range to 80 A ' + C('iec61851') + '. Two values matter for control. The ceiling is 80 A, and the floor is 6 A — below it the ' +
    'pilot cannot express a limit at all, so a session must be paused rather than slowed further. Table II collects ' +
    'the limits that follow.', { noIndent: true }),
  ...table('Table II. Technical limits set by the standards',
    ['Layer', 'Standard', 'Limit'],
    [
      ['Charging mode', 'IEC 61851-1 ' + C('iec61851') + '', 'Mode 3 for dedicated AC\nequipment; Mode 4 for DC'],
      ['Current signalling', 'IEC 61851-1\ncontrol pilot ' + C('iec61851') + '', '6 A minimum, 80 A maximum;\n6–51 A as 0.6 × duty cycle'],
      ['Connector', 'IEC 62196 ' + C('iec62196') + '', 'Type 2 to 63 A; CCS for DC'],
      ['Common ratings', 'from supply voltage', '7.4 kW at 230 V, 32 A;\n11 and 22 kW three-phase'],
      ['Remote limit setting', 'OCPP 1.6J / 2.0.1\nSmart Charging ' + C('ocpp') + '', 'charging profile in amperes\nor watts, set by the operator'],
    ], 3.3),
  p('Network capacity is protected by DEWA’s Regulations for Electrical Installations. Installation details are ' +
    'submitted for prior approval, distribution boards are rated on total connected load before any demand factor ' +
    'is applied, and DEWA inspects and approves before supply is connected; extensions require approval in the ' +
    'same way ' + C('dewaInstall') + '. Home chargers sit behind the customer’s meter and are installed much as any other ' +
    'appliance ' + C('dewaEVReg') + '.'),
  h2('What the framework leaves open'),
  p('Taken together, the instruments in Table I cover safety, equipment standards, approval of public infrastructure ' +
    'and the price of public charging thoroughly. Two things they do not do are the subject of this paper.', { noIndent: true }),
  ...table('Table I. Instruments in force, and what each does not address',
    ['Instrument', 'What it governs', 'What it leaves open'],
    [
      ['National Electric Vehicles\nPolicy (2023) ' + C('uaePolicy') + ', ' + C('moei') + '', 'National charger rollout,\ncentral station database,\n2050 fleet target',
        'How simultaneous demand\nis managed on existing\nlow-voltage networks'],
      ['Cabinet Decision No. 81\nof 2024 ' + C('dewaTariff') + '', 'Public charging tariffs:\nAED 0.70/kWh AC,\nAED 1.20/kWh DC',
        'Applies to public charging;\nnot a time-of-day signal'],
      ['DEWA slab tariff ' + C('dewaSlab') + '', 'Residential energy price,\nbanded by monthly volume',
        'No time-of-use element, so\nno incentive to shift\ncharging off the peak'],
      ['DEWA EV Charging\nTechnical Regulations ' + C('dewaEVReg') + '', 'Equipment standards, IET\nand BS 7671 compliance,\napproval of stations',
        'Does not require a station\nto respond to network\nconditions once running'],
      ['DEWA Regulations for\nElectrical Installations ' + C('dewaInstall') + '', 'Load schedules, prior\napproval, inspection before\nconnection',
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
    t('drawn the moment they all arrive', { italics: true }),
    t('. A compliant 7.4 kW installation is entitled to its full 7.4 kW at the worst possible moment, and in Dubai ' +
      'there is no tariff signal to discourage it. Because charging is a continuous load, wiring practice also sizes ' +
      'a charger’s own circuit at its full rated current rather than a diversified one, which is why each ' +
      'additional charge point consumes headroom so quickly. The transformer is therefore exposed to whatever ' +
      'its customers happen to do at the same moment.'),
  ]),
  p('One further instrument matters here, because the approach proposed below places a decision-support system ' +
    'inside a utility workflow. The UAE Charter for the Development and Use of Artificial Intelligence sets out ' +
    'human oversight as an explicit priority, emphasising "the irreplaceable value of human judgment and human ' +
    'oversight over AI" as the means of correcting errors and biases, alongside priorities on transparency and on ' +
    'governance and accountability ' + C('aiCharter') + '. A design in which an algorithm recommends and a named operator ' +
    'decides is therefore not a concession to caution but the arrangement the national framework asks for. DEWA ' +
    'has meanwhile deployed artificial intelligence in energy distribution to improve network efficiency and ' +
    'service reliability ' + C('dewaAI') + ', so the institutional route for a tool of this kind already exists.'),

  h1('Proposed Approach'),
  h2('From a static limit to a dynamic one'),
  p('The proposal is to replace the single up-front question with a continuous one. Instead of asking whether the ' +
    'network could supply every charger at full power simultaneously, a controller asks how much capacity is free at ' +
    'this moment, and guarantees that the chargers it manages never collectively exceed it. Fig. 2 contrasts the ' +
    'two.', { noIndent: true }),
  ...figure('fig2-framework.png', 2.9,
    'Fig. 2.  The change proposed. A static assessment must assume the worst case and so either wastes capacity or refuses a connection; a dynamic limit measures what is actually free and lets chargers share it.'),
  p('This is the flexible or managed connection, familiar in network engineering, and its appeal here is economic: ' +
    'a transformer that cannot accept ten more unmanaged points may well accept thirty managed ones, because the ' +
    'managed set is held collectively within whatever headroom exists. Reinforcement is deferred rather than ' +
    'delayed, and connections that would have been refused can be approved now.', { noIndent: true }),

  h2('What this adds to existing practice'),
  p('Parts of this are not new, and it is worth saying so. Least-laxity-first scheduling is standard, and ' +
    'controlling charging against a low-voltage feeder limit was demonstrated by the Esprit system in the My ' +
    'Electric Avenue trial a decade ago ' + C('mea') + ': it worked, and it did not become ordinary practice. Load ' +
    'management is not unusual either — products sold today measure a site’s incoming supply and share what is ' +
    'left among its points. But what those manage is one customer’s own connection, and that is a different ' +
    'boundary from the one that binds: twenty customers can each stay inside their own supply while the ' +
    'transformer they share goes over, because none of them measures it and none has standing to act on it. The ' +
    'contribution is therefore threefold. The constraint is the shared transformer rather than the site. ' +
    'Judgements about the asset are escalated to a named operator with a projection scored afterwards, which we ' +
    'are not aware of any load-management product doing. And the regulatory counterpart, a managed-connection ' +
    'class, is what turns the capability into capacity a utility can award. None of this requires changing the ' +
    'instruments in Table I: the equipment stays IEC 61851 compliant under the same regulations, public stations ' +
    'are still approved by DEWA, and tariffs are untouched. Only the basis of the connection assessment changes.',
    { noIndent: true }),

  h2('How the controller works'),
  p('Fig. 3 shows the arrangement. It touches the network at two points, deliberately in different places: the ' +
    'controller senses at the transformer, through a meter on the low-voltage busbar that reads the whole feeder, ' +
    'but it acts at the charge points, issuing one current limit per point. Nothing between those two points is ' +
    'instrumented, and no load other than charging is controlled — not an appliance, not a tenant’s cooling, ' +
    'not a building’s plant. That restraint is what keeps the scheme deployable. ' +
    'Loading is measured at the transformer; subtracting the charging the controller is ' +
    'itself commanding gives the demand from everything else, and the difference between that and the safe limit is ' +
    'the headroom available. Because this quantity is measured rather than forecast, the controller cannot be wrong ' +
    'about it: it need not know why demand moved, only that it did. That robustness is the main argument for ' +
    'measuring locally rather than scheduling centrally, and it is consistent with findings that local control ' +
    'captures much of the benefit of central optimisation without its communication burden ' + C('richardson') + '.', { noIndent: true }),
  ...figure('fig3-architecture.png', 2.9,
    'Fig. 3.  The two loops. Below the line the protection loop runs every minute and never waits for a decision: measured headroom is shared among connected vehicles in order of urgency and applied as a current limit at each charge point. Above it the advisory layer works across whole days, proposing ranked options that only take effect once an operator approves them. The approved policy is the sole path from one into the other.'),
  p('The headroom is then shared among connected vehicles. Priority is given to whichever vehicle has least slack — ' +
    'the smallest margin between the time remaining before its declared departure and the time it would need to ' +
    'finish charging at full power. Because that margin is recalculated continuously, a vehicle held back early in ' +
    'the arrival peak rises in priority as its departure approaches, so no vehicle can be indefinitely starved. The ' +
    'quantities required are modest: state of charge, energy needed and intended departure time, all of which the ' +
    'charging session either knows or can be told.', { noIndent: true }),
  h2('Enforcement'),
  p('Allocations are applied through the IEC 61851 control pilot, the signal every compliant charge point already ' +
    'uses to tell a vehicle the maximum current it may draw ' + C('iec61851') + '. Two properties make this the right mechanism. The ' +
    'vehicle is obliged by the standard to respect the advertised limit, so enforcement does not depend on any ' +
    'higher-level protocol or on the vehicle cooperating with a cloud service. And the behaviour degrades safely: if ' +
    'the controller stops issuing instructions, the charge point simply reverts to its default limit. The 6 A floor ' +
    'noted in Table II constrains the allocation directly: a vehicle that cannot be given at least 6 A is paused ' +
    'rather than throttled further, and the scheme therefore pauses sessions in reverse order of urgency rather than ' +
    'spreading an unusably thin allocation across all of them.', { noIndent: true }),
  p('For a networked charge point the same instruction can instead be carried by OCPP, whose Smart Charging profile ' +
    'sets a limit in amperes or watts on an individual point ' + C('ocpp') + '. The routes are complementary — a local controller ' +
    'behind a single customer’s meter, OCPP where a site or operator is already managed centrally — and both end ' +
    'at the same control pilot.'),
  h2('A decision layer, with a human holding the pen'),
  p('Holding a feeder under its limit is necessary but not sufficient. A controller that quietly absorbs a ' +
    'worsening problem is also concealing it: no alarm sounds, the asset ages, and the first visible sign is a ' +
    'failure. The utility also needs a judgement about what to do next — tighten the cap, recruit the points still ' +
    'outside the scheme, or accept that this unit warrants inspection and reinforcement. Those are decisions about ' +
    'capital, customers and risk, and they are not the controller’s to make.', { noIndent: true }),
  p('We therefore separate the system into two loops running on different clocks, shown above and below the line in ' +
    'Fig. 3. The protection loop is deterministic, acts every minute and never waits for authorisation: a ' +
    'transformer cannot be left overloaded while an operator is away from the desk. Above it sits a layer that ' +
    'touches no charger at all. It reads completed days and identifies the pattern — how often the limit was ' +
    'approached, what share of the load was beyond the controller’s reach, whether the trend is worsening — and ' +
    'presents the operator with a small set of ranked options. Each carries the reasoning behind it, a projected ' +
    'effect, the cost and lead time, and the risk of taking it. Nothing is applied until a person approves it, and ' +
    'an approval changes only the policy the protection loop then enforces.'),
  p('Two properties make this more than a confirmation dialogue. It must be able to say when an option will not ' +
    'help: if most of the excess is drawn by points never enrolled, no cap can reach it, and saying so is more ' +
    'useful than proposing it. And every projection is recorded and later compared with what happened, so the ' +
    'operator can see whether the system has been reliable before trusting its next suggestion, while the layer ' +
    'corrects its own estimates by that error. A recommender that cannot be audited is of little use for a ' +
    'decision about an asset of this value.'),
  p('None of this is a novel interaction. Restoration functions in an advanced distribution management system are ' +
    'already commissioned this way: GE Vernova’s D400-DA, in Operator Assisted Mode, "will first ask for ' +
    'confirmation from the operator before taking any action", and if the operator disagrees it "will calculate ' +
    'the next optimal scenario and propose that to the operator" ' + C('geD400') + '; Oracle’s network management system ' +
    'offers the equivalent manual mode ' + C('oracleNms') + '. Utilities commonly run such functions operator-assisted ' +
    'first and move to automatic only once confidence has been earned. We propose the same arrangement for a ' +
    'decision the industry does not currently make at all.'),
  p('The signal path is equally conventional, which matters because nothing here needs a new interface. ' +
    'Transformer loading already reaches a control centre over DNP3, standardised as IEEE 1815 ' + C('dnp3') + ', or ' +
    'IEC 60870-5-104 ' + C('iec104') + ', with IEC 61850 inside the substation. The advisory function would sit in the ADMS ' +
    'beside FLISR, exchanging data through the IEC 61968 Common Information Model ' + C('iec61968') + ' — an ' +
    'application-level layer, not an extension of those telecontrol protocols. The approved limit then travels ' +
    'outward as an OCPP profile applied on the IEC 61851-1 pilot. Every link is already deployed.'),
  p('The division also answers the obvious objection — who is accountable when it is wrong. The automatic part is ' +
    'bounded, deterministic and does only what the standards already permit a charge point to be told; every ' +
    'discretionary judgement is logged against the person who made it.'),

  h2('Solar canopy and storage'),
  p('The approach pairs naturally with photovoltaics, for which Dubai provides a route in the Shams Dubai ' +
    'programme: a shared canopy with a battery can discharge when headroom is scarcest. Two cautions, though. ' +
    'Solar output has often faded by the time arrivals cluster, and storage sized for one site shaves a peak ' +
    'rather than removing it. Both widen the margin; neither substitutes for coordination.', { noIndent: true }),
  h2('Supporting measures'),
  p([
    t('The dynamic limit is the core proposal, but several smaller measures complement it and some are worth ' +
      'adopting on their own. '),
    t('Monitoring and early warning:', { italics: true }),
    t(' the same instrumentation gives the operator visibility of a load class that today sits invisible behind ' +
      'the meter, so reinforcement is planned where trends show it is needed rather than discovered after a ' +
      'failure. '),
    t('Randomised starts:', { italics: true }),
    t(' where direct control is unavailable, beginning after a short random delay rather than on a shared signal ' +
      'costs nothing and removes the synchronised step a common tariff hour would create ' + C('touPilot') + '. '),
    t('A time-of-use element:', { italics: true }),
    t(' price alone cannot guarantee a limit, and a single shared off-peak hour makes matters worse, but ' +
      'staggered bands would give customers a reason to accept managed charging. '),
    t('Vehicle-to-grid:', { italics: true }),
    t(' a fleet that can export rather than merely modulate would become network support, though this needs ' +
      'bidirectional chargers and a settlement framework, so we treat it as a later extension. '),
    t('A managed-connection category:', { italics: true }),
    t(' the regulatory counterpart to all of the above, discussed next.'),
  ], { noIndent: true }),
  h1('Discussion'),
  p('The benefit is spread across three parties, which is why the approach is practical. The operator defers ' +
    'reinforcement capital and gains sight of a load class currently invisible behind the meter. The customer ' +
    'connects now rather than after reinforcement and still leaves charged, because the time parked exceeds the ' +
    'time needed. The wider system benefits because a managed population is, by construction, de-synchronised.',
    { noIndent: true }),
  p('This speaks directly to UN Sustainable Development Goal 9 and its call for infrastructure upgraded for greater ' +
    'resource-use efficiency: getting more electrification from assets already in the ground is faster, cheaper ' +
    'and less carbon-intensive than replacing them.'),
  p('An interactive demonstration accompanies this paper in the project repository: a teaching model of one ' +
    'street, offered to make the behaviour visible rather than to quantify it.'),


  h1('Limitations and Future Work'),
  p('This paper argues from published sources and the regulatory framework; it is not a validated network study, ' +
    'and the benefit on any feeder depends on its rating, impedance, customer mix and loading. Questions remain ' +
    'open: declared departure times may be wrong; fairness must be managed so the same customers are not always ' +
    'last; voltage and phase imbalance can bind before thermal rating; and the economics of a managed-connection ' +
    'class depend on reinforcement costs we have not estimated. Future work begins with a load-flow study of a ' +
    'representative Dubai feeder, at measured ambient temperatures rather than a reference value, and a hardware ' +
    'demonstration of the pilot loop.', { noIndent: true }),
  p('The advisory layer should be described accurately. It is a transparent recommender: it derives its options ' +
    'and projections from recorded history by stated rules, and learns only in that it measures its own ' +
    'projection error and corrects later estimates by it. It is not a trained model and we claim no validated ' +
    'one. That is defensible for a first system, since an operator signing off work on an asset needs to see why ' +
    'a recommendation was made — though a larger deployment is where a learned model could reach options a rule ' +
    'set would not, without changing who decides.'),

  h1('Conclusion'),
  p('Electric vehicle charging overloads distribution transformers because it is correlated, not because the energy ' +
    'it requires is unavailable. A vehicle parked for the night, or for a working day, has far longer than it ' +
    'needs; the difficulty is that every vehicle wants the same hour, and in this climate it wants it on a ' +
    'network whose cooling load is already correlated and whose transformers have least margin precisely when ' +
    'demand is highest. The ' +
    'UAE framework governs equipment, approval and public charging prices comprehensively, but protects capacity ' +
    'through a single static assessment and prices domestic electricity by monthly volume rather than time of ' +
    'day — so nothing spreads charging behind the meter, and nothing responds when a site draws more than its ' +
    'transformer can take.', { noIndent: true }),
  p('Converting that static limit into a dynamic one closes the gap without new standards or new hardware ' +
    'interfaces. A controller that measures the headroom at the transformer, shares it among vehicles in order of ' +
    'urgency and enforces the result through the IEC 61851 control pilot allows existing assets to host ' +
    'substantially more charging, keeps drivers supplied, and can be supported in the UAE by solar generation and ' +
    'storage. The infrastructure for a largely electric fleet is, to a significant extent, already in the ground; ' +
    'what is missing is the coordination to use it.'),

  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 },
    children: [t('References', { small: true })] }),
];

const REFS = _refOrder.map((k) => REF_TEXT[k]);
{ const unused = Object.keys(REF_TEXT).filter((k) => !_refOrder.includes(k));
  if (unused.length) throw new Error("reference never cited: " + unused.join(", ")); }

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

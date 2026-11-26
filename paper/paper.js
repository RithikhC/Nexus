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
  'Electricity distribution networks are planned on diversity: the assumption that households do not all draw their ' +
  'maximum power at the same moment. Electric vehicle charging weakens that assumption, because a home charger is ' +
  'comparable in size to the rest of a dwelling and because drivers plug in within the same few evening hours. The ' +
  'result is a local transformer carrying far more than it was sized for, with accelerated ageing and, eventually, ' +
  'loss of supply to the street. The published thresholds are lower than intuition suggests: modelling for the US ' +
  'Department of Energy puts distribution transformer limits as being exceeded at roughly 0.75 vehicles per home ' +
  'at 6.6 kW charging, and a British network trial projected that 32% of low-voltage feeders would need ' +
  'reinforcement once 40% to 70% of customers have electric vehicles. This paper examines the problem in the ' +
  'context of the United Arab Emirates, where national policy targets half the vehicle fleet electrified by 2050. ' +
  'It reviews the instruments governing charging today — the National Electric Vehicles Policy, Cabinet Decision ' +
  'No. 81 of 2024, and DEWA’s technical and installation regulations — and identifies a specific gap: capacity is ' +
  'protected by a static load assessment made once before connection, and domestic charging sits behind the meter ' +
  'on a tariff banded by monthly volume rather than by time of day, so no signal exists to spread it. We propose converting that static limit into ' +
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
    'new cars in 2024 and are projected above 40% by 2030 ' + C('gevo25') + '. The United Arab Emirates has set out a National ' +
    'Electric Vehicles Policy with the aim of half the vehicles on its roads being electric by 2050, alongside a ' +
    'substantial reduction in transport energy use ' + C('uaePolicy') + ', ' + C('moei') + '.', { noIndent: true }),
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
  p('First by size. Residential charging can draw more power than any other single household load ' + C('ieaV2G') + ': a ' +
    'domestic charge point draws roughly as much as the rest of a dwelling combined, so adding one is not a ' +
    'marginal change to a household’s demand but close to a doubling of its peak. No appliance introduced to the ' +
    'home in the last century has had that effect, and the network was not planned for it.', { noIndent: true }),
  p('Second, and more importantly, by correlation. Charging is not independent between households: people return from ' +
    'work within the same two or three hours and plug in on arrival, so chargers switch on together, and they do so ' +
    'precisely when cooking, lighting and air conditioning are already at their daily peak. Fig. 1 shows the shape of ' +
    'the problem. The dashed line is a street without electric vehicles, comfortably inside its limit. The solid line ' +
    'is the same street once charging is added on top of the evening peak.'),
  ...figure('fig1-mechanism.png', 3.0,
    'Fig. 1.  Why the evening is the difficulty. Charging arrives on top of the household peak rather than in the quiet hours, even though the energy could be delivered at any point overnight. Schematic.'),
  p('Measured coincidence factors for domestic charging do fall as fleets grow, because arrivals spread over several ' +
    'hours ' + C('dtu') + '. That is an average over a large population, and it is the wrong statistic for the problem at hand. ' +
    'A transformer does not serve an average; it serves one street of perhaps twenty to forty homes, where the law ' +
    'of large numbers is weak, charger power is high, and coincidence rises sharply whenever arrivals or start ' +
    'times cluster. The system-wide figure can improve while individual feeders fail.', { noIndent: true }),

  h2('The thresholds are far lower than intuition suggests'),
  p('It is tempting to treat this as a problem for the 2040s, to be solved when electric vehicles are everywhere. ' +
    'The published thresholds do not support that. Modelling of prototypical distribution feeders for the US ' +
    'Department of Energy found that charging at 6.6 kW causes distribution transformer power limits to be exceeded ' +
    'once adoption reaches about 0.75 vehicles per home — fewer than one car per household ' + C('pnnl') + '. The same study ' +
    'found the threshold falls to roughly 0.25 vehicles per home at 19.2 kW charging, because feeder loading is ' +
    'directly proportional to charging rate: faster chargers do not merely shift the problem forward, they multiply ' +
    'it. Simulating each city’s measured charging behaviour on that feeder, the limit was exceeded during the ' +
    'evening hours at about one vehicle per home for Seattle and 1.5 for Los Angeles.', { noIndent: true }),
  p('The proportion of the network involved is not marginal either. My Electric Avenue, an Ofgem-funded trial that ' +
    'ran clusters of neighbouring electric vehicles on real British low-voltage circuits, projected from its ' +
    'results that 32% of low-voltage feeders — some 312,000 circuits — would require intervention once 40% to 70% ' +
    'of customers have electric vehicles, at a reinforcement cost of around £2.2 billion to 2050 ' + C('mea') + '. That is ' +
    'roughly a third of a mature national distribution network requiring physical work, driven by one new load.'),

  h2('What is coming, and at what scale'),
  p('Dubai’s peak electricity demand reached 11,391 MW in 2025, about 5.8% above the previous year ' + C('dewaStats') + '. That growth ' +
    'is being driven by population and economic activity, before significant electrification of transport. Against ' +
    'this, national policy targets half the vehicle fleet electrified by 2050 ' + C('uaePolicy') + '. If a substantial share of those ' +
    'vehicles charge at home, and if they charge on arrival, the additional demand does not spread itself evenly ' +
    'across the day: it lands in the evening window, on thousands of low-voltage feeders simultaneously.', { noIndent: true }),
  p('The consequences differ by scale. Locally, sustained overloading is first a thermal problem and only later a ' +
    'visible one: insulation ageing accelerates sharply with winding temperature, so repeated evening excursions ' +
    'consume transformer life for months or years before anything is noticed, and the failure, when it comes, ' +
    'arrives without warning and takes the whole street’s supply with it. The asset is degraded silently and the ' +
    'cost is paid twice, once in shortened life and once in unplanned replacement. Hosting capacity also varies ' +
    'enormously between feeders, so the constraint binds unevenly and unpredictably: a meaningful fraction of ' +
    'residential networks cannot accept significant charging without a limit being violated ' + C('barbosa') + ', and the ' +
    'utility generally cannot tell which feeders those are until something gives.'),
  p('At system scale the bar is higher. A power system holds reserve against the loss of its largest generating ' +
    'unit, and a sudden demand step is equivalent to such a loss — but ordinary arrivals produce a ramp, which ' +
    'generation follows comfortably. What produces a step is a common control signal reaching many vehicles at once: ' +
    'a shared off-peak tariff hour, a default start time distributed by an application, or restoration after an ' +
    'outage. The IEA notes that static time-of-use tariffs can lead many vehicles to charge at the same moment, ' +
    'worsening grid impacts relative to leaving charging uncontrolled ' + C('ieaV2G') + ': an instrument meant to relieve the ' +
    'network can damage it. Pilot measurements agree, the resulting synchronised peak rivalling the ' +
    'uncontrolled one ' + C('touPilot') + '. Both scales share one mechanism, coincidence, and differ only in what causes it.'),

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
    'bands depend on how much a household uses, not on when it uses it.'),
  p('The consequence is direct: nothing in Dubai today would move domestic charging off the evening peak. A ' +
    'household pays the same at 19:00 as at 03:00, so the off-peak timer — the main mitigation in markets with ' +
    'time-of-use tariffs — is unavailable here, and as Section II noted it replaces a diverse peak with a ' +
    'synchronised one where it is.'),
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
    t('drawn at seven in the evening', { italics: true }),
    t('. A compliant 7.4 kW installation is entitled to its full 7.4 kW at the worst possible moment, and in Dubai ' +
      'there is no tariff signal to discourage it. Because charging is a continuous load, wiring practice also sizes ' +
      'a charger’s own circuit at its full rated current rather than a diversified one, which is why each ' +
      'additional charge point consumes headroom so quickly. The street’s transformer is therefore exposed to ' +
      'whatever its customers happen to do simultaneously.'),
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
    'this moment, and guarantees that the chargers it manages never collectively exceed it. Fig. 2 contrasts the two.', { noIndent: true }),
  ...figure('fig2-framework.png', 3.0,
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
    'captures much of the benefit of central optimisation without its communication burden ' + C('richardson') + '.', { noIndent: true }),
  ...figure('fig3-architecture.png', 3.0,
    'Fig. 3.  The two loops. Below the line the protection loop runs every minute and never waits for a decision: measured headroom is shared among connected vehicles in order of urgency and applied as a current limit at each charge point. Above it the advisory layer works across whole evenings, proposing ranked options that only take effect once an operator approves them. The approved policy is the sole path from one into the other.'),
  p('The headroom is then shared among connected vehicles. Priority is given to whichever vehicle has least slack — ' +
    'the smallest margin between the time remaining before its declared departure and the time it would need to ' +
    'finish charging at full power. Because that margin is recalculated continuously, a vehicle held back early in ' +
    'the evening rises in priority as its departure approaches, so no vehicle can be indefinitely starved. The ' +
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
    'behind a domestic meter, OCPP for stations already managed centrally — and both end at the same control pilot.'),
  h2('A decision layer, with a human holding the pen'),
  p('Holding a feeder under its limit is necessary but not sufficient. A controller that quietly absorbs a worsening ' +
    'problem every evening is also concealing it: the operator sees no alarm, the asset ages, and the first visible ' +
    'sign is a failure. What the utility needs in addition is a judgement about what to do next — tighten the cap, ' +
    'recruit the chargers still outside the scheme, or accept that this unit now warrants inspection and ' +
    'reinforcement. Those are decisions about capital, customers and risk, and they are not the controller’s to ' +
    'make.', { noIndent: true }),
  p('We therefore separate the system into two loops running on different clocks, shown above and below the line in ' +
    'Fig. 3. The protection loop is deterministic, acts every minute and never waits for authorisation, because a ' +
    'transformer cannot be left overloaded while an operator is away from the desk. Above it sits an advisory layer ' +
    'that touches no charger at all. It reads completed evenings, identifies the pattern — how often the limit was ' +
    'approached, what share of the load was beyond the controller’s reach, whether the trend is worsening — and ' +
    'presents the operator with a small set of ranked options. Each carries the reasoning behind it, a projected ' +
    'effect, the cost and lead time, and the risk of taking it. Nothing is applied until a person approves it, and ' +
    'an approval changes only the policy the protection loop then enforces.'),
  p('Two properties make this more than a confirmation dialogue. The first is that the layer must be able to say ' +
    'when an option will not help: if most of the excess is being drawn by chargers that have never been enrolled, ' +
    'no cap can reach it, and saying so is more useful than proposing it. The second is that every projection is ' +
    'recorded and later compared with what actually happened, so the operator can see whether this system has been ' +
    'reliable before trusting its next suggestion — and the layer corrects its own estimates by that error. A ' +
    'recommender that cannot be audited is of little use for a decision about an asset worth more than the ' +
    'scheme that manages it.'),
  p('None of this is a novel interaction. Restoration functions in an advanced distribution management system are ' +
    'already commissioned this way. GE Vernova’s D400-DA, in what it calls Operator Assisted Mode, "will first ask ' +
    'for confirmation from the operator before taking any action", and "if the operator does not agree with the ' +
    'recommended action, the D400-DA will calculate the next optimal scenario and propose that to the operator" ' +
    C('geD400') + '. Oracle’s network management system provides a manual mode in which restoration solutions are ' +
    'generated automatically but executed by the operator ' + C('oracleNms') + '. The pattern extends to how such functions ' +
    'are introduced: utilities commonly run them operator-assisted first and move to automatic only once ' +
    'confidence has been earned. What we propose is that the same arrangement be applied to a decision the ' +
    'industry does not currently make at all.'),
  p('The signal path is equally conventional, and this matters because nothing here requires a new interface. ' +
    'Transformer loading already reaches a control centre over the established telecontrol protocols — DNP3, ' +
    'standardised as IEEE 1815 ' + C('dnp3') + ', or IEC 60870-5-104 ' + C('iec104') + ' — from a remote terminal unit, with IEC 61850 ' +
    'used inside the substation. The advisory function would sit in the ADMS alongside FLISR and exchange data ' +
    'with metering and asset systems through the IEC 61968 Common Information Model ' + C('iec61968') + ', which defines ' +
    'application-level message interfaces and is a separate layer from the telecontrol protocols rather than an ' +
    'extension of them. The approved limit then travels outward by the route described above: an OCPP charging ' +
    'profile, applied at the charge point on the IEC 61851-1 control pilot. Every link in that chain is a ' +
    'standard already deployed.'),
  p('The division also answers the obvious objection to automating anything on a public network — who is ' +
    'accountable when it is wrong. The automatic part is bounded, deterministic, and does only what the standards ' +
    'already permit a charge point to be told; every discretionary judgement is logged against the person who ' +
    'made it.'),

  h2('Solar canopy and storage'),
  p('The approach pairs naturally with photovoltaics. A shared canopy over residential or station parking ' +
    'generates through the day and, with a battery behind it, can discharge into the evening window when headroom is ' +
    'scarcest, effectively widening the limit the controller has to work within. Dubai already provides a route for ' +
    'this: the Shams Dubai programme connects distributed solar to the network under DEWA’s connection guidelines.', { noIndent: true }),
  p('Two cautions are worth stating plainly. Solar output has largely faded by the evening peak, so photovoltaics ' +
    'without storage contribute little at the critical hour, and storage sized for a street shaves a peak rather ' +
    'than removing it. Both widen the margin the controller manages; neither substitutes for coordination.'),
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
      'staggered bands would give households a reason to accept managed charging. '),
    t('Vehicle-to-grid:', { italics: true }),
    t(' a fleet that can export rather than merely modulate would become evening support, though this needs ' +
      'bidirectional chargers and a settlement framework, so we treat it as a later extension. '),
    t('A managed-connection category:', { italics: true }),
    t(' the regulatory counterpart to all of the above, discussed next.'),
  ], { noIndent: true }),
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
  p('This speaks directly to UN Sustainable Development Goal 9 and its call for infrastructure upgraded for greater ' +
    'resource-use efficiency. Getting more transport electrification from distribution assets that already exist is ' +
    'faster, cheaper and less carbon-intensive than replacing them, and the constraint removed is one that would ' +
    'otherwise slow adoption in exactly the dense residential areas where it matters most.'),
  p('An interactive demonstration accompanies this paper in the project repository: a teaching model, offered to ' +
    'make the behaviour visible rather than to quantify it.'),

  h1('Limitations and Future Work'),
  p('This paper argues from published sources and from the regulatory framework; it is not a validated network ' +
    'study, and the benefit on any particular feeder would depend on its rating, impedance, customer mix and ' +
    'existing loading. Several questions remain open: declared departure times may be wrong, so the allocation needs ' +
    'a sensible response when a vehicle leaves early; fairness across repeated days must be managed so the same ' +
    'households are not always served last; voltage and phase imbalance can bind before thermal rating and would ' +
    'need constraining alongside loading; and the economic case for a managed-connection category depends on local ' +
    'reinforcement costs we have not estimated. Future work begins with a load-flow study of a representative Dubai ' +
    'feeder and a hardware demonstration of the control pilot loop.', { noIndent: true }),
  p('The advisory layer should be described accurately. As implemented it is a transparent recommender: it derives ' +
    'its options and projections from recorded history by stated rules, and the only sense in which it learns is ' +
    'that it measures its own projection error and corrects later estimates by it. It is not a trained statistical ' +
    'model and we claim no validated one. That is defensible for a first system, since an operator signing off ' +
    'work on an asset needs to see why a recommendation was made — but a larger deployment, with many feeders and ' +
    'years of history, is exactly where a learned model could propose options a rule set would not reach. The ' +
    'division of responsibility would not change.'),

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

// ─── BX Reservations — shared room catalogue ─────────────────────────────────
// Single source of truth for all room data. Photos are Unsplash placeholders
// until real photography is available — swap src strings here only.

export type SetupId =
  | "theater" | "banquet" | "reception" | "cocktail"
  | "classroom" | "boardroom" | "custom";

export interface RoomPhoto {
  src: string;
  caption: string;
}

export interface Room {
  id: string;
  name: string;
  tagline: string;          // short punchy card headline
  description: string;
  floor: "upper" | "main" | "lower";
  features: string[];
  capacityTheater: number;
  capacityBanquet: number;
  capacity: number;
  baseNP: number;
  basePro: number;
  image: string;            // primary card image
  photos: RoomPhoto[];      // lightbox gallery (includes primary first)
  setups: SetupId[];
}

const U = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&fit=crop&auto=format`;

export const ROOMS: Room[] = [
  {
    id: "crossing",
    name: "The Crossing",
    tagline: "Grand event hall with stage & mezzanine",
    description:
      "Main event space with mezzanine and stage. Galas, conferences, large gatherings.",
    floor: "main",
    features: ["Stage", "Mezzanine", "Full AV", "Lighting Rig", "Green Room", "Catering Access"],
    capacityTheater: 400,
    capacityBanquet: 300,
    capacity: 400,
    baseNP: 600,
    basePro: 800,
    image: U("photo-1519167758481-83f550bb49b3"),
    photos: [
      { src: U("photo-1519167758481-83f550bb49b3"), caption: "Main hall — banquet setup" },
      { src: U("photo-1492684223066-81342ee5ff30"), caption: "Stage and audience" },
      { src: U("photo-1540575467063-178a50c2df87"), caption: "Conference / theater setup" },
      { src: U("photo-1464366400600-7168b8af9bc3"), caption: "Reception lighting" },
    ],
    setups: ["theater", "banquet", "reception", "cocktail", "custom"],
  },
  {
    id: "loft",
    name: "The Loft",
    tagline: "Intimate upstairs space for meetings & workshops",
    description:
      "Intimate upstairs space. Great for meetings, small workshops, and rehearsals.",
    floor: "upper",
    features: ["Natural Light", "Whiteboard Wall", "Video Conferencing", "Lounge Seating"],
    capacityTheater: 100,
    capacityBanquet: 80,
    capacity: 100,
    baseNP: 275,
    basePro: 475,
    image: U("photo-1497366216548-37526070297c"),
    photos: [
      { src: U("photo-1497366216548-37526070297c"), caption: "Open loft setup" },
      { src: U("photo-1524758631624-e2822132978b"), caption: "Workshop configuration" },
      { src: U("photo-1552664730-d307ca884978"), caption: "Collaborative session" },
    ],
    setups: ["theater", "classroom", "reception", "boardroom", "custom"],
  },
  {
    id: "crossview",
    name: "CrossView",
    tagline: "Bright open space for classes & community events",
    description:
      "Bright open space — excellent for workshops, classes, and community events.",
    floor: "main",
    features: ["Panoramic Windows", "Projector", "Movable Furniture", "Whiteboard"],
    capacityTheater: 50,
    capacityBanquet: 40,
    capacity: 50,
    baseNP: 200,
    basePro: 250,
    image: U("photo-1580582932707-520aed937b7b"),
    photos: [
      { src: U("photo-1580582932707-520aed937b7b"), caption: "Classroom setup" },
      { src: U("photo-1524178232363-1fb2b075b655"), caption: "Workshop layout" },
      { src: U("photo-1535982330050-f1c2fb79ff78"), caption: "Open community setup" },
    ],
    setups: ["theater", "classroom", "banquet", "reception", "custom"],
  },
  {
    id: "crosspointe-a",
    name: "CrossPointe A",
    tagline: "Flexible breakout — opens into B & C",
    description:
      "Flexible breakout room — can open into B and C for a combined space.",
    floor: "main",
    features: ["Operable Wall", "Display Screen", "Conference Phone", "Acoustic Panels"],
    capacityTheater: 40,
    capacityBanquet: 30,
    capacity: 40,
    baseNP: 150,
    basePro: 200,
    image: U("photo-1568992687947-868a62a9f521"),
    photos: [
      { src: U("photo-1568992687947-868a62a9f521"), caption: "Boardroom setup" },
      { src: U("photo-1497366754035-f200968a6e72"), caption: "Classroom configuration" },
      { src: U("photo-1542744094-3a31f272c490"), caption: "Combined A+B+C open layout" },
    ],
    setups: ["classroom", "boardroom", "theater", "custom"],
  },
  {
    id: "crosspointe-b",
    name: "CrossPointe B",
    tagline: "Flexible breakout — opens into A & C",
    description:
      "Flexible breakout room — can open into A and C for a combined space.",
    floor: "main",
    features: ["Operable Wall", "Display Screen", "Conference Phone", "Acoustic Panels"],
    capacityTheater: 40,
    capacityBanquet: 30,
    capacity: 40,
    baseNP: 150,
    basePro: 200,
    image: U("photo-1497366754035-f200968a6e72"),
    photos: [
      { src: U("photo-1497366754035-f200968a6e72"), caption: "Meeting setup" },
      { src: U("photo-1568992687947-868a62a9f521"), caption: "Boardroom configuration" },
      { src: U("photo-1542744094-3a31f272c490"), caption: "Combined A+B+C open layout" },
    ],
    setups: ["classroom", "boardroom", "theater", "custom"],
  },
  {
    id: "crosspointe-c",
    name: "CrossPointe C",
    tagline: "Flexible breakout — opens into A & B",
    description:
      "Flexible breakout room — can open into A and B for a combined space.",
    floor: "main",
    features: ["Operable Wall", "Display Screen", "Conference Phone", "Acoustic Panels"],
    capacityTheater: 40,
    capacityBanquet: 30,
    capacity: 40,
    baseNP: 150,
    basePro: 200,
    image: U("photo-1542744094-3a31f272c490"),
    photos: [
      { src: U("photo-1542744094-3a31f272c490"), caption: "Open room" },
      { src: U("photo-1568992687947-868a62a9f521"), caption: "Boardroom setup" },
      { src: U("photo-1497366754035-f200968a6e72"), caption: "Combined A+B+C layout" },
    ],
    setups: ["classroom", "boardroom", "theater", "custom"],
  },
  {
    id: "crosstiescafe",
    name: "CrossTies Café",
    tagline: "Café-style social space for casual gatherings",
    description:
      "Café-style space, perfect for casual meet-ups and coffee conversations.",
    floor: "lower",
    features: ["Café Bar", "Lounge Seating", "Ambient Lighting", "WiFi"],
    capacityTheater: 60,
    capacityBanquet: 50,
    capacity: 60,
    baseNP: 175,
    basePro: 225,
    image: U("photo-1554118811-1e0d58224f24"),
    photos: [
      { src: U("photo-1554118811-1e0d58224f24"), caption: "Café main floor" },
      { src: U("photo-1501339847302-ac426a4a7cbb"), caption: "Social gathering setup" },
      { src: U("photo-1445116572660-236099ec97a0"), caption: "Evening ambiance" },
    ],
    setups: ["reception", "cocktail", "custom"],
  },
  {
    id: "crosstiesA",
    name: "CrossTies A",
    tagline: "Casual lower-level gathering space",
    description: "Casual lower-level gathering space.",
    floor: "lower",
    features: ["Lounge Seating", "Display Screen", "Casual Atmosphere"],
    capacityTheater: 20,
    capacityBanquet: 10,
    capacity: 20,
    baseNP: 125,
    basePro: 150,
    image: U("photo-1517502884422-41eaead166d4"),
    photos: [
      { src: U("photo-1517502884422-41eaead166d4"), caption: "Casual lounge" },
      { src: U("photo-1524758631624-e2822e304c36"), caption: "Small group setup" },
    ],
    setups: ["classroom", "reception", "custom"],
  },
  {
    id: "crosstiesB",
    name: "CrossTies B",
    tagline: "Casual lower-level gathering space",
    description: "Casual lower-level gathering space.",
    floor: "lower",
    features: ["Lounge Seating", "Display Screen", "Casual Atmosphere"],
    capacityTheater: 20,
    capacityBanquet: 10,
    capacity: 20,
    baseNP: 125,
    basePro: 150,
    image: U("photo-1519389950473-47ba0277781c"),
    photos: [
      { src: U("photo-1519389950473-47ba0277781c"), caption: "Casual meeting" },
      { src: U("photo-1517502884422-41eaead166d4"), caption: "Group setup" },
    ],
    setups: ["classroom", "reception", "custom"],
  },
  {
    id: "crosstiesC",
    name: "CrossTies C",
    tagline: "Casual lower-level gathering space",
    description: "Casual lower-level gathering space.",
    floor: "lower",
    features: ["Lounge Seating", "Display Screen", "Casual Atmosphere"],
    capacityTheater: 20,
    capacityBanquet: 10,
    capacity: 20,
    baseNP: 125,
    basePro: 150,
    image: U("photo-1556909114-f6e7ad7d3136"),
    photos: [
      { src: U("photo-1556909114-f6e7ad7d3136"), caption: "Small group" },
      { src: U("photo-1519389950473-47ba0277781c"), caption: "Casual setup" },
    ],
    setups: ["classroom", "reception", "custom"],
  },
] as const;

export type RoomId = typeof ROOMS[number]["id"];

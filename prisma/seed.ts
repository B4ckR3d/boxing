import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from "../src/lib/permissions/catalog";
import { hashPassword } from "../src/lib/security/password";
import { getSeedPolicy } from "../scripts/account-policy";

let dbHost = process.env.MYSQL_HOST || "127.0.0.1";
let dbPort = Number(process.env.MYSQL_PORT) || 3306;
let dbUser = process.env.MYSQL_USER || "boxing";
let dbPass = process.env.MYSQL_PASSWORD || "";
let dbName = process.env.MYSQL_DATABASE || "boxing";

if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    if (u.hostname) dbHost = u.hostname;
    if (u.port) dbPort = Number(u.port);
    if (u.username) dbUser = decodeURIComponent(u.username);
    if (u.password) dbPass = decodeURIComponent(u.password);
    if (u.pathname) dbName = u.pathname.replace(/^\//, "");
  } catch {}
}

const adapter = new PrismaMariaDb({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPass,
  database: dbName,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const policy = getSeedPolicy(process.env);
  console.log("🥊 [Seed] Starting database seed...");

  // 1. Seed Permissions (Idempotent)
  console.log("  → Seeding permissions...");
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key] },
      create: { key, description: PERMISSIONS[key] },
    });
  }

  // 2. Seed Roles and Link Permissions
  console.log("  → Seeding roles and permissions...");
  for (const roleDef of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: roleDef.key },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
        requiresMfa: roleDef.requiresMfa,
        isSensitive: roleDef.isSensitive,
      },
      create: {
        key: roleDef.key,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
        requiresMfa: roleDef.requiresMfa,
        isSensitive: roleDef.isSensitive,
      },
    });

    // Clear and rebuild role permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permKey of roleDef.permissions) {
      const perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // 3. Seed Fight Methods
  console.log("  → Seeding fight result methods...");
  const methods = [
    { code: "KO", name: "Knockout", isStoppage: true, sortOrder: 1 },
    { code: "TKO", name: "Technical Knockout", isStoppage: true, sortOrder: 2 },
    { code: "UD", name: "Unanimous Decision", isStoppage: false, sortOrder: 3 },
    { code: "SD", name: "Split Decision", isStoppage: false, sortOrder: 4 },
    { code: "MD", name: "Majority Decision", isStoppage: false, sortOrder: 5 },
    { code: "TD", name: "Technical Decision", isStoppage: false, sortOrder: 6 },
    { code: "DQ", name: "Disqualification", isStoppage: true, sortOrder: 7 },
    { code: "NC", name: "No Contest", isStoppage: false, sortOrder: 8 },
    { code: "DRAW", name: "Split / Majority Draw", isStoppage: false, sortOrder: 9 },
  ];
  for (const m of methods) {
    await prisma.fightMethod.upsert({
      where: { code: m.code },
      update: { name: m.name, isStoppage: m.isStoppage, sortOrder: m.sortOrder },
      create: m,
    });
  }

  // 4. Seed Standard Weight Classes (Male & Female)
  console.log("  → Seeding weight classes...");
  const divisions = [
    { name: "Heavyweight", slug: "heavyweight", gender: "MALE" as const, limitLbs: 999.0, limitKg: 999.0, sortOrder: 1 },
    { name: "Cruiserweight", slug: "cruiserweight", gender: "MALE" as const, limitLbs: 200.0, limitKg: 90.72, sortOrder: 2 },
    { name: "Light Heavyweight", slug: "light-heavyweight", gender: "MALE" as const, limitLbs: 175.0, limitKg: 79.38, sortOrder: 3 },
    { name: "Super Middleweight", slug: "super-middleweight", gender: "MALE" as const, limitLbs: 168.0, limitKg: 76.2, sortOrder: 4 },
    { name: "Middleweight", slug: "middleweight", gender: "MALE" as const, limitLbs: 160.0, limitKg: 72.57, sortOrder: 5 },
    { name: "Super Welterweight", slug: "super-welterweight", gender: "MALE" as const, limitLbs: 154.0, limitKg: 69.85, sortOrder: 6 },
    { name: "Welterweight", slug: "welterweight", gender: "MALE" as const, limitLbs: 147.0, limitKg: 66.68, sortOrder: 7 },
    { name: "Super Lightweight", slug: "super-lightweight", gender: "MALE" as const, limitLbs: 140.0, limitKg: 63.5, sortOrder: 8 },
    { name: "Lightweight", slug: "lightweight", gender: "MALE" as const, limitLbs: 135.0, limitKg: 61.23, sortOrder: 9 },
    { name: "Super Featherweight", slug: "super-featherweight", gender: "MALE" as const, limitLbs: 130.0, limitKg: 58.97, sortOrder: 10 },
    { name: "Featherweight", slug: "featherweight", gender: "MALE" as const, limitLbs: 126.0, limitKg: 57.15, sortOrder: 11 },
  ];

  const weightClassMap = new Map<string, string>();
  for (const d of divisions) {
    const wc = await prisma.weightClass.upsert({
      where: { slug: d.slug },
      update: { name: d.name, limitLbs: d.limitLbs, limitKg: d.limitKg, sortOrder: d.sortOrder },
      create: d,
    });
    weightClassMap.set(d.slug, wc.id);
  }

  if (policy.demo) {
  // 5. Seed Championship Belts
  console.log("  → Seeding championship belts...");
  const hwId = weightClassMap.get("heavyweight")!;
  const wwId = weightClassMap.get("welterweight")!;
  const _mwId = weightClassMap.get("middleweight")!;

  const hwBelt = await prisma.championshipBelt.upsert({
    where: { slug: "wbc-x-world-heavyweight-championship" },
    update: { name: "WBC-X World Heavyweight Championship", weightClassId: hwId },
    create: {
      name: "WBC-X World Heavyweight Championship",
      slug: "wbc-x-world-heavyweight-championship",
      weightClassId: hwId,
      description: "The undisputed supreme crown of the heavyweight division. Features hand-crafted gold medallion plates mounted on premium leather.",
      status: "ACTIVE",
      isDemo: true,
    },
  });

  const _wwBelt = await prisma.championshipBelt.upsert({
    where: { slug: "wbc-x-world-welterweight-championship" },
    update: { name: "WBC-X World Welterweight Championship", weightClassId: wwId },
    create: {
      name: "WBC-X World Welterweight Championship",
      slug: "wbc-x-world-welterweight-championship",
      weightClassId: wwId,
      description: "The premier championship belt of the 147-pound elite division.",
      status: "ACTIVE",
      isDemo: true,
    },
  });

  // 6. Seed Demo Fighters
  console.log("  → Seeding demo fighters...");
  const fightersData = [
    {
      slug: "marcus-iron-vale",
      firstName: "Marcus",
      lastName: "Vale",
      ringName: "Iron",
      gender: "MALE" as const,
      nationality: "US",
      hometown: "Detroit, Michigan",
      dateOfBirth: new Date("1996-04-12"),
      showDateOfBirth: true,
      heightCm: 196,
      reachCm: 211,
      stance: "ORTHODOX" as const,
      weightClassId: hwId,
      status: "ACTIVE" as const,
      bio: "Undefeated heavyweight champion known for devastating left hooks and defensive poise under pressure. Former collegiate athlete who transitioned seamlessly to professional boxing.",
      achievements: ["WBC-X World Heavyweight Champion", "2024 Fighter of the Year", "Olympic Gold Medalist (Tokyo 2020)"],
      baseWins: 28,
      baseLosses: 0,
      baseDraws: 0,
      baseNoContests: 0,
      baseKoWins: 24,
      wins: 28,
      losses: 0,
      draws: 0,
      noContests: 0,
      koWins: 24,
      isDemo: true,
    },
    {
      slug: "dario-storm",
      firstName: "Dario",
      lastName: "Storm",
      ringName: "The Tempest",
      gender: "MALE" as const,
      nationality: "GB",
      hometown: "Manchester, England",
      dateOfBirth: new Date("1997-09-21"),
      showDateOfBirth: true,
      heightCm: 198,
      reachCm: 213,
      stance: "ORTHODOX" as const,
      weightClassId: hwId,
      status: "ACTIVE" as const,
      bio: "Fierce power puncher boasting an 88% knockout ratio. Known for an explosive counter-right and relentless offensive pace.",
      achievements: ["#1 Heavyweight Contender", "Grand Prix Season 1 Champion"],
      baseWins: 24,
      baseLosses: 1,
      baseDraws: 0,
      baseNoContests: 0,
      baseKoWins: 21,
      wins: 24,
      losses: 1,
      draws: 0,
      noContests: 0,
      koWins: 21,
      isDemo: true,
    },
    {
      slug: "kenji-arata",
      firstName: "Kenji",
      lastName: "Arata",
      ringName: "Silent Blade",
      gender: "MALE" as const,
      nationality: "JP",
      hometown: "Tokyo, Japan",
      dateOfBirth: new Date("1998-02-15"),
      showDateOfBirth: true,
      heightCm: 191,
      reachCm: 198,
      stance: "SOUTHPAW" as const,
      weightClassId: hwId,
      status: "ACTIVE" as const,
      bio: "Master tactician with elite footwork and lightning speed counter-punching. Highly disciplined defensive technician.",
      achievements: ["#2 Heavyweight Contender", "Asian Super-Heavyweight Champion"],
      baseWins: 22,
      baseLosses: 1,
      baseDraws: 1,
      baseNoContests: 0,
      baseKoWins: 16,
      wins: 22,
      losses: 1,
      draws: 1,
      noContests: 0,
      koWins: 16,
      isDemo: true,
    },
    {
      slug: "tomas-reyes",
      firstName: "Tomas",
      lastName: "Reyes",
      ringName: "El Matador",
      gender: "MALE" as const,
      nationality: "MX",
      hometown: "Guadalajara, Mexico",
      dateOfBirth: new Date("1995-11-03"),
      showDateOfBirth: true,
      heightCm: 193,
      reachCm: 203,
      stance: "ORTHODOX" as const,
      weightClassId: hwId,
      status: "ACTIVE" as const,
      bio: "Aggressive inside fighter renowned for punishing body shots and an iron chin. Fan-favorite brawler.",
      achievements: ["#3 Heavyweight Contender", "Continental Title Holder"],
      baseWins: 26,
      baseLosses: 2,
      baseDraws: 0,
      baseNoContests: 0,
      baseKoWins: 22,
      wins: 26,
      losses: 2,
      draws: 0,
      noContests: 0,
      koWins: 22,
      isDemo: true,
    },
    {
      slug: "aleksandr-volkov",
      firstName: "Aleksandr",
      lastName: "Volkov",
      ringName: "The Siberian Bear",
      gender: "MALE" as const,
      nationality: "KZ",
      hometown: "Almaty, Kazakhstan",
      dateOfBirth: new Date("1994-07-19"),
      showDateOfBirth: true,
      heightCm: 201,
      reachCm: 216,
      stance: "SOUTHPAW" as const,
      weightClassId: hwId,
      status: "ACTIVE" as const,
      bio: "Towering southpaw with a stiff jab and thunderous straight left hand.",
      achievements: ["#4 Heavyweight Contender"],
      baseWins: 20,
      baseLosses: 1,
      baseDraws: 0,
      baseNoContests: 0,
      baseKoWins: 17,
      wins: 20,
      losses: 1,
      draws: 0,
      noContests: 0,
      koWins: 17,
      isDemo: true,
    },
    {
      slug: "carlos-mendoza",
      firstName: "Carlos",
      lastName: "Mendoza",
      ringName: "El Diablo",
      gender: "MALE" as const,
      nationality: "MX",
      hometown: "Tijuana, Mexico",
      dateOfBirth: new Date("1998-05-18"),
      showDateOfBirth: true,
      heightCm: 175,
      reachCm: 183,
      stance: "ORTHODOX" as const,
      weightClassId: wwId,
      status: "ACTIVE" as const,
      bio: "Pound-for-pound ranked phenom and reigning WBC-X Welterweight Champion. Lightning hand speed and vicious combination punching.",
      achievements: ["WBC-X World Welterweight Champion", "#1 Pound-for-Pound Contender"],
      baseWins: 25,
      baseLosses: 0,
      baseDraws: 0,
      baseNoContests: 0,
      baseKoWins: 20,
      wins: 25,
      losses: 0,
      draws: 0,
      noContests: 0,
      koWins: 20,
      isDemo: true,
    },
  ];

  const fighterMap = new Map<string, string>();
  for (const f of fightersData) {
    const fighter = await prisma.fighter.upsert({
      where: { slug: f.slug },
      update: f,
      create: f,
    });
    fighterMap.set(f.slug, fighter.id);
  }

  // 7. Seed Active Belt Reign for Heavyweight (Marcus Vale)
  console.log("  → Seeding active belt reign...");
  const marcusId = fighterMap.get("marcus-iron-vale")!;
  const darioId = fighterMap.get("dario-storm")!;

  const existingReign = await prisma.beltReign.findFirst({
    where: { beltId: hwBelt.id, status: "ACTIVE" },
  });
  if (!existingReign) {
    await prisma.beltReign.create({
      data: {
        beltId: hwBelt.id,
        fighterId: marcusId,
        status: "ACTIVE",
        activeKey: hwBelt.id,
        wonAt: new Date("2024-06-15"),
        notes: "Won via 10th-round TKO in Tokyo, Japan. First reign as undisputed champion.",
      },
    });
  }

  // 8. Seed Official Published Rankings (Heavyweight)
  console.log("  → Seeding published rankings...");
  const hwScope = `DIV:${hwId}`;
  let hwVersion = await prisma.rankingVersion.findUnique({
    where: { scopeKey_versionNumber: { scopeKey: hwScope, versionNumber: 1 } },
  });
  if (!hwVersion) {
    hwVersion = await prisma.rankingVersion.create({
      data: {
        type: "DIVISION",
        weightClassId: hwId,
        scopeKey: hwScope,
        versionNumber: 1,
        status: "PUBLISHED",
        effectiveDate: new Date(),
        notes: "Official November 2026 Heavyweight Divisional Rankings ratified by the Championship Committee.",
        publishedAt: new Date(),
      },
    });

    // Entries
    const entries = [
      { fighterId: marcusId, isChampion: true, rank: null, points: 1500.0, movement: 0, isNew: false, note: "Reigning Champion" },
      { fighterId: darioId, isChampion: false, rank: 1, points: 1320.0, movement: 2, isNew: false, note: "Defeated Reyes via KO" },
      { fighterId: fighterMap.get("kenji-arata")!, isChampion: false, rank: 2, points: 1280.0, movement: -1, isNew: false, note: "" },
      { fighterId: fighterMap.get("tomas-reyes")!, isChampion: false, rank: 3, points: 1190.0, movement: 0, isNew: false, note: "" },
      { fighterId: fighterMap.get("aleksandr-volkov")!, isChampion: false, rank: 4, points: 1110.0, movement: 1, isNew: false, note: "" },
    ];

    for (const e of entries) {
      await prisma.rankingEntry.create({
        data: {
          versionId: hwVersion.id,
          fighterId: e.fighterId,
          rank: e.rank,
          isChampion: e.isChampion,
          points: e.points,
          movement: e.movement,
          isNew: e.isNew,
          note: e.note,
        },
      });

      // Denormalized lookup
      await prisma.fighterRanking.upsert({
        where: { fighterId_scopeKey: { fighterId: e.fighterId, scopeKey: hwScope } },
        update: { rank: e.rank, isChampion: e.isChampion, versionId: hwVersion.id },
        create: {
          fighterId: e.fighterId,
          scopeKey: hwScope,
          versionId: hwVersion.id,
          rank: e.rank,
          isChampion: e.isChampion,
        },
      });
    }
  }

  // 9. Seed Demo Event: WBC-X 42 (Vale vs Storm)
  console.log("  → Seeding demo fight night event...");
  const demoStartsAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  const event = await prisma.event.upsert({
    where: { slug: "wbc-x-42-night-of-champions" },
    // Keep the demo event bookable on re-seed: refresh the date forward and keep it published.
    update: { isPublished: true, status: "SCHEDULED", startsAt: demoStartsAt },
    create: {
      name: "WBC-X 42: Night of Champions",
      slug: "wbc-x-42-night-of-champions",
      description: "Undisputed heavyweight champion Marcus 'Iron' Vale puts his rotating championship belt on the line against the #1 contender Dario Storm.",
      venue: "Jakarta International Arena",
      city: "Jakarta",
      country: "ID",
      startsAt: demoStartsAt,
      timezone: "Asia/Jakarta",
      status: "SCHEDULED",
      isPublished: true,
      isDemo: true,
    },
  });

  // Seed Fight Card
  const existingFight = await prisma.fight.findFirst({
    where: { eventId: event.id, isMainEvent: true },
  });
  if (!existingFight) {
    const mainFight = await prisma.fight.create({
      data: {
        eventId: event.id,
        weightClassId: hwId,
        scheduledAt: event.startsAt,
        scheduledRounds: 12,
        boutOrder: 1,
        isMainEvent: true,
        isTitleFight: true,
        beltId: hwBelt.id,
        status: "SCHEDULED",
        notes: "World Heavyweight Championship Title Bout",
      },
    });

    await prisma.fightParticipant.createMany({
      data: [
        { fightId: mainFight.id, fighterId: marcusId, corner: "RED", weighInKg: 108.5 },
        { fightId: mainFight.id, fighterId: darioId, corner: "BLUE", weighInKg: 111.2 },
      ],
    });
  }

  // 9b. Seed demo ticket categories (demo data only — clearly fictional pricing)
  console.log("  → Seeding demo ticket categories...");
  const demoTicketTypes = [
    {
      code: "vip-ringsides",
      name: "VIP Ringside",
      description: "Bangku ringside baris depan, akses masuk lebih awal, dan satu merchandise resmi.",
      price: 750000,
      quota: 60,
    },
    {
      code: "tribun-barat",
      name: "Tribun Barat",
      description: "Tribun utama dengan pandangan penuh ke ring.",
      price: 350000,
      quota: 220,
    },
    {
      code: "tribun-umum",
      name: "Tribun Umum",
      description: "Area tribun umum, tempat duduk tidak bernomor.",
      price: 150000,
      quota: 500,
    },
  ];

  for (const t of demoTicketTypes) {
    await prisma.ticketType.upsert({
      where: { eventId_code: { eventId: event.id, code: t.code } },
      // Do not reset `sold` on re-seed — that would break existing orders/stock.
      update: { name: t.name, description: t.description, price: t.price, quota: t.quota, isActive: true },
      create: { eventId: event.id, ...t },
    });
  }

  // 10. Seed Demo Grand Prix Tournament
  console.log("  → Seeding Grand Prix tournament...");
  const tournament = await prisma.tournament.upsert({
    where: { slug: "wbc-x-heavyweight-world-grand-prix-2026" },
    update: { isPublished: true },
    create: {
      name: "WBC-X Heavyweight World Grand Prix 2026",
      slug: "wbc-x-heavyweight-world-grand-prix-2026",
      weightClassId: hwId,
      format: "SINGLE_ELIMINATION",
      status: "IN_PROGRESS",
      size: 8,
      prize: "$2,500,000 USD & Championship Belt Defense Mandate",
      titleAwarded: "Grand Prix Cup & Mandatory Contender Status",
      description: "An 8-man single elimination world tournament featuring the globe's top heavyweight contenders competing across 3 rounds of combat.",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-12-20"),
      isPublished: true,
      isDemo: true,
    },
  });

  // Seed Bracket and Seeded Participants
  const existingBracket = await prisma.tournamentBracket.findFirst({
    where: { tournamentId: tournament.id },
  });
  if (!existingBracket) {
    const bracket = await prisma.tournamentBracket.create({
      data: {
        tournamentId: tournament.id,
        type: "WINNERS",
        name: "Main Championship Bracket",
        rounds: 3,
      },
    });

    // Seed 4 participants
    const p1 = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, fighterId: darioId, seed: 1, status: "ACTIVE" },
    });
    const p2 = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, fighterId: fighterMap.get("kenji-arata")!, seed: 2, status: "ACTIVE" },
    });
    const p3 = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, fighterId: fighterMap.get("tomas-reyes")!, seed: 3, status: "ACTIVE" },
    });
    const p4 = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, fighterId: fighterMap.get("aleksandr-volkov")!, seed: 4, status: "ACTIVE" },
    });

    // Round 1 bouts
    await prisma.tournamentBout.create({
      data: {
        bracketId: bracket.id,
        round: 1,
        position: 1,
        participantAId: p1.id,
        participantBId: p4.id,
        status: "READY",
      },
    });
    await prisma.tournamentBout.create({
      data: {
        bracketId: bracket.id,
        round: 1,
        position: 2,
        participantAId: p2.id,
        participantBId: p3.id,
        status: "READY",
      },
    });
  }

  // 11. Seed CMS Hero Slides
  console.log("  → Seeding CMS hero slides...");
  const heroCount = await prisma.heroSlide.count();
  if (heroCount === 0) {
    await prisma.heroSlide.createMany({
      data: [
        {
          eventTitle: "WBC-X 42: Night of Champions",
          category: "WORLD HEAVYWEIGHT TITLE",
          headline: "VALE VS STORM: UNFINISHED BUSINESS",
          description: "Marcus 'Iron' Vale risks his undefeated legacy against knockout sensation Dario Storm in a 12-round collision for the undisputed heavyweight crown.",
          eventDate: event.startsAt,
          ctaPrimaryLabel: "VIEW FIGHT CARD",
          ctaPrimaryHref: "/events/wbc-x-42-night-of-champions",
          ctaSecondaryLabel: "OFFICIAL RANKINGS",
          ctaSecondaryHref: "/rankings",
          show3dBelt: true,
          overlay: "GOLD",
          sortOrder: 1,
          isActive: true,
        },
        {
          eventTitle: "HEAVYWEIGHT WORLD GRAND PRIX",
          category: "TOURNAMENT SEMI-FINALS",
          headline: "THE ROAD TO SUPREMACY",
          description: "Eight warriors entered. Only the greatest punchers remain in the world's most grueling single-elimination boxing tournament.",
          ctaPrimaryLabel: "VIEW BRACKETS",
          ctaPrimaryHref: "/grand-prix",
          ctaSecondaryLabel: "EXPLORE FIGHTERS",
          ctaSecondaryHref: "/fighters",
          show3dBelt: false,
          overlay: "CRIMSON",
          sortOrder: 2,
          isActive: true,
        },
      ],
    });
  }

  } // explicit demo content only

  if (policy.demoUsers && policy.password) {
  console.log("  → Seeding explicitly enabled demo accounts (new accounts only)...");
  const passwordHash = await hashPassword(policy.password);

  const coreUsers = [
    { email: "superadmin@boxing.local", name: "Super Admin", roleKey: "super_admin" },
    { email: "admin@boxing.local", name: "Platform Admin", roleKey: "administrator" },
    { email: "rankings@boxing.local", name: "Chief Ranking Officer", roleKey: "ranking_manager" },
    { email: "tournaments@boxing.local", name: "Grand Prix Director", roleKey: "tournament_manager" },
    { email: "editor@boxing.local", name: "Lead Content Editor", roleKey: "editor" },
    { email: "data@boxing.local", name: "Fight Record Keeper", roleKey: "fight_data_manager" },
    { email: "reviewer@boxing.local", name: "Sanctioning Reviewer", roleKey: "reviewer" },
    { email: "viewer@boxing.local", name: "Broadcast Guest", roleKey: "viewer" },
  ];

  for (const u of coreUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        isActive: true,
      },
    });

    const role = await prisma.role.findUnique({ where: { key: u.roleKey } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }
  }

  } // explicit demo users only
  console.log("✅ [Seed] Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ [Seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


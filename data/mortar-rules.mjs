const MORTAR_SOURCE_PACKAGE = "air-islands.mortar";

const html = lines => lines.map(line => `<p>${line}</p>`).join("\n");

function talent({ id, name, systemType = "general", role, description, tier = null, attribute = null }) {
  return {
    name,
    type: "talent",
    img: "icons/svg/cog.svg",
    effects: [],
    flags: {
      "air-islands-builder": {
        role,
        ...(tier === null ? {} : { tier }),
        ...(attribute === null ? {} : { attribute })
      }
    },
    system: {
      rollModifiers: {},
      category: "general",
      rank: "1",
      description,
      type: systemType
    },
    _id: id
  };
}

export const MORTAR_TALENT_ITEMS = [
  talent({
    id: "mortarBody000001",
    name: "Механическое Тело",
    systemType: "kin",
    role: "mortar-body",
    description: html([
      "Мортару не нужны пища, вода, сон, дыхание или внешний источник энергии. Он невосприимчив к болезням.",
      "Постоянный Armor Rating корпуса равен 2. Damage режущей атаки уменьшается на 1 до броска брони, но не ниже 1.",
      "REST, SLEEP и HEALING не восстанавливают потерянные STR или AGI и не лечат физические Critical Injuries.",
      "REBOOT занимает Quarter Day, восстанавливает WITS как сон, 1 EMPATHY, полностью снимает OVERLOAD и позволяет сменить активный пассивный Operational Protocol. MAINTENANCE занимает Quarter Day и снимает 1D6 OVERLOAD.",
      "Этот талант бесплатно получают все мортары. У него нет дополнительных рангов."
    ])
  }),
  talent({
    id: "mortarRecover001",
    name: "Recovery Protocol [1]",
    systemType: "kin",
    role: "mortar-recovery",
    description: html([
      "<strong>✥ RANK 1: OVERCLOCK.</strong> После первоначального броска проверки, но до решения о PUSH, если проверка основана на самом высоком максимальном Attribute, потрать X WP: добавь X D6 и получи X OVERLOAD. При равенстве максимумов можно выбрать любой. Добавленные D6 входят в Dice Pool и перебрасываются при PUSH вместе с остальными допустимыми кубами.",
      "<strong>✥ RANK 2: UNRESTRICTED ACCESS.</strong> OVERCLOCK можно применять к проверке любого Attribute. Немедленно выбери один Operational Protocol и получи его Rank 1 бесплатно.",
      "<strong>✥ RANK 3: DEEP OVERCLOCK.</strong> Увеличь один Attribute на 1. Новый режим: 1 WP + 2 OVERLOAD → 1D8 Artifact Die. Standard и Deep Overclock не складываются.",
      "<strong>✥ RANK 4: ADVANCED OVERCLOCK.</strong> Увеличь один Attribute на 1. Deep Overclock даёт 1D10 при прежней стоимости 1 WP + 2 OVERLOAD.",
      "<strong>✥ RANK 5: FULL SYSTEM ACCESS.</strong> Увеличь один Attribute на 1. MAX OVERLOAD +2. Deep Overclock: 2 WP + 4 OVERLOAD → 1D12. REDLINE: в начале хода 2 WP и 4 OVERLOAD, до конца раунда одна дополнительная Slow Action, а повреждённые Attributes считаются равными нормальному максимуму при формировании Dice Pool.",
      "<strong>MAX OVERLOAD.</strong> Базовый предел равен максимальному WITS ×2, а на Recovery Protocol Rank 5 увеличивается ещё на 2."
    ])
  }),
  talent({
    id: "mortarCombat001",
    name: "Combat Protocol",
    role: "mortar-operational",
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: KILL RESPONSE.</strong> Пока активен, когда мортар лично убивает гуманоида, он получает 1D[Rank] WP, не более одного раза за раунд. WP сверх обычного максимума теряются.",
      "<strong>✥ RANK 1: ARMOR PENETRATION.</strong> После успешного попадания, но до броска брони, 1 WP: атака получает БП ×0.5. Не складывается с уже имеющимся БП ×0.5.",
      "<strong>✥ RANK 2: COMBAT CYCLING.</strong> 1 WP: дополнительная Fast Action только для вспомогательного боевого действия, включая AIM, DRAW WEAPON, RELOAD и аналоги. Не может быть дополнительной атакой. Не более раза за раунд.",
      "<strong>✥ RANK 3: LETHALITY ROUTINE.</strong> После попадания, до брони, потрать X WP: Damage атаки +X.",
      "<strong>✥ RANK 4: COUNTERMEASURE.</strong> Когда тебя атакуют, 1 WP: DODGE или PARRY без расходования обычного действия.",
      "<strong>✥ RANK 5: TERMINATION PROTOCOL.</strong> Если атака нанесла гуманоиду хотя бы 1 Damage после брони, 3 WP: гуманоид немедленно погибает. Против Monster вместо этого +3 Damage. Не более раза за раунд."
    ])
  }),
  talent({
    id: "mortarBulwark01",
    name: "Bulwark Protocol",
    role: "mortar-operational",
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: IMPACT RESPONSE.</strong> Пока активен, первый раз за бой, когда вражеская атака наносит хотя бы 1 Damage после брони, получи 1D[Rank] WP.",
      "<strong>✥ RANK 1: INTERPOSITION.</strong> Когда союзник в NEAR становится целью атаки и ты можешь физически до него добраться, 1 WP: немедленно переместись к нему и стань целью атаки вместо него. Действие не расходуется.",
      "<strong>✥ RANK 2: DAMAGE CONTROL.</strong> После определения входящего Damage потрать X WP и уменьши Damage на X.",
      "<strong>✥ RANK 3: DEFENSIVE PRIORITY.</strong> После попадания, до броска брони, 1 WP: либо удвой итоговый Armor Rating против атаки, либо полностью отмени её БП.",
      "<strong>✥ RANK 4: REDUNDANT ACTUATORS.</strong> Когда STR или AGI становится Broken, 2 WP: до конца следующего раунда действуй так, словно характеристика функциональна. Она не восстанавливается, Critical Injury продолжает действовать.",
      "<strong>✥ RANK 5: CORE CONTAINMENT.</strong> После физической Critical Injury 3 WP: полностью отмени её, Attribute остаётся Broken. Не действует на мгновенное уничтожение человеческого ядра. Не более раза за игровую сессию."
    ])
  }),
  talent({
    id: "mortarRecon0001",
    name: "Reconnaissance Protocol",
    role: "mortar-operational",
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: THREAT ACQUISITION.</strong> Пока активен, успешный SCOUTING, впервые обнаруживший гуманоидную засаду, скрытого враждебного гуманоида или активно прячущегося гуманоида, приносит 1D[Rank] WP. Одна цель или засада приносит WP лишь один раз.",
      "<strong>✥ RANK 1: ACTIVE SCAN.</strong> Перед SCOUTING roll 1 WP: +1D8 Artifact Die и игнорирование до -2 модификаторов от обычных проблем видимости.",
      "<strong>✥ RANK 2: THREAT PREDICTION.</strong> При Initiative всегда бери карту раньше остальных. После обычной карты можешь за 1 WP брать дополнительные карты сколько угодно раз, затем оставить одну.",
      "<strong>✥ RANK 3: MULTISPECTRAL VISION.</strong> 1 WP: до конца Turn обычные темнота, дым, туман и подобные визуальные препятствия не мешают зрению. Не даёт видеть через твёрдую материю или сверхъестественное сокрытие.",
      "<strong>✥ RANK 4: PRECISION PROCESSING.</strong> X WP: до конца сцены или боя +X к MARKSMANSHIP и SCOUTING.",
      "<strong>✥ RANK 5: OMNIDIRECTIONAL ARRAY.</strong> 3 WP до конца сцены: нельзя застать врасплох обычными средствами; обычные Sneak Attacks не получают преимуществ; воспринимаются угрозы независимо от направления; раз за раунд DODGE без действия; каждая атака и SCOUTING автоматически получают 1 успех до броска."
    ])
  }),
  talent({
    id: "mortarEngineer1",
    name: "Engineering Protocol",
    role: "mortar-operational",
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: TECHNICAL LEARNING.</strong> Пока активен, стоимость повышения CRAFTING и непосредственно ремесленных или инженерных General Talents уменьшается вдвое, если приобретаемый ранг не превышает текущий Rank Engineering Protocol. Дробная стоимость округляется вверх.",
      "<strong>✥ RANK 1: DIAGNOSTICS.</strong> Можно устанавливать протезы себе и другим без обычных штрафов. Перед CRAFTING roll, связанным с механизмом, ремонтом или устройством, 1 WP: +1D8 Artifact Die.",
      "<strong>✥ RANK 2: FIELD MAINTENANCE.</strong> Перед ремонтом STR или AGI 1 WP: ремонт занимает 15 минут вместо Quarter Day. CRAFTING и расход запчастей обычные.",
      "<strong>✥ RANK 3: SUBSTITUTE COMPONENTS.</strong> Перед ремонтом 1 WP: точные запчасти можно заменить обычными. Сверхтехнологичные запчасти не заменяются.",
      "<strong>✥ RANK 4: CRITICAL RECONSTRUCTION.</strong> При ремонте одной непостоянной механической Critical Injury 2 WP и бросок Resource Die точных запчастей: CRAFTING не требуется, травма полностью снимается. Время ремонта обычное.",
      "<strong>✥ RANK 5: PERFECT REPAIR.</strong> За 3 WP каждый успешный CRAFTING roll ремонта восстанавливает все недостающие единицы качества всех физических характеристик с любым типом запчастей и полностью снимает OVERLOAD, кроме перегрузки от самой способности. Resource Die всё равно бросается."
    ])
  }),
  talent({
    id: "mortarMobility01",
    name: "Mobility Protocol",
    role: "mortar-operational",
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: EXTENDED STRIDE.</strong> Пока активен, каждый RUN становится длиннее на число метров, равное Mobility Protocol Rank + Recovery Protocol Rank.",
      "<strong>✥ RANK 1: TERRAIN COMPENSATION.</strong> 1 WP: до конца Turn игнорируй обычные штрафы Difficult Terrain при беге, прыжках, лазании и перемещении.",
      "<strong>✥ RANK 2: SERVO BURST.</strong> 1 WP: немедленно выполни MOVE без расходования обычного действия. Не более раза за раунд.",
      "<strong>✥ RANK 3: VERTICAL TRACTION.</strong> 1 WP: до конца раунда перемещайся по вертикальным поверхностям как по обычным. За 2 WP можно двигаться вверх ногами; в конце раунда потрать ещё 1 WP, если остаёшься на стене или вверх ногами, иначе падаешь.",
      "<strong>✥ RANK 4: ACCELERATED FRAME.</strong> В начале хода 2 WP: до конца раунда дополнительная Fast Action, +1 MOVE, +1 DODGE.",
      "<strong>✥ RANK 5: HIGH-SPEED STATE.</strong> В начале хода 3 WP: до конца раунда дополнительная Slow Action и Fast Action; каждое обычное MOVE преодолевает на одну зону больше."
    ])
  }),
  ...[3, 4, 5].flatMap(tier => [
    ["strength", "STR"],
    ["agility", "AGI"],
    ["wits", "WITS"],
    ["empathy", "EMPATHY"]
  ].map(([attribute, label], position) => talent({
    id: `mCal${tier}${attribute.slice(0, 3)}000${position + 1}`.slice(0, 16),
    name: `Recovery Protocol Rank ${tier}: +1 ${label}`,
    role: "mortar-attribute",
    tier,
    attribute,
    description: html([
      `<strong>Системный выбор для мортара.</strong> При получении Recovery Protocol Rank ${tier} увеличь ${label} на 1. Этот выбор не стоит XP и не считается отдельным талантом при импорте.`,
      "Один Attribute после повышений Recovery Protocol не может превышать 8."
    ])
  })))
];

export function applyMortarBaseRules(baseRules) {
  if (!baseRules.ageCategories.mortar) {
    baseRules.ageCategories.mortar = {
      name: "Мортар",
      attributePoints: 13,
      skillPoints: 10,
      talentPoints: 0,
      reputation: 0
    };
  }

  if (!baseRules.kin.some(entry => entry.id === "mortar")) {
    baseRules.kin.push({
      id: "mortar",
      name: "Мортар",
      minimumAge: 0,
      youngMax: 9999,
      adultMax: 9999,
      maximumAge: 9999,
      talentSourceName: "Recovery Protocol [1]",
      creationMode: "mortar",
      summary: "Загадочный пробужденный механизм с разумным интеллектуальным ядром. Во многих частях мира мортары считаются плохим предзнаменованием, в других - интересными механизмами, в третьих - врагами народа. Мортар не выбирает профессию, начинает с Recovery Protocol Rank 1 и развивает Operational Protocols вместо Professional Paths."
    });
  }

  baseRules.builderSettings ??= {};
  baseRules.builderSettings.enabledKin ??= baseRules.kin.map(entry => entry.id);
  if (!baseRules.builderSettings.enabledKin.includes("mortar")) baseRules.builderSettings.enabledKin.push("mortar");

  baseRules.rulesVersion = "2026.09.10-1.4.0";
  baseRules.minimumBuilderVersion = "1.4.0";
  return baseRules;
}

export function mortarTalentEntry(item) {
  const role = item.flags?.["air-islands-builder"]?.role ?? null;
  const tier = Number(item.flags?.["air-islands-builder"]?.tier ?? 0) || null;
  const attribute = item.flags?.["air-islands-builder"]?.attribute ?? null;
  return {
    sourcePackage: MORTAR_SOURCE_PACKAGE,
    role,
    tier,
    attribute
  };
}

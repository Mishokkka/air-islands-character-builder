const MORTAR_SOURCE_PACKAGE = "air-islands.mortar";

const MORTAR_ICONS = {
  body: "WhitetransparentICONS/Other/blackbackground/bolt-eye.svg",
  recovery: "WhitetransparentICONS/Other/blackbackground/techno-heart.svg",
  combat: "WhitetransparentICONS/Other/blackbackground/crescent-blade_1.svg",
  bulwark: "WhitetransparentICONS/Other/blackbackground/layered-armor.svg",
  recon: "WhitetransparentICONS/Other/blackbackground/orbital-rays.svg",
  mobility: "WhitetransparentICONS/Other/blackbackground/fast-arrow.svg",
  engineering: "WhitetransparentICONS/Other/blackbackground/big-gear.svg"
};

const html = lines => lines.map(line => `<p>${line}</p>`).join("\n");

function talent({ id, name, systemType = "general", role, description, img = "icons/svg/cog.svg", tier = null, attribute = null }) {
  return {
    name,
    type: "talent",
    img,
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
    role: "mortar-body",
    img: MORTAR_ICONS.body,
    description: html([
      "<strong>МЕХАНИЧЕСКОЕ ТЕЛО.</strong> Мортару не требуются пища, вода, сон, дыхание или внешний источник энергии. Он полностью невосприимчив к болезням.",
      "<strong>ИНТЕЛЛЕКТУАЛЬНОЕ ЯДРО.</strong> Разум мортара интегрирован в защищённый вычислительный блок. Мортар использует WITS и EMPATHY как обычные Attributes.",
      "<strong>ВСТРОЕННАЯ БРОНЯ.</strong> Мортар имеет постоянный Armor Rating 2 от собственного корпуса.",
      "<strong>УСТОЙЧИВОСТЬ К РЕЖУЩЕМУ УРОНУ.</strong> Damage режущей атаки по мортару уменьшается на 1 до броска брони. Этим свойством Damage нельзя уменьшить ниже 1.",
      "<strong>ОТСУТСТВИЕ ЕСТЕСТВЕННОГО ВОССТАНОВЛЕНИЯ.</strong> REST, SLEEP и HEALING не восстанавливают потерянные STR или AGI мортара. Физические Critical Injuries мортара также не лечатся HEALING.",
      "<strong>REBOOT.</strong> REBOOT занимает Quarter Day и заменяет сон. Он восстанавливает WITS по обычным правилам сна, 1 EMPATHY и полностью снимает OVERLOAD. Во время REBOOT мортар может сменить один действующий пассивный Operational Protocol.",
      "<strong>MAINTENANCE.</strong> MAINTENANCE занимает Quarter Day (6 часов). Во время технического обслуживания можно выполнять ремонт. Завершённое MAINTENANCE дополнительно снимает 1D6 OVERLOAD.",
      "<strong>ЗАПЧАСТИ.</strong> Запчасти являются Consumable Resource и имеют Resource Die D6, D8, D10 или D12. Мортар начинает с 1D10 обычных запчастей и 1D8 точных запчастей. Обычные запчасти используются для полевого восстановления потерянных STR и AGI. Точные запчасти используются для устранения Structural Damage и ремонта механических Critical Injuries. Отдельные особо тяжёлые операции и Critical Injuries могут прямо требовать сверхтехнологичных запчастей.",
      "<strong>ПРОВЕРКА РЕМОНТА.</strong> Если способность не указывает иное, ремонт занимает Quarter Day. Ремонтирующий совершает CRAFTING roll и одновременно бросает Resource Die используемых запчастей. Resource Die истощается по обычным правилам Consumable Resource. Результат Resource Die одновременно считается Artifact Die и добавляет успехи к ремонту. Resource Die бросается один раз за попытку и не перебрасывается при PUSH.",
      "<strong>ОБЫЧНЫЙ РЕМОНТ STR И AGI.</strong> Каждый успех ремонта восстанавливает 1 пункт выбранного Attribute. Если после ремонта обычными запчастями Attribute восстановлен не полностью, весь оставшийся невосстановленный урон становится Structural Damage. Текущее восстановленное значение становится временным максимумом этого Attribute до точного ремонта.",
      "<strong>ТОЧНЫЙ РЕМОНТ.</strong> Точные запчасти используются для устранения Structural Damage. Каждый успех возвращает 1 пункт утраченного максимума STR или AGI.",
      "<strong>CRITICAL INJURIES.</strong> Мортары используют отдельные механические таблицы Critical Injuries по типам урона. Их лечение заменяется ремонтом через CRAFTING. Требуемый тип запчастей, время и дополнительные условия указываются в соответствующей записи Critical Injury.",
      "<strong>OVERLOAD.</strong> OVERLOAD показывает совокупную нагрузку на приводы, вычислительные системы и человеческое ядро мортара. Базовый MAX OVERLOAD равен постоянному максимальному WITS ×2, а не текущему значению после полученного урона. На Recovery Protocol Rank 5 предел увеличивается ещё на 2.",
      "<strong>0–50%: STABLE.</strong> Дополнительных эффектов нет.",
      "<strong>БОЛЕЕ 50%, НО МЕНЕЕ 75%: HEIGHTENED STATE.</strong> +1 к проверкам STR и AGI; -1 к проверкам WITS и EMPATHY. Эти модификаторы изменяют только проверки и не меняют сами Attributes, максимальные значения, грузоподъёмность, состояние Broken или предел OVERLOAD.",
      "<strong>75–99%: CRITICAL OVERLOAD.</strong> Сохраняются все эффекты HEIGHTENED STATE. Кроме того, каждый PUSH после разрешения броска создаёт +1 OVERLOAD.",
      "<strong>100%: PSYCHOSIS.</strong> Как только OVERLOAD достигает MAX OVERLOAD, сначала полностью разрешается действие, вызвавшее перегрузку, после чего начинается PSYCHOSIS на D3 раунда. Во время PSYCHOSIS мортар должен использовать доступные действия для приближения к живым существам и нападения на них. При нескольких равноценных целях цель определяется случайно или GM. Мортар использует доступные боевые возможности рационально и может применять оружие и протоколы. После окончания PSYCHOSIS текущий OVERLOAD уменьшается на 1D6.",
      "<strong>ЕСТЕСТВЕННОЕ СНИЖЕНИЕ.</strong> Если мортар в течение целого Turn не получает ни одной единицы OVERLOAD, в конце Turn OVERLOAD уменьшается на 1. Под воздействием COLD мортар естественно снимает 2 OVERLOAD за Turn вместо 1. Под воздействием HEAT естественное снижение OVERLOAD прекращается. Каждая активация Recovery Protocol или Operational Protocol при HEAT создаёт дополнительно +1 OVERLOAD сверх обычного значения.",
      "Этот талант бесплатно получают все мортары. У него нет дополнительных рангов."
    ])
  }),
  talent({
    id: "mortarRecover001",
    name: "Recovery Protocol [1]",
    systemType: "kin",
    role: "mortar-recovery",
    img: MORTAR_ICONS.recovery,
    description: html([
      "<strong>ОБЩИЕ ПРАВИЛА ПРОТОКОЛОВ.</strong> Если способность Operational Protocol требует X WP, её использование создаёт X OVERLOAD, если сама способность прямо не устанавливает другое значение. Recovery Protocol использует значения OVERLOAD, указанные в его собственных рангах.",
      "<strong>ПАССИВНЫЕ ПРОТОКОЛЫ.</strong> Каждый Operational Protocol имеет одну пассивную способность. Одновременно активной может быть пассивная способность только одного известного Operational Protocol. При получении первого Operational Protocol его пассивная способность становится активной автоматически. При REBOOT можно отключить текущую пассивную способность и активировать пассивную способность другого известного Operational Protocol. Ранговые активные способности и постоянные свойства Operational Protocol работают независимо от выбранной пассивной способности.",
      "<strong>ПОЛУЧЕНИЕ НОВЫХ OPERATIONAL PROTOCOLS.</strong> Recovery Protocol Rank 2 открывает первый Operational Protocol на Rank 1 бесплатно. После достижения Recovery Protocol Rank 3 можно открывать дополнительные Operational Protocols. Чтобы открыть следующий, последний открытый Operational Protocol должен быть развит до Rank 3. Новый Operational Protocol приобретается на Rank 1 за обычную стоимость таланта.",
      "<strong>1D[RANK] WP.</strong> 1D[Rank] означает случайное значение от 1 до текущего Rank соответствующего Operational Protocol: Rank 1 = 1; Rank 2 = D2; Rank 3 = D3; Rank 4 = D4; Rank 5 = D5.",
      "<strong>✥ RANK 1: OVERCLOCK.</strong> Если проверка основана на твоём самом высоком максимальном Attribute, после первоначального броска проверки, но до решения о PUSH, можешь потратить X WP и добавить X D6 к Dice Pool. Если несколько Attributes имеют одинаковое максимальное значение, при каждом использовании можно выбрать любой из них. Сравниваются максимальные, а не текущие повреждённые значения Attributes. Получаешь X OVERLOAD. Добавленные D6 являются обычной частью Dice Pool и перебрасываются при PUSH вместе с остальными допустимыми кубами.",
      "<strong>✥ RANK 2: UNRESTRICTED ACCESS.</strong> OVERCLOCK теперь можно применять к проверке любого Attribute независимо от его значения. Немедленно выбери один Operational Protocol и получи его Rank 1 бесплатно.",
      "<strong>✥ RANK 3: DEEP OVERCLOCK.</strong> При получении ранга увеличь один Attribute на 1. OVERCLOCK получает второй режим: 1 WP + 2 OVERLOAD → 1D8 Artifact Die. При одной проверке выбирается либо Standard Overclock (X WP → X D6 → X OVERLOAD), либо Deep Overclock. Режимы не складываются. D8 входит в Dice Pool и перебрасывается при PUSH, если правила PUSH допускают переброс этого куба.",
      "<strong>✥ RANK 4: ADVANCED OVERCLOCK.</strong> При получении ранга увеличь один Attribute на 1. Deep Overclock теперь предоставляет 1D10 вместо 1D8. Стоимость остаётся 1 WP + 2 OVERLOAD. Standard Overclock остаётся доступен.",
      "<strong>✥ RANK 5: FULL SYSTEM ACCESS.</strong> При получении ранга увеличь один Attribute на 1. MAX OVERLOAD увеличивается на 2. Deep Overclock теперь стоит 2 WP + 4 OVERLOAD и предоставляет 1D12 Artifact Die. Standard Overclock остаётся доступен.",
      "<strong>REDLINE.</strong> В начале своего хода потрать 2 WP. REDLINE создаёт 4 OVERLOAD. До конца раунда получаешь одну дополнительную Slow Action. Для формирования Dice Pool все повреждённые Attributes считаются равными их нормальному максимальному значению, даже если фактически уменьшены или Broken. REDLINE не восстанавливает Attributes, не отменяет Critical Injuries и не снимает Conditions. После окончания раунда используются реальные текущие значения Attributes.",
      "<strong>MAX OVERLOAD.</strong> Базовый предел равен постоянному максимальному WITS ×2, а не текущему значению после полученного урона. На Recovery Protocol Rank 5 он увеличивается ещё на 2. Итоговый Attribute после повышений Recovery Protocol не может превышать 8."
    ])
  }),
  talent({
    id: "mortarCombat001",
    name: "Combat Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.combat,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: KILL RESPONSE.</strong> Пока эта пассивная способность активна, когда мортар лично убивает гуманоида, он получает 1D[Combat Protocol Rank] WP. Не более одного срабатывания за раунд. WP сверх обычного максимума теряются.",
      "<strong>✥ RANK 1: ARMOR PENETRATION.</strong> После успешного попадания, но до броска брони, потрать 1 WP. Атака получает БП ×0.5. Если оружие уже имеет БП ×0.5, эффекты не складываются.",
      "<strong>✥ RANK 2: COMBAT CYCLING.</strong> Потрать 1 WP, чтобы получить дополнительную Fast Action. Эта Fast Action может использоваться только для вспомогательного боевого действия, включая AIM, DRAW WEAPON, RELOAD и аналогичные действия. Она не может непосредственно использоваться для дополнительной атаки. Не более одного раза за раунд.",
      "<strong>✥ RANK 3: LETHALITY ROUTINE.</strong> После успешного попадания, но до броска брони, потрать X WP. Damage атаки увеличивается на X.",
      "<strong>✥ RANK 4: COUNTERMEASURE.</strong> Когда тебя атакуют, потрать 1 WP, чтобы выполнить DODGE или PARRY без расходования обычного действия.",
      "<strong>✥ RANK 5: TERMINATION PROTOCOL.</strong> Если твоя атака нанесла гуманоиду хотя бы 1 Damage после брони, можешь потратить 3 WP. Гуманоид немедленно погибает. Если целью является Monster, вместо этого атака наносит +3 Damage. Не более одного применения за раунд."
    ])
  }),
  talent({
    id: "mortarBulwark01",
    name: "Bulwark Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.bulwark,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: IMPACT RESPONSE.</strong> Пока эта пассивная способность активна, первый раз за бой, когда вражеская атака наносит тебе хотя бы 1 Damage после брони, получи 1D[Bulwark Protocol Rank] WP.",
      "<strong>✥ RANK 1: INTERPOSITION.</strong> Когда союзник в пределах NEAR становится целью атаки и ты физически способен добраться до него, потрать 1 WP. Ты немедленно перемещаешься к союзнику и становишься целью этой атаки вместо него. Это не расходует обычное действие.",
      "<strong>✥ RANK 2: DAMAGE CONTROL.</strong> После определения входящего Damage можешь потратить X WP. Уменьши Damage на X.",
      "<strong>✥ RANK 3: DEFENSIVE PRIORITY.</strong> После попадания по тебе, но до броска брони, потрать 1 WP и выбери один эффект: удвой свой итоговый Armor Rating против этой атаки; либо полностью отмени БП этой атаки. Для разрешения этой атаки она считается не имеющей Armor Penetration независимо от источника БП.",
      "<strong>✥ RANK 4: REDUNDANT ACTUATORS.</strong> Когда STR или AGI становится Broken, можешь немедленно потратить 2 WP. До конца следующего раунда можешь действовать так, словно эта Broken характеристика всё ещё функциональна. Характеристика не восстанавливается, а Critical Injury продолжает действовать.",
      "<strong>✥ RANK 5: CORE CONTAINMENT.</strong> После получения физической Critical Injury можешь потратить 3 WP и полностью отменить её. Attribute остаётся Broken. Способность не действует на результат, прямо обозначенный как мгновенное уничтожение человеческого ядра. Не более одного раза за игровую сессию."
    ])
  }),
  talent({
    id: "mortarRecon0001",
    name: "Reconnaissance Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.recon,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: THREAT ACQUISITION.</strong> Пока эта пассивная способность активна, успешный SCOUTING, впервые обнаруживший гуманоидную засаду, скрытого враждебного гуманоида или враждебного гуманоида, который активно прячется, приносит 1D[Reconnaissance Protocol Rank] WP. Одна конкретная цель или одна конкретная засада может дать WP только один раз.",
      "<strong>✥ RANK 1: ACTIVE SCAN.</strong> Перед SCOUTING roll потрать 1 WP. Добавь 1D8 Artifact Die и игнорируй до -2 модификаторов от обычных проблем видимости.",
      "<strong>✥ RANK 2: THREAT PREDICTION.</strong> При определении Initiative ты всегда берёшь Initiative Cards раньше остальных участников боя. После получения обычной карты можешь потратить 1 WP и взять одну дополнительную Initiative Card. Если результат тебя не устраивает, можешь снова потратить 1 WP и взять ещё одну карту. Процедуру можно повторять, пока у тебя есть WP. После завершения выбора оставь одну из полученных карт, остальные верни.",
      "<strong>✥ RANK 3: MULTISPECTRAL VISION.</strong> Потрать 1 WP. До конца одного Turn обычная темнота, дым, туман и аналогичные визуальные препятствия не мешают твоему зрению. Способность не позволяет видеть сквозь твёрдую материю или сверхъестественное сокрытие.",
      "<strong>✥ RANK 4: PRECISION PROCESSING.</strong> Потрать X WP. До окончания текущей сцены или боя получаешь +X к MARKSMANSHIP и SCOUTING.",
      "<strong>✥ RANK 5: OMNIDIRECTIONAL ARRAY.</strong> Потрать 3 WP. До конца сцены: тебя нельзя застать врасплох обычными средствами; обычные Sneak Attacks не получают преимуществ против тебя; ты воспринимаешь угрозы вокруг себя независимо от направления взгляда; один раз за каждый раунд можешь выполнить DODGE без расходования действия; каждая твоя атака и каждая проверка SCOUTING автоматически получает 1 успех до броска кубов."
    ])
  }),
  talent({
    id: "mortarEngineer1",
    name: "Engineering Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.engineering,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: TECHNICAL LEARNING.</strong> Пока эта пассивная способность активна, стоимость повышения CRAFTING и непосредственно ремесленных или инженерных General Talents уменьшается вдвое, если приобретаемый ранг навыка или таланта не превышает текущий Engineering Protocol Rank. Дробная стоимость округляется вверх.",
      "<strong>✥ RANK 1: DIAGNOSTICS.</strong> Начиная с этого ранга мортар может устанавливать протезы себе и другим существам без обычных штрафов за установку протеза. Перед CRAFTING roll, непосредственно связанным с механизмом, ремонтом или устройством, можешь потратить 1 WP и добавить 1D8 Artifact Die.",
      "<strong>✥ RANK 2: FIELD MAINTENANCE.</strong> Перед ремонтом STR или AGI потрать 1 WP. Такой ремонт занимает 15 минут вместо Quarter Day. CRAFTING roll и расход запчастей производятся как обычно.",
      "<strong>✥ RANK 3: SUBSTITUTE COMPONENTS.</strong> Перед одним ремонтом потрать 1 WP. В течение этой попытки полностью игнорируется необходимость в точных запчастях: вместо них можно использовать обычные запчасти. Способность не заменяет сверхтехнологичные запчасти, если конкретная операция прямо требует их.",
      "<strong>✥ RANK 4: CRITICAL RECONSTRUCTION.</strong> При ремонте одной непостоянной механической Critical Injury потрать 2 WP и брось Resource Die точных запчастей. CRAFTING roll для этой операции не требуется. Critical Injury полностью снимается. Resource Die истощается по обычным правилам. Операция занимает обычное время ремонта этой Critical Injury, если другой эффект не сокращает его.",
      "<strong>✥ RANK 5: PERFECT REPAIR.</strong> За 3 WP каждый успешный CRAFTING roll, совершённый для ремонта, автоматически восстанавливает все недостающие единицы качества всех физических характеристик, используя любой имеющийся тип запчастей. Кроме того, Perfect Repair полностью снимает весь OVERLOAD, кроме получаемого от использования этой способности. Resource Die всё равно бросается и может истощиться."
    ])
  }),
  talent({
    id: "mortarMobility01",
    name: "Mobility Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.mobility,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: EXTENDED STRIDE.</strong> Пока эта пассивная способность активна, каждый твой RUN становится длиннее на количество метров, равное Mobility Protocol Rank + Recovery Protocol Rank.",
      "<strong>✥ RANK 1: TERRAIN COMPENSATION.</strong> Потрать 1 WP. До конца одного Turn игнорируй обычные штрафы Difficult Terrain при беге, прыжках, лазании и перемещении.",
      "<strong>✥ RANK 2: SERVO BURST.</strong> Потрать 1 WP, чтобы немедленно выполнить MOVE без расходования обычного действия. Не более одного раза за раунд.",
      "<strong>✥ RANK 3: VERTICAL TRACTION.</strong> Потрать 1 WP. До конца текущего раунда можешь перемещаться по вертикальным поверхностям так, будто они являются обычной поверхностью. За 2 WP мортар получает возможность перемещаться вверх ногами. В конце раунда потрать ещё 1 WP, если находишься на вертикальной стене или вверх ногами, чтобы не упасть.",
      "<strong>✥ RANK 4: ACCELERATED FRAME.</strong> В начале своего хода потрать 2 WP. До конца раунда получи дополнительную Fast Action, +1 к MOVE и +1 к DODGE.",
      "<strong>✥ RANK 5: HIGH-SPEED STATE.</strong> В начале своего хода потрать 3 WP. До конца раунда получаешь одну дополнительную Slow Action и одну дополнительную Fast Action. Кроме того, каждое обычное MOVE в течение этого раунда позволяет преодолеть на одну зону больше обычного."
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
    img: MORTAR_ICONS.recovery,
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

  baseRules.rulesVersion = "2026.09.10-1.4.1";
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

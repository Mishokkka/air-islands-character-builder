const MORTAR_SOURCE_PACKAGE = "air-islands.mortar";

const MORTAR_ICONS = {
  body: "WhitetransparentICONS/Other/blackbackground/bolt-eye.svg",
  recovery: "WhitetransparentICONS/Other/blackbackground/techno-heart.svg",
  combat: "WhitetransparentICONS/Other/blackbackground/crescent-blade_1.svg",
  bulwark: "WhitetransparentICONS/Other/blackbackground/layered-armor.svg",
  recon: "WhitetransparentICONS/Other/blackbackground/orbital-rays.svg",
  mobility: "WhitetransparentICONS/Other/blackbackground/fast-arrow.svg",
  engineering: "WhitetransparentICONS/Other/blackbackground/big-gear.svg",
  command: "icons/svg/cog.svg"
};

const html = lines => lines.map(line => `<p>${line}</p>`).join("\n");

function talent({ id, name, systemType = "general", role, description, img = "icons/svg/cog.svg" }) {
  return {
    name,
    type: "talent",
    img,
    effects: [],
    flags: {
      "air-islands-builder": { role }
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
      "<strong>МЕХАНИЧЕСКОЕ ТЕЛО.</strong> Мортару не требуются пища, вода, сон, дыхание или внешний источник энергии. Он полностью невосприимчив к большинству болезней и ядов, удушению, состояниям Hungry, Sleepy, Thirsty, Cold. Для прочих эффектов он считается гуманоидом, но не имеет биологического тела, с которым могут взаимодействовать таланты и заклинания.",
      "<strong>ИНТЕЛЛЕКТУАЛЬНОЕ ЯДРО.</strong> Разум мортара интегрирован в защищённый вычислительный блок. Мортар использует WITS и EMPATHY как обычные Attributes.",
      "<strong>ВСТРОЕННАЯ БРОНЯ.</strong> Мортар имеет постоянный Armor Rating 2 от собственного корпуса.",
      "<strong>УСТОЙЧИВОСТЬ К РЕЖУЩЕМУ УРОНУ.</strong> Damage режущей атаки по мортару уменьшается на 1 до броска брони. Этим свойством Damage нельзя уменьшить ниже 1.",
      "<strong>ОТСУТСТВИЕ ЕСТЕСТВЕННОГО ВОССТАНОВЛЕНИЯ.</strong> REST, SLEEP и HEALING не восстанавливают потерянные характеристики мортара. Физические Critical Injuries мортара также не лечатся HEALING или со временем.",
      "<strong>REBOOT.</strong> REBOOT занимает Quarter Day и заменяет сон. Он восстанавливает 1 ед. WITS, 1 ед. EMPATHY и полностью снимает OVERLOAD. Во время REBOOT мортар может сменить один действующий пассивный Operational Protocol. REBOOT может быть прерван в любой момент, но не даёт бонусов, если не завершён полностью.",
      "<strong>MAINTENANCE.</strong> MAINTENANCE занимает Quarter Day. Во время технического обслуживания можно выполнять ремонт. Завершённое MAINTENANCE снимает 1D6 OVERLOAD.",
      "<strong>ЗАПЧАСТИ.</strong> Запчасти являются Consumable Resource и имеют Resource Die: D6, D8, D10 или D12. Мортар начинает с 1D10 обычных запчастей и 1D8 точных запчастей в инвентаре. Обычные запчасти используются для полевого восстановления потерянных STR и AGI. Точные запчасти используются для устранения Structural Damage и ремонта механических Critical Injuries. Отдельные особо тяжёлые операции и Critical Injuries могут прямо требовать сверхтехнологичных запчастей.",
      "<strong>ПРОВЕРКА РЕМОНТА.</strong> Если способность не указывает иное, ремонт занимает Quarter Day. Ремонтирующий совершает CRAFTING roll и одновременно бросает Resource Die используемых запчастей. Resource Die истощается по обычным правилам Consumable Resource. Результат Resource Die одновременно считается Artifact Die и добавляет успехи к ремонту. Resource Die бросается один раз за попытку и не перебрасывается при PUSH.",
      "<strong>ОБЫЧНЫЙ РЕМОНТ STR И AGI.</strong> Каждый успех ремонта восстанавливает 1 пункт выбранного Attribute. Если после ремонта обычными запчастями Attribute восстановлен не полностью, весь оставшийся невосстановленный урон становится Structural Damage. Текущее восстановленное значение становится временным максимумом этого Attribute до точного ремонта.",
      "<strong>ТОЧНЫЙ РЕМОНТ.</strong> Точные запчасти используются для устранения Structural Damage. Каждый успех точного ремонта уменьшает Structural Damage на 1 и одновременно восстанавливает соответствующий Attribute на 1, но не выше нового максимума.",
      "<strong>CRITICAL INJURIES.</strong> Мортары используют отдельные механические таблицы Critical Injuries по типам урона. Их лечение заменяется ремонтом через CRAFTING. Требуемый тип запчастей, время и дополнительные условия указываются в соответствующей записи Critical Injury. Если конкретная запись Critical Injury противоречит общим правилам ремонта мортара, применяется текст этой Critical Injury.",
      "<strong>OVERLOAD.</strong> OVERLOAD показывает совокупную нагрузку на приводы, вычислительные системы и вычислительное ядро мортара. Базовый MAX OVERLOAD равен постоянному максимальному WITS × 2, а не текущему значению после полученного урона. На Recovery Protocol Rank 5 предел увеличивается ещё на 2.",
      "<strong>0–50%: STABLE.</strong> Дополнительных эффектов нет.",
      "<strong>БОЛЕЕ 50%, НО МЕНЕЕ 75%: HEIGHTENED STATE.</strong> +1 к проверкам STR и AGI; -1 к проверкам WITS и EMPATHY. Эти модификаторы изменяют только проверки и не меняют сами Attributes, максимальные значения, грузоподъёмность, состояние Broken или предел OVERLOAD.",
      "<strong>75–99%: CRITICAL OVERLOAD.</strong> Сохраняются все эффекты HEIGHTENED STATE. Кроме того, каждый PUSH после разрешения броска создаёт +1 OVERLOAD.",
      "<strong>100%: PSYCHOSIS.</strong> Как только OVERLOAD достигает MAX OVERLOAD, сначала полностью разрешается действие, вызвавшее перегрузку, после чего начинается PSYCHOSIS на D3 раунда. Во время PSYCHOSIS мортар должен использовать доступные действия для приближения к живым существам и нападения на них. При нескольких равноценных целях цель определяется случайно или GM. Мортар использует доступные боевые возможности рационально и может применять оружие и протоколы. После окончания PSYCHOSIS текущий OVERLOAD уменьшается на 1D6.",
      "<strong>ЕСТЕСТВЕННОЕ СНИЖЕНИЕ.</strong> Если мортар в течение целого Turn (15 минут) не получает ни одной единицы OVERLOAD, в конце Turn OVERLOAD уменьшается на 1 (4 ед. в час). Под воздействием COLD мортар естественно снимает 2 OVERLOAD за Turn вместо 1. Под воздействием HEAT естественное снижение OVERLOAD прекращается. Каждая активация Recovery Protocol или Operational Protocol создаёт дополнительно +1 OVERLOAD сверх обычного значения.",
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
      "<strong>АКТИВАЦИЯ.</strong> Если способность Operational Protocol требует X WP, её использование создаёт X OVERLOAD, если сама способность прямо не устанавливает другое значение. Recovery Protocol использует значения OVERLOAD, указанные в его собственных рангах. Активация и применение способностей протоколов не требует действий, если это не написано в самой способности. Способности разных рангов разных Protocol могут использоваться одновременно.",
      "<strong>ПАССИВНЫЕ ПРОТОКОЛЫ.</strong> Каждый Operational Protocol имеет одну пассивную способность. Одновременно активной может быть пассивная способность только одного известного Operational Protocol. При получении первого Operational Protocol его пассивная способность становится активной автоматически. При REBOOT мортар может отключить текущую пассивную способность и активировать пассивную способность другого известного Operational Protocol. Ранговые активные способности и постоянные свойства Operational Protocol работают независимо от того, какая пассивная способность выбрана.",
      "<strong>ПОЛУЧЕНИЕ НОВЫХ OPERATIONAL PROTOCOLS.</strong> Recovery Protocol Rank 2 открывает первый Operational Protocol на Rank 1. После достижения Recovery Protocol Rank 3 можно открывать дополнительные Operational Protocols. Чтобы открыть следующий Operational Protocol, последний открытый Operational Protocol должен быть развит до Rank 3. Новый Operational Protocol приобретается на Rank 1 за обычную стоимость таланта.",
      "<strong>1D[RANK] WP.</strong> Запись 1D[Rank] WP означает случайное значение от 1 до текущего Rank соответствующего Operational Protocol: Rank 1 = 1; Rank 2 = D2; Rank 3 = D3; Rank 4 = D4; Rank 5 = D5.",
      "<strong>✥ RANK 1: OVERCLOCK.</strong> Если проверка основана на твоём самом высоком Attribute, после первоначального броска проверки, но до решения о PUSH, можешь потратить X WP, затем добавь X D6 к Dice Pool. Если несколько Attributes имеют одинаковое максимальное значение, при каждом использовании можно выбрать любой из них. Сравниваются максимальные, а не текущие повреждённые значения Attributes. Получаешь X OVERLOAD. Добавленные D6 являются обычной частью Dice Pool и перебрасываются при PUSH вместе с остальными допустимыми кубами.",
      "<strong>✥ RANK 2: UNRESTRICTED ACCESS.</strong> OVERCLOCK теперь можно применять к проверке любого Attribute независимо от его значения. Немедленно выбери один Operational Protocol и получи его Rank 1.",
      "<strong>✥ RANK 3: DEEP OVERCLOCK.</strong> При получении ранга увеличь один Attribute на 1. OVERCLOCK получает второй режим: 1 WP + 2 OVERLOAD → 1D8 Artifact Die. При одной проверке выбирается либо Standard Overclock (X WP → X D6 → X OVERLOAD), либо Deep Overclock. Режимы не складываются. D8 входит в Dice Pool и перебрасывается при PUSH, если правила PUSH допускают переброс этого куба.",
      "<strong>✥ RANK 4: ADVANCED OVERCLOCK.</strong> При получении ранга увеличь один Attribute на 1. Deep Overclock теперь предоставляет 1D10 вместо 1D8. Стоимость остаётся 1 WP + 2 OVERLOAD. Standard Overclock остаётся доступен.",
      "<strong>✥ RANK 5: FULL SYSTEM ACCESS.</strong> При получении ранга увеличь один Attribute на 1. MAX OVERLOAD увеличивается на 2. Deep Overclock теперь стоит 2 WP + 4 OVERLOAD и предоставляет 1D12 Artifact Die. Standard Overclock остаётся доступен.",
      "<strong>REDLINE.</strong> В начале своего хода потрать 2 WP. REDLINE создаёт 4 OVERLOAD. До конца раунда получаешь дополнительный Slow Action. Для формирования Dice Pool все повреждённые Attributes считаются равными их нормальному максимальному значению, даже если фактически уменьшены или Broken, игнорируя состояние Broken до конца REDLINE. REDLINE не восстанавливает Attributes, не отменяет Critical Injuries и не снимает Conditions. После окончания раунда используются реальные текущие значения Attributes."
    ])
  }),
  talent({
    id: "mortarCombat001",
    name: "Combat Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.combat,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: KILL RESPONSE.</strong> Пока эта пассивная способность активна, когда мортар лично убивает гуманоида, он получает 1D[Combat Protocol Rank] WP. Не более одного срабатывания за раунд.",
      "<strong>✥ RANK 1: ARMOR PENETRATION.</strong> После успешного попадания, но до броска брони, потрать 1 WP. Атака получает БП ×0.5. Если оружие уже имеет БП ×0.5, эффекты не складываются.",
      "<strong>✥ RANK 2: COMBAT CYCLING.</strong> Потрать 1 WP, чтобы получить дополнительную Fast Action. Эта Fast Action может использоваться только для вспомогательного боевого действия, включая AIM, DRAW WEAPON, RELOAD и аналогичные действия. Она не может непосредственно использоваться для дополнительной атаки. Не более одного раза за раунд.",
      "<strong>✥ RANK 3: LETHALITY ROUTINE.</strong> После успешного попадания, но до броска брони, потрать X WP (но не более Rank). Damage атаки увеличивается на X.",
      "<strong>✥ RANK 4: COUNTERMEASURE.</strong> Когда тебя атакуют, потрать 1 WP, чтобы выполнить DODGE или PARRY без расходования обычного действия.",
      "<strong>✥ RANK 5: TERMINATION PROTOCOL.</strong> Если твоя атака нанесла гуманоиду хотя бы 1 Damage после брони, можешь потратить 3 WP. Гуманоид немедленно погибает. Если целью является Monster, вместо этого атака наносит +3 Damage. Не более одного применения за бой."
    ])
  }),
  talent({
    id: "mortarBulwark01",
    name: "Bulwark Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.bulwark,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: IMPACT RESPONSE.</strong> Пока эта пассивная способность активна, первый раз за бой, когда вражеская атака наносит тебе хотя бы 1 Damage после брони, получи 1D[Bulwark Protocol Rank] WP. Врожденный доспех становится равен 4.",
      "<strong>✥ RANK 1: INTERPOSITION.</strong> Когда союзник становится целью атаки и ты физически способен добраться до него за MOVE, потрать 1 WP. Ты немедленно перемещаешься к союзнику и становишься целью этой атаки вместо него. Это не расходует действие, если ты тратишь 2 WP.",
      "<strong>✥ RANK 2: DAMAGE CONTROL.</strong> После определения входящего Damage, но до броска Armor можешь потратить X WP (но не более Rank). Уменьши Damage на X.",
      "<strong>✥ RANK 3: DEFENSIVE PRIORITY.</strong> После попадания по тебе, но до броска брони, потрать 1 WP и выбери один эффект: удвой свой итоговый Armor Rating против этой атаки, при этом Врожденный доспех не ломается и не получает урон от этой атаки; полностью отмени БП этой атаки, так что для разрешения этой атаки она считается не имеющей Armor Penetration независимо от источника БП; либо откажись от брони, но уменьши урон на 1D3.",
      "<strong>✥ RANK 4: REDUNDANT ACTUATORS.</strong> Когда STR или AGI становится Broken, можешь немедленно потратить 2 WP. До конца следующего раунда можешь действовать так, словно эта Broken характеристика всё ещё функциональна. Critical Injury продолжает действовать.",
      "<strong>✥ RANK 5: CORE CONTAINMENT.</strong> После получения физической Critical Injury можешь потратить 3 WP и полностью отменить её. Attribute остаётся Broken. Способность не действует на результат, прямо обозначенный как мгновенное уничтожение вычислительного ядра. Не более одного раза за игровую сессию."
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
      "<strong>✥ RANK 4: PRECISION PROCESSING.</strong> Потрать X WP (но не более Rank). До окончания текущей сцены или боя получаешь +X к MARKSMANSHIP и SCOUTING.",
      "<strong>✥ RANK 5: OMNIDIRECTIONAL ARRAY.</strong> Потрать 3 WP. До конца сцены: тебя нельзя застать врасплох обычными средствами; обычные Sneak Attacks не получают преимуществ против тебя; ты воспринимаешь угрозы вокруг себя независимо от направления взгляда; один раз за каждый раунд можешь выполнить DODGE без расходования действия; каждая твоя атака и каждая проверка SCOUTING с PRECISION PROCESSING автоматически получает 1 успех до броска кубов."
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
      "<strong>✥ RANK 5: PERFECT REPAIR.</strong> За 3 WP при успешном ремонте полностью восстанови текущие STR и AGI ремонтируемого мортара и/или устрани весь его Structural Damage при использовании точных запчастей. PERFECT REPAIR не устраняет Critical Injuries, если их собственное правило не позволяет устранить их этим ремонтом. Кроме того, PERFECT REPAIR полностью снимает весь OVERLOAD, кроме получаемого от использования этой способности. Resource Die всё равно бросается и может истощиться."
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
      "<strong>✥ RANK 4: ACCELERATED FRAME.</strong> В начале своего хода потрать 2 WP. До конца раунда получи дополнительную Fast Action и +1 ко всем проверкам MOVE.",
      "<strong>✥ RANK 5: HIGH-SPEED STATE.</strong> В начале своего хода потрать 3 WP. До конца раунда получаешь одну дополнительную Slow Action и одну дополнительную Fast Action. Кроме того, каждое обычное MOVE в течение этого раунда позволяет преодолеть на одну зону больше обычного (+10 м скорости)."
    ])
  }),
  talent({
    id: "mortarCommand001",
    name: "Command Protocol",
    role: "mortar-operational",
    img: MORTAR_ICONS.command,
    description: html([
      "<strong>ПАССИВНЫЙ ПРОТОКОЛ: COMMAND RESPONSE.</strong> Пока эта пассивная способность активна, первый раз за сцену или бой, когда другой персонаж успешно проходит проверку, непосредственно усиленную одной из способностей Command Protocol, получи 1D[Command Protocol Rank] WP.",
      "<strong>✥ RANK 1: LINKED OVERCLOCK.</strong> Когда другой персонаж в пределах NEAR совершает проверку навыка, после первоначального броска, но до решения о PUSH, можешь потратить X WP и добавить X D6 к его Dice Pool. Все потраченные WP и весь OVERLOAD относятся к мортару, использующему LINKED OVERCLOCK. Получаешь X OVERLOAD, а любые дополнительные эффекты и модификаторы OVERLOAD, включая HEAT, применяются к мортару. Добавленные D6 являются обычной частью Dice Pool союзника и перебрасываются при PUSH вместе с остальными допустимыми кубами. LINKED OVERCLOCK использует только Standard Overclock и не позволяет передавать союзнику Deep Overclock.",
      "<strong>✥ RANK 2: TACTICAL LINK.</strong> После того как все участники боя получили Initiative Cards, но до начала первого раунда, можешь потратить X WP и выбрать до X союзников в пределах NEAR. Ты и выбранные союзники можете свободно перераспределить между собой полученные Initiative Cards. Карты противников не затрагиваются. После перераспределения инициатива фиксируется обычным образом.",
      "<strong>✥ RANK 3: IMMEDIATE DIRECTIVE.</strong> В начале хода другого персонажа в пределах NEAR можешь потратить 1 WP. Этот персонаж получает одну дополнительную Fast Action на текущий ход. Дополнительная Fast Action может использоваться для любого обычного Fast Action, не переносится на следующий ход и может быть сохранена для реактивного действия позднее в текущем раунде. Не более одного применения IMMEDIATE DIRECTIVE за раунд.",
      "<strong>✥ RANK 4: COMMAND NETWORK.</strong> В начале сцены или боя потрать 2 WP. До окончания этой сцены или боя создаётся COMMAND NETWORK. Пока другой персонаж находится в пределах NEAR и способен воспринимать твои команды, каждый обычный HELP с твоей стороны даёт ему дополнительный +1D6 к проверке. При использовании LINKED OVERCLOCK цель также получает ещё +1D6 сверх количества кубов, полученных за потраченные WP. COMMAND NETWORK прекращает действовать, если мортар становится Broken по WITS или входит в PSYCHOSIS.",
      "<strong>✥ RANK 5: BATTLEFIELD ORCHESTRATION.</strong> Дальность всех способностей Command Protocol, использующих NEAR, увеличивается до SHORT. В начале любого раунда можешь потратить 3 WP и выбрать до трёх других союзников в пределах SHORT. До конца текущего раунда каждый выбранный персонаж получает одну дополнительную Fast Action. Один из выбранных персонажей на твой выбор дополнительно получает одну Slow Action. Дополнительные действия должны быть использованы до конца текущего раунда и не переносятся. Мортар не может выбрать самого себя. Один персонаж не может получить преимущества BATTLEFIELD ORCHESTRATION более одного раза за один раунд."
    ])
  })
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

  baseRules.rulesVersion = "2026.09.11-1.5.1";
  baseRules.minimumBuilderVersion = "1.5.1";
  return baseRules;
}

export function mortarTalentEntry(item) {
  return {
    sourcePackage: MORTAR_SOURCE_PACKAGE,
    role: item.flags?.["air-islands-builder"]?.role ?? null,
    tier: null,
    attribute: null
  };
}

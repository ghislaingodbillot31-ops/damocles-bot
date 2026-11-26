-- ============================================================
--  FS25_DiscordBridge V2
--  Exporte l'état de la partie dans <profil>/modSettings/FS25_DiscordBridge/ :
--    status.xml : heure, météo, fermes (finances, stats), compteurs, joueurs, ouvriers IA  (toutes les 30 s)
--    full.xml   : sections détaillées pour la commande /fs25 du bot                          (toutes les 2 min)
--    counters_savegameN.xml : compteurs persistants
--  Le bot Discord lit ces fichiers par FTP. Le mod ne tourne que côté serveur et n'ouvre aucune connexion.
--
--  Règles de sécurité :
--   - serveur uniquement (rien n'est chargé, écrit ou observé chez un client) ;
--   - écriture limitée au dossier du mod ; aucune lecture hors de ses propres fichiers ;
--   - les crochets OBSERVENT : l'original s'exécute d'abord, ses valeurs de retour sont rendues telles quelles,
--     l'observation tourne dans un pcall (aucune erreur du mod ne remonte dans le jeu) ;
--   - pas de coordonnées de joueurs ni de droits admin exportés ; nombre de lignes et longueur des textes bornés.
-- ============================================================

DiscordBridge = {}
DiscordBridge.LOG_PREFIX         = "[DiscordBridge] "
DiscordBridge.STATUS_INTERVAL_MS = 10000
DiscordBridge.FULL_INTERVAL_MS   = 120000
DiscordBridge.WORK_INTERVAL_MS   = 1000
DiscordBridge.MAX_ROWS           = 1000   -- lignes max par section de full.xml
DiscordBridge.MAX_STRING         = 200    -- longueur max d'une valeur texte exportée

-- Compteurs persistants : counters[kind][farmId][clé] = valeur
--   produced    : litres/unités produits par les animaux et les ruches (clé = fillType)
--   sold        : litres/unités vendus à un point de vente (clé = fillType)
--   money_in    : € gagnés  (clé = MoneyType)
--   money_out   : € dépensés (clé = MoneyType)
--   transfer_in : € reçus par virement d'une autre ferme (clé = id de la ferme qui envoie)
--   work_vehicle  : secondes de conduite moteur allumé (clé = pseudo du joueur)
--   work_chainsaw : secondes de coupe à la tronçonneuse (clé = pseudo du joueur)
--   work_credit / work_debit : hectares travaillés dans le champ d'une autre ferme (clé = nom de stat) ;
--                  credit = ferme du véhicule (+), debit = propriétaire du champ (-). Le bot déplace les hectares.
DiscordBridge.counters = {
    produced = {}, sold = {}, money_in = {}, money_out = {}, transfer_in = {},
    work_vehicle = {}, work_chainsaw = {}, work_credit = {}, work_debit = {},
}
DiscordBridge.countersDirty = false
DiscordBridge.statusTimer = 0
DiscordBridge.fullTimer   = 0
DiscordBridge.workTimer   = 0

-- Lecture "sûre" d'un champ (évite un crash si l'API change)
local function safe(fn, default)
    local ok, value = pcall(fn)
    if ok and value ~= nil then
        return value
    end
    return default
end

local function isServer()
    return g_currentMission ~= nil and g_currentMission:getIsServer()
end

local function log(message)
    print(DiscordBridge.LOG_PREFIX .. message)
end

-- ------------------------------------------------------------
--  Compteurs
-- ------------------------------------------------------------
function DiscordBridge:addCounter(kind, farmId, key, amount)
    local byFarm = self.counters[kind]
    if byFarm == nil or farmId == nil or key == nil or type(amount) ~= "number" or amount <= 0 then
        return
    end
    byFarm[farmId] = byFarm[farmId] or {}
    byFarm[farmId][key] = (byFarm[farmId][key] or 0) + amount
    self.countersDirty = true
end

function DiscordBridge:loadCounters()
    if self.countersFile == nil or not fileExists(self.countersFile) then
        return
    end
    local xml = loadXMLFile("DiscordBridgeCounters", self.countersFile)
    if xml == nil or xml == 0 then
        return
    end
    local i = 0
    while true do
        local key = string.format("counters.c(%d)", i)
        if not hasXMLProperty(xml, key) then
            break
        end
        local kind  = getXMLString(xml, key .. "#kind")
        local farm  = getXMLInt(xml, key .. "#farm")
        local ft    = getXMLString(xml, key .. "#fillType")
        local value = getXMLFloat(xml, key .. "#value")
        -- un fichier modifié à la main ne doit pas pouvoir injecter n'importe quoi
        if kind ~= nil and self.counters[kind] ~= nil and farm ~= nil and ft ~= nil and #ft <= self.MAX_STRING
            and value ~= nil and value > 0 and value < 1e15 then
            self.counters[kind][farm] = self.counters[kind][farm] or {}
            self.counters[kind][farm][ft] = value
        end
        i = i + 1
    end
    delete(xml)
    log("Compteurs chargés : " .. i .. " entrées")
end

-- Écrit les <c kind farm fillType value> (fichier de sauvegarde et status.xml partagent le même format)
local function writeCounters(xml, prefix)
    local i = 0
    for kind, byFarm in pairs(DiscordBridge.counters) do
        for farmId, byKey in pairs(byFarm) do
            for key, value in pairs(byKey) do
                local ckey = string.format("%s.c(%d)", prefix, i)
                setXMLString(xml, ckey .. "#kind",     kind)
                setXMLInt   (xml, ckey .. "#farm",     farmId)
                setXMLString(xml, ckey .. "#fillType", key)
                setXMLFloat (xml, ckey .. "#value",    value)
                i = i + 1
            end
        end
    end
end

function DiscordBridge:saveCounters()
    if self.countersFile == nil or not self.countersDirty then
        return
    end
    local xml = createXMLFile("DiscordBridgeCounters", self.countersFile, "counters")
    if xml == nil or xml == 0 then
        return
    end
    writeCounters(xml, "counters")
    saveXMLFile(xml)
    delete(xml)
    self.countersDirty = false
end

-- ------------------------------------------------------------
--  Crochets (observation seule)
--  hookAfter(table, "méthode", observer) : appelle l'original puis observer(results, self, a1..a6) dans un pcall,
--  et renvoie exactement les valeurs de l'original. Fonctionne sur une classe ou sur une instance. Serveur uniquement.
--  Si la méthode n'existe pas (version du jeu différente), le crochet est ignoré et le log le dit.
-- ------------------------------------------------------------
local function hookAfter(target, method, label, observer)
    if target == nil or target[method] == nil then
        log(label .. " : " .. method .. " introuvable, non suivi")
        return false
    end
    local original = target[method]
    target[method] = function(self, a1, a2, a3, a4, a5, a6, ...)
        local results = { original(self, a1, a2, a3, a4, a5, a6, ...) }
        if isServer() then
            pcall(observer, results, self, a1, a2, a3, a4, a5, a6)
        end
        return unpack(results)
    end
    return true
end

-- Production animale : lait, lisier, fumier (sans outil = produit par les animaux), laine/œufs, miel
local PRODUCED_BY_ANIMALS = { MILK = true, GOATMILK = true, BUFFALOMILK = true, LIQUIDMANURE = true, MANURE = true }

hookAfter(PlaceableHusbandry, "addHusbandryFillLevelFromTool", "Lait/fumier",
    function(results, placeable, farmId, delta, fillTypeIndex, _, toolType)
        if toolType ~= nil or type(delta) ~= "number" or delta <= 0 or not isServer() then
            return
        end
        local name = g_fillTypeManager:getFillTypeNameByIndex(fillTypeIndex)
        if PRODUCED_BY_ANIMALS[name] then
            local applied = (type(results[1]) == "number" and results[1] > 0) and results[1] or delta
            DiscordBridge:addCounter("produced", farmId, name, applied)
        end
    end)

hookAfter(PlaceableHusbandryPallets, "updateOutput", "Laine/œufs",
    function(_, placeable, _, _, productionFactor, globalProductionFactor)
        if not placeable.isServer then
            return
        end
        local spec = placeable.spec_husbandryPallets
        local farmId = placeable:getOwnerFarmId()
        for _, fillTypeIndex in ipairs(spec.fillTypes) do
            local litersPerHour = spec.litersPerHour[fillTypeIndex] or 0
            if litersPerHour > 0 then
                local delta = productionFactor * globalProductionFactor * litersPerHour * g_currentMission.environment.timeAdjustment
                DiscordBridge:addCounter("produced", farmId, g_fillTypeManager:getFillTypeNameByIndex(fillTypeIndex), delta)
            end
        end
    end)

hookAfter(PlaceableBeehivePalletSpawner, "addFillLevel", "Miel",
    function(_, placeable, fillLevel)
        if placeable.isServer and type(fillLevel) == "number" and fillLevel > 0 then
            DiscordBridge:addCounter("produced", placeable:getOwnerFarmId(), "HONEY", fillLevel)
        end
    end)

-- Ventes : tout ce qui est livré à un point de vente (la classe hérite d'UnloadingStation) -> litres vendus par produit
hookAfter(SellingStation, "addFillLevelFromTool", "Ventes",
    function(results, _, farmId, delta, fillTypeIndex)
        local applied = type(results[1]) == "number" and results[1] or 0
        if applied <= 0 or type(delta) ~= "number" or delta <= 0 or not isServer() then
            return
        end
        local name = g_fillTypeManager:getFillTypeNameByIndex(fillTypeIndex)
        if name ~= nil then
            if not DiscordBridge.saleLogged then
                DiscordBridge.saleLogged = true
                log("Vente détectée : ferme " .. tostring(farmId) .. ", " .. name .. ", " .. tostring(applied))
            end
            DiscordBridge:addCounter("sold", farmId, name, applied)
        end
    end)

-- Travail chez un autre joueur : le jeu crédite les stats "...Hectares" à la ferme du TERRAIN touché.
-- getLastTouchedFarmlandFarmId note quel véhicule vient de toucher quel terrain ; updateFarmStats, observé juste après,
-- déclenche work_credit (ferme du véhicule) / work_debit (propriétaire). Rien n'est modifié dans le jeu.
local function noteTouch(results, vehicle)
    DiscordBridge.touch = { vehicle = vehicle, land = results[1], t = g_time }
end
local _ = hookAfter(Vehicle, "getLastTouchedFarmlandFarmId", "Travail chez un autre joueur", noteTouch)
    or hookAfter(WorkArea, "getLastTouchedFarmlandFarmId", "Travail chez un autre joueur", noteTouch)

hookAfter(FarmManager, "updateFarmStats", "Travail chez un autre joueur",
    function(_, _, farmId, statName, delta)
        local t = DiscordBridge.touch
        if t == nil or not isServer() or type(delta) ~= "number" or delta <= 0 or type(statName) ~= "string"
            or not statName:find("Hectares$") or t.land ~= farmId or math.abs((g_time or 0) - (t.t or 0)) > 100 then
            return
        end
        local worker = t.vehicle:getOwnerFarmId()
        if type(worker) == "number" and worker ~= farmId and worker ~= FarmManager.SPECTATOR_FARM_ID then
            if not DiscordBridge.creditLogged then
                DiscordBridge.creditLogged = true
                log("Travail chez un autre joueur : ferme " .. tostring(worker) .. " dans le champ de la ferme " .. tostring(farmId) .. " (" .. statName .. ")")
            end
            DiscordBridge:addCounter("work_credit", worker, statName, delta)
            DiscordBridge:addCounter("work_debit", farmId, statName, delta)
        end
    end)

-- Argent : chaque mouvement passe par g_currentMission:addMoney(montant, ferme, MoneyType)
-- -> money_in / money_out par type, et transfer_in pour les virements entre fermes
function DiscordBridge:getMoneyTypeName(moneyType)
    if self.moneyTypeNames == nil then
        self.moneyTypeNames = {}
        for key, value in pairs(MoneyType or {}) do
            if type(key) == "string" and type(value) == "table" then
                self.moneyTypeNames[value] = key
            end
        end
    end
    return self.moneyTypeNames[moneyType] or "OTHER"
end

-- Virement = une sortie TRANSFER puis une entrée TRANSFER du même montant (ordre quelconque), mises en relation ici
function DiscordBridge:matchTransfer(farmId, amount)
    local queue = self.pendingTransfers or {}
    self.pendingTransfers = queue
    for i, p in ipairs(queue) do
        if p.farmId ~= farmId and math.abs(p.amount + amount) < 0.01 then
            local from, to = (amount > 0) and p.farmId or farmId, (amount > 0) and farmId or p.farmId
            self:addCounter("transfer_in", to, tostring(from), math.abs(amount))
            table.remove(queue, i)
            return
        end
    end
    queue[#queue + 1] = { farmId = farmId, amount = amount }
    if #queue > 20 then
        table.remove(queue, 1)
    end
end

function DiscordBridge:hookMoney()
    local mission = g_currentMission
    if self.moneyHooked or mission == nil then
        return
    end
    self.moneyHooked = hookAfter(mission, "addMoney", "Argent", function(_, m, amount, farmId, moneyType)
        if not m:getIsServer() or type(amount) ~= "number" or amount == 0 or farmId == nil then
            return
        end
        local name = DiscordBridge:getMoneyTypeName(moneyType)
        DiscordBridge:addCounter(amount > 0 and "money_in" or "money_out", farmId, name, math.abs(amount))
        if name == "TRANSFER" then
            DiscordBridge:matchTransfer(farmId, amount)
        end
    end)
end

-- ------------------------------------------------------------
--  Temps de travail par joueur (salaires de l'association), relevé une fois par seconde
--  - Véhicule conduit par un joueur (pas l'IA), moteur allumé -> ferme propriétaire du véhicule
--  - Tronçonneuse tenue ET en train de couper -> ferme du joueur
--  ponytail: noms d'API non confirmés (getControllerName, getHeldHandTool, spec_chainsaw.isCutting) ; le premier relevé
--  de tronçonneuse est écrit dans le log pour vérifier.
-- ------------------------------------------------------------
local function playerNick(player)
    local nick = safe(function() return g_currentMission.userManager:getUserByUserId(player.userId):getNickname() end, nil)
    return nick or safe(function() return player:getName() end, nil) or safe(function() return player.nickname end, nil)
end

function DiscordBridge:trackWork(dt)
    self.workTimer = self.workTimer + dt
    if self.workTimer < self.WORK_INTERVAL_MS then
        return
    end
    local s = self.workTimer / 1000
    self.workTimer = 0

    for _, v in pairs(safe(function() return g_currentMission.vehicleSystem.vehicles end, {})) do
        if v.spec_enterable ~= nil and safe(function() return v:getIsControlled() end, false)
            and not safe(function() return v:getIsAIActive() end, false)
            and safe(function() return v:getIsMotorStarted() end, false) then
            local nick = safe(function() return v:getControllerName() end, nil)
            if nick ~= nil and nick ~= "" then
                self:addCounter("work_vehicle", safe(function() return v:getOwnerFarmId() end, nil), nick, s)
            end
        end
    end

    for _, p in pairs(safe(function() return g_currentMission.playerSystem.players end, {})) do
        local tool = safe(function() return p:getHeldHandTool() end, nil) or p.currentHandTool
        local spec = type(tool) == "table" and tool.spec_chainsaw or nil
        if spec ~= nil then
            if not self.chainsawLogged then
                self.chainsawLogged = true
                local keys = {}
                for k, val in pairs(spec) do if type(val) == "boolean" then keys[#keys + 1] = k .. "=" .. tostring(val) end end
                log("Tronçonneuse détectée, champs : " .. table.concat(keys, " "))
            end
            if spec.isCutting or spec.isWorking then
                local farmId = safe(function() return p:getFarmId() end, nil) or p.farmId
                self:addCounter("work_chainsaw", farmId, playerNick(p), s)
            end
        end
    end
end

-- ------------------------------------------------------------
--  Possessions (valeurs actuelles) : véhicules, usines, ruches -> exportées comme stats "_owned..."
-- ------------------------------------------------------------
function DiscordBridge:collectOwned()
    local owned = {}
    local function add(farmId, key)
        if farmId ~= nil then
            owned[farmId] = owned[farmId] or {}
            owned[farmId][key] = (owned[farmId][key] or 0) + 1
        end
    end

    for _, vehicle in pairs(safe(function() return g_currentMission.vehicleSystem.vehicles end, {})) do
        if vehicle.spec_pallet == nil and vehicle.spec_bigBag == nil then
            add(safe(function() return vehicle:getOwnerFarmId() end, nil), "_ownedVehicles")
        end
    end
    for _, placeable in pairs(safe(function() return g_currentMission.placeableSystem.placeables end, {})) do
        local farmId = safe(function() return placeable:getOwnerFarmId() end, nil)
        if placeable.spec_productionPoint ~= nil then add(farmId, "_ownedProductionPoints") end
        if placeable.spec_beehive ~= nil then add(farmId, "_ownedBeehives") end
    end
    return owned
end

-- ------------------------------------------------------------
--  full.xml : <section name="vehicles"><e k1="v1" k2="v2"/>...</section>
--  Le bot (commande /fs25) lit n'importe quelle section/colonne sans connaître les champs à l'avance :
--  pour une nouvelle catégorie, ajouter une section ICI. Chaque section est isolée par pcall ;
--  les valeurs indisponibles sont omises. Pas de coordonnées ni de droits admin.
-- ------------------------------------------------------------

-- Niveaux de remplissage -> "WHEAT=1200;BARLEY=300"
local function fillLevels(storage)
    local parts = {}
    local levels = safe(function() return storage:getFillLevels() end, nil) or safe(function() return storage.fillLevels end, {})
    for idx, lvl in pairs(levels) do
        if type(lvl) == "number" and lvl > 0.5 then
            parts[#parts + 1] = tostring(g_fillTypeManager:getFillTypeNameByIndex(idx)) .. "=" .. math.floor(lvl)
        end
    end
    table.sort(parts)
    return table.concat(parts, ";")
end

local function farmName(farmId)
    local f = farmId ~= nil and safe(function() return g_farmManager:getFarmById(farmId) end, nil) or nil
    return f ~= nil and tostring(f.name) or ""
end

local function placeables()
    return safe(function() return g_currentMission.placeableSystem.placeables end, {})
end

local function vehicles()
    return safe(function() return g_currentMission.vehicleSystem.vehicles end, {})
end

DiscordBridge.sections = {}

DiscordBridge.sections.vehicles = function()
    local rows = {}
    for _, v in pairs(vehicles()) do
        if v.spec_pallet == nil and v.spec_bigBag == nil then
            local diesel = safe(function() return v:getConsumerFillUnitIndex(FillType.DIESEL) end, nil)
            local farmId = safe(function() return v:getOwnerFarmId() end, nil)
            rows[#rows + 1] = {
                name = safe(function() return v:getFullName() end, "?"),
                farm = farmId, farmName = farmName(farmId),
                price     = safe(function() return v:getPrice() end, nil),
                sellPrice = safe(function() return v:getSellPrice() end, nil),
                age       = v.age,
                hours     = safe(function() return (v.operatingTime or 0) / 3600000 end, nil),
                damage    = safe(function() return v:getDamageAmount() end, nil),
                wear      = safe(function() return v:getWearTotalAmount() end, nil),
                dirt      = safe(function() return v:getDirtAmount() end, nil),
                fuel      = diesel and safe(function() return v:getFillUnitFillLevel(diesel) end, nil) or nil,
                fuelCap   = diesel and safe(function() return v:getFillUnitCapacity(diesel) end, nil) or nil,
                speed     = safe(function() return v:getLastSpeed() end, nil),
                motor     = safe(function() return v:getIsMotorStarted() end, nil),
                ai        = safe(function() return v:getIsAIActive() end, nil),
                driver    = safe(function() return v:getControllerName() end, nil),
                fills     = safe(function() return fillLevels(v) end, nil),
            }
        end
    end
    return rows
end

DiscordBridge.sections.fields = function()
    local rows = {}
    local fm = g_fieldManager
    for _, field in pairs(safe(function() return fm:getFields() end, nil) or fm.fields or {}) do
        local farmland = field.farmland
        local farmId = farmland ~= nil and safe(function() return g_farmlandManager:getFarmlandOwner(farmland.id) end, nil) or nil
        local st = safe(function() return field:getFieldState() end, nil) or field.fieldState
        rows[#rows + 1] = {
            id = safe(function() return field:getId() end, field.fieldId),
            farm = farmId, farmName = farmName(farmId),
            area = field.fieldArea or safe(function() return field:getAreaHa() end, nil),
            fruit  = st and safe(function() return g_fruitTypeManager:getFruitTypeByIndex(st.fruitTypeIndex).name end, nil) or nil,
            growth = st and st.growthState or nil, fert = st and st.sprayLevel or nil, lime = st and st.limeLevel or nil,
            weeds  = st and st.weedState or nil, plow = st and st.plowLevel or nil,
            roller = st and st.rollerLevel or nil, stones = st and st.stoneLevel or nil,
        }
    end
    return rows
end

DiscordBridge.sections.placeables = function()
    local rows = {}
    for _, p in pairs(placeables()) do
        local farmId = safe(function() return p:getOwnerFarmId() end, nil)
        local kind = p.spec_productionPoint and "production" or p.spec_husbandry and "animals"
            or p.spec_beehive and "beehive" or p.spec_silo and "silo" or p.spec_sellingStation and "sell" or "other"
        rows[#rows + 1] = {
            name = safe(function() return p:getName() end, "?"), kind = kind,
            farm = farmId, farmName = farmName(farmId),
            price = safe(function() return p:getPrice() end, nil), age = p.age,
        }
    end
    return rows
end

DiscordBridge.sections.productions = function()
    local rows = {}
    for _, p in pairs(placeables()) do
        local pp = p.spec_productionPoint and p.spec_productionPoint.productionPoint or nil
        if pp ~= nil then
            local farmId = safe(function() return p:getOwnerFarmId() end, nil)
            local active = {}
            for _, prod in pairs(pp.activeProductions or {}) do active[#active + 1] = tostring(prod.id) end
            rows[#rows + 1] = {
                name = safe(function() return p:getName() end, "?"),
                farm = farmId, farmName = farmName(farmId),
                active = table.concat(active, ";"),
                fills  = safe(function() return fillLevels(pp.storage) end, nil),
            }
        end
    end
    return rows
end

DiscordBridge.sections.husbandries = function()
    local rows = {}
    for _, p in pairs(placeables()) do
        local spec = p.spec_husbandry
        if spec ~= nil then
            local farmId = safe(function() return p:getOwnerFarmId() end, nil)
            rows[#rows + 1] = {
                name = safe(function() return p:getName() end, "?"),
                farm = farmId, farmName = farmName(farmId),
                animals  = safe(function() return p:getNumOfAnimals() end, nil),
                capacity = safe(function() return p:getMaxNumOfAnimals() end, nil),
                fills    = safe(function() return fillLevels(spec.storage) end, nil),
                productivity = safe(function() return p:getGlobalProductionFactor() end, nil),
            }
        end
    end
    return rows
end

DiscordBridge.sections.silos = function()
    local rows = {}
    for _, p in pairs(placeables()) do
        local spec = p.spec_silo
        if spec ~= nil then
            local farmId = safe(function() return p:getOwnerFarmId() end, nil)
            local parts = {}
            for _, st in pairs(spec.storages or {}) do parts[#parts + 1] = fillLevels(st) end
            rows[#rows + 1] = {
                name = safe(function() return p:getName() end, "?"),
                farm = farmId, farmName = farmName(farmId), fills = table.concat(parts, ";"),
            }
        end
    end
    return rows
end

DiscordBridge.sections.prices = function()
    local rows = {}
    for _, ft in pairs(safe(function() return g_fillTypeManager:getFillTypes() end, {})) do
        local price = safe(function() return g_currentMission.economyManager:getPricePerLiter(ft.index) * 1000 end, nil)
        if price ~= nil and price > 0 then
            rows[#rows + 1] = { fillType = ft.name, title = ft.title, pricePer1000 = price }
        end
    end
    return rows
end

DiscordBridge.sections.players = function()
    local rows = {}
    for _, user in pairs(safe(function() return g_currentMission.userManager:getUsers() end, {})) do
        local nick = safe(function() return user:getNickname() end, nil)
        if nick ~= nil and nick ~= "" then
            local farm = safe(function() return g_farmManager:getFarmByUserId(user:getId()) end, nil)
            rows[#rows + 1] = { name = nick, farm = farm and farm.farmId or 0, farmName = farm and tostring(farm.name) or "" }
        end
    end
    return rows
end

DiscordBridge.sections.farms = function()
    local rows = {}
    for _, farm in pairs(safe(function() return g_farmManager:getFarms() end, {})) do
        if farm.farmId ~= nil and farm.farmId ~= FarmManager.SPECTATOR_FARM_ID then
            local members = {}
            for _, pl in pairs(safe(function() return farm.players end, {})) do
                members[#members + 1] = tostring(pl.lastNickname or pl.userId)
            end
            rows[#rows + 1] = {
                id = farm.farmId, name = farm.name, money = farm.money, loan = farm.loan,
                members = table.concat(members, ";"),
            }
        end
    end
    return rows
end

DiscordBridge.sections.environment = function()
    local env = g_currentMission.environment
    local w = env.weather
    return { {
        day = env.currentDay, hour = env.currentHour, minute = env.currentMinute, period = env.currentPeriod,
        season = env.currentSeason, year = env.currentYear,
        temperature = safe(function() return w:getCurrentTemperature() end, nil),
        weatherType = safe(function() return w:getCurrentWeatherType() end, nil),
        rain = safe(function() return w:getRainFallScale() end, nil),
        wind = safe(function() return w:getWindSpeed() end, nil),
        timeScale = safe(function() return g_currentMission.missionInfo.timeScale end, nil),
    } }
end

-- Valeur de cellule : nombres compactés, textes bornés ; nil si inexportable
local function cell(v)
    if type(v) == "number" then
        return (string.format("%.2f", v):gsub("%.?0+$", ""))
    elseif type(v) == "string" then
        return v ~= "" and string.sub(v, 1, DiscordBridge.MAX_STRING) or nil
    elseif type(v) == "boolean" then
        return tostring(v)
    end
    return nil
end

function DiscordBridge:exportFull()
    local xml = createXMLFile("DiscordBridgeFull", self.fullFile, "full")
    if xml == nil or xml == 0 then
        log("Impossible de créer " .. self.fullFile)
        return
    end
    setXMLString(xml, "full#exportedAt", safe(function() return getDate("%Y-%m-%d %H:%M:%S") end, ""))
    local names = {}
    for name in pairs(self.sections) do names[#names + 1] = name end
    table.sort(names)
    for si, name in ipairs(names) do
        local ok, rows = pcall(self.sections[name])
        if not ok then
            log("Section " .. name .. " en erreur : " .. tostring(rows))
            rows = {}
        end
        local skey = string.format("full.section(%d)", si - 1)
        setXMLString(xml, skey .. "#name", name)
        for ri, row in ipairs(rows) do
            if ri > self.MAX_ROWS then
                break
            end
            local ekey = string.format("%s.e(%d)", skey, ri - 1)
            for k, v in pairs(row) do
                local text = cell(v)
                if text ~= nil then
                    setXMLString(xml, ekey .. "#" .. k, text)
                end
            end
        end
    end
    saveXMLFile(xml)
    delete(xml)
end

-- ------------------------------------------------------------
--  status.xml : lu par le bot toutes les minutes (noms de balises et d'attributs = contrat avec parseStatus du bot)
-- ------------------------------------------------------------
local function exportGame(xml, mission)
    local info, env, weather = mission.missionInfo, mission.environment, mission.environment.weather
    setXMLString(xml, "discordBridge.game#mapTitle",       safe(function() return info.mapTitle end, ""))
    setXMLFloat (xml, "discordBridge.game#timeScale",      safe(function() return info.timeScale end, 1))
    setXMLInt   (xml, "discordBridge.time#hour",           safe(function() return env.currentHour end, 0))
    setXMLInt   (xml, "discordBridge.time#minute",         safe(function() return env.currentMinute end, 0))
    setXMLInt   (xml, "discordBridge.time#dayInPeriod",    safe(function() return env.currentDayInPeriod end, 1))
    setXMLInt   (xml, "discordBridge.time#daysPerPeriod",  safe(function() return env.daysPerPeriod end, 1))
    setXMLInt   (xml, "discordBridge.time#period",         safe(function() return env.currentPeriod end, 1)) -- 1 = mars ... 12 = février
    setXMLInt   (xml, "discordBridge.time#season",         safe(function() return env.currentSeason end, 0))
    setXMLInt   (xml, "discordBridge.time#year",           safe(function() return env.currentYear end, 1))
    if weather ~= nil then
        setXMLFloat(xml, "discordBridge.weather#temperature", safe(function() return weather:getCurrentTemperature() end, -999))
    end
end

-- Fermes (finances) + toutes leurs statistiques (hectares, bottes, distances...) + possessions
local function exportFarms(xml)
    local i, s = 0, 0
    local function addStat(farmId, name, value)
        local skey = string.format("discordBridge.stats.stat(%d)", s)
        setXMLInt   (xml, skey .. "#farm",  farmId)
        setXMLString(xml, skey .. "#name",  tostring(name))
        setXMLFloat (xml, skey .. "#value", value)
        s = s + 1
    end
    for _, farm in pairs(safe(function() return g_farmManager:getFarms() end, {})) do
        if farm.farmId ~= nil and farm.farmId ~= FarmManager.SPECTATOR_FARM_ID then
            local key = string.format("discordBridge.farms.farm(%d)", i)
            setXMLInt   (xml, key .. "#id",    farm.farmId)
            setXMLString(xml, key .. "#name",  string.sub(tostring(farm.name or ("Ferme " .. farm.farmId)), 1, DiscordBridge.MAX_STRING))
            setXMLFloat (xml, key .. "#money", safe(function() return farm.money end, 0))
            setXMLFloat (xml, key .. "#loan",  safe(function() return farm.loan end, 0))
            i = i + 1
            for statName, entry in pairs(safe(function() return farm.stats.statistics end, {})) do
                local value = type(entry) == "table" and entry.total or entry
                if type(value) == "number" then
                    addStat(farm.farmId, statName, value)
                end
            end
        end
    end
    for farmId, values in pairs(DiscordBridge:collectOwned()) do
        for name, value in pairs(values) do
            addStat(farmId, name, value)
        end
    end
end

-- Joueurs connectés (pseudo + ferme ; 0 = spectateur ou inconnue)
local function exportPlayers(xml)
    local j = 0
    for _, user in pairs(safe(function() return g_currentMission.userManager:getUsers() end, {})) do
        local nick = safe(function() return user:getNickname() end, nil)
        if nick ~= nil and nick ~= "" then
            local key = string.format("discordBridge.players.player(%d)", j)
            setXMLString(xml, key .. "#name", string.sub(nick, 1, DiscordBridge.MAX_STRING))
            setXMLInt(xml, key .. "#farm", safe(function() return g_farmManager:getFarmByUserId(user:getId()).farmId end, 0))
            j = j + 1
        end
    end
end

-- Ouvriers IA en cours : jobs actifs du système IA, sinon véhicules pilotés par l'IA
local function collectHelpers(mission)
    local found, seen = {}, {}
    local ai = mission.aiSystem
    for _, listName in ipairs({ "activeJobs", "jobs" }) do
        local list = ai ~= nil and ai[listName] or nil
        if type(list) == "table" then
            for _, job in pairs(list) do
                if type(job) == "table" and safe(function() return job.isRunning end, nil) ~= false and not seen[job] then
                    seen[job] = true
                    local farmId = safe(function() return job:getStartedFarmId() end, nil)
                    if farmId == nil or farmId == 0 then farmId = job.startedFarmId end
                    if farmId == nil or farmId == 0 then farmId = safe(function() return job.vehicleParameter:getVehicle():getOwnerFarmId() end, nil) end
                    found[#found + 1] = {
                        id      = tostring(job.jobId or (#found + 1)),
                        farmId  = farmId,
                        title   = tostring(safe(function() return job:getTitle() end, "Ouvrier IA")),
                        vehicle = tostring(safe(function() return job.vehicleParameter:getVehicle():getFullName() end, "")),
                    }
                end
            end
        end
    end
    if #found == 0 then
        for _, veh in pairs(vehicles()) do
            if safe(function() return veh:getIsAIActive() end, false) == true then
                found[#found + 1] = {
                    id      = tostring(veh.id or (#found + 1)),
                    farmId  = safe(function() return veh:getOwnerFarmId() end, nil),
                    title   = "Ouvrier IA",
                    vehicle = tostring(safe(function() return veh:getFullName() end, "")),
                }
            end
        end
    end
    return found
end

local function exportHelpers(xml, mission)
    for h, w in ipairs(collectHelpers(mission)) do
        local farm = w.farmId ~= nil and safe(function() return g_farmManager:getFarmById(w.farmId) end, nil) or nil
        local key = string.format("discordBridge.helpers.helper(%d)", h - 1)
        setXMLString(xml, key .. "#id",      w.id)
        setXMLString(xml, key .. "#farm",    farm ~= nil and tostring(farm.name) or "?")
        setXMLString(xml, key .. "#job",     w.title)
        setXMLString(xml, key .. "#vehicle", w.vehicle)
    end
end

function DiscordBridge:export()
    local xml = createXMLFile("DiscordBridgeStatus", self.file, "discordBridge")
    if xml == nil or xml == 0 then
        log("Impossible de créer " .. self.file)
        return
    end
    -- chaque bloc est isolé : une erreur dans l'un n'empêche pas d'écrire les autres
    local mission = g_currentMission
    for name, fn in pairs({
        game = exportGame, farms = exportFarms, players = exportPlayers, helpers = exportHelpers,
        counters = function(x) writeCounters(x, "discordBridge.counters") end,
    }) do
        local ok, err = pcall(fn, xml, mission)
        if not ok then
            log("Export " .. name .. " en erreur : " .. tostring(err))
        end
    end
    saveXMLFile(xml)
    delete(xml)
end

-- ------------------------------------------------------------
--  Cycle de vie du mod (serveur uniquement)
-- ------------------------------------------------------------
function DiscordBridge:loadMap(name)
    if not isServer() then
        return
    end
    self.enabled = true
    self.statusTimer = self.STATUS_INTERVAL_MS                -- premier export immédiat
    self.fullTimer   = self.FULL_INTERVAL_MS - 20000          -- premier export complet 20 s après (décalé du premier)

    local settingsDir = getUserProfileAppPath() .. "modSettings/"
    self.dir      = settingsDir .. "FS25_DiscordBridge/"
    self.file     = self.dir .. "status.xml"
    self.fullFile = self.dir .. "full.xml"
    createFolder(settingsDir)
    createFolder(self.dir)

    local savegameIndex = safe(function() return g_currentMission.missionInfo.savegameIndex end, 0)
    self.countersFile = self.dir .. string.format("counters_savegame%d.xml", savegameIndex)
    self:loadCounters()
    self:hookMoney()
    log("V2 prête. Export vers : " .. self.file)
end

function DiscordBridge:deleteMap()
    if self.enabled then
        pcall(DiscordBridge.saveCounters, self)
    end
end

function DiscordBridge:update(dt)
    if not self.enabled or g_currentMission == nil then
        return
    end

    pcall(DiscordBridge.trackWork, self, dt)

    self.fullTimer = self.fullTimer + dt
    if self.fullTimer >= self.FULL_INTERVAL_MS then
        self.fullTimer = 0
        local ok, err = pcall(DiscordBridge.exportFull, self)
        if not ok then log("Erreur export complet : " .. tostring(err)) end
    end

    self.statusTimer = self.statusTimer + dt
    if self.statusTimer >= self.STATUS_INTERVAL_MS then
        self.statusTimer = 0
        local ok, err = pcall(DiscordBridge.export, self)
        pcall(DiscordBridge.saveCounters, self)
        if not ok then log("Erreur export : " .. tostring(err)) end
    end
end

addModEventListener(DiscordBridge)

-- ============================================================
--  FS25_DiscordBridge
--  Exporte les données de la partie dans un fichier XML :
--    <profil>/modSettings/FS25_DiscordBridge/status.xml
--  Un script externe (discord_bridge.py) lit ce fichier et
--  met à jour un message Discord.
--  Ne tourne que côté serveur (hôte ou serveur dédié).
-- ============================================================

DiscordBridge = {}
DiscordBridge.modName       = g_currentModName
DiscordBridge.INTERVAL_MS   = 30000   -- export toutes les 30 s (temps réel)
DiscordBridge.timer         = 0
DiscordBridge.LOG_PREFIX    = "[DiscordBridge] "

-- Compteurs persistants : counters[kind][farmId][clé] = valeur
--   "produced"  : litres/unités produits par les animaux et les ruches (clé = fillType)
--   "money_in"  : € gagnés  (clé = MoneyType)
--   "money_out" : € dépensés (clé = MoneyType)
--   "work_vehicle"  : secondes de conduite, moteur allumé, d'un véhicule de la ferme (clé = pseudo du joueur)
--   "work_chainsaw" : secondes de coupe à la tronçonneuse pour la ferme du joueur (clé = pseudo du joueur)
--   "transfer_in"   : € reçus par virement d'une autre ferme (clé = id de la ferme qui envoie)
--   "sold"          : litres/unités vendus à un point de vente (clé = fillType) -> événement hebdomadaire
--   "work_credit" / "work_debit" : hectares travaillés chez un autre joueur (clé = nom de stat), + pour la ferme du véhicule, - pour le propriétaire du champ
DiscordBridge.counters = { produced = {}, money_in = {}, money_out = {}, work_vehicle = {}, work_chainsaw = {}, transfer_in = {}, sold = {}, work_credit = {}, work_debit = {} }
DiscordBridge.countersDirty = false

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

-- ------------------------------------------------------------
--  Compteurs
-- ------------------------------------------------------------
function DiscordBridge:addCounter(kind, farmId, fillTypeName, amount)
    if farmId == nil or fillTypeName == nil or amount == nil or amount <= 0 then
        return
    end
    local byFarm = self.counters[kind]
    byFarm[farmId] = byFarm[farmId] or {}
    byFarm[farmId][fillTypeName] = (byFarm[farmId][fillTypeName] or 0) + amount
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
        if self.counters[kind] ~= nil and farm ~= nil and ft ~= nil and value ~= nil then
            self.counters[kind][farm] = self.counters[kind][farm] or {}
            self.counters[kind][farm][ft] = value
        end
        i = i + 1
    end
    delete(xml)
    print(self.LOG_PREFIX .. "Compteurs chargés : " .. i .. " entrées")
end

function DiscordBridge:saveCounters()
    if self.countersFile == nil or not self.countersDirty then
        return
    end
    local xml = createXMLFile("DiscordBridgeCounters", self.countersFile, "counters")
    if xml == nil or xml == 0 then
        return
    end
    local i = 0
    for kind, byFarm in pairs(self.counters) do
        for farmId, byType in pairs(byFarm) do
            for ft, value in pairs(byType) do
                local key = string.format("counters.c(%d)", i)
                setXMLString(xml, key .. "#kind", kind)
                setXMLInt(xml, key .. "#farm", farmId)
                setXMLString(xml, key .. "#fillType", ft)
                setXMLFloat(xml, key .. "#value", value)
                i = i + 1
            end
        end
    end
    saveXMLFile(xml)
    delete(xml)
    self.countersDirty = false
end

-- ------------------------------------------------------------
--  Production animale (points d'accroche confirmés dans le code FS25)
--
--  1) Lait, lisier, fumier : PlaceableHusbandryMilk / LiquidManure / Straw
--     appellent addHusbandryFillLevelFromTool(farmId, litres, fillType, nil, nil, nil)
--     -> toolType == nil = production par les animaux (un joueur qui décharge a un toolType).
--  2) Laine, œufs : PlaceableHusbandryPallets:updateOutput ajoute
--     productionFactor * globalProductionFactor * litersPerHour * timeAdjustment.
--  3) Miel : PlaceableBeehivePalletSpawner:addFillLevel(fillLevel).
-- ------------------------------------------------------------
local PRODUCED_BY_ANIMALS = { MILK = true, GOATMILK = true, BUFFALOMILK = true, LIQUIDMANURE = true, MANURE = true }

if PlaceableHusbandry ~= nil and PlaceableHusbandry.addHusbandryFillLevelFromTool ~= nil then
    local original = PlaceableHusbandry.addHusbandryFillLevelFromTool
    PlaceableHusbandry.addHusbandryFillLevelFromTool = function(placeable, farmId, delta, fillTypeIndex, fillPositionData, toolType, ...)
        local results = { original(placeable, farmId, delta, fillTypeIndex, fillPositionData, toolType, ...) }
        if toolType == nil and type(delta) == "number" and delta > 0 then
            pcall(function()
                local name = g_fillTypeManager:getFillTypeNameByIndex(fillTypeIndex)
                if PRODUCED_BY_ANIMALS[name] and isServer() then
                    local applied = (type(results[1]) == "number" and results[1] > 0) and results[1] or delta
                    DiscordBridge:addCounter("produced", farmId, name, applied)
                end
            end)
        end
        return unpack(results)
    end
else
    print(DiscordBridge.LOG_PREFIX .. "PlaceableHusbandry.addHusbandryFillLevelFromTool introuvable : lait/fumier non suivis")
end

if PlaceableHusbandryPallets ~= nil and PlaceableHusbandryPallets.updateOutput ~= nil then
    local original = PlaceableHusbandryPallets.updateOutput
    PlaceableHusbandryPallets.updateOutput = function(placeable, superFunc, foodFactor, productionFactor, globalProductionFactor, ...)
        local results = { original(placeable, superFunc, foodFactor, productionFactor, globalProductionFactor, ...) }
        pcall(function()
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
        return unpack(results)
    end
else
    print(DiscordBridge.LOG_PREFIX .. "PlaceableHusbandryPallets.updateOutput introuvable : laine/œufs non suivis")
end

if PlaceableBeehivePalletSpawner ~= nil and PlaceableBeehivePalletSpawner.addFillLevel ~= nil then
    local original = PlaceableBeehivePalletSpawner.addFillLevel
    PlaceableBeehivePalletSpawner.addFillLevel = function(placeable, fillLevel, ...)
        local results = { original(placeable, fillLevel, ...) }
        pcall(function()
            if placeable.isServer and type(fillLevel) == "number" and fillLevel > 0 then
                DiscordBridge:addCounter("produced", placeable:getOwnerFarmId(), "HONEY", fillLevel)
            end
        end)
        return unpack(results)
    end
end

-- ------------------------------------------------------------
--  Succès : le travail effectué dans un champ appartenant à une autre ferme doit compter pour la ferme du véhicule.
--  Le jeu crédite la ferme du TERRAIN touché. On ne modifie RIEN dans le jeu (une version qui renvoyait une autre ferme
--  faisait planter les contrats de champ) : on OBSERVE. getLastTouchedFarmlandFarmId note quel véhicule vient de toucher
--  quel terrain ; FarmManager:updateFarmStats (stats "...Hectares") est observé juste après : si le propriétaire du terrain
--  n'est pas la ferme du véhicule, le mod compte "work_credit" (ferme du véhicule, +) et "work_debit" (propriétaire, -).
--  Le bot ajoute/retire ces compteurs aux stats exportées. Les valeurs renvoyées au jeu sont toujours celles de l'original.
--  ponytail: noms d'API FS25 non confirmés ; la 1re attribution est écrite dans le log pour vérifier.
-- ------------------------------------------------------------
local function observeTouch(class)
    if class == nil or class.getLastTouchedFarmlandFarmId == nil then
        return false
    end
    local original = class.getLastTouchedFarmlandFarmId
    class.getLastTouchedFarmlandFarmId = function(vehicle, ...)
        local results = { original(vehicle, ...) }
        pcall(function() DiscordBridge.touch = { vehicle = vehicle, land = results[1], t = g_time } end)
        return unpack(results)
    end
    return true
end

local touchHooked = observeTouch(Vehicle) or observeTouch(WorkArea)
print(DiscordBridge.LOG_PREFIX .. (touchHooked and "Succès : travail chez un autre joueur suivi (observation seule)"
    or "getLastTouchedFarmlandFarmId introuvable : travail chez un autre joueur non suivi"))

if FarmManager ~= nil and FarmManager.updateFarmStats ~= nil then
    local original = FarmManager.updateFarmStats
    FarmManager.updateFarmStats = function(manager, farmId, statName, delta, ...)
        local results = { original(manager, farmId, statName, delta, ...) }
        pcall(function()
            local t = DiscordBridge.touch
            if t ~= nil and isServer() and type(delta) == "number" and delta > 0 and type(statName) == "string"
                and statName:find("Hectares$") and t.land == farmId and math.abs((g_time or 0) - (t.t or 0)) <= 100 then
                local worker = t.vehicle:getOwnerFarmId()
                if type(worker) == "number" and worker ~= farmId and worker ~= FarmManager.SPECTATOR_FARM_ID then
                    if not DiscordBridge.creditLogged then
                        DiscordBridge.creditLogged = true
                        print(DiscordBridge.LOG_PREFIX .. "Travail chez un autre joueur : ferme " .. tostring(worker) .. " dans le champ de la ferme " .. tostring(farmId) .. " (" .. statName .. ")")
                    end
                    DiscordBridge:addCounter("work_credit", worker, statName, delta)
                    DiscordBridge:addCounter("work_debit", farmId, statName, delta)
                end
            end
        end)
        return unpack(results)
    end
else
    print(DiscordBridge.LOG_PREFIX .. "FarmManager.updateFarmStats introuvable : travail chez un autre joueur non suivi")
end

-- ------------------------------------------------------------
--  Ventes : tout ce qui est livré à un point de vente passe par SellingStation:addFillLevelFromTool(farmId, delta, fillType, ...)
--  -> "sold" (litres vendus par ferme et par produit). Les animaux ne passent pas par là.
--  ponytail: nom d'API FS25 non confirmé ; la 1re vente est écrite dans le log pour vérifier, à corriger ici si rien ne remonte.
-- ------------------------------------------------------------
if SellingStation ~= nil and SellingStation.addFillLevelFromTool ~= nil then
    local original = SellingStation.addFillLevelFromTool
    SellingStation.addFillLevelFromTool = function(station, farmId, delta, fillTypeIndex, ...)
        local results = { original(station, farmId, delta, fillTypeIndex, ...) }
        pcall(function()
            if isServer() and type(delta) == "number" and delta > 0 then
                local applied = (type(results[1]) == "number" and results[1] > 0) and results[1] or 0
                local name = g_fillTypeManager:getFillTypeNameByIndex(fillTypeIndex)
                if applied > 0 and name ~= nil then
                    if not DiscordBridge.saleLogged then
                        DiscordBridge.saleLogged = true
                        print(DiscordBridge.LOG_PREFIX .. "Vente détectée : ferme " .. tostring(farmId) .. ", " .. name .. ", " .. tostring(applied))
                    end
                    DiscordBridge:addCounter("sold", farmId, name, applied)
                end
            end
        end)
        return unpack(results)
    end
else
    print(DiscordBridge.LOG_PREFIX .. "SellingStation.addFillLevelFromTool introuvable : ventes non suivies")
end

-- ------------------------------------------------------------
--  Argent : chaque mouvement passe par g_currentMission:addMoney(montant, ferme, MoneyType)
--  -> "money_in" (gains) / "money_out" (dépenses) par type (SOLD_PRODUCTS, HARVEST_INCOME,
--     SOLD_ANIMALS, MISSIONS, PROPERTY_INCOME, PURCHASE_FUEL, VEHICLE_REPAIR...)
-- ------------------------------------------------------------
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

function DiscordBridge:hookMoney()
    local mission = g_currentMission
    if self.moneyHooked or mission == nil or mission.addMoney == nil then
        return
    end
    local original = mission.addMoney
    mission.addMoney = function(m, amount, farmId, moneyType, ...)
        local results = { original(m, amount, farmId, moneyType, ...) }
        pcall(function()
            if m:getIsServer() and type(amount) == "number" and amount ~= 0 and farmId ~= nil then
                local name = DiscordBridge:getMoneyTypeName(moneyType)
                if amount > 0 then
                    DiscordBridge:addCounter("money_in", farmId, name, amount)
                else
                    DiscordBridge:addCounter("money_out", farmId, name, -amount)
                end
                -- Virement entre fermes = une sortie TRANSFER puis une entrée TRANSFER du même montant (ordre quelconque)
                -- -> "transfer_in" : ferme qui reçoit, clé = id de la ferme qui envoie
                if name == "TRANSFER" then
                    -- liste d'attente : un autre mouvement TRANSFER entre les deux moitiés ne fait plus perdre le virement
                    local q = DiscordBridge.pendingTransfers or {}
                    DiscordBridge.pendingTransfers = q
                    local matched = false
                    for i, p in ipairs(q) do
                        if p.farmId ~= farmId and math.abs(p.amount + amount) < 0.01 then
                            local from, to = (amount > 0) and p.farmId or farmId, (amount > 0) and farmId or p.farmId
                            DiscordBridge:addCounter("transfer_in", to, tostring(from), math.abs(amount))
                            table.remove(q, i)
                            matched = true
                            break
                        end
                    end
                    if not matched then
                        q[#q + 1] = { farmId = farmId, amount = amount }
                        if #q > 20 then table.remove(q, 1) end
                    end
                end
            end
        end)
        return unpack(results)
    end
    self.moneyHooked = true
end

-- ------------------------------------------------------------
--  Temps de travail par joueur (salaires de l'association)
--  - Véhicule : conduit par un joueur (pas l'IA), moteur allumé -> crédité à la ferme propriétaire du véhicule.
--  - Tronçonneuse : tenue ET en train de couper -> créditée à la ferme du joueur.
--  ponytail: noms d'API FS25 non confirmés (getControllerName, getHeldHandTool, spec_chainsaw.isCutting) ;
--  le premier relevé de tronçonneuse est écrit dans le log pour vérifier, à corriger ici si rien ne remonte.
-- ------------------------------------------------------------
local function playerNick(player)
    local nick = safe(function() return g_currentMission.userManager:getUserByUserId(player.userId):getNickname() end, nil)
    return nick or safe(function() return player:getName() end, nil) or safe(function() return player.nickname end, nil)
end

function DiscordBridge:trackWork(dt)
    local s = dt / 1000
    local vehicles = safe(function() return g_currentMission.vehicleSystem.vehicles end, {})
    for _, v in pairs(vehicles) do
        if v.spec_enterable ~= nil and safe(function() return v:getIsControlled() end, false)
            and not safe(function() return v:getIsAIActive() end, false)
            and safe(function() return v:getIsMotorStarted() end, false) then
            local nick = safe(function() return v:getControllerName() end, nil)
            if nick ~= nil and nick ~= "" then
                self:addCounter("work_vehicle", safe(function() return v:getOwnerFarmId() end, nil), nick, s)
            end
        end
    end

    local players = safe(function() return g_currentMission.playerSystem.players end, {})
    for _, p in pairs(players) do
        local tool = safe(function() return p:getHeldHandTool() end, nil) or p.currentHandTool
        local spec = type(tool) == "table" and tool.spec_chainsaw or nil
        if spec ~= nil then
            if not self.chainsawLogged then
                self.chainsawLogged = true
                local keys = {}
                for k, val in pairs(spec) do if type(val) == "boolean" then keys[#keys + 1] = k .. "=" .. tostring(val) end end
                print(self.LOG_PREFIX .. "Tronçonneuse détectée, champs : " .. table.concat(keys, " "))
            end
            if spec.isCutting or spec.isWorking then
                local farmId = safe(function() return p:getFarmId() end, nil) or p.farmId
                self:addCounter("work_chainsaw", farmId, playerNick(p), s)
            end
        end
    end
end

-- ------------------------------------------------------------
--  Possessions (valeurs actuelles) : véhicules, usines, ruches
-- ------------------------------------------------------------
function DiscordBridge:collectOwned()
    local owned = {}
    local function add(farmId, key)
        if farmId == nil then
            return
        end
        owned[farmId] = owned[farmId] or {}
        owned[farmId][key] = (owned[farmId][key] or 0) + 1
    end

    local vehicles = safe(function() return g_currentMission.vehicleSystem.vehicles end, {})
    for _, vehicle in pairs(vehicles) do
        if vehicle.spec_pallet == nil and vehicle.spec_bigBag == nil then
            local farmId = safe(function() return vehicle:getOwnerFarmId() end, nil)
            add(farmId, "_ownedVehicles")
            if vehicle.spec_motorized ~= nil then
                add(farmId, "_ownedMotorized")
            end
        end
    end

    local placeables = safe(function() return g_currentMission.placeableSystem.placeables end, {})
    for _, placeable in pairs(placeables) do
        local farmId = safe(function() return placeable:getOwnerFarmId() end, nil)
        if placeable.spec_productionPoint ~= nil then
            add(farmId, "_ownedProductionPoints")
        end
        if placeable.spec_beehive ~= nil then
            add(farmId, "_ownedBeehives")
        end
    end
    return owned
end


-- ------------------------------------------------------------
--  Export complet générique : full.xml
--  Format : <section name="vehicles"><e k1="v1" k2="v2"/>...</section>
--  Le bot lit n'importe quelle section/colonne sans connaître les champs à l'avance :
--  pour une nouvelle fonction Discord, ajouter une section ICI (ou afficher une colonne existante côté bot).
--  Chaque section est isolée par pcall ; les valeurs indisponibles sont simplement omises.
-- ------------------------------------------------------------
DiscordBridge.FULL_INTERVAL_MS = 60000
DiscordBridge.fullTimer = 0

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

-- safe() ne renvoie qu'une valeur : position = pcall direct
local function posXZ(node)
    local ok, x, _, z = pcall(getWorldTranslation, node)
    if ok then return x, z end
end

local function placeables()
    return safe(function() return g_currentMission.placeableSystem.placeables end, {})
end

-- Chaque section renvoie une liste de lignes { colonne = valeur }
DiscordBridge.sections = {}

DiscordBridge.sections.vehicles = function()
    local rows = {}
    for _, v in pairs(safe(function() return g_currentMission.vehicleSystem.vehicles end, {})) do
        if v.spec_pallet == nil and v.spec_bigBag == nil then
            local x, z = posXZ(v.rootNode)
            local diesel = safe(function() return v:getConsumerFillUnitIndex(FillType.DIESEL) end, nil)
            local farmId = safe(function() return v:getOwnerFarmId() end, nil)
            rows[#rows + 1] = {
                name = safe(function() return v:getFullName() end, "?"),
                farm = farmId, farmName = farmName(farmId), x = x, z = z,
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

DiscordBridge.sections.contracts = function()
    local rows = {}
    for _, m in pairs(safe(function() return g_missionManager.missions end, {})) do
        rows[#rows + 1] = {
            type = safe(function() return m.type.name end, "?"), farm = m.farmId, status = m.status,
            reward = safe(function() return m:getReward() end, nil),
            field = safe(function() return m.field.fieldId end, nil),
            completion = safe(function() return m:getCompletion() end, nil),
        }
    end
    return rows
end

DiscordBridge.sections.players = function()
    local rows = {}
    for _, user in pairs(safe(function() return g_currentMission.userManager:getUsers() end, {})) do
        local nick = safe(function() return user:getNickname() end, nil)
        if nick ~= nil and nick ~= "" then
            local farm = safe(function() return g_farmManager:getFarmByUserId(user:getId()) end, nil)
            local player = safe(function() return g_currentMission.playerSystem:getPlayerByUserId(user:getId()) end, nil)
            local x, z
            if player ~= nil then x, z = posXZ(player.rootNode) end
            rows[#rows + 1] = {
                name = nick, farm = farm and farm.farmId or 0, farmName = farm and tostring(farm.name) or "",
                x = x, z = z, admin = safe(function() return user:getIsMasterUser() end, nil),
            }
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

function DiscordBridge:exportFull()
    local xml = createXMLFile("DiscordBridgeFull", self.fullFile, "full")
    if xml == nil or xml == 0 then
        print(self.LOG_PREFIX .. "Impossible de créer " .. self.fullFile)
        return
    end
    setXMLInt(xml, "full#version", 2)
    setXMLString(xml, "full#exportedAt", safe(function() return getDate("%Y-%m-%d %H:%M:%S") end, ""))
    local names = {}
    for name in pairs(self.sections) do names[#names + 1] = name end
    table.sort(names)
    for si, name in ipairs(names) do
        local ok, rows = pcall(self.sections[name])
        if not ok then
            print(self.LOG_PREFIX .. "Section " .. name .. " en erreur : " .. tostring(rows))
            rows = {}
        end
        local skey = string.format("full.section(%d)", si - 1)
        setXMLString(xml, skey .. "#name", name)
        for ri, row in ipairs(rows) do
            local ekey = string.format("%s.e(%d)", skey, ri - 1)
            for k, v in pairs(row) do
                if v ~= nil and v ~= "" and type(v) ~= "table" and type(v) ~= "function" then
                    if type(v) == "number" then v = string.format("%.2f", v):gsub("%.?0+$", "") end
                    setXMLString(xml, ekey .. "#" .. k, tostring(v))
                end
            end
        end
    end
    saveXMLFile(xml)
    delete(xml)
end

-- ------------------------------------------------------------
--  Cycle de vie du mod

function DiscordBridge:loadMap(name)
    self.timer = self.INTERVAL_MS -- premier export immédiat

    local settingsDir = getUserProfileAppPath() .. "modSettings/"
    self.dir  = settingsDir .. "FS25_DiscordBridge/"
    self.file = self.dir .. "status.xml"
    self.fullFile = self.dir .. "full.xml"

    createFolder(settingsDir)
    createFolder(self.dir)

    local savegameIndex = safe(function() return g_currentMission.missionInfo.savegameIndex end, 0)
    self.countersFile = self.dir .. string.format("counters_savegame%d.xml", savegameIndex)
    self:loadCounters()
    if isServer() then
        self:hookMoney()
    end

    print(self.LOG_PREFIX .. "Export vers : " .. self.file)
end

function DiscordBridge:deleteMap()
    pcall(DiscordBridge.saveCounters, self)
end

function DiscordBridge:update(dt)
    if g_currentMission == nil or not g_currentMission:getIsServer() then
        return
    end

    pcall(DiscordBridge.trackWork, self, dt)

    self.fullTimer = self.fullTimer + dt
    if self.fullTimer >= self.FULL_INTERVAL_MS then
        self.fullTimer = 0
        local okFull, errFull = pcall(DiscordBridge.exportFull, self)
        if not okFull then print(self.LOG_PREFIX .. "Erreur export complet : " .. tostring(errFull)) end
    end

    self.timer = self.timer + dt
    if self.timer < self.INTERVAL_MS then
        return
    end
    self.timer = 0

    local ok, err = pcall(DiscordBridge.export, self)
    pcall(DiscordBridge.saveCounters, self)
    if not ok then
        print(self.LOG_PREFIX .. "Erreur export : " .. tostring(err))
    end
end

function DiscordBridge:export()
    local mission = g_currentMission
    local env     = mission.environment

    local xml = createXMLFile("DiscordBridgeStatus", self.file, "discordBridge")
    if xml == nil or xml == 0 then
        print(self.LOG_PREFIX .. "Impossible de créer " .. self.file)
        return
    end

    setXMLInt(xml, "discordBridge#version", 1)
    setXMLString(xml, "discordBridge#exportedAt", safe(function() return getDate("%Y-%m-%d %H:%M:%S") end, ""))

    -- ---------- Partie / carte ----------
    local info = mission.missionInfo
    setXMLString(xml, "discordBridge.game#savegameName", safe(function() return info.savegameName end, ""))
    setXMLString(xml, "discordBridge.game#mapTitle",     safe(function() return info.mapTitle end, ""))
    setXMLFloat (xml, "discordBridge.game#timeScale",    safe(function() return info.timeScale end, 1))

    -- ---------- Temps ----------
    setXMLInt(xml, "discordBridge.time#hour",        safe(function() return env.currentHour end, 0))
    setXMLInt(xml, "discordBridge.time#minute",      safe(function() return env.currentMinute end, 0))
    setXMLInt(xml, "discordBridge.time#day",         safe(function() return env.currentDay end, 0))
    setXMLInt(xml, "discordBridge.time#dayInPeriod", safe(function() return env.currentDayInPeriod end, 1))
    setXMLInt(xml, "discordBridge.time#daysPerPeriod", safe(function() return env.daysPerPeriod end, 1))
    -- period : 1 = début de printemps (mars) ... 12 = février
    setXMLInt(xml, "discordBridge.time#period",      safe(function() return env.currentPeriod end, 1))
    setXMLInt(xml, "discordBridge.time#season",      safe(function() return env.currentSeason end, 0))
    setXMLInt(xml, "discordBridge.time#year",        safe(function() return env.currentYear end, 1))

    -- ---------- Météo (facultatif, ignoré si indispo) ----------
    local weather = env.weather
    if weather ~= nil then
        setXMLFloat(xml, "discordBridge.weather#temperature",
            safe(function() return weather:getCurrentTemperature() end, -999))
        setXMLInt(xml, "discordBridge.weather#type",
            safe(function() return weather:getCurrentWeatherType() end, -1))
    end

    -- ---------- Fermes : finances + statistiques ----------
    local i, s = 0, 0
    local farms = safe(function() return g_farmManager:getFarms() end, {})
    for _, farm in pairs(farms) do
        if farm.farmId ~= nil and farm.farmId ~= FarmManager.SPECTATOR_FARM_ID then
            local key = string.format("discordBridge.farms.farm(%d)", i)
            setXMLInt   (xml, key .. "#id",    farm.farmId)
            setXMLString(xml, key .. "#name",  tostring(farm.name or ("Ferme " .. farm.farmId)))
            setXMLFloat (xml, key .. "#money", safe(function() return farm.money end, 0))
            setXMLFloat (xml, key .. "#loan",  safe(function() return farm.loan end, 0))
            i = i + 1

            -- Toutes les statistiques de la ferme (hectares labourés, semés, bottes, distance...)
            local statistics = safe(function() return farm.stats.statistics end, {})
            for statName, entry in pairs(statistics) do
                local value = nil
                if type(entry) == "table" then
                    value = entry.total
                elseif type(entry) == "number" then
                    value = entry
                end
                if type(value) == "number" then
                    local skey = string.format("discordBridge.stats.stat(%d)", s)
                    setXMLInt   (xml, skey .. "#farm",  farm.farmId)
                    setXMLString(xml, skey .. "#name",  tostring(statName))
                    setXMLFloat (xml, skey .. "#value", value)
                    s = s + 1
                end
            end
        end
    end

    -- ---------- Possessions (exportées comme des stats "_owned...") ----------
    for farmId, values in pairs(self:collectOwned()) do
        for name, value in pairs(values) do
            local skey = string.format("discordBridge.stats.stat(%d)", s)
            setXMLInt   (xml, skey .. "#farm",  farmId)
            setXMLString(xml, skey .. "#name",  name)
            setXMLFloat (xml, skey .. "#value", value)
            s = s + 1
        end
    end

    -- ---------- Compteurs production / argent ----------
    local c = 0
    for kind, byFarm in pairs(self.counters) do
        for farmId, byType in pairs(byFarm) do
            for ft, value in pairs(byType) do
                local ckey = string.format("discordBridge.counters.c(%d)", c)
                setXMLString(xml, ckey .. "#kind",     kind)
                setXMLInt   (xml, ckey .. "#farm",     farmId)
                setXMLString(xml, ckey .. "#fillType", ft)
                setXMLFloat (xml, ckey .. "#value",    value)
                c = c + 1
            end
        end
    end

    -- ---------- Joueurs connectés ----------
    local j = 0
    local users = safe(function() return mission.userManager:getUsers() end, {})
    for _, user in pairs(users) do
        local nick = safe(function() return user:getNickname() end, nil)
        if nick ~= nil and nick ~= "" then
            setXMLString(xml, string.format("discordBridge.players.player(%d)#name", j), nick)
            -- ferme du joueur (contrôle des licences de l'association) ; 0 = spectateur / inconnue
            local farmId = safe(function() return g_farmManager:getFarmByUserId(user:getId()).farmId end, 0)
            setXMLInt(xml, string.format("discordBridge.players.player(%d)#farm", j), farmId)
            j = j + 1
        end
    end
    setXMLInt(xml, "discordBridge.players#count", j)

    -- ---------- Ouvriers IA en cours ----------
    -- On regroupe : jobs actifs (aiSystem) + vehicules pilotes par l'IA (au cas ou la liste des jobs est vide).
    local found, seen = {}, {}
    local ai = mission.aiSystem
    for _, listName in ipairs({ "activeJobs", "jobs" }) do
        local list = ai ~= nil and ai[listName] or nil
        if type(list) == "table" then
            for _, job in pairs(list) do
                local running = safe(function() return job.isRunning end, nil)
                if type(job) == "table" and running ~= false and not seen[job] then
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
        local vehicles = safe(function() return mission.vehicleSystem.vehicles end, nil) or mission.vehicles or {}
        for _, veh in pairs(vehicles) do
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
    local h = 0
    for _, w in ipairs(found) do
        local farm = w.farmId ~= nil and safe(function() return g_farmManager:getFarmById(w.farmId) end, nil) or nil
        local key = string.format("discordBridge.helpers.helper(%d)", h)
        setXMLString(xml, key .. "#id",      w.id)
        setXMLString(xml, key .. "#farm",    farm ~= nil and tostring(farm.name) or "?")
        setXMLString(xml, key .. "#job",     w.title)
        setXMLString(xml, key .. "#vehicle", w.vehicle)
        h = h + 1
    end
    saveXMLFile(xml)
    delete(xml)
end

addModEventListener(DiscordBridge)

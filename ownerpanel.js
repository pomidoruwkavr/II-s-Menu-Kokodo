(function () {
  var PANEL_TITLE = "II's Menu Kokodo";

  var GLOBAL_VARS = [
    "Day",
    "Strength_",
    "SavedDayCount",
    "SavedStrength",
    "Loaded",
    "found_",
    "TAKNIE",
    "FPS_FG"
  ];

  var SCENES = ["menu", "Game Scene", "DEMO", "about developers", "Info"];

  var PLAYER_OBJECT_NAME = "TopDown_Character";
  var PLAYER_HEALTH_BEHAVIOR = "Health";
  var PLAYER_MOVEMENT_BEHAVIORS = [
    "TopDownMovement",
    "PixelPerfectTopDownMovement",
    "Walk3D2",
    "TopDownMultitouchMapper"
  ];
  var STRENGTH_VAR = "Strength_";
  var IMMORTAL_STRENGTH_VALUE = 9999;

  var SPAWN_DISTANCE = 150;

  var immortal = false;
  var lastDebugOutput = "";
  var immortalRafId = null;

  function tryCall(obj, methodNames, args) {
    for (var i = 0; i < methodNames.length; i++) {
      var m = methodNames[i];
      if (obj && typeof obj[m] === "function") {
        try {
          return obj[m].apply(obj, args || []);
        } catch (e) {
        }
      }
    }
    return undefined;
  }

  function getResourceFileMap() {
    var map = {};
    try {
      var resources = gdjs.projectData.resources.resources;
      for (var i = 0; i < resources.length; i++) {
        map[resources[i].name] = resources[i].file;
      }
    } catch (e) {}
    return map;
  }

  function getSceneObjectsData(sceneName) {
    try {
      var layouts = gdjs.projectData.layouts;
      for (var i = 0; i < layouts.length; i++) {
        if (layouts[i].name === sceneName) return layouts[i].objects;
      }
    } catch (e) {}
    return [];
  }

  function getObjectDataByName(sceneName, objectName) {
    var objs = getSceneObjectsData(sceneName);
    for (var i = 0; i < objs.length; i++) {
      if (objs[i].name === objectName) return objs[i];
    }
    return null;
  }

  function getFirstImageResourceName(objData) {
    try {
      if (objData.type === "Sprite") {
        return objData.animations[0].directions[0].sprites[0].image;
      }
      if (typeof objData.texture === "string") return objData.texture;
    } catch (e) {}
    return null;
  }

  function hasBehavior(objData, behaviorName) {
    var behs = objData.behaviors || [];
    for (var i = 0; i < behs.length; i++) {
      if (behs[i].name === behaviorName) return true;
    }
    return false;
  }

  // behaviory odpowiedzialne za ruch/atak - te zamrazamy (activate(false))
  function classifySceneObjects(sceneName) {
    var objs = getSceneObjectsData(sceneName);
    var npc = [];
    var items = [];
    var nodes = [];
    var other = [];
    objs.forEach(function (o) {
      if (o.name === PLAYER_OBJECT_NAME) return; // nie pokazuj gracza jako "do zespawnowania"
      var hasHealth = hasBehavior(o, "Health");
      var hasSticker = hasBehavior(o, "Sticker");
      if (hasSticker) {
        items.push(o.name);
      } else if (hasHealth && o.type === "Sprite") {
        npc.push(o.name);
      } else if (hasHealth) {
        nodes.push(o.name);
      } else if (o.type === "Sprite") {
        // Sprite bez behaviora Health/Sticker - w praktyce wiele prawdziwych NPC
        // (zwierzeta, postacie) w tym projekcie NIE MA behaviora Health, wiec
        // wczesniej znikaly z panelu calkowicie. Pokazujemy je tutaj.
        other.push(o.name);
      }
    });
    return { npc: npc, items: items, nodes: nodes, other: other };
  }

  function iconImgTag(objectName, sceneName, resourceMap) {
    var objData = getObjectDataByName(sceneName, objectName);
    if (!objData) return "";
    var resName = getFirstImageResourceName(objData);
    if (!resName || !resourceMap[resName]) return "";
    var file = resourceMap[resName];
    return (
      '<img src="' +
      file +
      '" onerror="this.onerror=null;this.src=\'assets/' +
      file +
      "';this.onerror=function(){this.style.display='none';};\" " +
      'style="width:28px;height:28px;object-fit:contain;image-rendering:pixelated;vertical-align:middle;margin-right:4px;border-radius:3px;background:#222;"/>'
    );
  }

  function init() {
    var game = window.__gdGame;
    if (!game) {
      setTimeout(init, 200);
      return;
    }

    var resourceMap = getResourceFileMap();

    var panel = document.createElement("div");
    panel.id = "ownerPanel";
    panel.style.cssText =
      "position:fixed;top:10px;right:10px;width:340px;max-height:92vh;" +
      "overflow-y:auto;background:rgba(15,15,15,0.95);color:#eee;" +
      "font-family:Segoe UI,Arial,sans-serif;font-size:12px;padding:14px;" +
      "border:1px solid #555;border-radius:10px;z-index:999999;display:none;" +
      "box-shadow:0 4px 20px rgba(0,0,0,0.6);";
    document.body.appendChild(panel);

    var style = document.createElement("style");
    style.textContent =
      "#ownerPanel button{cursor:pointer;background:#333;color:#eee;border:1px solid #555;" +
      "border-radius:5px;padding:4px 8px;margin:2px;font-size:11px;}" +
      "#ownerPanel button:hover{background:#4a4a4a;}" +
      "#ownerPanel button.active{background:#7a1f1f;border-color:#ff5555;}" +
      "#ownerPanel input[type=number]{background:#222;color:#fff;border:1px solid #555;border-radius:4px;padding:2px 4px;}" +
      "#ownerPanel input[type=range]{width:100%;}" +
      "#ownerPanel h3{margin:0 0 8px 0;color:#ff5555;}" +
      "#ownerPanel h4{margin:10px 0 4px 0;color:#ffaa55;font-size:12px;}" +
      "#ownerPanel hr{border-color:#444;margin:10px 0;}" +
      "#ownerPanel .row{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}" +
      "#ownerPanel .objBtn{display:inline-flex;align-items:center;background:#2a2a2a;" +
      "border:1px solid #555;border-radius:6px;padding:3px 6px;margin:2px;font-size:10px;}" +
      "#ownerPanel .objBtn span{max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:4px;}" +
      "#ownerPanel .objBtn button{padding:2px 5px;font-size:10px;margin:0 1px;}";
    document.head.appendChild(style);

    function getVar(name) {
      var vars = game.getVariables();
      return vars.has(name) ? vars.get(name) : null;
    }

    function getCurrentSceneName() {
      try {
        return game.getSceneStack().getCurrentScene().getName();
      } catch (e) {
        return "Game Scene";
      }
    }

    function getCurrentScene() {
      return game.getSceneStack().getCurrentScene();
    }

    function getPlayerInstance() {
      try {
        var scene = getCurrentScene();
        var list = scene.getObjects(PLAYER_OBJECT_NAME);
        return list && list.length > 0 ? list[0] : null;
      } catch (e) {
        return null;
      }
    }

    var storedOriginalMaxHealth = null;
    var storedOriginalCurrentHealth = null;
    var IMMORTAL_HEALTH_VALUE = 999999999; // duza skonczona liczba zamiast Infinity (bezpieczniejsze dla UI/serializacji)

    function forceInfiniteHealth(inst) {
      var hb = inst.getBehavior(PLAYER_HEALTH_BEHAVIOR);
      if (!hb) return;
      // PRAWDZIWE nazwy metod behaviora Health::Health (PascalCase) - patrz debug output.
      tryCall(hb, ["SetChanceToDodge", "setPropertyChanceToDodge", "setChanceToDodge"], [1]);
      tryCall(
        hb,
        ["SetFlatDamageReduction", "setPropertyFlatDamageReduction", "setFlatDamageReduction"],
        [999999]
      );
      tryCall(
        hb,
        ["SetPercentDamageReduction", "setPropertyPercentDamageReduction", "setPercentDamageReduction"],
        [100]
      );
      tryCall(
        hb,
        ["SetMaxHealth", "_setMaxHealth", "setPropertyMaxHealth", "setMaxHealth", "setMaxHP", "setMaximumHealth"],
        [IMMORTAL_HEALTH_VALUE]
      );
      tryCall(
        hb,
        [
          "SetHealth",
          "SetCurrentHealth",
          "_setHealth",
          "_setCurrentHealth",
          "setPropertyCurrentHealth",
          "setCurrentHealth",
          "setHealth",
          "setHP",
          "setCurrentHP",
          "heal"
        ],
        [IMMORTAL_HEALTH_VALUE]
      );
      // Dodatkowa warstwa ochrony przez tarcze (jesli behavior ja wspiera) - ignorowane cicho jesli nie istnieje.
      tryCall(hb, ["SetShieldBlockExcessDamage"], [true]);
      tryCall(hb, ["SetMaxShieldPoints", "SetMaxShield"], [IMMORTAL_HEALTH_VALUE]);
      tryCall(hb, ["SetShieldPoints"], [IMMORTAL_HEALTH_VALUE]);
      tryCall(hb, ["SetShieldDuration"], [999999]);
      tryCall(hb, ["ActivateShield"], []);
    }

    function forceStrengthVar() {
      var v = getVar(STRENGTH_VAR);
      if (v) v.setNumber(IMMORTAL_STRENGTH_VALUE);
      var v2 = getVar("SavedStrength");
      if (v2) v2.setNumber(IMMORTAL_STRENGTH_VALUE);
    }

    function immortalFrame() {
      if (!immortal) return;
      var player = getPlayerInstance();
      if (player) forceInfiniteHealth(player);
      forceStrengthVar();
      immortalRafId = requestAnimationFrame(immortalFrame);
    }

    function setImmortal(on) {
      immortal = on;
      if (immortalRafId) {
        cancelAnimationFrame(immortalRafId);
        immortalRafId = null;
      }
      var player = getPlayerInstance();
      if (immortal) {
        if (player) {
          var hb = player.getBehavior(PLAYER_HEALTH_BEHAVIOR);
          if (hb) {
            storedOriginalMaxHealth = tryCall(hb, ["MaxHealth", "_getMaxHealth", "getMaxHealth", "getMaxHP"]);
            storedOriginalCurrentHealth = tryCall(hb, ["Health", "_getCurrentHealth", "getHealth", "getCurrentHealth"]);
          }
        }
        immortalFrame();
      } else {
        if (player) {
          var hb2 = player.getBehavior(PLAYER_HEALTH_BEHAVIOR);
          if (hb2) {
            tryCall(hb2, ["SetChanceToDodge"], [0]);
            tryCall(hb2, ["SetFlatDamageReduction"], [0]);
            tryCall(hb2, ["SetPercentDamageReduction"], [0]);
            if (typeof storedOriginalMaxHealth === "number") {
              tryCall(hb2, ["SetMaxHealth", "_setMaxHealth", "setMaxHealth", "setMaxHP"], [storedOriginalMaxHealth]);
            }
            if (typeof storedOriginalCurrentHealth === "number") {
              tryCall(
                hb2,
                ["SetHealth", "SetCurrentHealth", "_setHealth", "_setCurrentHealth", "setCurrentHealth", "setHealth"],
                [storedOriginalCurrentHealth]
              );
            }
          }
        }
      }
    }

    function openLink(url) {
      try {
        var electron = require("electron");
        if (electron && electron.shell && typeof electron.shell.openExternal === "function") {
          electron.shell.openExternal(url);
          return;
        }
      } catch (e) {
      }
      try {
        window.open(url, "_blank");
      } catch (e) {
        console.error("Owner Panel: nie udalo sie otworzyc linku", url, e);
      }
    }

    var desiredSpeed = null;
    var speedRafId = null;

    function applySpeedToAllPlayers(value) {
      var scene = getCurrentScene();
      var players = scene.getObjects(PLAYER_OBJECT_NAME) || [];
      var boost = Math.max(value * 4, 200);
      players.forEach(function (obj) {
        PLAYER_MOVEMENT_BEHAVIORS.forEach(function (behaviorName) {
          var mv = obj.getBehavior(behaviorName);
          if (!mv) return;
          tryCall(mv, ["setMaxSpeed"], [value]);
          tryCall(mv, ["setAcceleration"], [boost]);
          tryCall(mv, ["setDeceleration"], [boost]);
          tryCall(mv, ["setSpeed"], [value]);
          tryCall(mv, ["setWalkSpeed"], [value]);
          tryCall(mv, ["setForwardSpeed", "setForwardSpeedMax"], [value]);
        });
      });
    }

    function speedFrame() {
      if (desiredSpeed === null) {
        speedRafId = null;
        return;
      }
      applySpeedToAllPlayers(desiredSpeed);
      speedRafId = requestAnimationFrame(speedFrame);
    }

    function setDesiredSpeed(value) {
      desiredSpeed = value;
      if (!speedRafId) speedFrame();
    }

    function clearDesiredSpeed() {
      desiredSpeed = null;
      if (speedRafId) {
        cancelAnimationFrame(speedRafId);
        speedRafId = null;
      }
    }

    function spawnObject(objectName) {
      try {
        var scene = getCurrentScene();
        var obj = scene.createObject(objectName);
        if (!obj) {
          console.error("[OwnerPanel] scene.createObject('" + objectName + "') zwrocilo null/undefined - obiekt sie NIE stworzyl.");
          return;
        }
        var player = getPlayerInstance();
        var x = game.getGameResolutionWidth() / 2;
        var y = game.getGameResolutionHeight() / 2;
        if (player) {
          var angle = Math.random() * Math.PI * 2;
          x = player.getX() + Math.cos(angle) * SPAWN_DISTANCE;
          y = player.getY() + Math.sin(angle) * SPAWN_DISTANCE;
        }
        obj.setX(x);
        obj.setY(y);
        tryCall(obj, ["hide"], [false]);
        tryCall(obj, ["setOpacity"], [255]);

        var spawnedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
        console.log("[OwnerPanel] === SPAWN '" + objectName + "' na (" + Math.round(x) + "," + Math.round(y) + ") ===", obj);

        function tryCallLog(target, methodNames, args, label) {
          for (var i = 0; i < methodNames.length; i++) {
            var m = methodNames[i];
            if (target && typeof target[m] === "function") {
              try {
                var result = target[m].apply(target, args || []);
                console.log("[OwnerPanel] " + label + ": " + m + "(" + (args || []).join(",") + ") OK -> " + result);
                return result;
              } catch (e) {
                console.warn("[OwnerPanel] " + label + ": " + m + " rzucil blad:", e);
              }
            }
          }
          console.log("[OwnerPanel] " + label + ": ZADNA z metod [" + methodNames.join(", ") + "] nie istnieje na tym obiekcie.");
          return undefined;
        }

        function forceRawHealthFields(hb, maxH) {
          var maxPattern = /^_?max(imum)?(health|hp)$/i;
          var curPattern = /^_?(current)?(health|hp)$/i;
          var changed = [];
          for (var key in hb) {
            if (!Object.prototype.hasOwnProperty.call(hb, key)) continue;
            if (typeof hb[key] !== "number") continue;
            if (maxPattern.test(key) || curPattern.test(key)) {
              hb[key] = maxH;
              changed.push(key);
            }
          }
          console.log(
            "[OwnerPanel] forceRawHealthFields: " +
              (changed.length ? "nadpisano pola [" + changed.join(", ") + "] na " + maxH : "brak pasujacych surowych pol na behaviorze")
          );
        }

        function forceObjectHealthVariables(target, maxH) {
          var candidates = [
            "HP", "Hp", "hp", "Health", "health", "MaxHP", "MaxHealth",
            "CurrentHP", "CurrentHealth", "Zdrowie", "ZDROWIE", "PunktyZycia"
          ];
          var changed = [];
          try {
            var vars = target.getVariables();
            candidates.forEach(function (name) {
              if (vars.has(name)) {
                vars.get(name).setNumber(maxH);
                changed.push(name);
              }
            });
          } catch (e) {
            console.warn("[OwnerPanel] forceObjectHealthVariables: blad", e);
          }
          console.log(
            "[OwnerPanel] forceObjectHealthVariables: " +
              (changed.length ? "nadpisano zmienne [" + changed.join(", ") + "] na " + maxH : "brak zmiennych z listy kandydatow na tym obiekcie")
          );
        }

        function fixHealth(callLabel) {
          var hb = obj.getBehavior(PLAYER_HEALTH_BEHAVIOR);
          if (!hb) {
            console.warn("[OwnerPanel] " + callLabel + ": obiekt NIE MA behaviora '" + PLAYER_HEALTH_BEHAVIOR + "'.");
            return;
          }
          // PRAWDZIWE nazwy metod behaviora Health::Health (potwierdzone debug-em):
          // MaxHealth / Health (gettery), SetMaxHealth / SetHealth / SetCurrentHealth (settery),
          // _getCurrentHealth / _setCurrentHealth (wewnetrzne, ale dostepne).
          // Wczesniej uzywane camelCase (setMaxHealth, setHealth...) NIGDY nie istnialo -
          // to byl caly powod, dla ktorego HP nigdy nie bylo naprawiane.
          var maxH = tryCallLog(
            hb,
            ["MaxHealth", "_getMaxHealth", "getPropertyMaxHealth", "getMaxHealth", "getMaxHP"],
            [],
            callLabel + " odczyt maxH"
          );
          if (typeof maxH !== "number" || maxH <= 0) {
            console.log("[OwnerPanel] " + callLabel + ": maxH nieprawidlowe (" + maxH + "), uzywam fallback 500");
            maxH = 500;
          }
          tryCallLog(
            hb,
            ["SetMaxHealth", "_setMaxHealth", "setPropertyMaxHealth", "setMaxHealth", "setMaxHP"],
            [maxH],
            callLabel + " setMaxHealth"
          );
          tryCallLog(
            hb,
            ["SetHealth", "SetCurrentHealth", "_setHealth", "_setCurrentHealth", "setPropertyCurrentHealth", "setCurrentHealth", "setHealth"],
            [maxH],
            callLabel + " setCurrentHealth"
          );
          tryCallLog(hb, ["SetCooldownDuration", "_setDamageCooldown", "setPropertyDamageCooldown", "setDamageCooldown"], [0], callLabel + " setDamageCooldown");
          forceRawHealthFields(hb, maxH);
          forceObjectHealthVariables(obj, maxH);

          var checkAfter = tryCallLog(hb, ["Health", "_getCurrentHealth", "getHealth", "getCurrentHealth"], [], callLabel + " odczyt PO fixHealth");
          var isDead = tryCallLog(hb, ["IsDead"], [], callLabel + " IsDead?");
          console.log("[OwnerPanel] " + callLabel + ": HP po naprawie = " + checkAfter + ", IsDead=" + isDead);
        }

        fixHealth("fix#0 (natychmiast)");

        // Behavior czesto w pelni inicjalizuje sie dopiero w pierwszych klatkach
        // po stworzeniu obiektu i nadpisuje nasza wartosc, a event "HP <= 0 -> zniszcz"
        // moze zdazyc zadzialac zanim to zauwazymy. Dobijamy co klatke przez ~20 klatek
        // i logujemy DOKLADNIE, w ktorej klatce/po ilu ms obiekt znika ze sceny.
        var fixFrames = 0;
        function fixHealthRaf() {
          var stillExists = scene.getObjects(objectName).indexOf(obj) !== -1;
          var elapsed = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - spawnedAt);
          if (!stillExists) {
            console.error(
              "[OwnerPanel] '" + objectName + "' ZNIKNAL ze sceny po klatce #" + fixFrames + " (" + elapsed + "ms od spawnu)."
            );
            return;
          }
          if (fixFrames >= 20) {
            console.log("[OwnerPanel] '" + objectName + "' przetrwal 20 klatek naprawy (" + elapsed + "ms) - konczymy petle.");
            return;
          }
          fixFrames++;
          fixHealth("fix#" + fixFrames + " (rAF, " + elapsed + "ms)");
          requestAnimationFrame(fixHealthRaf);
        }
        requestAnimationFrame(fixHealthRaf);
      } catch (e) {
        console.error("Owner Panel: blad spawnu", objectName, e);
      }
    }

    function despawnObject(objectName) {
      try {
        var scene = getCurrentScene();
        var list = scene.getObjects(objectName) || [];
        var copy = list.slice();
        copy.forEach(function (inst) {
          inst.deleteFromScene(scene);
        });
      } catch (e) {
        console.error("Owner Panel: blad usuwania", objectName, e);
      }
    }

    function objectButtonsHtml(names, sceneName) {
      var html = "";
      names.forEach(function (n) {
        html +=
          '<span class="objBtn">' +
          iconImgTag(n, sceneName, resourceMap) +
          '<span title="' + n + '">' + n + "</span>" +
          '<button data-spawn="' + n + '">+</button>' +
          '<button data-despawn="' + n + '">X</button>' +
          '<button data-debughealth="' + n + '">?</button>' +
          "</span>";
      });
      return html;
    }

    function debugHealthApi(objectName) {
      var scene = getCurrentScene();
      var obj = scene.createObject(objectName);
      if (!obj) {
        lastDebugOutput = "Nie udalo sie stworzyc obiektu " + objectName;
        render();
        return;
      }
      var player = getPlayerInstance();
      if (player) {
        obj.setX(player.getX());
        obj.setY(player.getY());
      }
      var hb = obj.getBehavior(PLAYER_HEALTH_BEHAVIOR);
      if (!hb) {
        lastDebugOutput =
          "OBIEKT: " + objectName + "\nNIE MA behavioru '" + PLAYER_HEALTH_BEHAVIOR + "'.";
        render();
        return;
      }

      var proto = Object.getPrototypeOf(hb);
      var methodNames = [];
      while (proto && proto !== Object.prototype) {
        Object.getOwnPropertyNames(proto).forEach(function (name) {
          if (typeof hb[name] === "function" && methodNames.indexOf(name) === -1) {
            methodNames.push(name);
          }
        });
        proto = Object.getPrototypeOf(proto);
      }

      var ownFields = [];
      for (var key in hb) {
        if (Object.prototype.hasOwnProperty.call(hb, key)) {
          var val = hb[key];
          var t = typeof val;
          if (t === "number" || t === "string" || t === "boolean") {
            ownFields.push(key + " = " + val);
          } else if (val === null) {
            ownFields.push(key + " = null");
          }
        }
      }

      var text =
        "OBIEKT: " +
        objectName +
        "\n\n--- METODY (proto) ---\n" +
        (methodNames.length ? methodNames.sort().join(", ") : "(brak wykrytych)") +
        "\n\n--- WLASNE POLA (surowe, mozliwe do bezposredniego odczytu/zapisu) ---\n" +
        (ownFields.length ? ownFields.join("\n") : "(brak prostych pol - tylko obiekty/funkcje)");

      var varCandidates = [
        "HP", "Hp", "hp", "Health", "health", "MaxHP", "MaxHealth",
        "CurrentHP", "CurrentHealth", "Zdrowie", "ZDROWIE", "PunktyZycia"
      ];
      var foundVars = [];
      try {
        var objVars = obj.getVariables();
        varCandidates.forEach(function (name) {
          if (objVars.has(name)) {
            foundVars.push(name + " = " + objVars.get(name).getAsNumber());
          }
        });
      } catch (e) {}
      text +=
        "\n\n--- ZMIENNE OBIEKTU (kandydaci na HP) ---\n" +
        (foundVars.length
          ? foundVars.join("\n")
          : "(brak znalezionych zmiennych z listy kandydatow - jesli NPC mimo to gina, sprawdz eventy gry recznie)");

      lastDebugOutput = text;
      render();

      setTimeout(function () {
        var stillExists = scene.getObjects(objectName).indexOf(obj) !== -1;
        lastDebugOutput += "\n\nPo 500ms nadal istnieje w scenie: " + stillExists;
        render();
      }, 500);
    }

    function render() {
      var sceneName = getCurrentSceneName();
      var classified = classifySceneObjects(sceneName);
      var player = getPlayerInstance();
      var currentSpeed = desiredSpeed !== null ? desiredSpeed : 98;
      if (desiredSpeed === null && player) {
        for (var bi = 0; bi < PLAYER_MOVEMENT_BEHAVIORS.length; bi++) {
          var mv = player.getBehavior(PLAYER_MOVEMENT_BEHAVIORS[bi]);
          var s = tryCall(mv, ["getMaxSpeed", "getSpeed", "getWalkSpeed"]);
          if (typeof s === "number") {
            currentSpeed = s;
            break;
          }
        }
      }

      var html = "<h3>" + PANEL_TITLE + "</h3>";

      if (lastDebugOutput) {
        html +=
          '<div style="background:#111;border:1px solid #555;border-radius:6px;padding:6px;margin-bottom:8px;">' +
          '<b style="color:#7fd7ff;">Debug output</b>' +
          '<pre style="white-space:pre-wrap;font-size:10px;max-height:200px;overflow-y:auto;margin:4px 0;">' +
          lastDebugOutput.replace(/</g, "&lt;") +
          "</pre>" +
          '<button id="opDebugClear">Wyczysc</button>' +
          "</div>";
      }

      html += "<h4>Gracz</h4>";
      html +=
        '<button id="opImmortal" class="' +
        (immortal ? "active" : "") +
        '">Niesmiertelnosc (HP: nieskonczonosc): ' +
        (immortal ? "WLACZONA" : "wylaczona") +
        "</button>";
      html +=
        '<div class="row" style="margin-top:6px;"><span>Predkosc (wymuszana: ' +
        (desiredSpeed !== null ? "TAK" : "nie") +
        ", " +
        Math.round(currentSpeed) +
        ')</span></div>';
      html +=
        '<input id="opSpeed" type="range" min="0" max="2000" step="10" value="' +
        currentSpeed +
        '"/>';
      html += '<button id="opSpeedStop">Wylacz wymuszanie predkosci</button>';

      html += "<hr/><h4>Linki</h4>";
      html += '<button id="opGoogle">Otworz nasz link tiktoka</button>';

      html += "<hr/><h4>Zmienne globalne</h4>";
      GLOBAL_VARS.forEach(function (name) {
        var v = getVar(name);
        var val = v ? v.getAsNumber() : "(brak)";
        html +=
          '<div class="row"><span>' +
          name +
          '</span><input data-var="' +
          name +
          '" type="number" step="any" value="' +
          val +
          '" style="width:80px;"/></div>';
      });
      html += '<button id="opApply">Zastosuj zmienne</button>';

      html += "<hr/><h4>Szybkie akcje</h4>";
      html += '<button id="opMaxStr">Max Strength</button>';
      html += '<button id="opForceSave">Force Save</button>';
      html += '<button id="opReload">Restart gry</button>';

      html += "<hr/><h4>Zmiana sceny</h4>";
      SCENES.forEach(function (s) {
        html += '<button data-scene="' + s + '">' + s + "</button>";
      });

      html += "<hr/><h4>NPC / Stworzenia (scena: " + sceneName + ")</h4>";
      html +=
        classified.npc.length > 0
          ? objectButtonsHtml(classified.npc, sceneName)
          : "<i>Brak wykrytych NPC w tej scenie</i>";

      html += "<hr/><h4>Przedmioty / surowce</h4>";
      html +=
        classified.items.length > 0
          ? objectButtonsHtml(classified.items, sceneName)
          : "<i>Brak wykrytych przedmiotow w tej scenie</i>";

      html += "<hr/><h4>Wezly zasobow (drzewa / kamienie / kloce)</h4>";
      html +=
        classified.nodes.length > 0
          ? objectButtonsHtml(classified.nodes, sceneName)
          : "<i>Brak w tej scenie</i>";

      html += "<hr/><h4>Pozostale stworzenia / obiekty (bez behaviora Health)</h4>";
      html +=
        classified.other.length > 0
          ? objectButtonsHtml(classified.other, sceneName)
          : "<i>Brak w tej scenie</i>";

      panel.innerHTML = html;

      panel.querySelector("#opImmortal").onclick = function () {
        setImmortal(!immortal);
        render();
      };

      panel.querySelector("#opGoogle").onclick = function () {
        openLink("https://www.tiktok.com/@pomidoruwkavr");
      };

      panel.querySelector("#opSpeed").oninput = function (e) {
        setDesiredSpeed(parseFloat(e.target.value));
      };
      panel.querySelector("#opSpeed").onchange = function () {
        render();
      };
      panel.querySelector("#opSpeedStop").onclick = function () {
        clearDesiredSpeed();
        render();
      };

      panel.querySelector("#opApply").onclick = function () {
        GLOBAL_VARS.forEach(function (name) {
          var input = panel.querySelector('[data-var="' + name + '"]');
          var num = parseFloat(input.value);
          var v = getVar(name);
          if (v && !isNaN(num)) v.setNumber(num);
        });
        render();
      };

      panel.querySelector("#opMaxStr").onclick = function () {
        var v = getVar("Strength_");
        if (v) v.setNumber(9999);
        render();
      };

      panel.querySelector("#opForceSave").onclick = function () {
        var day = getVar("Day");
        var savedDay = getVar("SavedDayCount");
        var str = getVar("Strength_");
        var savedStr = getVar("SavedStrength");
        var loaded = getVar("Loaded");
        if (day && savedDay) savedDay.setNumber(day.getAsNumber());
        if (str && savedStr) savedStr.setNumber(str.getAsNumber());
        if (loaded) loaded.setNumber(1);
        render();
      };

      panel.querySelector("#opReload").onclick = function () {
        window.location.reload();
      };

      Array.prototype.forEach.call(panel.querySelectorAll("[data-scene]"), function (btn) {
        btn.onclick = function () {
          try {
            game.getSceneStack().replace(btn.getAttribute("data-scene"));
            setTimeout(render, 300);
          } catch (e) {
            console.error(e);
          }
        };
      });

      Array.prototype.forEach.call(panel.querySelectorAll("[data-spawn]"), function (btn) {
        btn.onclick = function () {
          spawnObject(btn.getAttribute("data-spawn"));
        };
      });

      Array.prototype.forEach.call(panel.querySelectorAll("[data-despawn]"), function (btn) {
        btn.onclick = function () {
          despawnObject(btn.getAttribute("data-despawn"));
        };
      });

      Array.prototype.forEach.call(panel.querySelectorAll("[data-debughealth]"), function (btn) {
        btn.onclick = function () {
          debugHealthApi(btn.getAttribute("data-debughealth"));
        };
      });

      if (panel.querySelector("#opDebugClear")) {
        panel.querySelector("#opDebugClear").onclick = function () {
          lastDebugOutput = "";
          render();
        };
      }
    }

    var visible = false;
    window.addEventListener("keydown", function (e) {
      if (e.key === "F1" || e.keyCode === 112) {
        e.preventDefault();
        visible = !visible;
        panel.style.display = visible ? "block" : "none";
        if (visible) render();
      }
    });
  }

  init();
})();

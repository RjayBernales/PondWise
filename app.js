// PondWise v1 - plain JS, no framework.
// Read top to bottom: storage, ponds, feed, tasks, records, finance, guide.
// Every function does one small thing.

// ---------- 1. Storage ----------

var STORE_KEY = "pondwise_v1";

function blankState() {
  return {
    ponds: [],
    activePondId: null,
    tasks: [],
    feedLogs: [],
    waterLogs: [],
    healthLogs: [],
    maintLogs: [],
    expenses: [],
    sales: []
  };
}

function loadData() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blankState();
    return JSON.parse(raw);
  } catch (e) {
    return blankState();
  }
}

function saveData(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

// Simple unique id even for beginners to read.
function makeId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

function getActivePond(state) {
  var i;
  for (i = 0; i < state.ponds.length; i++) {
    if (state.ponds[i].id === state.activePondId) return state.ponds[i];
  }
  return null;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- 2. Pure calculations (no DOM, easy to test) ----------

function calcFeedKg(count, avgWeightG, ratePercent) {
  var biomassKg = (count * avgWeightG) / 1000;
  return biomassKg * (ratePercent / 100);
}

// Standard feed program by fish size (proposal for common pond species).
// Single source of truth: the Feed tab guide table renders from this.
var FEED_STAGES = [
  { minG: 0, maxG: 5, size: "0-5 g (fry)", feed: "Fry mash", protein: "40%", rate: 10, meals: "4-5" },
  { minG: 5, maxG: 20, size: "5-20 g (fingerling)", feed: "Starter crumble", protein: "35%", rate: 7, meals: "3-4" },
  { minG: 20, maxG: 100, size: "20-100 g (juvenile)", feed: "Grower pellet 2 mm", protein: "30%", rate: 5, meals: "3" },
  { minG: 100, maxG: 250, size: "100-250 g (grow-out)", feed: "Grower pellet 3 mm", protein: "28%", rate: 3, meals: "2-3" },
  { minG: 250, maxG: null, size: "250 g+ (finisher)", feed: "Finisher pellet 4 mm", protein: "25%", rate: 2.5, meals: "2" }
];

function recommendFeed(avgWeightG) {
  var w = Number(avgWeightG);
  if (!w || w <= 0) return null;
  var i;
  for (i = 0; i < FEED_STAGES.length; i++) {
    var s = FEED_STAGES[i];
    if (w >= s.minG && (s.maxG === null || w < s.maxG)) return s;
  }
  return FEED_STAGES[FEED_STAGES.length - 1];
}

// Daily ration for one pond's population: { stage, kg } or null.
function pondDailyRation(count, avgWeightG) {
  var n = Number(count);
  var stage = recommendFeed(avgWeightG);
  if (!n || n <= 0 || !stage) return null;
  return { stage: stage, kg: calcFeedKg(n, Number(avgWeightG), stage.rate) };
}

function calcTotals(expenses, sales, pondId) {
  var exp = 0;
  var sal = 0;
  var i;
  for (i = 0; i < expenses.length; i++) {
    if (!pondId || expenses[i].pondId === pondId) exp += Number(expenses[i].amount);
  }
  for (i = 0; i < sales.length; i++) {
    if (!pondId || sales[i].pondId === pondId) sal += Number(sales[i].amount);
  }
  return { expenses: exp, sales: sal, profit: sal - exp };
}

function getUpcomingTasks(tasks, pondId) {
  var out = [];
  var i;
  for (i = 0; i < tasks.length; i++) {
    if (tasks[i].pondId === pondId && !tasks[i].done) out.push(tasks[i]);
  }
  out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}

// Today's schedule for the mobile dashboard: open tasks due today or overdue
// first (oldest first), then tasks finished today. Capped at 6 rows.
function getTodaySchedule(tasks, pondId, today) {
  var open = [];
  var doneToday = [];
  var i;
  for (i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (t.pondId !== pondId) continue;
    if (!t.done && t.date <= today) open.push(t);
    else if (t.done && t.date === today) doneToday.push(t);
  }
  open.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return open.concat(doneToday).slice(0, 6);
}

// Rule-based tips from the latest water log. Simple if/else on purpose.
function buildAdvice(waterLog) {
  var tips = [];
  tips.push("Feed only what fish finish in 10-15 minutes. Remove leftover feed.");
  if (!waterLog) {
    tips.push("No water records yet. Log temperature and pH weekly.");
    return tips;
  }
  var ph = Number(waterLog.ph);
  var temp = Number(waterLog.temp);
  if (waterLog.ph !== "" && (ph < 6.5 || ph > 9)) {
    tips.push("pH is " + ph + ". Safe range is about 6.5-9. Change part of the water and re-check tomorrow.");
  } else {
    tips.push("pH looks OK. Keep logging it weekly.");
  }
  if (waterLog.temp !== "" && (temp < 24 || temp > 32)) {
    tips.push("Temperature is " + temp + "C. Most warm-water fish prefer 24-32C. Add shade or adjust depth.");
  }
  if (waterLog.notes) tips.push("Your note: " + waterLog.notes);
  return tips;
}

// ---------- 3. Navigation ----------

function showSection(name) {
  var names = ["dashboard", "ponds", "feed", "tasks", "records", "finance", "plans", "guide"];
  var i;
  for (i = 0; i < names.length; i++) {
    document.getElementById("section-" + names[i]).hidden = (names[i] !== name);
  }
  // Underline the active tab so users know where they are.
  var tabs = document.querySelectorAll(".tabs button");
  for (i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle("active", tabs[i].getAttribute("data-section") === name);
  }
  // Same for the mobile bottom tab bar.
  var bar = document.querySelectorAll(".tabbar button");
  for (i = 0; i < bar.length; i++) {
    bar[i].classList.toggle("active", bar[i].getAttribute("data-section") === name);
  }
  // Deep link: the URL hash remembers the open section.
  if (window.location.hash !== "#" + name) window.location.hash = "#" + name;
  refresh();
}

// ---------- 4. Ponds ----------

function addPond(event) {
  event.preventDefault();
  var state = loadData();
  if (state.ponds.length >= pondLimit()) {
    renderPondNote(state, true);
    return false;
  }
  var pond = {
    id: makeId(),
    name: document.getElementById("pondName").value.trim(),
    size: document.getElementById("pondSize").value,
    notes: document.getElementById("pondNotes").value.trim(),
    stock: { common: "", scientific: "", count: "", avgWeightG: "" }
  };
  state.ponds.push(pond);
  state.activePondId = pond.id;
  saveData(state);
  document.getElementById("pondForm").reset();
  refresh();
  return false;
}

function selectPond(id) {
  var state = loadData();
  state.activePondId = id;
  saveData(state);
  refresh();
}

function deletePond(id) {
  if (!confirm("Delete this pond and its records?")) return;
  var state = loadData();
  state.ponds = state.ponds.filter(function (p) { return p.id !== id; });
  state.tasks = state.tasks.filter(function (t) { return t.pondId !== id; });
  state.feedLogs = state.feedLogs.filter(function (t) { return t.pondId !== id; });
  state.waterLogs = state.waterLogs.filter(function (t) { return t.pondId !== id; });
  state.healthLogs = state.healthLogs.filter(function (t) { return t.pondId !== id; });
  state.maintLogs = state.maintLogs.filter(function (t) { return t.pondId !== id; });
  state.expenses = state.expenses.filter(function (t) { return t.pondId !== id; });
  state.sales = state.sales.filter(function (t) { return t.pondId !== id; });
  if (state.activePondId === id) {
    state.activePondId = state.ponds.length ? state.ponds[0].id : null;
  }
  saveData(state);
  refresh();
}

function saveStock(event) {
  event.preventDefault();
  var state = loadData();
  var pond = getActivePond(state);
  if (!pond) { alert("Add a pond first."); return false; }
  pond.stock.common = document.getElementById("stockCommon").value.trim();
  pond.stock.scientific = document.getElementById("stockScientific").value.trim();
  pond.stock.count = document.getElementById("stockCount").value;
  pond.stock.avgWeightG = document.getElementById("stockWeight").value;
  saveData(state);
  refresh();
  return false;
}

// ---------- 5. Feed + species library ----------

function estimateFeed() {
  var count = Number(document.getElementById("feedCount").value);
  var weight = Number(document.getElementById("feedWeight").value);
  var rate = Number(document.getElementById("feedRate").value);
  if (!count || !weight || !rate) {
    document.getElementById("feedResult").textContent = "Enter count, weight, and rate.";
    return;
  }
  var kg = calcFeedKg(count, weight, rate);
  document.getElementById("feedResult").textContent =
    "Daily feed: " + kg.toFixed(2) + " kg (" + (kg / 2).toFixed(2) + " kg x 2 feedings)";
  document.getElementById("feedHint").textContent =
    "Guide: fry 8-10%, fingerlings 5-8%, juveniles 3-5%, grow-out 2-3% of body weight per day.";
}

function fillFeedFromPond() {
  var state = loadData();
  var pond = getActivePond(state);
  if (!pond || !pond.stock.count) { alert("Save stock for this pond first."); return; }
  document.getElementById("feedCount").value = pond.stock.count;
  document.getElementById("feedWeight").value = pond.stock.avgWeightG;
  var rate = findLocalRate(pond.stock.scientific, pond.stock.common);
  if (!rate) rate = suggestRateByWeight(Number(pond.stock.avgWeightG));
  document.getElementById("feedRate").value = rate;
}

function findLocalRate(scientific, common) {
  var i;
  var s = (scientific || "").toLowerCase();
  var c = (common || "").toLowerCase();
  for (i = 0; i < SPECIES_LIST.length; i++) {
    if (SPECIES_LIST[i].scientific.toLowerCase() === s) return SPECIES_LIST[i].rate;
    if (c && SPECIES_LIST[i].common.toLowerCase() === c) return SPECIES_LIST[i].rate;
  }
  return null;
}

// Live species search. Tries FishBase API, falls back to local list.
function searchSpecies() {
  var q = document.getElementById("speciesSearch").value.trim();
  var box = document.getElementById("speciesResults");
  box.innerHTML = "<li>Searching...</li>";
  var local = searchLocal(q);
  // FishBase API: GET https://fishbase.ropensci.org/species?Genus=TILAPIA...
  // We search by genus word; on any failure we show local results.
  var genus = q.split(" ")[0];
  fetch("https://fishbase.ropensci.org/species?Genus=" + encodeURIComponent(genus) + "&limit=5")
    .then(function (res) { return res.json(); })
    .then(function (json) {
      var rows = json.data || json;
      box.innerHTML = "";
      if (rows && rows.length) {
        rows.slice(0, 5).forEach(function (r) {
          var name = (r.Genus || "") + " " + (r.Species || "");
          var li = document.createElement("li");
          li.textContent = name.trim() + " (FishBase) ";
          var btn = document.createElement("button");
          btn.textContent = "Use";
          btn.className = "btn-small btn-ghost";
          btn.onclick = function () { useSpecies("", name.trim()); };
          li.appendChild(btn);
          box.appendChild(li);
        });
      } else {
        renderSpeciesRows(box, local, "local");
      }
    })
    .catch(function () {
      box.innerHTML = "";
      renderSpeciesRows(box, local, "local (offline)");
    });
}

function searchLocal(q) {
  q = q.toLowerCase();
  if (!q) return SPECIES_LIST;
  return SPECIES_LIST.filter(function (s) {
    return s.common.toLowerCase().indexOf(q) >= 0 ||
      s.scientific.toLowerCase().indexOf(q) >= 0;
  });
}

function renderSpeciesRows(box, list, tag) {
  box.innerHTML = "";
  if (!list.length) { box.innerHTML = "<li>No match. Try another name.</li>"; return; }
  list.forEach(function (s) {
    var li = document.createElement("li");
    li.textContent = s.common + " - " + s.scientific + " (" + tag + ", guide " + s.rate + "%) ";
    var btn = document.createElement("button");
    btn.textContent = "Use";
    btn.className = "btn-small btn-ghost";
    btn.onclick = function () { useSpecies(s.common, s.scientific); };
    li.appendChild(btn);
    box.appendChild(li);
  });
}

function useSpecies(common, scientific) {
  showSection("ponds");
  document.getElementById("stockCommon").value = common;
  document.getElementById("stockScientific").value = scientific;
}

// ---------- 6. Tasks ----------

function addTask(event) {
  event.preventDefault();
  var state = loadData();
  if (!state.activePondId) { alert("Add a pond first."); return false; }
  state.tasks.push({
    id: makeId(),
    pondId: state.activePondId,
    title: document.getElementById("taskTitle").value.trim(),
    type: document.getElementById("taskType").value,
    date: document.getElementById("taskDate").value,
    done: false
  });
  saveData(state);
  event.target.reset();
  refresh();
  return false;
}

function toggleTask(id) {
  var state = loadData();
  var i;
  for (i = 0; i < state.tasks.length; i++) {
    if (state.tasks[i].id === id) state.tasks[i].done = !state.tasks[i].done;
  }
  saveData(state);
  refresh();
}

function deleteTask(id) {
  var state = loadData();
  state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
  saveData(state);
  refresh();
}

// ---------- 6b. Calendar ----------

var calCursor = null;   // { y, m } month on display (m is 0-based)
var calSelected = null; // yyyy-mm-dd picked day

function calEnsure() {
  if (!calCursor) {
    var d = new Date();
    calCursor = { y: d.getFullYear(), m: d.getMonth() };
  }
  if (!calSelected) calSelected = todayStr();
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function ymd(y, m, d) {
  var dt = new Date(y, m, d);
  return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate());
}

function calMove(dir) {
  calEnsure();
  var dt = new Date(calCursor.y, calCursor.m + dir, 1);
  calCursor = { y: dt.getFullYear(), m: dt.getMonth() };
  refresh();
}

function calToday() {
  var d = new Date();
  calCursor = { y: d.getFullYear(), m: d.getMonth() };
  calSelected = todayStr();
  var el = document.getElementById("taskDate");
  if (el) el.value = calSelected;
  refresh();
}

// Picking a day fills the add-task date so the task lands on that day.
function calPick(dateStr) {
  var parts = dateStr.split("-");
  calCursor = { y: Number(parts[0]), m: Number(parts[1]) - 1 };
  calSelected = dateStr;
  var el = document.getElementById("taskDate");
  if (el) el.value = dateStr;
  refresh();
}

function tasksOn(tasks, dateStr) {
  return tasks.filter(function (t) { return t.date === dateStr; });
}

// ---------- 7. Records ----------

function needPond(state) {
  if (!state.activePondId) { alert("Add a pond first."); return true; }
  return false;
}

function flashSaved(elId, msg) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  setTimeout(function () { el.hidden = true; }, 4000);
}

function deleteRow(collection, id) {
  var state = loadData();
  state[collection] = state[collection].filter(function (r) { return r.id !== id; });
  saveData(state);
  refresh();
}

function addFeedLog(event) {
  event.preventDefault();
  var state = loadData();
  if (needPond(state)) return false;
  var kg = document.getElementById("feedLogKg").value;
  state.feedLogs.push({
    id: makeId(), pondId: state.activePondId,
    date: document.getElementById("feedLogDate").value,
    kg: kg
  });
  saveData(state);
  event.target.reset();
  refresh();
  setDefaultDates();
  flashSaved("recordsSaved", "Saved! You gave " + kg + " kg of food.");
  return false;
}

function addWaterLog(event) {
  event.preventDefault();
  var state = loadData();
  if (needPond(state)) return false;
  state.waterLogs.push({
    id: makeId(), pondId: state.activePondId,
    date: document.getElementById("waterDate").value,
    temp: document.getElementById("waterTemp").value,
    ph: document.getElementById("waterPh").value,
    notes: document.getElementById("waterNotes").value.trim()
  });
  saveData(state);
  event.target.reset();
  refresh();
  setDefaultDates();
  flashSaved("recordsSaved", "Saved! Your water check is written.");
  return false;
}

function addHealthLog(event) {
  event.preventDefault();
  var state = loadData();
  if (needPond(state)) return false;
  state.healthLogs.push({
    id: makeId(), pondId: state.activePondId,
    date: document.getElementById("healthDate").value,
    note: document.getElementById("healthNote").value.trim()
  });
  saveData(state);
  event.target.reset();
  refresh();
  setDefaultDates();
  flashSaved("recordsSaved", "Saved! Your fish note is written.");
  return false;
}

function addMaintenanceLog(event) {
  event.preventDefault();
  var state = loadData();
  if (needPond(state)) return false;
  state.maintLogs.push({
    id: makeId(), pondId: state.activePondId,
    date: document.getElementById("maintDate").value,
    note: document.getElementById("maintNote").value.trim()
  });
  saveData(state);
  event.target.reset();
  refresh();
  setDefaultDates();
  flashSaved("recordsSaved", "Saved! Your work note is written.");
  return false;
}

// ---------- 8. Finance ----------

function addExpense(event) {
  event.preventDefault();
  var state = loadData();
  if (needPond(state)) return false;
  if (!canUseMoney()) { showSection("plans"); return false; }
  var item = document.getElementById("expItem").value.trim();
  var amount = document.getElementById("expAmount").value;
  state.expenses.push({
    id: makeId(), pondId: state.activePondId,
    date: document.getElementById("expDate").value,
    item: item,
    amount: amount
  });
  saveData(state);
  event.target.reset();
  refresh();
  setDefaultDates();
  flashSaved("financeSaved", "Saved! You paid " + amount + " pesos for " + item + ".");
  return false;
}

function addSale(event) {
  event.preventDefault();
  var state = loadData();
  if (needPond(state)) return false;
  if (!canUseMoney()) { showSection("plans"); return false; }
  var item = document.getElementById("saleItem").value.trim();
  var amount = document.getElementById("saleAmount").value;
  state.sales.push({
    id: makeId(), pondId: state.activePondId,
    date: document.getElementById("saleDate").value,
    item: item,
    amount: amount
  });
  saveData(state);
  event.target.reset();
  refresh();
  setDefaultDates();
  flashSaved("financeSaved", "Saved! You got " + amount + " pesos for " + item + ".");
  return false;
}

// ---------- 9. Helper chatbot (railguarded to PondWise topics) ----------

// Whole words the Helper is allowed to talk about (plurals included).
// Whole-word matching matters: substring matching would let "weather" pass
// because it contains "eat". Anything else gets a polite redirect.
var GUIDE_WORDS = [
  "pond", "ponds", "fish", "fishes", "tilapia", "catfish", "carp", "carps",
  "milkfish", "gourami", "snakehead", "fingerling", "fingerlings",
  "feed", "feeds", "feeding", "food", "foods", "kg", "kilo", "eat", "eating", "rate",
  "water", "waters", "ph", "temp", "temperature", "oxygen", "algae", "clear", "muddy",
  "health", "healthy", "sick", "disease", "diseases", "dead", "floating", "floaters",
  "spot", "spots", "vet",
  "task", "tasks", "todo", "clean", "cleaning", "inspect", "inspection",
  "repair", "schedule", "calendar", "reminder",
  "money", "profit", "sale", "sales", "sold", "sell", "expense", "expenses",
  "cost", "costs", "paid", "pay", "buy", "bought", "price", "prices",
  "peso", "pesos", "earn", "earned",
  "record", "records", "log", "logs", "note", "notes", "report", "dashboard",
  "pondwise", "helper", "guide", "start", "started", "add", "save", "saved",
  "delete", "remove", "backup", "demo"
];
var GUIDE_RE = new RegExp("\\b(" + GUIDE_WORDS.join("|") + ")\\b");

// Hard off-topic tripwires. Blocklist wins: even if a PondWise word appears,
// these topics are refused (e.g. "bet my fish will win the game").
var BLOCK_RE = /\b(weather|rain forecast|news|sports?|basketball|football|volleyball|game|games|politics|politician|election|president|mayor|lottery|lotto|casino|bet|betting|movie|movies|film|music|song|songs|love|marry|marriage|school|homework|math|joke|god|pray|prayer|church|recipe|cook|ulam)\b/;

// Allowed how-to / identity phrases that carry no PondWise noun by themselves.
var HELP_RE = /\b(help|how (do i|do u|to) (start|use|add|save)|what is pondwise|why pondwise|who are you|your name|what can you do)\b/;

var OFFTOPIC_REPLY = "Sorry, I only talk about PondWise and fishpond care (ponds, fish, food, water, tasks, records, money). " +
  "Try asking: 'How much feed today?' or 'Check my water' or 'How do I see my profit?'";

function isOnTopic(text) {
  var t = " " + (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ") + " ";
  if (!t.trim()) return false;
  if (BLOCK_RE.test(t)) return false;
  if (GUIDE_RE.test(t)) return true;
  if (HELP_RE.test(t)) return true;
  // Short greetings are allowed so the bot feels friendly, then it redirects.
  if (/^\s*(hi|hello|hey|good (morning|afternoon|evening)|salamat|thanks?|thank you)\b/.test(t)) return true;
  return false;
}

function latestWater(state, pondId) {
  var logs = state.waterLogs.filter(function (w) { return w.pondId === pondId; });
  logs.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return logs[0] || null;
}

function botReply(question) {
  var state = loadData();
  var pond = getActivePond(state);
  var q = (question || "").toLowerCase();

  // Railguard: refuse off-topic questions.
  if (!isOnTopic(question)) return OFFTOPIC_REPLY;

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(q.trim())) {
    return "Hello! I am your PondWise Helper. I can explain your ponds, food, water, tasks, and money. " +
      "Try: 'How much feed today?' or 'How do I start?'";
  }
  if (q.indexOf("thank") >= 0 || q === "salamat") {
    return "You are welcome! Keep logging every day - small notes make healthy fish.";
  }
  if (q.indexOf("who are you") >= 0 || q.indexOf("your name") >= 0) {
    return "I am your PondWise Helper - a small assistant inside this app. " +
      "I read your ponds, food, water, tasks, and money notes to answer questions. " +
      "Try: 'How much feed today?' or 'Check my water'.";
  }
  if (q.indexOf("what is pondwise") >= 0 || q === "what is pondwise?") {
    return "WHAT: PondWise is your fishpond notebook on your phone or computer. " +
      "It remembers your ponds, fish, food, water, tasks, and money so you do not forget.";
  }
  if (q.indexOf("why") >= 0 && q.indexOf("pondwise") >= 0) {
    return "WHY: So you feed the right amount, spot bad water early, and know if you earned money. " +
      "No more lost paper notes.";
  }
  if (q.indexOf("how do i start") >= 0 || q.indexOf("how to start") >= 0 || q.indexOf("how do i use") >= 0) {
    return "HOW (4 easy steps): 1) Go to Ponds, add your pond, tap its card. " +
      "2) Write your fish: name, how many, how big. " +
      "3) Every day open Records and save food + water. " +
      "4) When you pay or sell, open Money and save it. That is all!";
  }
  if (q.indexOf("add") >= 0 && q.indexOf("pond") >= 0) {
    return "To add a pond: open Ponds, find 'Step 2: Add a new pond', type the name (example: Home Pond), " +
      "type the size (example: 500), then tap 'Add this pond'. Then tap its card to pick it.";
  }
  if (q.indexOf("stock") >= 0 || (q.indexOf("fish") >= 0 && q.indexOf("add") >= 0)) {
    return "To write your fish: pick a pond card first, then in 'Step 3: Fish inside' type the fish name, " +
      "how many, and how big in grams. Tap 'Save fish'.";
  }
  if (q.indexOf("feed") >= 0 || q.indexOf("food") >= 0) {
    if (!pond) return "Add a pond first (open Ponds), then I can tell you how much food to give.";
    if (!pond.stock.count || !pond.stock.avgWeightG) {
      return "I need your fish number and size first. Open Ponds, pick " + pond.name +
        ", and save how many fish and how big they are. Then ask me again.";
    }
    var rate = findLocalRate(pond.stock.scientific, pond.stock.common) ||
      suggestRateByWeight(Number(pond.stock.avgWeightG));
    var kg = calcFeedKg(Number(pond.stock.count), Number(pond.stock.avgWeightG), rate);
    var half = kg / 2;
    return "For " + pond.name + " (" + pond.stock.count + " fish x " + pond.stock.avgWeightG + "g): give about " +
      kg.toFixed(2) + " kg today - that is " + half.toFixed(2) + " kg in the morning and " +
      half.toFixed(2) + " kg in the afternoon. Only give what fish finish in 10-15 minutes.";
  }
  if (q.indexOf("water") >= 0 || q.indexOf("ph") >= 0 || q.indexOf("temp") >= 0) {
    if (!pond) return "Add a pond first, then save a water check in Records so I can read it.";
    var wl = latestWater(state, pond.id);
    var tips = buildAdvice(wl);
    return "Water advice for " + pond.name + ": " + tips.join(" ");
  }
  if (q.indexOf("sick") >= 0 || q.indexOf("disease") >= 0 || q.indexOf("dead") >= 0 || q.indexOf("floating") >= 0 || q.indexOf("health") >= 0) {
    return "If fish are slow, floating, or have spots: 1) Do not overfeed today. 2) Change part of the water with clean water. " +
      "3) Write what you see in Records > Fish health. 4) If many fish die, ask a local fish expert fast - I am not a vet.";
  }
  if (q.indexOf("task") >= 0 || q.indexOf("todo") >= 0 || q.indexOf("remind") >= 0 || q.indexOf("schedule") >= 0) {
    if (!pond) return "Add a pond first. Then open Tasks to add things like 'Morning feeding'.";
    var upcoming = getUpcomingTasks(state.tasks, pond.id);
    if (!upcoming.length) return "No open tasks for " + pond.name + ". Open Tasks and add one, like 'Morning feeding' for today.";
    return "You have " + upcoming.length + " open task" + (upcoming.length === 1 ? "" : "s") + " for " + pond.name +
      ". Next: '" + upcoming[0].title + "' on " + upcoming[0].date + ". Open Tasks to tick Done.";
  }
  if (q.indexOf("profit") >= 0 || q.indexOf("money") >= 0 || q.indexOf("sale") >= 0 || q.indexOf("expense") >= 0 || q.indexOf("earn") >= 0) {
    if (!pond) return "Add a pond first. Then open Money to save what you paid and what you sold.";
    var t = calcTotals(state.expenses, state.sales, pond.id);
    var plain = t.profit >= 0
      ? "Good! You have " + t.profit + " pesos left."
      : "Careful: you paid more than you sold by " + Math.abs(t.profit) + " pesos.";
    return "Money for " + pond.name + ": you paid " + t.expenses + " pesos, you sold " + t.sales +
      " pesos. " + plain + " To see it, open Money - the green box on top shows money left.";
  }
  // Generic "where" goes after topic branches so "Where is my profit?" gets money.
  if (q.indexOf("where") >= 0) {
    return "WHERE: Ponds = your ponds. Feed = food calculator. Tasks = things to do and calendar. " +
      "Records = daily notes. Money = money in and out. Plans = subscription options. " +
      "You are now in Helper - ask me anything about those.";
  }
  if (q.indexOf("record") >= 0 || q.indexOf("log") >= 0 || q.indexOf("note") >= 0) {
    return "To write a daily note: open Records. Pick 1 box: 1 Food given, 2 Water check, 3 Fish health, 4 Work done. " +
      "The date is already today - just type and tap the big Save button.";
  }
  if (q.indexOf("backup") >= 0 || q.indexOf("download") >= 0 || q.indexOf("restore") >= 0) {
    return "To keep a copy: on this page, tap 'Download backup' - it saves a file. " +
      "To bring it back later, use 'Bring back a backup' and pick that file.";
  }
  if (q.indexOf("demo") >= 0) {
    return "Demo data is pretend ponds so you can practice. Tap 'Load demo data' (top of Ponds page) to see 3 ponds with food, water, and money already filled in.";
  }
  // Bare "help" lands here; "help + topic" is caught by the branches above.
  if (q.indexOf("help") >= 0 || q.indexOf("what can you do") >= 0) {
    return "I can: 1) Tell you how much food to give ('How much feed today?'). " +
      "2) Check your water ('Check my water'). 3) Read your tasks and money ('How do I see my profit?'). " +
      "4) Teach you the app ('How do I start?'). Tap a green button above or type your question.";
  }
  if (!pond) {
    return "You have no pond yet. Open Ponds and add one (example: Home Pond), or tap 'Load demo data' to practice. Then ask me again!";
  }
  // Default on-topic fallback: summarize this pond in plain words.
  var tt = calcTotals(state.expenses, state.sales, pond.id);
  var up = getUpcomingTasks(state.tasks, pond.id);
  return "Your pond " + pond.name + " has " + (pond.stock.count || "no") + " fish (" +
    (pond.stock.common || "no name yet") + "), " + up.length + " open task" + (up.length === 1 ? "" : "s") + ", and " +
    tt.profit + " pesos left. Ask me: 'How much feed today?', 'Check my water', or 'How do I see my profit?'";
}

function addChatMsg(who, text) {
  var box = document.getElementById("chatMessages");
  if (!box) return;
  var div = document.createElement("div");
  div.className = who === "you" ? "msg msg-you" : "msg msg-bot";
  var whoP = document.createElement("p");
  whoP.className = "msg-who";
  whoP.textContent = who === "you" ? "You" : "Helper";
  var txt = document.createElement("p");
  txt.className = "msg-text";
  txt.textContent = text;
  div.appendChild(whoP);
  div.appendChild(txt);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function askChat(question) {
  showSection("guide");
  addChatMsg("you", question);
  var reply;
  try {
    reply = botReply(question);
  } catch (e) {
    reply = "Sorry, something went wrong. Try asking: 'How do I start?'";
  }
  setTimeout(function () { addChatMsg("bot", reply); }, 250);
}

function sendChat(event) {
  event.preventDefault();
  var input = document.getElementById("chatInput");
  var q = (input.value || "").trim();
  if (!q) return false;
  input.value = "";
  addChatMsg("you", q);
  var reply;
  try {
    reply = botReply(q);
  } catch (e) {
    reply = "Sorry, something went wrong. Try asking: 'How do I start?'";
  }
  setTimeout(function () { addChatMsg("bot", reply); }, 250);
  return false;
}

function initChat() {
  var box = document.getElementById("chatMessages");
  if (!box || box.children.length) return;
  addChatMsg("bot", "Hello! I am your PondWise Helper. I only answer about PondWise and fishpond care. " +
    "Ask me like: 'How much feed today?' or tap a green button above. How can I help?");
}

// Old Guide button kept for compatibility: opens chat with a water summary.
function showAdvice() {
  askChat("Check my water");
}

// ---------- 10. Backup + demo ----------

function exportData() {
  if (!canUseBackup()) { showSection("plans"); return; }
  var blob = new Blob([localStorage.getItem(STORE_KEY) || "{}"], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pondwise-backup.json";
  a.click();
}

function importData(event) {
  if (!canUseBackup()) { showSection("plans"); return; }
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (!data.ponds) throw new Error("bad file");
      saveData(data);
      refresh();
    } catch (e) {
      alert("That file is not a PondWise backup.");
    }
  };
  reader.readAsText(file);
}

function demoDate(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function loadDemo() {
  var state = blankState();
  var p1 = makeId() + "1";
  var p2 = makeId() + "2";
  var p3 = makeId() + "3";
  // 3 ponds: small backyard, main pond, big riverside.
  state.ponds.push({
    id: p1, name: "Home Pond", size: "500", notes: "Near the house, easy to watch",
    stock: { common: "Nile tilapia", scientific: "Oreochromis niloticus", count: "800", avgWeightG: "150" }
  });
  state.ponds.push({
    id: p2, name: "River Side", size: "1000", notes: "Big pond near the river",
    stock: { common: "African catfish", scientific: "Clarias gariepinus", count: "1200", avgWeightG: "90" }
  });
  state.ponds.push({
    id: p3, name: "Backyard Small", size: "200", notes: "Trial pond for carp",
    stock: { common: "Common carp", scientific: "Cyprinus carpio", count: "300", avgWeightG: "250" }
  });
  state.activePondId = p1;
  // Tasks: past done, today, and upcoming across ponds.
  state.tasks.push({ id: makeId() + "t1", pondId: p1, title: "Morning feeding", type: "feeding", date: demoDate(0), done: false });
  state.tasks.push({ id: makeId() + "t2", pondId: p1, title: "Check water color", type: "inspection", date: demoDate(0), done: false });
  state.tasks.push({ id: makeId() + "t3", pondId: p1, title: "Clean inlet screen", type: "cleaning", date: demoDate(1), done: false });
  state.tasks.push({ id: makeId() + "t4", pondId: p1, title: "Evening feeding", type: "feeding", date: demoDate(-1), done: true });
  state.tasks.push({ id: makeId() + "t5", pondId: p2, title: "Morning feeding catfish", type: "feeding", date: demoDate(0), done: false });
  state.tasks.push({ id: makeId() + "t6", pondId: p2, title: "Fix broken net corner", type: "repair", date: demoDate(2), done: false });
  state.tasks.push({ id: makeId() + "t7", pondId: p2, title: "Count weak fish", type: "inspection", date: demoDate(-2), done: true });
  state.tasks.push({ id: makeId() + "t8", pondId: p3, title: "Weigh 10 sample carp", type: "inspection", date: demoDate(3), done: false });
  // A week of feeding for Home Pond + a few for others.
  var feeds = ["3.5", "3.6", "3.4", "3.8", "3.6", "3.7", "3.6"];
  var i;
  for (i = 0; i < feeds.length; i++) {
    state.feedLogs.push({ id: makeId() + "f" + i, pondId: p1, date: demoDate(-6 + i), kg: feeds[i] });
  }
  state.feedLogs.push({ id: makeId() + "f20", pondId: p2, date: demoDate(-1), kg: "5.2" });
  state.feedLogs.push({ id: makeId() + "f21", pondId: p2, date: demoDate(0), kg: "5.4" });
  state.feedLogs.push({ id: makeId() + "f30", pondId: p3, date: demoDate(0), kg: "1.9" });
  // Water: one good, one low-pH warning, one warm.
  state.waterLogs.push({ id: makeId() + "w1", pondId: p1, date: demoDate(-6), temp: "29", ph: "7.8", notes: "Clear, normal" });
  state.waterLogs.push({ id: makeId() + "w2", pondId: p1, date: demoDate(-2), temp: "28", ph: "7.5", notes: "Clear after light rain" });
  state.waterLogs.push({ id: makeId() + "w3", pondId: p1, date: demoDate(0), temp: "28", ph: "7.4", notes: "Clear, fish active" });
  state.waterLogs.push({ id: makeId() + "w4", pondId: p2, date: demoDate(0), temp: "30", ph: "6.1", notes: "A bit muddy, will change water" });
  state.waterLogs.push({ id: makeId() + "w5", pondId: p3, date: demoDate(-1), temp: "31", ph: "8.2", notes: "Greenish, added shade" });
  // Health + maintenance.
  state.healthLogs.push({ id: makeId() + "h1", pondId: p1, date: demoDate(-2), note: "Active, eating well" });
  state.healthLogs.push({ id: makeId() + "h2", pondId: p1, date: demoDate(0), note: "All good, no floaters" });
  state.healthLogs.push({ id: makeId() + "h3", pondId: p2, date: demoDate(0), note: "3 fish slow, watching closely" });
  state.healthLogs.push({ id: makeId() + "h4", pondId: p3, date: demoDate(-1), note: "Carp jumping at dusk, normal" });
  state.maintLogs.push({ id: makeId() + "m1", pondId: p1, date: demoDate(-3), note: "Cleaned inlet screen" });
  state.maintLogs.push({ id: makeId() + "m2", pondId: p2, date: demoDate(-1), note: "Patched net corner" });
  state.maintLogs.push({ id: makeId() + "m3", pondId: p3, date: demoDate(-5), note: "Added bamboo shade" });
  // Money: realistic expenses + sales per pond.
  state.expenses.push({ id: makeId() + "e1", pondId: p1, date: demoDate(-10), item: "Tilapia fingerlings x800", amount: "2400" });
  state.expenses.push({ id: makeId() + "e2", pondId: p1, date: demoDate(-6), item: "Feeds 25kg", amount: "1250" });
  state.expenses.push({ id: makeId() + "e3", pondId: p1, date: demoDate(-2), item: "Feeds 25kg", amount: "1250" });
  state.expenses.push({ id: makeId() + "e4", pondId: p1, date: demoDate(-4), item: "Net repair + labor", amount: "500" });
  state.expenses.push({ id: makeId() + "e5", pondId: p2, date: demoDate(-8), item: "Catfish fingerlings x1200", amount: "3600" });
  state.expenses.push({ id: makeId() + "e6", pondId: p2, date: demoDate(-3), item: "Feeds 50kg", amount: "2500" });
  state.expenses.push({ id: makeId() + "e7", pondId: p2, date: demoDate(-1), item: "Lime + salt", amount: "350" });
  state.expenses.push({ id: makeId() + "e8", pondId: p3, date: demoDate(-12), item: "Carp fingerlings x300", amount: "900" });
  state.expenses.push({ id: makeId() + "e9", pondId: p3, date: demoDate(-5), item: "Feeds 10kg", amount: "520" });
  state.sales.push({ id: makeId() + "s1", pondId: p1, date: demoDate(-3), item: "Tilapia 10kg to neighbor", amount: "1500" });
  state.sales.push({ id: makeId() + "s2", pondId: p1, date: demoDate(0), item: "Tilapia 20kg to market", amount: "3000" });
  state.sales.push({ id: makeId() + "s3", pondId: p2, date: demoDate(-1), item: "Catfish 15kg to buyer", amount: "2700" });
  state.sales.push({ id: makeId() + "s4", pondId: p3, date: demoDate(-2), item: "Carp 5kg tasting sale", amount: "750" });
  saveData(state);
  refresh();
  setDefaultDates();
}

// ---------- 11. Render everything ----------

function refresh() {
  var state = loadData();
  renderPondPicker(state);
  renderPonds(state);
  renderTasks(state);
  renderCalendar(state);
  renderFeedGuide();
  renderRations(state);
  renderRecords(state);
  renderFinance(state);
  renderDashboard(state);
  renderSpeciesRows(document.getElementById("speciesLocal"), SPECIES_LIST, "built-in");
  renderPlan();
}

// ---------- 8. Subscription plans (proposal, saved in this browser) ----------

var PLAN_KEY = "pondwise_plan";
var PLAN_NAMES = { start: "PondStart (free)", pro: "PondPro", elite: "PondElite" };
var POND_LIMITS = { start: 1, pro: 5, elite: Infinity };

function getPlan() {
  try {
    return localStorage.getItem(PLAN_KEY) || "start";
  } catch (e) {
    return "start";
  }
}

// Tier gates. Pond limits block addPond; money, rations, and backup swap
// their panels for an upgrade lock (renderPlan) and refuse saves too.
function pondLimit() {
  var p = getPlan();
  return POND_LIMITS[p] == null ? 1 : POND_LIMITS[p];
}

function canUseMoney() {
  var p = getPlan();
  return p === "pro" || p === "elite";
}

function canUseRations() {
  return canUseMoney();
}

function canUseBackup() {
  return getPlan() === "elite";
}

function choosePlan(name) {
  try {
    localStorage.setItem(PLAN_KEY, name);
  } catch (e) {
    // Private mode: choice just won't persist.
  }
  refresh();
}

function setLocked(bodyId, lockId, allowed) {
  var body = document.getElementById(bodyId);
  var lock = document.getElementById(lockId);
  if (body) body.hidden = !allowed;
  if (lock) lock.hidden = allowed;
}

function renderPlan() {
  var current = getPlan();
  if (!PLAN_NAMES[current]) current = "start";
  var label = document.getElementById("planCurrent");
  if (label) label.textContent = "You are on " + PLAN_NAMES[current] + ".";
  var btns = document.querySelectorAll(".plan-btn");
  var i;
  for (i = 0; i < btns.length; i++) {
    var isCurrent = btns[i].getAttribute("data-plan") === current;
    btns[i].disabled = isCurrent;
    btns[i].textContent = isCurrent ? "Current plan" : "Choose " + btns[i].getAttribute("data-label");
  }
  setLocked("financeBody", "financeLock", canUseMoney());
  setLocked("rationPanel", "rationLock", canUseRations());
  setLocked("backupBody", "backupLock", canUseBackup());
}

// Pond usage note under the add-pond form. Existing ponds always stay;
// the limit only blocks adding more (downgrades included).
function renderPondNote(state, blocked) {
  var note = document.getElementById("pondLimitNote");
  var btn = document.getElementById("pondUpgradeBtn");
  if (!note) return;
  var plan = getPlan();
  var limit = pondLimit();
  var name = PLAN_NAMES[plan] || PLAN_NAMES.start;
  var maxed = state.ponds.length >= limit;
  if (blocked) {
    note.textContent = "Limit reached: " + name + " allows " + limit +
      " pond" + (limit === 1 ? "" : "s") + ". Upgrade to add more.";
  } else if (limit === Infinity) {
    note.textContent = "Using " + state.ponds.length + " ponds (" + name + " - unlimited).";
  } else {
    note.textContent = "Using " + state.ponds.length + " of " + limit + " ponds (" + name + ")." +
      (maxed ? " Upgrade to add more." : "");
  }
  if (btn) btn.hidden = !maxed;
}

function renderCalendar(state) {
  calEnsure();
  var label = document.getElementById("calLabel");
  var grid = document.getElementById("calGrid");
  if (!label || !grid) return;
  var y = calCursor.y;
  var m = calCursor.m;
  label.textContent = new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  grid.innerHTML = "";
  var first = new Date(y, m, 1).getDay();
  var days = new Date(y, m + 1, 0).getDate();
  var prevDays = new Date(y, m, 0).getDate();
  var today = todayStr();
  var tasks = state.tasks.filter(function (t) { return t.pondId === state.activePondId; });
  var i, d, dateStr, inMonth;
  for (i = 0; i < 42; i++) {
    if (i < first) {
      d = prevDays - first + 1 + i;
      inMonth = false;
      dateStr = ymd(y, m - 1, d);
    } else if (i < first + days) {
      d = i - first + 1;
      inMonth = true;
      dateStr = ymd(y, m, d);
    } else {
      d = i - first - days + 1;
      inMonth = false;
      dateStr = ymd(y, m + 1, d);
    }
    grid.appendChild(calCell(dateStr, d, inMonth, dateStr === today, dateStr === calSelected, tasksOn(tasks, dateStr)));
  }
  var hint = document.getElementById("calHint");
  if (hint) hint.textContent = "Adding tasks for " + calSelected + ". Tap another date to change it.";
}

function calCell(dateStr, dayNum, inMonth, isToday, isSel, dayTasks) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "cal-day" + (inMonth ? "" : " dim") + (isToday ? " today" : "") + (isSel ? " sel" : "");
  b.setAttribute("aria-label", dateStr + (dayTasks.length ? (", " + dayTasks.length + " tasks") : ", no tasks"));
  b.onclick = function () { calPick(dateStr); };
  var num = document.createElement("span");
  num.className = "cal-num";
  num.textContent = String(dayNum);
  b.appendChild(num);
  var dots = document.createElement("span");
  dots.className = "cal-dots";
  dots.setAttribute("aria-hidden", "true");
  dayTasks.slice(0, 3).forEach(function (t) {
    var s = document.createElement("i");
    s.className = t.done ? "cal-dot done" : "cal-dot todo";
    dots.appendChild(s);
  });
  if (dayTasks.length > 3) {
    var more = document.createElement("em");
    more.textContent = "+" + (dayTasks.length - 3);
    dots.appendChild(more);
  }
  b.appendChild(dots);
  return b;
}

function renderFeedGuide() {
  var body = document.getElementById("feedGuideBody");
  if (!body) return;
  body.innerHTML = "";
  FEED_STAGES.forEach(function (s) {
    var tr = document.createElement("tr");
    var cells = [
      { text: s.size, num: false },
      { text: s.feed, num: false },
      { text: s.protein, num: true },
      { text: s.rate + "%", num: true },
      { text: s.meals, num: true }
    ];
    cells.forEach(function (c) {
      var td = document.createElement("td");
      td.textContent = c.text;
      if (c.num) td.className = "num";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function renderRations(state) {
  var box = document.getElementById("rationList");
  if (!box) return;
  box.innerHTML = "";
  if (!state.ponds.length) {
    box.innerHTML = "<p class='hint'>No ponds yet. Add one in Ponds first.</p>";
    return;
  }
  state.ponds.forEach(function (p) {
    var row = document.createElement("div");
    row.className = "ration-row";
    var r = (p.stock.count && p.stock.avgWeightG) ? pondDailyRation(p.stock.count, p.stock.avgWeightG) : null;
    var left = document.createElement("div");
    left.className = "ration-pond";
    var nm = document.createElement("strong");
    nm.textContent = p.name;
    var pop = document.createElement("small");
    pop.textContent = p.stock.count ? (p.stock.count + " fish x " + p.stock.avgWeightG + " g") : "No fish saved yet";
    left.appendChild(nm);
    left.appendChild(pop);
    var right = document.createElement("div");
    right.className = "ration-val";
    if (r) {
      var amt = document.createElement("strong");
      amt.textContent = r.kg.toFixed(2) + " kg/day";
      var feed = document.createElement("small");
      feed.textContent = r.stage.feed + " - " + r.stage.meals + " meals";
      right.appendChild(amt);
      right.appendChild(feed);
    } else {
      var none = document.createElement("small");
      none.textContent = "Save fish in Ponds to see its ration";
      right.appendChild(none);
    }
    row.appendChild(left);
    row.appendChild(right);
    box.appendChild(row);
  });
}

function fillPondSelect(elId, state) {
  var sel = document.getElementById(elId);
  if (!sel) return;
  sel.innerHTML = "";
  if (!state.ponds.length) {
    var opt = document.createElement("option");
    opt.textContent = "No ponds yet";
    sel.appendChild(opt);
    return;
  }
  state.ponds.forEach(function (p) {
    var o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    if (p.id === state.activePondId) o.selected = true;
    sel.appendChild(o);
  });
}

function renderPondPicker(state) {
  fillPondSelect("pondSelect", state);
  fillPondSelect("pondSelectM", state);
}

function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function renderPonds(state) {
  var box = document.getElementById("pondList");
  box.innerHTML = "";
  if (!state.ponds.length) {
    box.innerHTML = "<p class='hint'>No ponds yet. Add your first pond below, or load demo data to practice.</p>";
  }
  state.ponds.forEach(function (p) {
    var isActive = (p.id === state.activePondId);
    var card = document.createElement("div");
    card.className = isActive ? "pond-card selected" : "pond-card";
    card.setAttribute("role", "listitem");
    if (isActive) {
      var badge = document.createElement("span");
      badge.className = "tag tag-picked";
      badge.textContent = "Picked";
      card.appendChild(badge);
    }
    // Decorative cover: same simple pond art on every card.
    var img = document.createElement("img");
    img.src = "assets/pond.svg";
    img.alt = "";
    card.appendChild(img);
    var stockLine = (p.stock.common || "No fish yet") + (p.stock.count ? (" x " + p.stock.count) : "");
    var body = document.createElement("div");
    body.className = "pond-body";
    body.innerHTML =
      "<p class='pond-name'>" + escHtml(p.name) + "</p>" +
      "<p class='pond-meta'>" + escHtml(p.size || "-") + " sqm</p>" +
      "<p class='pond-stock'>" + escHtml(stockLine) + "</p>" +
      "<p class='pond-notes'>" + escHtml(p.notes || "") + "</p>";
    var row = document.createElement("div");
    row.className = "pond-actions";
    if (!isActive) {
      var sel = document.createElement("button");
      sel.textContent = "Use this";
      sel.className = "btn-small";
      sel.setAttribute("aria-label", "Use pond " + p.name);
      sel.onclick = function () { selectPond(p.id); };
      row.appendChild(sel);
    }
    var del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "btn-danger";
    del.setAttribute("aria-label", "Delete pond " + p.name);
    del.onclick = function () { deletePond(p.id); };
    row.appendChild(del);
    body.appendChild(row);
    card.appendChild(body);
    box.appendChild(card);
  });
  var active = getActivePond(state);
  var stockFor = document.getElementById("stockFor");
  if (active) {
    document.getElementById("stockCommon").value = active.stock.common || "";
    document.getElementById("stockScientific").value = active.stock.scientific || "";
    document.getElementById("stockCount").value = active.stock.count || "";
    document.getElementById("stockWeight").value = active.stock.avgWeightG || "";
    if (stockFor) stockFor.textContent = "You are writing fish for: " + active.name;
  } else if (stockFor) {
    stockFor.textContent = "Pick a pond card first.";
  }
  renderPondNote(state, false);
}

function setDefaultDates() {
  var ids = ["feedLogDate", "waterDate", "healthDate", "maintDate", "expDate", "saleDate", "taskDate"];
  var t = todayStr();
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = t;
  });
}

function renderTasks(state) {
  var box = document.getElementById("taskList");
  box.innerHTML = "";
  var list = getUpcomingTasks(state.tasks, state.activePondId);
  var done = state.tasks.filter(function (t) { return t.pondId === state.activePondId && t.done; });
  if (!list.length && !done.length) {
    box.innerHTML = "<li class='hint'>No tasks yet. Add one above.</li>";
    return;
  }
  if (list.length) {
    box.appendChild(groupHead("Upcoming"));
    list.forEach(function (t) { box.appendChild(taskItem(t)); });
  }
  if (done.length) {
    box.appendChild(groupHead("Done"));
    done.forEach(function (t) { box.appendChild(taskItem(t)); });
  }
}

// A bold separator row inside the task list.
function groupHead(text) {
  var li = document.createElement("li");
  li.className = "group-head";
  li.textContent = text;
  return li;
}

// One task row with its Done/Undo and Delete buttons.
function taskItem(t) {
  var li = document.createElement("li");
  if (t.done) li.className = "done";
  li.textContent = t.date + " [" + t.type + "] " + t.title + " ";
  var b1 = document.createElement("button");
  b1.textContent = t.done ? "Undo" : "Done";
  b1.className = "btn-small";
  b1.onclick = function () { toggleTask(t.id); };
  var b2 = document.createElement("button");
  b2.textContent = "X";
  b2.className = "btn-danger";
  b2.onclick = function () { deleteTask(t.id); };
  li.appendChild(b1);
  li.appendChild(b2);
  return li;
}

function pondRows(rows, pondId) {
  return rows.filter(function (r) { return r.pondId === pondId; });
}

function renderRecords(state) {
  var id = state.activePondId;
  var pond = getActivePond(state);
  var forEl = document.getElementById("recordsFor");
  if (forEl) forEl.textContent = pond ? ("You are writing for: " + pond.name) : "No pond picked yet. Open Ponds first.";
  renderSimpleList("feedLogList", pondRows(state.feedLogs, id), function (r) {
    return r.date + " - gave " + r.kg + " kg of food";
  }, "Nothing saved yet. Type above and tap 'Save food'.", "feedLogs");
  renderSimpleList("waterList", pondRows(state.waterLogs, id), function (r) {
    var parts = [r.date];
    if (r.temp) parts.push(r.temp + " C");
    if (r.ph) parts.push("pH " + r.ph);
    if (r.notes) parts.push(r.notes);
    return parts.join(" - ");
  }, "Nothing saved yet. Type above and tap 'Save water check'.", "waterLogs");
  renderSimpleList("healthList", pondRows(state.healthLogs, id), function (r) {
    return r.date + " - " + r.note;
  }, "Nothing saved yet. Type what you saw and tap 'Save health note'.", "healthLogs");
  renderSimpleList("maintList", pondRows(state.maintLogs, id), function (r) {
    return r.date + " - " + r.note;
  }, "Nothing saved yet. Type your work and tap 'Save work'.", "maintLogs");
}

function renderSimpleList(elId, rows, fmt, emptyText, collection) {
  var box = document.getElementById(elId);
  if (!box) return;
  box.innerHTML = "";
  if (!rows.length) {
    box.innerHTML = "<li class='hint'>" + escHtml(emptyText || "Nothing here yet.") + "</li>";
    return;
  }
  // Newest last 8 only, so long lists stay readable.
  rows.slice(-8).forEach(function (r) {
    var li = document.createElement("li");
    li.className = "log-row";
    var span = document.createElement("span");
    span.textContent = fmt(r);
    li.appendChild(span);
    if (collection && r.id) {
      var del = document.createElement("button");
      del.textContent = "Remove";
      del.className = "btn-danger btn-small";
      del.setAttribute("aria-label", "Remove: " + fmt(r));
      del.onclick = (function (col, rowId) {
        return function () { deleteRow(col, rowId); };
      })(collection, r.id);
      li.appendChild(del);
    }
    box.appendChild(li);
  });
}

function peso(n) {
  var num = Number(n) || 0;
  return num.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

function renderFinance(state) {
  var id = state.activePondId;
  var pond = getActivePond(state);
  var forEl = document.getElementById("financeFor");
  if (forEl) forEl.textContent = pond ? ("Money for: " + pond.name) : "No pond picked yet. Open Ponds first.";
  renderSimpleList("expenseList", pondRows(state.expenses, id), function (r) {
    return r.date + " - " + r.item + " (" + peso(r.amount) + " pesos)";
  }, "Nothing here. Example: Feeds 25kg, 1200 pesos.", "expenses");
  renderSimpleList("saleList", pondRows(state.sales, id), function (r) {
    return r.date + " - " + r.item + " (" + peso(r.amount) + " pesos)";
  }, "Nothing here. Example: Tilapia 10kg, 1500 pesos.", "sales");
  var t = calcTotals(state.expenses, state.sales, id);
  var outEl = document.getElementById("moneyOut");
  var inEl = document.getElementById("moneyIn");
  var leftEl = document.getElementById("moneyLeft");
  if (outEl) outEl.textContent = peso(t.expenses);
  if (inEl) inEl.textContent = peso(t.sales);
  if (leftEl) leftEl.textContent = peso(t.profit);
  var sumEl = document.getElementById("financeSummary");
  if (sumEl) {
    if (!pond) {
      sumEl.textContent = "Pick a pond to see money.";
    } else if (!state.expenses.length && !state.sales.length) {
      sumEl.textContent = "No money saved yet. Save what you paid on the left, what you sold on the right.";
    } else if (t.profit >= 0) {
      sumEl.textContent = "Good: you have " + peso(t.profit) + " pesos left for " + pond.name + ".";
    } else {
      sumEl.textContent = "Careful: you spent " + peso(Math.abs(t.profit)) + " pesos more than you sold for " + pond.name + ".";
    }
  }
}

function reportRow(term, value) {
  var wrap = document.createElement("div");
  var dt = document.createElement("dt");
  dt.textContent = term;
  var dd = document.createElement("dd");
  dd.textContent = value;
  wrap.appendChild(dt);
  wrap.appendChild(dd);
  return wrap;
}

// Mobile dashboard mirrors the desktop numbers (same helpers, same values).
function renderMobileDash(state) {
  var box = document.getElementById("mobileDash");
  if (!box) return;
  var pond = getActivePond(state);
  box.hidden = !pond;
  if (!pond) return;
  var today = todayStr();
  document.getElementById("mDate").textContent =
    new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  document.getElementById("mAvatar").textContent = (pond.name || "?").charAt(0).toUpperCase();
  document.getElementById("mPondName").textContent = pond.name;
  var stockTxt = pond.stock.count
    ? (pond.stock.count + " " + (pond.stock.common || "fish"))
    : "No fish yet";
  document.getElementById("mPondSub").textContent = stockTxt + (pond.size ? (" - " + pond.size + " sqm") : "");
  // Tasks due today or overdue drive the badge and the "tasks today" card.
  var due = state.tasks.filter(function (t) {
    return t.pondId === pond.id && !t.done && t.date <= today;
  });
  document.getElementById("mTodayNum").textContent = String(due.length);
  var badge = document.getElementById("mBadge");
  badge.textContent = String(due.length);
  badge.hidden = (due.length === 0);
  // Overview reuses the exact desktop values so both screens always agree.
  var upcoming = getUpcomingTasks(state.tasks, pond.id);
  document.getElementById("mTasks").textContent = String(upcoming.length);
  var feedTxt = "-";
  if (pond.stock.count && pond.stock.avgWeightG) {
    var rate = findLocalRate(pond.stock.scientific, pond.stock.common) ||
      suggestRateByWeight(Number(pond.stock.avgWeightG));
    feedTxt = calcFeedKg(Number(pond.stock.count), Number(pond.stock.avgWeightG), rate).toFixed(2) + " kg";
  }
  document.getElementById("mFeed").textContent = feedTxt;
  document.getElementById("mFish").textContent = pond.stock.count ? String(pond.stock.count) : "-";
  var t = calcTotals(state.expenses, state.sales, pond.id);
  document.getElementById("mMoney").textContent = peso(t.profit);
  document.getElementById("mMoneyDot").className = "ov-dot " + (t.profit < 0 ? "rose" : "emerald");
  // Today's schedule rows with a tap-to-finish pill on each.
  var sched = document.getElementById("mSched");
  sched.innerHTML = "";
  var rows = getTodaySchedule(state.tasks, pond.id, today);
  if (!rows.length) {
    sched.innerHTML = "<li class='m-ev'><span class='ev-dot' aria-hidden='true'></span>" +
      "<div class='ev-t'><strong>No tasks today</strong><small>Tap View all to add one</small></div></li>";
    return;
  }
  rows.forEach(function (task) {
    var li = document.createElement("li");
    li.className = "m-ev";
    var dot = document.createElement("span");
    dot.className = "ev-dot " + (task.done ? "done" : "todo");
    dot.setAttribute("aria-hidden", "true");
    var txt = document.createElement("div");
    txt.className = "ev-t";
    var title = document.createElement("strong");
    title.textContent = task.title;
    var sub = document.createElement("small");
    sub.textContent = task.type + " - " + (task.date === today ? "today" : task.date);
    txt.appendChild(title);
    txt.appendChild(sub);
    var pill = document.createElement("button");
    pill.className = "pill " + (task.done ? "pill-done" : "pill-todo");
    pill.textContent = task.done ? "Done" : "Mark done";
    pill.setAttribute("aria-label", (task.done ? "Reopen task: " : "Mark done: ") + task.title);
    pill.onclick = (function (id) { return function () { toggleTask(id); }; })(task.id);
    li.appendChild(dot);
    li.appendChild(txt);
    li.appendChild(pill);
    sched.appendChild(li);
  });
}

function renderDashboard(state) {
  renderMobileDash(state);
  var pond = getActivePond(state);
  var dt = document.getElementById("dashTasks");
  var dr = document.getElementById("dashRecent");
  var summary = document.getElementById("dashSummary");
  dt.innerHTML = "";
  dr.innerHTML = "";
  summary.innerHTML = "";
  // Empty state says it once: one get-started panel, grey dot, the rest hidden.
  document.getElementById("dashEmpty").hidden = !!pond;
  document.getElementById("dashKpis").hidden = !pond;
  document.getElementById("dashGrid").hidden = !pond;
  if (!pond) {
    document.getElementById("dashSub").textContent = "Add a pond to begin.";
    document.getElementById("dashStatus").className = "statusbar idle";
    document.getElementById("statusText").textContent = "No ponds yet.";
    return;
  }
  document.getElementById("dashStatus").className = "statusbar";
  document.getElementById("dashSub").textContent = pond.name + " - " + todayStr();
  var upcoming = getUpcomingTasks(state.tasks, pond.id);
  document.getElementById("statusText").textContent =
    pond.name + " - " + upcoming.length + " open tasks, " + state.ponds.length + " pond(s)";
  document.getElementById("kpiTasks").textContent = upcoming.length + " open";
  if (pond.stock.count && pond.stock.avgWeightG) {
    var rate = findLocalRate(pond.stock.scientific, pond.stock.common) ||
      suggestRateByWeight(Number(pond.stock.avgWeightG));
    var kg = calcFeedKg(Number(pond.stock.count), Number(pond.stock.avgWeightG), rate);
    document.getElementById("kpiFeed").textContent = kg.toFixed(2) + " kg";
  } else {
    document.getElementById("kpiFeed").textContent = "No stock";
  }
  var t = calcTotals(state.expenses, state.sales, pond.id);
  document.getElementById("kpiProfit").textContent = peso(t.profit);
  var waters = pondRows(state.waterLogs, pond.id);
  document.getElementById("kpiWater").textContent =
    waters.length ? ("pH " + waters[waters.length - 1].ph) : "No data";
  var stockTxt = pond.stock.count
    ? ((pond.stock.common || "Fish") + " x " + pond.stock.count)
    : "No stock";
  summary.appendChild(reportRow("Stock", stockTxt));
  summary.appendChild(reportRow("Size", pond.size ? (pond.size + " sqm") : "-"));
  summary.appendChild(reportRow("Open tasks", String(upcoming.length)));
  summary.appendChild(reportRow("Money left", peso(t.profit) + " pesos"));
  if (!upcoming.length) dt.innerHTML = "<li class='hint'>No upcoming tasks.</li>";
  upcoming.slice(0, 5).forEach(function (t) {
    var li = document.createElement("li");
    li.textContent = t.date + " - " + t.title;
    dt.appendChild(li);
  });
  var recent = pondRows(state.feedLogs, pond.id).slice(-3);
  if (!recent.length) dr.innerHTML = "<li class='hint'>No feedings yet.</li>";
  recent.forEach(function (r) {
    var li = document.createElement("li");
    li.textContent = "Fed " + r.kg + " kg on " + r.date;
    dr.appendChild(li);
  });
}

// Start the app in a browser only (skipped during Node smoke test).
if (typeof document !== "undefined") {
  window.onload = function () {
    // Open the section from the URL hash (e.g. index.html#feed), else dashboard.
    var start = window.location.hash ? window.location.hash.slice(1) : "dashboard";
    var known = ["dashboard", "ponds", "feed", "tasks", "records", "finance", "plans", "guide"];
    if (known.indexOf(start) < 0) start = "dashboard";
    refresh();
    setDefaultDates();
    initChat();
    showSection(start);
  };
}

// Export pure functions for the Node smoke test.
if (typeof module !== "undefined") {
  module.exports = {
    calcFeedKg: calcFeedKg, calcTotals: calcTotals, buildAdvice: buildAdvice,
    getUpcomingTasks: getUpcomingTasks, getTodaySchedule: getTodaySchedule,
    recommendFeed: recommendFeed, pondDailyRation: pondDailyRation,
    tasksOn: tasksOn, ymd: ymd,
    isOnTopic: (typeof isOnTopic !== "undefined" ? isOnTopic : null)
  };
}

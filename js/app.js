const SELL_RATE = 0.8, START_BALANCE = 2000, KEY = "zabytye-nakhodki-v3";
const $ = id => document.getElementById(id);
const money = n => n.toLocaleString("ru-RU");
const pct = n => n.toLocaleString("ru-RU") + "%";
const getItem = id => ITEMS.find(i => i.id === id);
const getCase = id => CASES.find(c => c.id === id);
const sellPrice = i => Math.round(i.value * SELL_RATE);

// Проверка шансов
CASES.forEach(c => {
  const t = c.items.reduce((a, i) => a + i.chance, 0);
  if (Math.abs(t - 100) > 1e-9) console.error(`Кейс «${c.name}»: сумма шансов ${t}, а должна быть 100`);
});

// Состояние (сохраняется в браузере)
let state;
try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
if (!state) state = { balance: START_BALANCE, inventory: [], found: {} };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

// Миниатюра: если фото нет — остаётся штриховка с номером
function thumb(i, locked) {
  const img = locked || !i.img ? "" : `<img src="${i.img}" alt="${i.name}" loading="lazy" onerror="this.remove()">`;
  return `<div class="thumb ${i.rarity} ${locked ? "locked" : ""}"><span class="num">${i.num}</span>${img}</div>`;
}
// Путь к фото предмета по умолчанию
ITEMS.forEach(i => { i.img = i.img || `img/items/${i.id}.jpg`; });

function weightedPick(c) {
  let r = Math.random() * 100, acc = 0;
  for (const it of c.items) { acc += it.chance; if (r < acc) return getItem(it.id); }
  return getItem(c.items[c.items.length - 1].id);
}

/* ---------- Отрисовка ---------- */
function renderCases() {
  $("caseGrid").innerHTML = CASES.map(c => `
    <article class="case">
      <div class="case-img" style="background-image:url('${c.img}')"></div>
      <div class="case-body">
        <h3>${c.name}</h3><p>${c.tagline}</p>
        <div class="case-foot"><span class="meta muted">${c.items.length} предметов</span><span class="price">${money(c.price)} кр.</span></div>
        <div class="actions" style="justify-content:stretch;margin-top:14px">
          <button class="btn" style="flex:1" data-open="${c.id}">Открыть</button>
          <button class="btn ghost" data-contents="${c.id}">Состав</button>
        </div>
      </div>
    </article>`).join("");
}
function itemCard(i, locked) {
  return `<article class="card ${i.rarity}">${thumb(i, locked)}<div class="card-body">
    <h3>${locked ? "Не найдено" : i.name}</h3>
    <p class="rar">${RARITY[i.rarity]} · шанс ${pct(i.chance)}</p>
    <div class="tag">${locked ? "—" : i.tag}</div>
    <p class="story">${locked ? "История откроется после первой находки." : i.story}</p>
  </div></article>`;
}
function renderCollection() {
  const q = $("collectionSearch").value.toLowerCase();
  const found = state.found;
  $("collectionCount").textContent = `Найдено: ${Object.keys(found).length} из ${ITEMS.length}`;
  $("collectionBody").innerHTML = CASES.map(c => {
    const list = c.items.map(x => getItem(x.id)).filter(i => !q || (found[i.id] && (i.name + i.story).toLowerCase().includes(q)));
    const got = c.items.filter(x => found[x.id]).length;
    return list.length ? `<div class="group"><h3><span>${c.name}</span><span class="muted">${got} / ${c.items.length}</span></h3>
      <div class="item-grid">${list.map(i => itemCard(i, !found[i.id])).join("")}</div></div>` : "";
  }).join("") || '<div class="empty">Ничего не найдено.</div>';
}
function renderInventory() {
  const q = $("inventorySearch").value.toLowerCase();
  const rows = state.inventory.map((x, idx) => ({ ...x, idx })).reverse().filter(x => getItem(x.item).name.toLowerCase().includes(q));
  $("inventoryCount").textContent = `Всего: ${state.inventory.length}`;
  $("inventoryGrid").innerHTML = rows.map(x => {
    const i = getItem(x.item);
    return `<article class="card ${i.rarity}">${thumb(i)}<div class="card-body"><h3>${i.name}</h3>
      <p class="rar">${RARITY[i.rarity]}</p><div class="tag">${getCase(x.case).name} · ${new Date(x.date).toLocaleDateString("ru-RU")}</div>
      <p class="story">${i.story}</p><button class="btn ghost" data-sell="${x.idx}">Продать за ${money(sellPrice(i))} кр.</button></div></article>`;
  }).join("") || '<div class="empty">Пока пусто. Открой первый кейс.</div>';
}
function renderAll() {
  $("balance").textContent = money(state.balance) + " кр.";
  renderCases(); renderCollection(); renderInventory(); renderBonus(); save();
}

/* ---------- Окна ---------- */
let spinning = false, skipFn = null, lastDrop = null;
const showBox = n => ["boxSpin", "boxResult", "boxContents"].forEach(b => $(b).hidden = b !== n);
const openModal = () => $("backdrop").classList.add("open");
const closeModal = () => { if (!spinning) $("backdrop").classList.remove("open"); };
function toast(t) { const e = $("toast"); e.textContent = t; e.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = "none", 2600); }

function openCase(id) {
  if (spinning) return;
  const c = getCase(id);
  if (state.balance < c.price) {
    if (!state.inventory.length) { state.balance += 500; renderAll(); toast("Кредиты закончились. Держи 500 на демо."); }
    else toast("Не хватает кредитов. Продай что-нибудь во вкладке «Мои предметы».");
    return;
  }
  spinning = true; state.balance -= c.price;
  const win = weightedPick(c);
  lastDrop = { item: win.id, case: c.id, date: new Date().toISOString() };
  state.inventory.push(lastDrop); state.found[win.id] = true; save();
  $("balance").textContent = money(state.balance) + " кр.";

  const K = 40, CELL = 130, strip = [];
  for (let n = 0; n < 50; n++) strip.push(n === K ? win : weightedPick(c));
  const tr = $("track");
  $("spinCase").textContent = c.name;
  tr.innerHTML = strip.map(i => `<div class="cell ${i.rarity}">${thumb(i)}<small>${i.name}</small></div>`).join("");
  tr.style.transition = "none"; tr.style.transform = "translateX(0)";
  showBox("boxSpin"); openModal();

  const W = $("rollWindow").clientWidth;
  const target = -(K * CELL + CELL / 2 - W / 2 + (Math.random() - .5) * 60);
  const dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? .5 : 5.5;
  let done = false;
  const finish = () => { if (done) return; done = true; spinning = false; skipFn = null; tr.removeEventListener("transitionend", finish); showResult(win, c); };
  skipFn = () => { tr.style.transition = "none"; tr.style.transform = `translateX(${target}px)`; finish(); };
  tr.addEventListener("transitionend", finish);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    tr.style.transition = `transform ${dur}s cubic-bezier(.12,.6,.1,1)`; tr.style.transform = `translateX(${target}px)`;
  }));
}
function showResult(i, c) {
  renderAll();
  $("resCase").textContent = c.name;
  $("resThumb").innerHTML = thumb(i);
  $("resName").textContent = i.name;
  $("resRarity").textContent = RARITY[i.rarity]; $("resRarity").className = "rar " + i.rarity;
  $("resStory").textContent = i.story;
  $("resChance").textContent = `${i.num} · шанс в этом кейсе ${pct(i.chance)}`;
  $("resSell").textContent = `Продать за ${money(sellPrice(i))} кр.`; $("resSell").hidden = false;
  showBox("boxResult");
}
function showContents(id) {
  if (spinning) return;
  const c = getCase(id);
  $("conTitle").textContent = c.name;
  $("conLead").textContent = "Состав и шансы. Истории откроются, когда найдёшь предмет.";
  $("conList").innerHTML = c.items.map(x => {
    const i = getItem(x.id);
    return `<div class="row">${thumb(i, !state.found[i.id])}<div>${i.name}<small class="rar ${i.rarity}">${RARITY[i.rarity]}</small></div><span class="price">${pct(i.chance)}</span></div>`;
  }).join("");
  $("conOpen").textContent = `Открыть за ${money(c.price)} кр.`;
  $("conOpen").onclick = () => { closeModal(); openCase(id); };
  showBox("boxContents"); openModal();
}

/* ---------- Продажа ---------- */
function sellEntry(idx) {
  const x = state.inventory[idx]; if (!x) return;
  const i = getItem(x.item), p = sellPrice(i);
  state.inventory.splice(idx, 1); state.balance += p; renderAll();
  toast(`Продано: ${i.name} за ${money(p)} кр.`);
}
function sellBulk(keepOne) {
  const seen = new Set(), sold = [], rest = [];
  state.inventory.forEach(x => { if (keepOne && !seen.has(x.item)) { seen.add(x.item); rest.push(x); } else sold.push(x); });
  if (!sold.length) return toast("Нечего продавать.");
  const sum = sold.reduce((t, x) => t + sellPrice(getItem(x.item)), 0);
  if (!confirm(`Продать предметов: ${sold.length} за ${money(sum)} кр.?`)) return;
  state.inventory = rest; state.balance += sum; renderAll(); toast(`Продано: ${sold.length} за ${money(sum)} кр.`);
}

/* ---------- Ежедневный бонус ---------- */
const BONUS = 1500;
const today = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
function renderBonus() {
  const b = $("bonusBtn"), ready = state.lastBonus !== today();
  b.disabled = !ready;
  if (ready) { b.textContent = `Бонус дня +${money(BONUS)} кр.`; return; }
  const n = new Date(), left = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n;
  b.textContent = `Следующий бонус через ${Math.floor(left / 36e5)} ч ${Math.floor(left % 36e5 / 6e4)} мин`;
}
$("bonusBtn").onclick = () => {
  if (state.lastBonus === today()) return;
  state.lastBonus = today(); state.balance += BONUS; renderAll();
  toast(`Бонус дня: +${money(BONUS)} кр.`);
};
setInterval(renderBonus, 60000);

/* ---------- События ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-open],[data-contents],[data-sell],[data-page]"); if (!t) return;
  if (t.dataset.open) openCase(t.dataset.open);
  else if (t.dataset.contents) showContents(t.dataset.contents);
  else if (t.dataset.sell) sellEntry(+t.dataset.sell);
  else if (t.dataset.page) {
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + t.dataset.page));
    document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b === t));
  }
});
$("skipBtn").onclick = () => skipFn && skipFn();
$("resClose").onclick = closeModal; $("conClose").onclick = closeModal;
$("resSell").onclick = () => { const idx = state.inventory.indexOf(lastDrop); if (idx > -1) sellEntry(idx); $("resSell").hidden = true; };
$("backdrop").addEventListener("click", e => { if (e.target.id === "backdrop") closeModal(); });
$("sellDupes").onclick = () => sellBulk(true); $("sellAll").onclick = () => sellBulk(false);
$("collectionSearch").oninput = renderCollection; $("inventorySearch").oninput = renderInventory;
renderAll();

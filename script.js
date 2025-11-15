/* ===========================
   In-Store Navigation — script.js
   Features:
   - realistic block layout (multi-floor)
   - BFS shortest path + emergency nearest-exit
   - animated moving person
   - shop details modal (brand, offers, BOGO, discount)
   - payment modal (UPI / Card / Cash mock)
   - shopkeeper edit mode (rename shop)
   - multilingual labels + speech synthesis
   =========================== */

/* ---------------------------
   Basic app state
   --------------------------- */
const state = {
  floor: 0,
  shops: {},          // populated below
  specials: {},       // escalator/lift/wash/washgender/exit
  selectedItems: [],
  currentNode: null,
  destNode: null,
  anim: true,
  shopkeeper: false,
  lang: 'en'
};

/* ---------------------------
   Simple i18n
   --------------------------- */
const I18N = {
  en: {
    selectShop: 'Select a shop to see details.',
    total: 'Total',
    checkout: 'Checkout',
    noPath: 'No path found',
    emergencyNotified: 'Emergency alerted to security!',
    arrived: 'You have arrived.',
    startNav: 'Starting navigation to'
  },
  kn: {
    selectShop: 'ದೂಕಾಣೆಯ ವಿವರಗಳನ್ನು ಆರಿಸಿ.',
    total: 'ಒಟ್ಟು',
    checkout: 'ಚೆಕ್ಔಟ್',
    noPath: 'ಮಾರ್ಗ ಕಂಡುಬಂದಿಲ್ಲ',
    emergencyNotified: 'ಭದ್ರತೆಗೆ ತುರ್ತು ಮಾಹಿತಿ ಕಳುಹಿಸಲಾಗಿದೆ!',
    arrived: 'ನೀವು ತಲುಪಿದ್ದೀರಿ.',
    startNav: 'ನ್ಯಾವಿಗೇಶನ್ ಪ್ರಾರಂಭ'
  },
  hi: {
    selectShop: 'दुकान विवरण चुनें।',
    total: 'कुल',
    checkout: 'चेकआउट',
    noPath: 'रास्ता नहीं मिला',
    emergencyNotified: 'आपातकालीन सूचना सुरक्षा को भेजी गई!',
    arrived: 'आप पहुंच गए हैं।',
    startNav: 'नेविगेशन शुरू'
  }
}
function t(key){ return (I18N[state.lang] && I18N[state.lang][key]) || key }

/* ---------------------------
   mall layout data — floors are 12x8 grid
   Nodes are 'f-r-c' e.g. '0-1-2'
   We'll place shops & specials for demo
   --------------------------- */
const FLOORS = [
  { id:0, rows:8, cols:12, name:'Ground' },
  { id:1, rows:8, cols:12, name:'First' },
  { id:2, rows:8, cols:12, name:'Second' }
];

// stores (key -> metadata)
state.shops = {
  '0-1-2': { id:'G1', name:'Grocery Mart', brand:'FreshMart', items:[{name:'Milk',price:40},{name:'Bread',price:30}], rating:4.2, bogo:false, discount:10 },
  '0-1-5': { id:'C1', name:'Clothing Hub', brand:'StyleX', items:[{name:'T-Shirt',price:499}], rating:4.6, bogo:true, discount:0 },
  '0-0-0': { id:'Office', name:'Mall Office', brand:'MallOps', items:[], rating:4.0, bogo:false, discount:0 },
  '1-3-4': { id:'E1', name:'ElectroWorld', brand:'E-Zone', items:[{name:'Headphones',price:899}], rating:4.1, bogo:false, discount:15 },
  '1-6-8': { id:'S4', name:'Gaming Zone', brand:'PlayMore', items:[{name:'Gamepad',price:1299}], rating:4.7, bogo:false, discount:5 },
  '2-5-7': { id:'M1', name:'Movie Snacks', brand:'PopCorner', items:[{name:'Popcorn',price:120}], rating:4.0, bogo:true, discount:0 }
};

// specials: escalator/lift/wash/exit
state.specials = {
  '0-2-2': { type:'escalator', to:'1-2-2' },
  '1-2-2': { type:'escalator', to:'0-2-2' },
  '1-3-10': { type:'lift', to:'2-3-10' },
  '2-3-10': { type:'lift', to:'1-3-10' },

  '0-7-1': { type:'wash', gender:'both' },
  '1-7-1': { type:'wash', gender:'male' },
  '1-7-2': { type:'wash', gender:'female' },
  '2-7-2': { type:'wash', gender:'both' },

  '0-7-11': { type:'exit' },
  '1-0-11': { type:'exit' },
  '2-7-0': { type:'exit' }
};

/* ---------------------------
   Utility: node key helpers
   --------------------------- */
function nodeKey(f,r,c){ return `${f}-${r}-${c}` }
function parseKey(k){ return k.split('-').map(Number) }

/* ---------------------------
   Grid neighbors — 4-way + specials
   --------------------------- */
function neighbors(k){
  const [f,r,c]=parseKey(k)
  const out=[]
  const dirs=[[0,1],[0,-1],[1,0],[-1,0]]
  for(const [dr,dc] of dirs){
    const nr=r+dr, nc=c+dc
    if(nr>=0 && nc>=0 && nr<FLOORS[f].rows && nc<FLOORS[f].cols) out.push(nodeKey(f,nr,nc))
  }
  if(state.specials[k] && state.specials[k].to) out.push(state.specials[k].to)
  // include reverse specials (can step onto escalator destination back to origin)
  for(const sk in state.specials){
    if(state.specials[sk].to === k) out.push(sk)
  }
  return out
}

/* ---------------------------
   BFS shortest path (works across floors via specials)
   --------------------------- */
function bfsPath(start, goal){
  if(!start || !goal) return []
  const q=[start]; const prev={}; const seen=new Set([start])
  while(q.length){
    const cur=q.shift()
    if(cur===goal) break
    for(const nb of neighbors(cur)){
      if(!seen.has(nb)){
        seen.add(nb); prev[nb]=cur; q.push(nb)
      }
    }
  }
  if(!prev[goal] && start!==goal) return []
  const path=[goal]; let u=goal
  while(u!==start){ u=prev[u]; if(!u) break; path.push(u) }
  return path.reverse()
}

/* ---------------------------
   Render map for current floor
   --------------------------- */
const mapEl = document.getElementById('map')
const floorBtns = document.getElementById('floorBtns')
const currentSelect = document.getElementById('currentSelect')
const destSelect = document.getElementById('destSelect')
const shopDetails = document.getElementById('shopDetails')
const shopModal = document.getElementById('shopModal')
const modalContent = document.getElementById('modalContent')
const closeShopModal = document.getElementById('closeShopModal')
const paymentModal = document.getElementById('paymentModal')
const paymentContent = document.getElementById('paymentContent')
const closePayment = document.getElementById('closePayment')
const personEl = document.getElementById('person')
const cartList = document.getElementById('cartList')
const totalEl = document.getElementById('total')
const emergencyBtn = document.getElementById('emergencyBtn')
const nearestExitBtn = document.getElementById('nearestExitBtn')

function renderFloorButtons(){
  floorBtns.innerHTML=''
  for(const f of FLOORS){
    const b=document.createElement('button'); b.textContent=f.name
    b.onclick=()=>{ state.floor=f.id; renderMap() }
    floorBtns.appendChild(b)
  }
}

function buildSelects(){
  currentSelect.innerHTML=''; destSelect.innerHTML=''
  // shops and specials
  for(const k in state.shops){
    const opt1=document.createElement('option'); opt1.value=k; opt1.textContent= `${state.shops[k].name} — ${k.split('-')[0]}F`
    currentSelect.appendChild(opt1)
    const opt2=opt1.cloneNode(true); destSelect.appendChild(opt2)
  }
  for(const k in state.specials){
    const s=state.specials[k]
    const opt=document.createElement('option'); opt.value=k; opt.textContent=`${s.type.toUpperCase()} — ${k.split('-')[0]}F`
    currentSelect.appendChild(opt); destSelect.appendChild(opt.cloneNode(true))
  }
}

function renderMap(){
  mapEl.innerHTML=''
  const f = FLOORS[state.floor]
  // create grid cells exactly f.rows x f.cols
  for(let r=0;r<f.rows;r++){
    for(let c=0;c<f.cols;c++){
      const k=nodeKey(f.id,r,c)
      const div=document.createElement('div')
      div.className='cell'
      div.id='cell-'+k
      // store?
      if(state.shops[k]){
        div.classList.add('store'); div.textContent=state.shops[k].name; div.onclick=()=>openShop(k)
      } else if(state.specials[k]){
        const t=state.specials[k].type
        if(t==='wash'){ div.classList.add('wash'); div.textContent='Wash' }
        else if(t==='escalator' || t==='lift'){ div.classList.add('escalator'); div.textContent= t==='lift' ? 'Lift' : 'Esc' }
        else if(t==='exit'){ div.classList.add('exit'); div.textContent='Exit' }
      } else {
        div.classList.add('empty')
      }
      mapEl.appendChild(div)
    }
  }
  // update selects and timing info
  document.getElementById('timings').textContent = `Open 10:00 — Close 21:00`
  buildSelects()
}

/* ---------------------------
   Shop modal & shop actions
   --------------------------- */
function openShop(key){
  const s = state.shops[key]
  if(!s){ shopDetails.innerHTML = `<p>${t('selectShop')}</p>`; return }
  const offers = `${s.bogo ? 'Buy 1 Get 1' : ''} ${s.discount ? s.discount+'% off':''}`
  shopDetails.innerHTML = `
    <h4>${s.name}</h4>
    <p><b>Brand:</b> ${s.brand}</p>
    <p><b>Rating:</b> ${s.rating} ★</p>
    <p><b>Offers:</b> ${offers}</p>
    <div><b>Items:</b></div>
    <div id="shopItems">${s.items.map(it=>`<div class="shop-item">${it.name} — ₹${it.price} <button class="addItem" data-shop="${key}" data-name="${it.name}">Add</button></div>`).join('')}</div>
    ${state.shopkeeper ? `<div><button id="editShopBtn">Edit Shop</button></div>` : ''}
  `
  // attach add handlers
  document.querySelectorAll('.addItem').forEach(btn=>{
    btn.onclick = (e)=>{
      const shopKey = btn.dataset.shop
      const itemName = btn.dataset.name
      const item = state.shops[shopKey].items.find(it=>it.name===itemName)
      state.selectedItems.push({ shop:shopKey, name:item.name, price:item.price })
      renderCart()
    }
  })
  // shopkeeper edit
  const ed = document.getElementById('editShopBtn')
  if(ed) ed.onclick = ()=> {
    const newName = prompt('New shop name', s.name)
    if(newName) { s.name = newName; renderMap() }
  }

  // open modal with more detail (larger UI)
  modalContent.innerHTML = `
    <h3>${s.name}</h3>
    <p><b>Brand:</b> ${s.brand}</p>
    <p>${s.items.map(i=>`<div>${i.name} — ₹${i.price}</div>`).join('')}</p>
    <div style="margin-top:8px"><button id="openPaymentFromShop" class="btn-primary">Pay / Checkout</button></div>
  `
  shopModal.classList.remove('hidden')
  const payBtn = document.getElementById('openPaymentFromShop')
  payBtn.onclick = ()=> { openPayment(); shopModal.classList.add('hidden') }
}

/* close modal */
closeShopModal.onclick = ()=> shopModal.classList.add('hidden')
closePayment.onclick = ()=> paymentModal.classList.add('hidden')

/* ---------------------------
   CART / Checkout
   --------------------------- */
function renderCart(){
  cartList.innerHTML=''
  let total=0
  state.selectedItems.forEach((it,idx)=>{
    const li = document.createElement('li')
    li.textContent = `${it.name} — ₹${it.price}`
    const rm = document.createElement('button'); rm.textContent='Remove'; rm.onclick=()=>{ state.selectedItems.splice(idx,1); renderCart() }
    li.appendChild(rm); cartList.appendChild(li)
    // apply discounts per shop
    const s = state.shops[it.shop]
    let p = it.price
    if(s.bogo) p = p/2
    if(s.discount) p = p*(1 - s.discount/100)
    total += p
  })
  totalEl.textContent = `${t('total')}: ₹${Math.round(total)}`
}

/* payment modal */
function openPayment(){
  paymentContent.innerHTML = ''
  const total = totalEl.textContent
  paymentContent.innerHTML = `<p>${total}</p>
    <div>
      <label><input type="radio" name="payMode" value="upi" checked /> UPI</label>
      <label><input type="radio" name="payMode" value="card" /> Card</label>
      <label><input type="radio" name="payMode" value="cash" /> Cash</label>
    </div>
    <div id="payMsg"></div>
  `
  paymentModal.classList.remove('hidden')
  document.getElementById('payUPI').onclick = ()=> processPayment('UPI')
  document.getElementById('payCard').onclick = ()=> processPayment('Card')
  document.getElementById('payCash').onclick = ()=> processPayment('Cash')
}
function processPayment(mode){
  document.getElementById('payMsg').innerText = `Processing ${mode} — demo`
  setTimeout(()=> {
    alert('Payment success (demo)')
    state.selectedItems = []
    renderCart()
    paymentModal.classList.add('hidden')
  },1000)
}

/* ---------------------------
   ROUTING + animation
   --------------------------- */
const routeBtn = document.getElementById('routeBtn')
const animToggle = document.getElementById('animToggle')

routeBtn.onclick = ()=>{
  const start = currentSelect.value
  const goal = destSelect.value
  if(!start || !goal) { alert('Select start & destination'); return }
  const path = bfsPath(start, goal)
  if(!path || path.length===0){ alert(t('noPath')); return }
  drawPath(path)
  if(animToggle.checked) animatePerson(path)
  speak(`${I18N[state.lang].startNav} ${destSelect.options[destSelect.selectedIndex].text}`)
}

/* visual path drawing */
function drawPath(path, kind='path'){
  // clear old
  document.querySelectorAll('.cell').forEach(c=> c.classList.remove('path','active'))
  for(const k of path){
    const el = document.getElementById('cell-'+k)
    if(el) el.classList.add('path')
  }
}

/* person animation — absolute element moves to each cell */
function animatePerson(path){
  personEl.classList.remove('hidden')
  let i=0
  function step(){
    if(i>=path.length){ speak(I18N[state.lang].arrived); return }
    const el = document.getElementById('cell-'+path[i])
    if(!el){ i++; return setTimeout(step,300) }
    const rect = el.getBoundingClientRect()
    personEl.style.left = (rect.left + rect.width/2) + 'px'
    personEl.style.top  = (rect.top  + rect.height/2) + 'px'
    // highlight active
    document.querySelectorAll('.cell').forEach(c=> c.classList.remove('active'))
    el.classList.add('active')
    i++
    setTimeout(step, 380)
  }
  step()
}

/* ---------------------------
   Emergency -> find nearest exit and show red path + alarm
   --------------------------- */
emergencyBtn.onclick = ()=>{
  // pick current location if available else pick first shop on same floor
  const start = state.currentNode || Object.keys(state.shops)[0]
  // gather exits
  const exits = Object.keys(state.specials).filter(k => state.specials[k].type==='exit')
  // find nearest exit via BFS
  let best = null, bestPath = null
  for(const ex of exits){
    const p = bfsPath(start, ex)
    if(p && p.length>0 && (!bestPath || p.length < bestPath.length)){
      best = ex; bestPath = p
    }
  }
  if(!bestPath){ alert('No exit path'); return }
  // draw path in red style
  drawPath(bestPath)
  bestPath.forEach(k=> {
    const el=document.getElementById('cell-'+k)
    if(el) el.style.background = '#fee2e2' // red-ish
  })
  // play simple alarm (using speech)
  speak(t('emergencyNotified'))
  // optional flashing
  flashCells(bestPath)
}

/* flashing effect */
function flashCells(path){
  let on=true
  const iv=setInterval(()=>{
    path.forEach(k=> {
      const el=document.getElementById('cell-'+k)
      if(el) el.style.border = on ? '2px solid #b91c1c' : '2px solid transparent'
    })
    on=!on
  },400)
  setTimeout(()=> clearInterval(iv),8000) // stop after 8s
}

/* ---------------------------
   nearest exit highlighting toggle
   --------------------------- */
document.getElementById('nearestExitBtn').onchange = (e)=>{
  if(e.target.checked){
    // find exits on current floor and mark
    for(const k in state.specials){
      if(state.specials[k].type==='exit' && k.startsWith(state.floor+'-')){
        const el=document.getElementById('cell-'+k); if(el) el.classList.add('exit')
      }
    }
  } else {
    document.querySelectorAll('.cell.exit').forEach(el=> el.classList.remove('exit'))
  }
}

/* ---------------------------
   Search
   --------------------------- */
const searchBox = document.getElementById('searchBox')
const searchResults = document.getElementById('searchResults')
searchBox.oninput = ()=>{
  const q = searchBox.value.toLowerCase(); searchResults.innerHTML=''
  if(!q) return
  for(const k in state.shops){
    const s = state.shops[k]
    if(s.name.toLowerCase().includes(q) || s.brand.toLowerCase().includes(q) || s.items.some(it=>it.name.toLowerCase().includes(q))){
      const d = document.createElement('div'); d.className='result'; d.textContent = `${s.name} (${k})`
      d.onclick = ()=> { openShop(k); currentSelect.value=k; destSelect.value=k }
      searchResults.appendChild(d)
    }
  }
}

/* ---------------------------
   Helpers: speak
   --------------------------- */
const voiceBtn = document.getElementById('voiceBtn')
voiceBtn.onclick = ()=> {
  speak('Welcome to the Mall Navigator. Try saying "Find Grocery" or "Go to Electronics."')
}

/* speech synthesis */
function speak(txt){
  try{
    const msg = new SpeechSynthesisUtterance(txt)
    msg.lang = state.lang === 'kn' ? 'kn-IN' : (state.lang === 'hi' ? 'hi-IN' : 'en-US')
    speechSynthesis.speak(msg)
  }catch(e){ console.warn(e) }
}

/* ---------------------------
   language & controls wiring
   --------------------------- */
document.querySelectorAll('.lang-btn').forEach(b=>{
  b.onclick = ()=> { state.lang = b.dataset.lang; renderMap() }
})
document.getElementById('shopkeeperToggle').onclick = ()=>{
  state.shopkeeper = !state.shopkeeper
  document.getElementById('shopkeeperToggle').classList.toggle('muted')
  renderMap()
}

/* map init */
renderFloorButtons()
renderMap()
buildSelects()
renderCart()

/* set selects default */
currentSelect.onchange = ()=> state.currentNode = currentSelect.value
destSelect.onchange = ()=> state.destNode = destSelect.value

/* route via pressing Go button (wiring already set) */
document.getElementById('routeBtn').onclick = ()=> { routeBtn.onclick() }

/* checkout button */}
document.getElementById('checkoutBtn').onclick = ()=> { openPayment() }

/* close modal click outside */
window.addEventListener('click', (ev)=>{
  if(ev.target===shopModal) shopModal.classList.add('hidden')
  if(ev.target===paymentModal) paymentModal.classList.add('hidden')
})

/* keyboard shortcuts for demo */
window.addEventListener('keydown', (e)=>{
  if(e.key==='e') emergencyBtn.click()
  if(e.key==='k') document.getElementById('shopkeeperToggle').click()
})

/* ensure person hidden initially */
personEl.classList.add('hidden')

/* expose for debugging */
window._mallState = state

// ==========================================
// ARCCARDS - STATE MANAGEMENT & LOGIC SYSTEM
// ==========================================
const CARD_POOL = [
  { id:1, name:"Neon Samurai Kaelen",    rarity:"Legendary", img:"https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=500&q=80", score:250 },
  { id:2, name:"Mistress Neon Aetheria", rarity:"Legendary", img:"https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80", score:250 },
  { id:3, name:"Siren of Abyss Scylla",  rarity:"Rare",      img:"https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=500&q=80", score:100 },
  { id:4, name:"Void Weaver Nyx",        rarity:"Rare",      img:"https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=500&q=80", score:100 },
  { id:5, name:"Tox-Grid Specialist",    rarity:"Common",    img:"https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=500&q=80", score:30  },
  { id:6, name:"Star Atlas Orion",       rarity:"Common",    img:"https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=500&q=80", score:30  },
  { id:7, name:"Flare Catalyst Ember",   rarity:"Common",    img:"https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=500&q=80", score:30  },
  { id:8, name:"Chrono Ranger Zero",     rarity:"Rare",      img:"https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=500&q=80", score:100 },
  { id:9, name:"Crystalline Overlord",   rarity:"Legendary", img:"https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=500&q=80", score:250 }
];

const ACHIEVEMENTS_POOL = [
  { id:"first_summon",  title:"Pemanggil Pertama", desc:"Tarik kartu pertamamu.",                    reward:50,  xpReward:25  },
  { id:"legendary_pull",title:"Tangan Emas",        desc:"Tarik kartu Legendary.",                   reward:200, xpReward:50  },
  { id:"market_list",   title:"Pebisnis Handal",    desc:"Daftarkan kartu di marketplace.",           reward:50,  xpReward:20  },
  { id:"market_buy",    title:"Pemilik Modal",       desc:"Beli kartu dari marketplace.",              reward:100, xpReward:30  },
  { id:"level_5",       title:"Veterancy",           desc:"Capai level 5.",                            reward:300, xpReward:100 }
];

const MOCK_LEADERBOARD = [
  { rank:1, address:"0x7a81C9742Bef8...", level:14, cards:42, score:3820 },
  { rank:2, address:"0x2B99F4463d11...",  level:11, cards:31, score:2950 },
  { rank:3, address:"0x17dA99015c92...",  level:9,  cards:24, score:1840 }
];

let state = {
  walletConnected:false, walletAddress:"", walletProvider:"",
  arcBalance:1000, userLevel:1, userXP:0,
  collection:[], marketplace:[], arcScanLogs:[], achievements:[]
};
let selectedFilter = 'all';
let currentMarketSubTab = 'buy';
let activeCardDetailId = null;

function loadState() {
  const saved = localStorage.getItem('arccards_state');
  if (saved) { state = JSON.parse(saved); } else {
    state.collection = [createCardInstance(CARD_POOL[4]), createCardInstance(CARD_POOL[5])];
    state.marketplace = [
      { listingId:"lst_1", seller:"0x2B99F4463d11...", card:createCardInstance(CARD_POOL[2]), price:150 },
      { listingId:"lst_2", seller:"0x7a81C9742Bef...", card:createCardInstance(CARD_POOL[0]), price:550 }
    ];
    state.arcScanLogs = [{ txHash:generateTxHash(), action:"MINT_INITIAL_STATE", block:1940190, sender:"0x0000000000000000000000000000000000000000", value:0, status:"Success" }];
    saveState();
  }
}
function saveState() { localStorage.setItem('arccards_state', JSON.stringify(state)); }

function createCardInstance(baseCard) {
  const serial = Math.floor(100 + Math.random() * 900);
  return { id:baseCard.id, instanceId:"inst_"+Math.random().toString(36).substring(2,9), name:baseCard.name, rarity:baseCard.rarity, img:baseCard.img, score:baseCard.score, serial, txHash:generateTxHash(), xpValue:Math.floor(Math.random()*20), mintedBlock:Math.floor(1940100+Math.random()*100) };
}
function generateTxHash() { return "0x"+Array.from({length:40},()=>Math.floor(Math.random()*16).toString(16)).join(''); }

function navigateTo(target) {
  ['landing','gacha','collection','marketplace','leaderboard','explorer'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (!el) return;
    if (v === target) { el.classList.remove('hidden'); el.classList.add('block'); }
    else { el.classList.add('hidden'); el.classList.remove('block'); }
  });
  document.querySelectorAll('.nav-tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === target) { tab.classList.add('bg-white/10','text-white'); tab.classList.remove('text-white/60'); }
    else { tab.classList.remove('bg-white/10','text-white'); tab.classList.add('text-white/60'); }
  });
  document.getElementById('mobile-nav-overlay').classList.add('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
function switchTab(tabId) {
  if (!state.walletConnected && tabId !== 'explorer') { showToast("Sambungkan wallet terlebih dahulu.","error"); triggerConnectWallet(); return; }
  navigateTo(tabId);
}
function switchTabMobile(tabId) { switchTab(tabId); }
function toggleMobileNav() { document.getElementById('mobile-nav-overlay').classList.toggle('hidden'); }
function launchApp() {
  document.getElementById('main-nav').classList.remove('hidden');
  if (state.walletConnected) navigateTo('collection'); else { navigateTo('gacha'); triggerConnectWallet(); }
}
function launchAppAndSwitch(tabId) {
  document.getElementById('main-nav').classList.remove('hidden');
  navigateTo(tabId);
  if (!state.walletConnected) triggerConnectWallet();
}

function showToast(message, type="info") {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  let borderColor="border-white/10", iconColor="text-white", icon="info";
  if (type==="success") { icon="check-circle"; borderColor="border-emerald-500/30 bg-emerald-950/20"; iconColor="text-emerald-400"; }
  else if (type==="error") { icon="alert-circle"; borderColor="border-red-500/30 bg-red-950/20"; iconColor="text-red-400"; }
  else if (type==="achievement") { icon="award"; borderColor="border-yellow-500/30 bg-amber-950/20 animate-pulse"; iconColor="text-yellow-400"; }
  toast.className = `glass-panel px-4 py-3.5 rounded-2xl border flex items-center gap-3 shadow-lg transition-all duration-300 transform translate-x-12 opacity-0 pointer-events-auto ${borderColor}`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 ${iconColor} flex-shrink-0"></i><p class="font-body text-xs font-semibold text-white">${message}</p>`;
  container.appendChild(toast);
  lucide.createIcons();
  setTimeout(()=>{ toast.classList.remove('translate-x-12','opacity-0'); },50);
  setTimeout(()=>{ toast.classList.add('opacity-0'); setTimeout(()=>toast.remove(),300); },4000);
}

function triggerConnectWallet() {
  if (state.walletConnected) {
    state.walletConnected=false; state.walletAddress=""; state.walletProvider="";
    saveState(); updateWalletUI(); navigateTo('landing');
    document.getElementById('main-nav').classList.add('hidden');
    showToast("Wallet terputus.","info"); return;
  }
  document.getElementById('modal-wallet').classList.remove('hidden');
}
function handleWalletSelection(provider, mockAddr) {
  state.walletConnected=true; state.walletAddress=mockAddr; state.walletProvider=provider;
  saveState(); logTransaction("WALLET_CONNECT",state.walletAddress,0,"Success");
  updateWalletUI(); closeModal('wallet');
  showToast(`Terhubung dengan ${provider}`,"success");
  document.getElementById('main-nav').classList.remove('hidden');
  navigateTo('collection'); checkAchievements();
}
function addFreeTokens() {
  if (!state.walletConnected) return;
  state.arcBalance+=500; logTransaction("FAUCET_CLAIM",state.walletAddress,500,"Success");
  saveState(); updateHeaderAndProfile(); showToast("+500 ARC berhasil diklaim.","success");
}
function updateWalletUI() {
  const textEl=document.getElementById('wallet-text'), dotEl=document.getElementById('wallet-dot'), btnEl=document.getElementById('wallet-btn');
  if (state.walletConnected) {
    textEl.textContent=`${state.walletAddress.substring(0,6)}...${state.walletAddress.substring(38)}`;
    dotEl.className="w-2.5 h-2.5 rounded-full bg-emerald-400";
    btnEl.classList.add('border-primaryPurple/40','bg-primaryPurple/10');
  } else {
    textEl.textContent="Connect Wallet";
    dotEl.className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse";
    btnEl.classList.remove('border-primaryPurple/40','bg-primaryPurple/10');
  }
  updateHeaderAndProfile();
}

function executeSummon(packType) {
  if (!state.walletConnected) { showToast("Sambungkan wallet terlebih dahulu.","error"); triggerConnectWallet(); return; }
  const cost = packType==='premium' ? 400 : 100;
  if (state.arcBalance < cost) { showToast("Saldo ARC tidak mencukupi.","error"); return; }
  state.arcBalance -= cost;
  logTransaction("GACHA_SUMMON",state.walletAddress,cost,"Success");
  const roll = Math.random()*100;
  let selectedCard;
  if (packType==='premium') {
    if (roll<35) selectedCard=getRandomByRarity("Legendary");
    else if (roll<80) selectedCard=getRandomByRarity("Rare");
    else selectedCard=getRandomByRarity("Common");
  } else {
    if (roll<10) selectedCard=getRandomByRarity("Legendary");
    else if (roll<40) selectedCard=getRandomByRarity("Rare");
    else selectedCard=getRandomByRarity("Common");
  }
  const instance = createCardInstance(selectedCard);
  state.collection.push(instance); saveState(); addXP(15); checkAchievements();
  showSummonReveal(instance); renderInventory();
}
function getRandomByRarity(rarity) { const m=CARD_POOL.filter(c=>c.rarity===rarity); return m[Math.floor(Math.random()*m.length)]; }
function showSummonReveal(cardInstance) { openCardDetail(cardInstance.instanceId); showToast(`SUMMON BERHASIL! ${cardInstance.name}`,"success"); }

function renderInventory() {
  const grid=document.getElementById('inventory-grid'); grid.innerHTML="";
  let list=state.collection;
  if (selectedFilter!=='all') list=state.collection.filter(c=>c.rarity.toLowerCase()===selectedFilter);
  if (list.length===0) {
    grid.innerHTML=`<div class="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5"><h4 class="font-heading text-lg text-white font-bold">Koleksi Kosong</h4><p class="font-body text-xs text-white/40 mt-1">Lakukan pemanggilan kartu di tab Summon.</p></div>`;
    lucide.createIcons(); return;
  }
  list.forEach(card => {
    const rb=card.rarity==='Legendary'?'glow-legendary':(card.rarity==='Rare'?'glow-rare':'glow-common');
    const bc=card.rarity==='Legendary'?'bg-yellow-500/10 text-yellow-400 border-yellow-500/30':(card.rarity==='Rare'?'bg-blue-500/10 text-blue-400 border-blue-500/30':'bg-white/5 text-white/50 border-white/10');
    const isListed=state.marketplace.some(m=>m.card.instanceId===card.instanceId);
    const overlay=isListed?`<div class="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-10 flex items-center justify-center"><span class="font-mono text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full uppercase font-bold">TERDAFTAR</span></div>`:'';
    const el=document.createElement('div');
    el.className=`glass-panel rounded-3xl overflow-hidden glass-card-hover border relative flex flex-col justify-between h-96 p-5 cursor-pointer ${rb}`;
    el.setAttribute('onclick',`openCardDetail('${card.instanceId}')`);
    el.innerHTML=`${overlay}<div class="absolute inset-0 bg-cover bg-center opacity-85" style="background-image:url('${card.img}');"></div><div class="absolute inset-0 bg-gradient-to-t from-[#07070F] via-transparent to-transparent"></div><div class="relative z-10 flex justify-between items-start"><span class="font-mono text-[9px] text-white/50 bg-black/60 px-1.5 py-0.5 rounded">#${card.serial}</span><span class="font-mono text-[9px] px-2 py-0.5 rounded border font-bold ${bc}">${card.rarity.toUpperCase()}</span></div><div class="relative z-10 mt-auto"><span class="font-mono text-[9px] text-cyan-400">XP +${card.xpValue}</span><h3 class="font-heading text-base text-white font-extrabold tracking-tight leading-snug">${card.name}</h3></div>`;
    grid.appendChild(el);
  });
  lucide.createIcons();
}
function filterCollection(rarity) {
  selectedFilter=rarity;
  ['all','legendary','rare','common'].forEach(b=>{ const el=document.getElementById(`filter-${b}`); if(b===rarity) el.classList.add('bg-white/20'); else el.classList.remove('bg-white/20'); });
  renderInventory();
}

function switchMarketSubTab(subTab) {
  currentMarketSubTab=subTab;
  const tabBuy=document.getElementById('market-tab-buy'), tabSell=document.getElementById('market-tab-sell');
  const subBuy=document.getElementById('market-sub-buy'), subSell=document.getElementById('market-sub-sell');
  if (subTab==='buy') {
    tabBuy.classList.add('border-primaryPurple','text-white'); tabBuy.classList.remove('border-transparent','text-white/60');
    tabSell.classList.add('border-transparent','text-white/60'); tabSell.classList.remove('border-primaryPurple','text-white');
    subBuy.classList.remove('hidden'); subSell.classList.add('hidden');
  } else {
    tabSell.classList.add('border-primaryPurple','text-white'); tabSell.classList.remove('border-transparent','text-white/60');
    tabBuy.classList.add('border-transparent','text-white/60'); tabBuy.classList.remove('border-primaryPurple','text-white');
    subSell.classList.remove('hidden'); subBuy.classList.add('hidden');
  }
  renderMarketplace();
}

function renderMarketplace() {
  const grid=document.getElementById('marketplace-grid'); grid.innerHTML="";
  document.getElementById('market-stats-total').textContent=state.marketplace.length;
  if (!state.marketplace.length) { grid.innerHTML=`<div class="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5"><h4 class="font-heading text-lg text-white font-bold">Pasar Kosong</h4></div>`; lucide.createIcons(); }
  state.marketplace.forEach(item => {
    const isSelf=item.seller.toLowerCase()===state.walletAddress.toLowerCase();
    const btnHtml=isSelf?`<button disabled class="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 font-body font-bold text-xs cursor-not-allowed">Koleksi Anda</button>`:`<button onclick="buyMarketplaceCard('${item.listingId}')" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 text-white font-body font-bold text-xs transition-all hover:opacity-90">Beli ${item.price} ARC</button>`;
    const rg=item.card.rarity==='Legendary'?'glow-legendary':(item.card.rarity==='Rare'?'glow-rare':'glow-common');
    const el=document.createElement('div'); el.className=`glass-panel rounded-3xl overflow-hidden border p-5 relative flex flex-col justify-between h-[360px] ${rg}`;
    el.innerHTML=`<div class="absolute inset-0 bg-cover bg-center opacity-80" style="background-image:url('${item.card.img}');"></div><div class="absolute inset-0 bg-gradient-to-t from-[#07070F] via-transparent to-transparent"></div><div class="relative z-10 flex justify-between items-start"><span class="font-mono text-[9px] text-white/50 bg-black/60 px-1.5 py-0.5 rounded">#${item.card.serial}</span><span class="font-mono text-[9px] text-cyan-400 bg-black/60 px-1.5 py-0.5 rounded">Seller: ${item.seller.substring(0,6)}...</span></div><div class="relative z-10 mt-auto"><h3 class="font-heading text-base text-white font-extrabold mb-3">${item.card.name}</h3>${btnHtml}</div>`;
    grid.appendChild(el);
  });
  const myGrid=document.getElementById('my-listings-grid'); myGrid.innerHTML="";
  const myList=state.marketplace.filter(m=>m.seller.toLowerCase()===state.walletAddress.toLowerCase());
  if (!myList.length) { myGrid.innerHTML=`<div class="col-span-full py-16 text-center glass-panel rounded-3xl border border-white/5"><h4 class="font-heading text-lg text-white font-bold">Tidak Ada Listing Aktif</h4></div>`; return; }
  myList.forEach(item => {
    const el=document.createElement('div'); el.className="glass-panel rounded-3xl overflow-hidden border border-white/10 p-5 relative flex flex-col justify-between h-[320px]";
    el.innerHTML=`<div class="absolute inset-0 bg-cover bg-center opacity-80" style="background-image:url('${item.card.img}');"></div><div class="absolute inset-0 bg-gradient-to-t from-[#07070F] via-transparent to-transparent"></div><div class="relative z-10 flex justify-between"><span class="font-mono text-[9px] text-white/50 bg-black/60 px-2 py-0.5 rounded">#${item.card.serial}</span><span class="font-mono text-[9px] text-yellow-400 bg-black/60 px-2 py-0.5 rounded">${item.price} ARC</span></div><div class="relative z-10 mt-auto"><h3 class="font-heading text-sm text-white font-bold mb-3">${item.card.name}</h3><button onclick="handleDelistFromMarket('${item.listingId}')" class="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-body text-xs font-bold rounded-xl transition-all">Batalkan Listing</button></div>`;
    myGrid.appendChild(el);
  });
}

function buyMarketplaceCard(listingId) {
  if (!state.walletConnected) return;
  const item=state.marketplace.find(m=>m.listingId===listingId); if (!item) return;
  if (state.arcBalance<item.price) { showToast("Saldo tidak mencukupi.","error"); return; }
  state.arcBalance-=item.price; state.collection.push(item.card);
  state.marketplace=state.marketplace.filter(m=>m.listingId!==listingId);
  logTransaction("MARKETPLACE_BUY",state.walletAddress,item.price,"Success");
  addXP(20); checkAchievements(); saveState();
  showToast(`Berhasil membeli ${item.card.name}!`,"success");
  renderMarketplace(); renderInventory();
}

function renderLeaderboard() {
  const container=document.getElementById('leaderboard-container'); container.innerHTML="";
  const playerScore=state.collection.reduce((a,c)=>a+c.score,0);
  const list=[...MOCK_LEADERBOARD];
  if (state.walletConnected) list.push({rank:0,address:state.walletAddress,level:state.userLevel,cards:state.collection.length,score:playerScore,isSelf:true});
  list.sort((a,b)=>b.score-a.score);
  list.forEach((user,i)=>{
    const rowBg=user.isSelf?'bg-purple-500/10 border-l-2 border-purple-500':'hover:bg-white/[0.01]';
    const row=document.createElement('div'); row.className=`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-all ${rowBg}`;
    row.innerHTML=`<div class="col-span-1 text-center font-mono font-bold text-white/60">${i+1}</div><div class="col-span-5 font-mono text-xs flex items-center gap-3"><span class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px]">👤</span><span class="text-white/80">${user.isSelf?'0xYou (Current Player)':user.address}</span></div><div class="col-span-2 text-center font-mono text-xs font-bold">${user.level}</div><div class="col-span-2 text-center font-mono text-xs text-white/60">${user.cards}</div><div class="col-span-2 text-right font-mono text-sm font-bold text-cyan-400">${user.score} pts</div>`;
    container.appendChild(row);
  });
}

function logTransaction(action,sender,value,status="Success") {
  const blockEl=document.getElementById('ticker-block');
  const currentBlock=blockEl?parseInt(blockEl.textContent.replace(/,/g,'')):1940202;
  state.arcScanLogs.unshift({txHash:generateTxHash(),action,block:currentBlock,sender,value,status});
  if (state.arcScanLogs.length>50) state.arcScanLogs.pop();
  saveState(); renderLogs();
}
function renderLogs() {
  const tbody=document.getElementById('explorer-table-body'); if (!tbody) return; tbody.innerHTML="";
  const quickLogs=document.getElementById('quick-logs'); if (quickLogs) quickLogs.innerHTML="";
  state.arcScanLogs.forEach((log,i)=>{
    const row=document.createElement('tr'); row.className="hover:bg-white/[0.01]";
    row.innerHTML=`<td class="px-6 py-4 text-cyan-400 text-[11px] font-bold">${log.txHash.substring(0,16)}...</td><td class="px-6 py-4 font-body text-xs"><span class="bg-white/5 border border-white/10 px-2 py-1 rounded">${log.action}</span></td><td class="px-6 py-4 text-white/50">${log.block}</td><td class="px-6 py-4 text-white/60">${log.sender.substring(0,10)}...</td><td class="px-6 py-4 text-white font-bold">${log.value} ARC</td><td class="px-6 py-4 text-right"><span class="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">Success</span></td>`;
    tbody.appendChild(row);
    if (quickLogs && i<3) { const q=document.createElement('div'); q.className="flex justify-between items-center py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5 font-mono text-xs text-white/60"; q.innerHTML=`<span class="text-cyan-400">${log.txHash.substring(0,8)}...</span><span>${log.action}</span><span class="text-emerald-400">${log.value} ARC</span>`; quickLogs.appendChild(q); }
  });
  const txCount=document.getElementById('explorer-tx-count'); if (txCount) txCount.textContent=state.arcScanLogs.length;
}
function clearLogs() { state.arcScanLogs=[]; saveState(); renderLogs(); }

function addXP(amount) {
  state.userXP+=amount;
  while (state.userXP>=100) { state.userXP-=100; state.userLevel++; showToast(`Level naik ke ${state.userLevel}`,"success"); checkAchievements(); }
  saveState(); updateHeaderAndProfile();
}
function checkAchievements() {
  ACHIEVEMENTS_POOL.forEach(ach=>{
    if (state.achievements.includes(ach.id)) return;
    let q=false;
    if (ach.id==="first_summon" && state.collection.length>2) q=true;
    else if (ach.id==="legendary_pull" && state.collection.some(c=>c.rarity==="Legendary")) q=true;
    else if (ach.id==="market_list" && state.marketplace.some(l=>l.seller===state.walletAddress)) q=true;
    else if (ach.id==="market_buy" && state.arcScanLogs.some(l=>l.action==="MARKETPLACE_BUY")) q=true;
    else if (ach.id==="level_5" && state.userLevel>=5) q=true;
    if (q) { state.achievements.push(ach.id); addXP(ach.xpReward); state.arcBalance+=ach.reward; showToast(`Achievement: "${ach.title}" (+${ach.reward} ARC)`,"achievement"); saveState(); }
  });
}
function updateHeaderAndProfile() {
  document.getElementById('arc-balance').textContent=state.arcBalance.toLocaleString();
  document.getElementById('header-level').textContent=state.userLevel;
  document.getElementById('header-xp-bar').style.width=`${state.userXP}%`;
  document.getElementById('header-xp-text').textContent=`${state.userXP}/100`;
  const statsBar=document.getElementById('user-stats-bar'), balBar=document.getElementById('balance-indicator');
  if (state.walletConnected) { statsBar.classList.remove('hidden'); balBar.classList.remove('hidden'); }
  else { statsBar.classList.add('hidden'); balBar.classList.add('hidden'); }
}

function openCardDetail(instanceId) {
  const card=state.collection.find(c=>c.instanceId===instanceId);
  if (!card) { const list=state.marketplace.find(m=>m.card.instanceId===instanceId); if (list) showCardInDetailModal(list.card,false,true,list.listingId); return; }
  const isListed=state.marketplace.some(m=>m.card.instanceId===instanceId);
  showCardInDetailModal(card,true,isListed);
}
function showCardInDetailModal(card,isOwner=true,isListed=false,listingId=null) {
  activeCardDetailId=card.instanceId;
  document.getElementById('detail-card-title').textContent=card.name;
  document.getElementById('detail-card-meta-title').textContent=card.name;
  document.getElementById('detail-card-serial').textContent=`#${card.serial} - INST ${card.instanceId.split('_')[1].toUpperCase()}`;
  document.getElementById('detail-card-badge').textContent=card.rarity.toUpperCase();
  document.getElementById('detail-card-img').style.backgroundImage=`url('${card.img}')`;
  document.getElementById('detail-meta-tokenid').textContent=card.serial*7+1092;
  document.getElementById('detail-meta-xp').textContent=`${card.xpValue} XP`;
  document.getElementById('detail-meta-txhash').textContent=card.txHash;
  const card3D=document.getElementById('detail-card-3d'), badge=document.getElementById('detail-card-badge'), glowBg=document.getElementById('detail-card-glow-bg');
  card3D.className="w-72 h-[410px] rounded-3xl overflow-hidden glass-panel border relative transition-all duration-300 transform shadow-2xl flex flex-col justify-between p-6";
  if (card.rarity==='Legendary') { card3D.classList.add('border-yellow-500/50','shadow-[0_0_30px_rgba(244,185,66,0.3)]'); badge.className="font-mono text-[9px] px-2 py-0.5 rounded border font-bold bg-yellow-500/15 text-yellow-400 border-yellow-500/40"; glowBg.className="absolute inset-0 bg-yellow-400 filter blur-[80px] opacity-30 pointer-events-none"; }
  else if (card.rarity==='Rare') { card3D.classList.add('border-blue-500/50','shadow-[0_0_20px_rgba(59,130,246,0.25)]'); badge.className="font-mono text-[9px] px-2 py-0.5 rounded border font-bold bg-blue-500/15 text-blue-400 border-blue-500/40"; glowBg.className="absolute inset-0 bg-blue-500 filter blur-[80px] opacity-25 pointer-events-none"; }
  else { card3D.classList.add('border-white/10','shadow-lg'); badge.className="font-mono text-[9px] px-2 py-0.5 rounded border font-bold bg-white/5 text-white/50 border-white/10"; glowBg.className="absolute inset-0 bg-white/5 filter blur-[80px] opacity-10 pointer-events-none"; }
  document.getElementById('detail-list-actions').classList.add('hidden');
  document.getElementById('detail-delist-actions').classList.add('hidden');
  if (isOwner && !isListed) document.getElementById('detail-list-actions').classList.remove('hidden');
  else if (isOwner && isListed) document.getElementById('detail-delist-actions').classList.remove('hidden');
  document.getElementById('modal-card-detail').classList.remove('hidden');
}
function handleListCard() {
  const price=parseFloat(document.getElementById('list-price-input').value);
  if (!price||price<=0) { showToast("Masukkan harga yang valid.","error"); return; }
  const card=state.collection.find(c=>c.instanceId===activeCardDetailId); if (!card) return;
  state.marketplace.push({listingId:"lst_"+Math.random().toString(36).substring(2,9),seller:state.walletAddress,card,price});
  logTransaction("MARKET_LISTING",state.walletAddress,0,"Success");
  addXP(15); checkAchievements(); saveState();
  showToast(`${card.name} didaftarkan seharga ${price} ARC.`,"success");
  closeModal('card-detail'); renderInventory(); renderMarketplace();
}
function handleDelistCard() {
  const listing=state.marketplace.find(m=>m.card.instanceId===activeCardDetailId&&m.seller.toLowerCase()===state.walletAddress.toLowerCase());
  if (!listing) return; handleDelistFromMarket(listing.listingId); closeModal('card-detail');
}
function handleDelistFromMarket(listingId) {
  state.marketplace=state.marketplace.filter(m=>m.listingId!==listingId);
  saveState(); showToast("Listing dibatalkan.","info"); renderMarketplace(); renderInventory();
}
function openPlayerProfile() {
  if (!state.walletConnected) return;
  document.getElementById('profile-level').textContent=state.userLevel;
  document.getElementById('profile-xp').textContent=`${state.userXP}/100`;
  const listEl=document.getElementById('achievements-list'); listEl.innerHTML="";
  ACHIEVEMENTS_POOL.forEach(ach=>{
    const achieved=state.achievements.includes(ach.id);
    const el=document.createElement('div');
    el.className=`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${achieved?'bg-purple-500/5 border-purple-500/30 text-white':'bg-white/[0.01] border-white/5 text-white/40'}`;
    el.innerHTML=`<div><p class="font-bold font-body">${ach.title}</p><p class="font-body text-[10px] opacity-70 mt-0.5">${ach.desc}</p></div><span class="font-mono text-[9px] font-bold ${achieved?'text-yellow-400':'text-white/30'}">${achieved?'COMPLETED':'LOCKED'}</span>`;
    listEl.appendChild(el);
  });
  document.getElementById('modal-player-profile').classList.remove('hidden');
}
function closeModal(modalId) { document.getElementById(`modal-${modalId}`).classList.add('hidden'); }

function initBlockchainTicker() {
  setInterval(()=>{
    const blockEl=document.getElementById('ticker-block'), blockExpEl=document.getElementById('explorer-block-height');
    let b=parseInt(blockEl.textContent.replace(/,/g,'')); b++;
    const f=b.toLocaleString(); blockEl.textContent=f; if (blockExpEl) blockExpEl.textContent=`#${f}`;
    const sumEl=document.getElementById('ticker-summons'); let s=parseInt(sumEl.textContent.replace(/,/g,'')); s+=Math.floor(Math.random()*3); sumEl.textContent=s.toLocaleString();
  },15000);
}

window.addEventListener('load',()=>{
  loadState(); updateWalletUI(); renderInventory(); renderMarketplace(); renderLeaderboard(); renderLogs(); initBlockchainTicker(); lucide.createIcons();
});

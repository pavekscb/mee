// --- КОНСТАНТЫ ---
const DEFAULT_EXAMPLE_ADDRESS = "0x9ba27fc8a65ba4507fc4cca1b456e119e4730b8d8cfaf72a2a486e6d0825b27b";
const MEE_COIN_T0_T1 = "0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin";
const APT_COIN = "0x1::aptos_coin::AptosCoin";
const MEGA_COIN_TYPE ="0x350f1f65a2559ad37f95b8ba7c64a97c23118856ed960335fce4cd222d5577d3::mega_coin::MEGA";
let lastMegaBalance = 0;
let currentAptPrice = 0;

const UPDATE_INTERVAL_SECONDS = 60;
const TOKEN_DECIMALS = 8; 
const RAW_DATA_CORRECTION_FACTOR = 100n; 
const ACC_PRECISION = 100000000000n; 
const RAW_UNIT = 1n; 
const MEE_PER_RAW_UNIT = 1 / (10 ** TOKEN_DECIMALS); 

const HARVEST_BASE_URL = "https://explorer.aptoslabs.com/account/0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5/modules/run/Staking/harvest?network=mainnet";
const ADD_MEE_URL = "https://explorer.aptoslabs.com/account/0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5/modules/run/Staking/stake?network=mainnet";
const UNSTAKE_BASE_URL = "https://explorer.aptoslabs.com/account/0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5/modules/run/Staking/unstake?network=mainnet";
const APTOS_LEDGER_URL = "https://fullnode.mainnet.aptoslabs.com/v1";

const URL_SOURCE = "https://github.com/pavekscb/mee";
const URL_SITE = "https://meeiro.xyz/staking";
const URL_GRAPH = "https://www.geckoterminal.com/aptos/pools/899cb684-bdcb-47a6-a6c9-f2b631bba93a";
const URL_SWAP = "https://aptos.pancakeswap.finance/swap?outputCurrency=0x1%3A%3Aaptos_coin%3A%3AAptosCoin&inputCurrency=0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9%3A%3Amee_coin%3A%3AMeeCoin";
const URL_SWAP_EARNIUM = "https://app.panora.exchange/?ref=V94RDWEH#/swap/aptos?pair=MEE-APT";

const URL_SUPPORT = "https://t.me/cripto_karta";
let cometProgress = 0;

// --- КОНСТАНТЫ: ПРОВЕРКА ВЕРСИИ ---
const GITHUB_RELEASES_API = "https://api.github.com/repos/pavekscb/mee/releases/latest";
const GITHUB_REPO_URL = "https://github.com/pavekscb/mee"; 
let currentVersion = chrome.runtime.getManifest().version; 
// ------------------------------------
// проверка обновления
async function checkForUpdate(auto = false) {
    const checkVersionBtn = document.getElementById('checkVersionBtn');
    if (!auto && checkVersionBtn) {
        checkVersionBtn.textContent = "Проверка...";
        checkVersionBtn.disabled = true;
    }
    try {
        const response = await fetch(GITHUB_RELEASES_API);
        if (!response.ok) throw new Error("Ошибка сети");
        const data = await response.json();
        
        // Очищаем тег от букв 'v', оставляем только цифры и точки
        const latestVersion = data.tag_name.replace(/[vV]/g, '');
        
        const updateModal = document.getElementById('updateModal');
        const header = document.getElementById('updateModalHeader');
        const text = document.getElementById('updateModalText');
        const actions = document.getElementById('updateModalActions');
        const closeBtn = document.getElementById('closeUpdateModalBtn');
        const tagSpan = document.getElementById('newVersionTag');

        // Используем функцию сравнения вместо простого !==
        if (isNewer(currentVersion, latestVersion)) {
            if (header) { header.textContent = "🚀 Доступно обновление!"; header.style.color = "#1E90FF"; }
            if (text) text.textContent = `Ваша версия: ${currentVersion}. Новая версия: ${latestVersion}`;
            if (tagSpan) tagSpan.textContent = latestVersion;
            if (actions) actions.style.display = 'flex';
            if (closeBtn) closeBtn.style.display = 'none';
            if (updateModal) updateModal.style.display = 'flex';  // Всегда показываем, если обновление
        } else {
            if (!auto) {  // Для автоматической — не показываем "актуально"
                if (header) { header.textContent = "✅ У вас последняя версия!"; header.style.color = "#4CAF50"; }
                if (text) text.textContent = currentVersion !== latestVersion 
                    ? `Ваша версия V${currentVersion} новее, чем на GitHub (V${latestVersion}).`
                    : `Текущая версия V${currentVersion} является актуальной.`;
                if (actions) actions.style.display = 'none';
                if (closeBtn) closeBtn.style.display = 'block';
                if (updateModal) updateModal.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error(error);
        if (!auto) alert("Не удалось проверить обновление.");
    } finally {
        if (!auto && checkVersionBtn) {
            checkVersionBtn.textContent = "Проверить последнюю версию";
            checkVersionBtn.disabled = false;
        }
    }
}

// -------------

let currentWalletAddress = DEFAULT_EXAMPLE_ADDRESS;
let meeCurrentReward = 0n;
let meeRatePerSec = 0.0;
let meeAccumulatedFloatReward = 0.0;

let aptUsdPrice = null;
let meeUsdPrice = null;
let lastAptBalance = 0;
let lastMeeBalance = 0;

const ANIMATION_FRAMES = ['🌱', '🌿', '💰']; 
let currentFrameIndex = 0;

// Вспомогательная функция для правильного сравнения версий (например, 1.0.3 > 1.0.2)
function isNewer(current, latest) {
    const c = current.split('.').map(Number);
    const l = latest.split('.').map(Number);
    for (let i = 0; i < Math.max(c.length, l.length); i++) {
        const v1 = c[i] || 0;
        const v2 = l[i] || 0;
        if (v2 > v1) return true;  // Версия в облаке выше
        if (v2 < v1) return false; // Ваша версия выше
    }
    return false;
}

// ================ курс apt
async function fetchAptPrice() {
    try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=aptos&vs_currencies=usd");
        const data = await res.json();
        currentAptPrice = data.aptos.usd;
        return data.aptos.usd;
    } catch (e) {
        console.error("APT price error", e);
        return null;
    }
}

// ================ курс mee (через on-chain пул PancakeSwap, как в main.dart)
const MEE_POOL_RESOURCE_URL = "https://fullnode.mainnet.aptoslabs.com/v1/accounts/0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa/resource/" +
    encodeURIComponent("0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa::swap::TokenPairMetadata<0x1::aptos_coin::AptosCoin,0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin>");

async function fetchMeePrice() {
    try {
        const res = await fetch(MEE_POOL_RESOURCE_URL);
        if (!res.ok) throw new Error("Pool fetch failed: " + res.status);
        const data = await res.json();
        const poolData = data.data;
        // balance_x = APT (8 decimals), balance_y = MEE (6 decimals) — точно как в main.dart
        const aptReserveRaw = parseFloat(poolData.balance_x.value);
        const meeReserveRaw = parseFloat(poolData.balance_y.value);
        const aptReserve = aptReserveRaw / 1e8;   // APT decimals = 8
        const meeReserve = meeReserveRaw / 1e6;   // MEE decimals = 6
        if (meeReserve <= 0 || aptReserve <= 0) throw new Error("Zero reserve");
        // Цена MEE в APT = APT_reserve / MEE_reserve (как в main.dart: priceMeeInApt)
        const priceMeeInApt = aptReserve / meeReserve;
        // Цена MEE в USD = priceMeeInApt * priceApt
        const aptPrice = aptUsdPrice || currentAptPrice;
        if (!aptPrice) return null;
        return priceMeeInApt * aptPrice;
    } catch (e) {
        console.error("MEE price error (pool)", e);
        return null;
    }
}

//======== обновление цен (сначала APT, потом MEE — т.к. MEE зависит от aptUsdPrice)
async function updateTokenPrices() {
    const aptPrice = await fetchAptPrice();
    if (aptPrice !== null) {
        aptUsdPrice = aptPrice;
        currentAptPrice = aptPrice;
    }
    const meePrice = await fetchMeePrice();
    if (meePrice !== null) meeUsdPrice = meePrice;
    renderWalletLines();
}

// =======================================================
// === 1. Балансы кошелька ===
// =======================================================

async function fetchWalletCoinBalance(address, coinType) {
    try {
        const url = `${APTOS_LEDGER_URL}/accounts/${address}/balance/${coinType}`;
        const response = await fetch(url);
        if (!response.ok) return 0n;
        const text = await response.text();
        return BigInt(text);
    } catch (e) {
        console.error("Error fetching balance:", e);
        return 0n;
    }
}

async function updateWalletLiquidBalances() {
    try {
        const aptRaw = await fetchWalletCoinBalance(currentWalletAddress, APT_COIN);
        const meeRaw = await fetchWalletCoinBalance(currentWalletAddress, MEE_COIN_T0_T1);
        const megaRaw = await fetchWalletCoinBalance(currentWalletAddress, MEGA_COIN_TYPE);
        lastAptBalance = Number(aptRaw) / 1e8;
        lastMeeBalance = Number(meeRaw) / 1e6;
        lastMegaBalance = Number(megaRaw) / 1e8;
        renderWalletLines();
    } catch (e) {
        console.error("UI Update error:", e);
    }
}

function renderWalletLines() {
    const aptLine = document.getElementById("walletAptLine");
    const meeLine = document.getElementById("walletMeeLine");
    const megaLine = document.getElementById("walletMegaLine");
    
    // Простая проверка: если элементов нет на странице, ничего не делаем
    if (!aptLine || !meeLine || !megaLine) return;

    // 1. Отрисовка APT
    let aptText = `<b>$APT: ${lastAptBalance.toFixed(8)} </b>`;
    if (aptUsdPrice !== null) {
        const aptUsdValue = lastAptBalance * aptUsdPrice;
        aptText += ` <span style="color:#2E8B57">($${aptUsdPrice.toFixed(2)} / <b>$${aptUsdValue.toFixed(2)}</b>)</span>`;
    }
    aptLine.innerHTML = aptText;

    // 2. Отрисовка MEE
    let meeText = `<b>$MEE: ${lastMeeBalance.toFixed(6)} </b>`;
    if (meeUsdPrice !== null) {
        const meeUsdValue = lastMeeBalance * meeUsdPrice;
        meeText += ` <span style="color:#2E8B57">($${meeUsdPrice.toFixed(6)} / <b>$${meeUsdValue.toFixed(4)}</b>)</span>`;
    }
    meeLine.innerHTML = meeText;

    // 3. Отрисовка MEGA (Расчет прямо здесь, чтобы не было ошибок)
    const now = Math.floor(Date.now() / 1000);
    const START_TIME = 1767623400; 
    const END_TIME = 1795075200;   
    const START_PRICE = 100000;    
    const END_PRICE = 10000000;    

    let currentPriceOctas;
    if (now >= END_TIME) currentPriceOctas = END_PRICE;
    else if (now <= START_TIME) currentPriceOctas = START_PRICE;
    else {
        currentPriceOctas = START_PRICE + Math.floor((END_PRICE - START_PRICE) * (now - START_TIME) / (END_TIME - START_TIME));
    }
    
    const megaPriceApt = currentPriceOctas / 100000000;
    let megaText = `<b>$MEGA: ${lastMegaBalance.toFixed(8)} </b>`;
    
    if (aptUsdPrice !== null) {
        const megaUsdPrice = megaPriceApt * aptUsdPrice;
        const totalMegaUsdValue = lastMegaBalance * megaUsdPrice;
        megaText += ` <span style="color:#2E8B57">(${megaPriceApt.toFixed(6) }  / <b>$${totalMegaUsdValue.toFixed(8)}</b>)</span>`;
    }
    megaLine.innerHTML = megaText;
}

// =======================================================
// === 2. Функции расчета и API ===
// =======================================================

function calculateRatePerSecond(stakeData, poolData) {
    const amount = BigInt(stakeData.amount) * RAW_DATA_CORRECTION_FACTOR; 
    if (amount === 0n) return 0.0;
    const tokenPerSecond = BigInt(poolData.token_per_second); 
    const unlockingAmount = BigInt(poolData.unlocking_amount);
    const stakedValue = BigInt(poolData.staked_coins.value);
    const poolTotalAmount = stakedValue - unlockingAmount;
    if (poolTotalAmount <= 0n) return 0.0;
    const RATE_PRECISION = 10n ** 18n; 
    const rateRawBigInt = (tokenPerSecond * amount * RATE_PRECISION) / poolTotalAmount; 
    return (Number(rateRawBigInt) / Number(RATE_PRECISION)) / (10 ** TOKEN_DECIMALS);
}

function generateApiUrls(accountAddress) {
    if (accountAddress.length !== 66 || !accountAddress.startsWith("0x")) return null; 
    const STAKE_RESOURCE_TYPE = `0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5::Staking::StakeInfo<${MEE_COIN_T0_T1},${MEE_COIN_T0_T1}>`;
    const STAKE_API_URL = `${APTOS_LEDGER_URL}/accounts/${accountAddress}/resource/${encodeURIComponent(STAKE_RESOURCE_TYPE)}`;
    const POOL_ADDRESS = "0x482b8d35e320cca4f2d49745a1f702d052aa0366ac88e375c739dc479e81bc98";
    const POOL_RESOURCE_TYPE = `0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5::Staking::PoolInfo<${MEE_COIN_T0_T1},${MEE_COIN_T0_T1}>`;
    const POOL_API_URL = `${APTOS_LEDGER_URL}/accounts/${POOL_ADDRESS}/resource/${encodeURIComponent(POOL_RESOURCE_TYPE)}`;
    return { stakeUrl: STAKE_API_URL, poolUrl: POOL_API_URL };
}

async function fetchData(apiUrl) {
    try {
        const response = await fetch(apiUrl);
        if (response.status === 404) return apiUrl.includes("StakeInfo") ? { amount: "0", reward_amount: "0", reward_debt: "0" } : null;
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error("Fetch error:", error);
        return null;
    }
}

async function fetchLedgerTimestamp() {
    try {
        const response = await fetch(APTOS_LEDGER_URL);
        const data = await response.json();
        return Math.floor(parseInt(data.ledger_timestamp) / 1000000); 
    } catch (e) {
        return null;
    }
}

function calculateStakeReward(stakeData, poolData, currentTime) {
    if (!stakeData || !poolData || currentTime === null) return { stakeBalance: null, totalReward: null };
    const CORRECT_FACTOR = RAW_DATA_CORRECTION_FACTOR;
    const amount = BigInt(stakeData.amount) * CORRECT_FACTOR;
    const rewardAmount = BigInt(stakeData.reward_amount) * CORRECT_FACTOR;
    const rewardDebt = BigInt(stakeData.reward_debt) * CORRECT_FACTOR;
    if (amount === 0n) return { stakeBalance: 0.0, totalReward: 0n };
    const poolTotalAmount = BigInt(poolData.staked_coins.value) - BigInt(poolData.unlocking_amount);
    const passedSeconds = BigInt(currentTime - parseInt(poolData.last_reward_time));
    let rewardPerShare = poolTotalAmount > 0n ? (BigInt(poolData.token_per_second) * passedSeconds * ACC_PRECISION) / poolTotalAmount : 0n;
    const pending = (amount * (BigInt(poolData.acc_reward_per_share) + rewardPerShare) / ACC_PRECISION) - rewardDebt;
    return { stakeBalance: Number(amount) / (10 ** TOKEN_DECIMALS), totalReward: rewardAmount + pending };
}

async function fetchAndCalculateRewards() {
    const urls = generateApiUrls(currentWalletAddress);
    if (!urls) return { meeBalance: null, meeTotalRewardRaw: null, meeRate: 0.0 };
    const currentTime = await fetchLedgerTimestamp();
    const [meeStakeData, meePoolData] = await Promise.all([fetchData(urls.stakeUrl), fetchData(urls.poolUrl)]);
    if (!meeStakeData || !meePoolData || currentTime === null) return { meeBalance: null, meeTotalRewardRaw: null, meeRate: 0.0 };
    const { stakeBalance, totalReward } = calculateStakeReward(meeStakeData, meePoolData, currentTime);
    return { meeBalance: stakeBalance, meeTotalRewardRaw: totalReward, meeRate: calculateRatePerSecond(meeStakeData, meePoolData) };
}

function loadWalletAddress() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['walletAddress'], (result) => {
            currentWalletAddress = result.walletAddress && result.walletAddress.startsWith("0x") ? result.walletAddress : DEFAULT_EXAMPLE_ADDRESS;
            resolve(currentWalletAddress);
        });
    });
}

function saveWalletAddress(address) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ walletAddress: address }, () => {
            currentWalletAddress = address;
            resolve();
        });
    });
}

function formatMeeValue(rawValue) {
    const divisor = 10n ** BigInt(TOKEN_DECIMALS);
    const integerPart = rawValue / divisor;
    let fractionalStr = (rawValue % divisor).toString().padStart(TOKEN_DECIMALS, '0');
    return `${integerPart.toLocaleString('ru-RU').replace(/\s/g, ' ')},${fractionalStr}`;
}

function updateLabels(results) {
    const { meeBalance, meeTotalRewardRaw, meeRate } = results;
    const walletLabel = document.getElementById('walletAddressDisplay');
    const balanceLabel = document.getElementById('meeBalance');
    const rewardLabel = document.getElementById('meeReward');
    const rateLabel = document.getElementById('meeRateLabel');
    const tickerLabel = document.getElementById('rewardTicker'); 

    if (walletLabel) {
        const displayAddress = currentWalletAddress === DEFAULT_EXAMPLE_ADDRESS 
            ? `${currentWalletAddress.substring(0, 6)}... (ПРИМЕР) `
            : `${currentWalletAddress.substring(0, 6)}...${currentWalletAddress.substring(currentWalletAddress.length - 4)}`;
        walletLabel.textContent = `Кошелек: ${displayAddress}`;
        walletLabel.style.color = currentWalletAddress === DEFAULT_EXAMPLE_ADDRESS ? 'darkorange' : 'purple';
    }
    
    if (meeBalance === null) {
        if (balanceLabel) balanceLabel.textContent = 'Ошибка!';
        return;
    }
    
    meeCurrentReward = meeTotalRewardRaw;
    meeRatePerSec = meeRate; 
    meeAccumulatedFloatReward = 0.0;
    
    let usdText = "";
    if (meeUsdPrice !== null) {
        const usdValue = meeBalance * meeUsdPrice;
        usdText = ` <span style="color:#228B22">($${usdValue.toFixed(2)})</span>`;
    }

    if (balanceLabel) {
        balanceLabel.innerHTML = meeBalance.toLocaleString('ru-RU', { minimumFractionDigits: 8 })
            .replace(/\s/g, ' ').replace('.', ',') + ' $MEE' + usdText;
    }

    if (rewardLabel) {
        const rewardFloat = Number(meeCurrentReward) / (10 ** TOKEN_DECIMALS);
        const rewardUsd = meeUsdPrice ? ` <span style="color:#2E8B57; font-size:0.9em;">($${(rewardFloat * meeUsdPrice).toFixed(8)})</span>` : "";
        rewardLabel.innerHTML = formatMeeValue(meeCurrentReward) + ' $MEE' + rewardUsd;
    }
    if (rateLabel) rateLabel.textContent = `Скорость: ${meeRatePerSec.toFixed(12).replace('.', ',')} MEE/сек`;
    if (tickerLabel) tickerLabel.textContent = ANIMATION_FRAMES[currentFrameIndex];

    if (!window.simulationInterval) startSimulation();
    window.updateTimeout = setTimeout(runUpdateCycle, UPDATE_INTERVAL_SECONDS * 1000);
}

function startSimulation() {
    if (window.simulationInterval) return; 
    window.simulationInterval = setInterval(() => {
        meeAccumulatedFloatReward += meeRatePerSec; 
        let addedRewardRaw = 0n;
        while (meeAccumulatedFloatReward >= MEE_PER_RAW_UNIT) {
            meeAccumulatedFloatReward -= MEE_PER_RAW_UNIT;
            addedRewardRaw += RAW_UNIT;
        }
        meeCurrentReward += addedRewardRaw; 
        const rewardLabel = document.getElementById('meeReward');
        const tickerLabel = document.getElementById('rewardTicker');
        if (rewardLabel) {
            const rewardFloat = Number(meeCurrentReward) / (10 ** TOKEN_DECIMALS);
            const rewardUsd = meeUsdPrice ? ` <span style="color:#2E8B57; font-size:0.9em;">($${(rewardFloat * meeUsdPrice).toFixed(8)})</span>` : "";
            rewardLabel.innerHTML = formatMeeValue(meeCurrentReward) + ' $MEE' + rewardUsd;
        }
        currentFrameIndex = (currentFrameIndex + 1) % ANIMATION_FRAMES.length;
        if (tickerLabel) tickerLabel.textContent = ANIMATION_FRAMES[currentFrameIndex];
    }, 1000); 
}

function stopSimulationAndTimers() {
    if (window.simulationInterval) { clearInterval(window.simulationInterval); window.simulationInterval = null; }
    if (window.updateTimeout) { clearTimeout(window.updateTimeout); window.updateTimeout = null; }
}

function handleSaveWallet() {
    const input = document.getElementById('newWalletInput');
    if (!input) return;
    const trimmedAddress = input.value.trim();
    if (trimmedAddress.length === 66 && trimmedAddress.startsWith("0x")) {
        document.getElementById('modalOverlay').style.display = 'none';
        saveWalletAddress(trimmedAddress).then(() => {
            stopSimulationAndTimers();
            runUpdateCycle();
        });
    } else { alert("Неверный адрес"); }
}

async function runUpdateCycle() {
    stopSimulationAndTimers(); 
    updateWalletLiquidBalances(); 
    await updateTokenPrices();  
    const results = await fetchAndCalculateRewards();
    updateLabels(results);
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadWalletAddress();





   // Открытие окна справки $MEGA
const megaInfoBtn = document.getElementById('megaMiningInfoBtn');
if (megaInfoBtn) {
    megaInfoBtn.addEventListener('click', () => {
        document.getElementById('megaMiningInfoModal').style.display = 'flex';
    });
}

// Закрытие окна справки $MEGA
const closeMegaBtn = document.getElementById('closeMegaInfo');
if (closeMegaBtn) {
    closeMegaBtn.addEventListener('click', () => {
        document.getElementById('megaMiningInfoModal').style.display = 'none';
    });
}




    // --- БЕЗОПАСНАЯ ПРИВЯЗКА СОБЫТИЙ ---
    const addEvent = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    addEvent('miningInfoBtn', 'click', () => { document.getElementById('miningInfoModal').style.display = 'flex'; });
    addEvent('closeMiningInfo', 'click', () => { document.getElementById('miningInfoModal').style.display = 'none'; });

    addEvent('aboutProjectBtn', 'click', () => { document.getElementById('aboutProjectModal').style.display = 'flex'; });
    addEvent('closeAboutProject', 'click', () => { document.getElementById('aboutProjectModal').style.display = 'none'; });

    addEvent('editWalletBtn', 'click', () => {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('newWalletInput').value = currentWalletAddress;
    });
    addEvent('saveNewWalletBtn', 'click', handleSaveWallet);
    addEvent('cancelNewWalletBtn', 'click', () => document.getElementById('modalOverlay').style.display = 'none');
    
    addEvent('addMeeBtn', 'click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        document.getElementById('stakeModal').style.display = 'flex';
    });
    addEvent('harvestBtn', 'click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        document.getElementById('harvestModal').style.display = 'flex';
    });
    addEvent('unstakeBtn', 'click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        document.getElementById('unstakeModal').style.display = 'flex';
    });

    // Логика для крестика очистки
    const walletInput = document.getElementById('newWalletInput');
    const clearBtn = document.getElementById('clearWalletInput');

    if (walletInput && clearBtn) {
        walletInput.addEventListener('input', () => {
            clearBtn.style.display = walletInput.value.length > 0 ? 'block' : 'none';
        });

        clearBtn.addEventListener('click', () => {
            walletInput.value = '';
            clearBtn.style.display = 'none';
            walletInput.focus();
        });

        addEvent('editWalletBtn', 'click', () => {
            clearBtn.style.display = walletInput.value.length > 0 ? 'block' : 'none';
        });
    }

    // --- ИСПРАВЛЕННЫЙ ЦИКЛ LINK MAP ---
    const linkMap = {
        'linkSourceBtn': URL_SOURCE, 'linkSiteBtn': URL_SITE, 'linkGraphBtn': URL_GRAPH,
        'linkSwapBtn': URL_SWAP, 'linkSwapEarniumBtn': URL_SWAP_EARNIUM, 'linkSupportBtn': URL_SUPPORT
    };
    Object.keys(linkMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => chrome.tabs.create({ url: linkMap[id] }));
        }
    });

    addEvent('copyContractBtn', 'click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        alert("Скопировано!");
    });

    addEvent('proceedHarvestModalBtn', 'click', () => chrome.tabs.create({ url: HARVEST_BASE_URL }));
    addEvent('proceedStakeModalBtn', 'click', () => chrome.tabs.create({ url: ADD_MEE_URL }));
    addEvent('closeUnstakeModalBtn', 'click', () => chrome.tabs.create({ url: UNSTAKE_BASE_URL }));

    ['cancelHarvestModalBtn', 'cancelStakeModalBtn', 'cancelUnstakeModalBtn'].forEach(id => {
        addEvent(id, 'click', (e) => e.target.closest('div[id$="Modal"]').style.display = 'none');
    });

    // --- ЛОГИКА ПРОВЕРКИ ВЕРСИИ (УЛУЧШЕННАЯ) ---
    const checkVersionBtn = document.getElementById('checkVersionBtn');
if (checkVersionBtn) {
    checkVersionBtn.addEventListener('click', () => checkForUpdate(false));
}

    addEvent('closeUpdateModalBtn', 'click', () => { document.getElementById('updateModal').style.display = 'none'; });
    addEvent('cancelUpdateModalBtn', 'click', () => { document.getElementById('updateModal').style.display = 'none'; });
    addEvent('downloadUpdateBtn', 'click', () => {
        chrome.tabs.create({ url: GITHUB_REPO_URL + "/releases/latest" });
        document.getElementById('updateModal').style.display = 'none';
    });

    addEvent('openMeeSwap', 'click', () => {
        chrome.tabs.create({ url: "https://app.panora.exchange/?ref=V94RDWEH#/swap/aptos?pair=MEE-APT" });
    });

    // --- НОВАЯ ЛОГИКА ДЛЯ MEGA COIN & GTA 6 ---
const MEGA_HARVEST_URL = "https://explorer.aptoslabs.com/account/0x350f1f65a2559ad37f95b8ba7c64a97c23118856ed960335fce4cd222d5577d3/modules/run/mega_coin/harvest?network=mainnet";
const START_TIME = 1767623400; // 5 Jan 2026
const END_TIME = 1795075200;   // 19 Nov 2026
const START_PRICE = 100000;    // 0.001 APT (in Octas)
const END_PRICE = 10000000;    // 0.1 APT (in Octas)

function updateMegaUI() {
    const now = Math.floor(Date.now() / 1000);
    
    // 1. Расчет цены
    let currentPriceOctas;
    if (now >= END_TIME) currentPriceOctas = END_PRICE;
    else if (now <= START_TIME) currentPriceOctas = START_PRICE;
    else {
        currentPriceOctas = START_PRICE + Math.floor((END_PRICE - START_PRICE) * (now - START_TIME) / (END_TIME - START_TIME));
    }
    const priceDisplay = (currentPriceOctas / 100000000).toFixed(6);
    const priceElem = document.getElementById('dynamicPrice');
    if (priceElem) priceElem.textContent = priceDisplay;

    // 2. Таймер
    const diff = END_TIME - now;
    if (diff > 0) {
        const d = Math.floor(diff / 86400);
        const h = Math.floor((diff % 86400) / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        const timerElem = document.getElementById('megaTimer');
        if (timerElem) timerElem.textContent = `${d}д : ${h}ч : ${m}м : ${s}с`;
    }

    renderWalletLines();
    
}

function drawSmallChart(now) {
    const canvas = document.getElementById('priceChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0e14'; 
    ctx.fillRect(0, 0, w, h);

    const paddingX = 45; 
    const bottomPadding = 25;
    const chartWidth = w - (paddingX * 2);
    const chartHeight = h - bottomPadding;

    // 1. Сетка (тусклая)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        let x = paddingX + (chartWidth / 4) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, chartHeight); ctx.stroke();
        let y = (chartHeight / 4) * i;
        ctx.beginPath(); ctx.moveTo(paddingX, y); ctx.lineTo(w - paddingX, y); ctx.stroke();
    }

    // 2. Расчет прогресса
    const realProgress = Math.min(Math.max((now - START_TIME) / (END_TIME - START_TIME), 0), 1);
    
    // Двигаем комету от реальной цены до конца
    if (cometProgress < realProgress || cometProgress >= 1) {
        cometProgress = realProgress;
    }
    cometProgress += 0.003; // Скорость кометы (можно менять)

    const getX = (p) => paddingX + (chartWidth * p);
    const getY = (p) => (chartHeight * 0.9) - (chartHeight * 0.8 * p);

    // 3. Линия графика (основная траектория)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
    ctx.setLineDash([5, 5]); // Делаем её пунктирной для стиля
    ctx.beginPath();
    ctx.moveTo(paddingX, chartHeight * 0.9);
    ctx.lineTo(paddingX + chartWidth, chartHeight * 0.1);
    ctx.stroke();
    ctx.setLineDash([]); // Сброс пунктира

    // 4. ЭФФЕКТ КОМЕТЫ (Шлейф)
    const gradient = ctx.createLinearGradient(getX(realProgress), getY(realProgress), getX(cometProgress), getY(cometProgress));
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0, 255, 204, 0.4)');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(getX(realProgress), getY(realProgress));
    ctx.lineTo(getX(cometProgress), getY(cometProgress));
    ctx.stroke();

    // 5. Летящая голова кометы (Импульс)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffcc';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(getX(cometProgress), getY(cometProgress), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. Реальная точка цены (Пульсирующая)
    const pulse = Math.sin(Date.now() / 300) * 2;
    ctx.shadowBlur = 10 + pulse;
    ctx.shadowColor = '#00ffcc';
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(getX(realProgress), getY(realProgress), 5 + pulse/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Цена над реальной точкой
    const realPrice = (0.001 + (0.1 - 0.001) * realProgress).toFixed(6);
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(realPrice + " APT", getX(realProgress), getY(realProgress) - 15);

    // 7. Месяцы (внизу)
    const months = ['Янв', 'Мар', 'Май', 'Июл', 'Сен', 'Ноя'];
    ctx.fillStyle = '#666'; ctx.font = '10px Arial';
    for (let i = 0; i < months.length; i++) {
        let x = paddingX + (chartWidth / (months.length - 1)) * i;
        ctx.fillText(months[i], x, h - 5);
    }
}

// Запуск таймера обновления
setInterval(updateMegaUI, 1000);

// Обработчики кнопок
addEvent('gtaBannerBtn', 'click', () => {
    const modal = document.getElementById('gtaModal');
    if (modal) {
        modal.style.display = 'flex';
        updateMegaUI();
    }
});

addEvent('proceedGtaBtn', 'click', () => {
    chrome.tabs.create({ url: MEGA_HARVEST_URL });
});

addEvent('cancelGtaBtn', 'click', () => {
    document.getElementById('gtaModal').style.display = 'none';
});

// Функция для плавной анимации (60 кадров в секунду)
function animate() {
    const now = Date.now() / 1000;
    drawSmallChart(now);
    requestAnimationFrame(animate); // Зацикливаем перерисовку
}

// Запускаем анимацию сразу после загрузки
animate();
runUpdateCycle();
checkForUpdate(true);  // Автоматическая проверка при запуске
});


///////////////// MEGA 


// --- MEGA FIXED LOGIC (SINC WITH LEDGER) ---

const MEGA_POOL_ADDRESS = "0x350f1f65a2559ad37f95b8ba7c64a97c23118856ed960335fce4cd222d5577d3";
const MEGA_STAKING_MODULE = `${MEGA_POOL_ADDRESS}::mega_coin`;
const MEGA_STAKE_RESOURCE = `${MEGA_STAKING_MODULE}::StakePosition`; 
let megaUnlockTime = 0n;

const MEGA_APY = 15n; 
const SECONDS_IN_YEAR = 31536000n;

let megaCurrentReward = 0n;
let megaStakedAmountRaw = 0n;
let megaLastUpdate = 0n;
let megaNetworkTimeOffset = 0n; // Разница между временем ПК и временем сети

// ←─────── ДОБАВЛЕНО ────────
let lastMegaRewardUsd = 0;     // глобальная переменная для хранения USD наград

// Функция для создания "зеленого" текста долларов
function formatUsdGreen(amount, decimals = 2) {
    // Используем переданное количество знаков (decimals)
    return ` <span style="color: #228B22; font-weight: bold;">($${amount.toFixed(decimals)})</span>`;
}

async function runMegaUpdateCycle() {
    try {
        const stakeUrl = `${APTOS_LEDGER_URL}/accounts/${currentWalletAddress}/resource/${encodeURIComponent(MEGA_STAKE_RESOURCE)}`;
        
        const [ledgerRes, stakeRes] = await Promise.all([
            fetch(APTOS_LEDGER_URL).then(r => r.json()).catch(() => null),
            fetch(stakeUrl).then(r => r.ok ? r.json() : null).catch(() => null)
        ]);

        // КОРРЕКЦИЯ ВРЕМЕНИ СЕТИ (НОВОЕ: рассчитываем offset на основе ledger_timestamp)
        if (ledgerRes && ledgerRes.ledger_timestamp) {
            const ledgerTimeSec = BigInt(Math.floor(parseInt(ledgerRes.ledger_timestamp) / 1000000)); // микросекунды -> секунды
            const localTimeSec = BigInt(Math.floor(Date.now() / 1000));
            megaNetworkTimeOffset = ledgerTimeSec - localTimeSec; // Может быть положительным или отрицательным
        }

        if (stakeRes && stakeRes.data) {
            // 1. Считываем данные из блокчейна
            megaStakedAmountRaw = BigInt(stakeRes.data.amount || 0);
            megaLastUpdate = BigInt(stakeRes.data.last_update || 0);
            megaUnlockTime = BigInt(stakeRes.data.unlock_time || 0);
            
            // Сбрасываем локальную награду, так как при stake_all она ушла в тело стейка (amount)
            megaCurrentReward = 0n; 
            
            const minedMega = Number(megaStakedAmountRaw) / 100000000; // Майнинг (22)
            const walletMega = lastMegaBalance || 0;                   // Кошелек (1)
            const totalMega = minedMega + walletMega;                  // Итого (23)

            const megaBalanceLabel = document.getElementById('megaBalance');
            if (megaBalanceLabel) {
                const START_TIME = 1767623400;
                const END_TIME = 1795075200;
                const now = Math.floor(Date.now() / 1000);
                const progress = Math.max(0, Math.min(1, (now - START_TIME) / (END_TIME - START_TIME)));
                const priceInApt = 0.001 + (0.1 - 0.001) * progress;
                const aptPrice = currentAptPrice || 0;

                // Вывод: Майнинг / В кошельке
                let balanceHtml = `<span title="В процессе майнинга">${minedMega.toFixed(8).replace('.', ',')} $MEGA</span>`;
                // balanceHtml += ` <span style="color: #888; font-size: 0.8em; font-weight: normal;"> <p> В кошельке: ${walletMega.toFixed(6).replace('.', ',')} </p></span> $MEGA`;
                

                // USD считаем от общей суммы (23)
                if (aptPrice > 0) {
                    const totalUsd = totalMega * priceInApt * aptPrice;
                    balanceHtml += formatUsdGreen(totalUsd);
                }
                megaBalanceLabel.innerHTML = balanceHtml;
            }

            // 2. Сразу запускаем локальный расчет награды от новых данных
            calculateMegaRewardLocally();
        }
    } catch (e) {
        console.error("MEGA Sync Error:", e);
    }
    // 3. Обновляем все надписи и таймеры
    updateMegaLabels();
    if (typeof updateMegaUnlockTimer === 'function') updateMegaUnlockTimer();
}


function updateMegaUnlockTimer() {
    const row = document.getElementById('megaUnlockRow');
    const timerDisplay = document.getElementById('megaUnlockTimer');
    const timerContainer = document.getElementById('megaUnlockTimerContainer');
    const confirmBtn = document.getElementById('confirmUnstakeBtn');
    
    // Если анстейк не заказан (unlock_time === 0), скрываем весь блок
    if (!row || !timerDisplay || !confirmBtn || megaUnlockTime === 0n) {
        if (row) row.style.display = 'none';
        return;
    }

    const nowSynced = BigInt(Math.floor(Date.now() / 1000)) + megaNetworkTimeOffset;
    const timeLeft = megaUnlockTime - nowSynced;

    // Показываем блок, так как вывод заказан
    row.style.display = 'block';

    if (timeLeft > 0n) {
        // --- ВРЕМЯ ЕЩЕ ИДЕТ ---
        timerContainer.style.display = 'block';
        
        // Делаем кнопку "мертвой"
        confirmBtn.disabled = true;
        confirmBtn.style.backgroundColor = "#cccccc"; // Серый цвет
        confirmBtn.style.color = "#666666";
        confirmBtn.style.cursor = "not-allowed";
        confirmBtn.textContent = "ЗАВЕРШИТЬ ВЫВОД $MEGA";

        // Обновляем цифры таймера
        const days = timeLeft / 86400n;
        const hours = (timeLeft % 86400n) / 3600n;
        const minutes = (timeLeft % 3600n) / 60n;
        const seconds = timeLeft % 60n;
        let timeStr = days > 0n ? `${days}д ` : "";
        timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.textContent = timeStr;

    } else {
        // --- ВРЕМЯ ВЫШЛО! ---
        timerContainer.style.display = 'none'; // Скрываем текст таймера
        
        // Активируем кнопку
        confirmBtn.disabled = false;
        confirmBtn.style.backgroundColor = "#FF5722"; // Оранжевый (активный)
        confirmBtn.style.color = "white";
        confirmBtn.style.cursor = "pointer";
        confirmBtn.textContent = "ПОДТВЕРДИТЬ ВЫВОД $MEGA";
    }
}


function updateMegaLabels() {
    const rewardLabel = document.getElementById('megaRewardDisplay');
    const usdLabel = document.getElementById('megaRewardUsd');
    const priceLabel = document.getElementById('megaCurrentPriceLabel'); // Новый элемент
    const rateLabel = document.getElementById('megaRateLabel');
    
    // Расчет прогресса и цены в APT
    const START_TIME = 1767623400;
    const END_TIME = 1795075200;
    const now = Math.floor(Date.now() / 1000);
    const progress = Math.max(0, Math.min(1, (now - START_TIME) / (END_TIME - START_TIME)));
    const priceInApt = 0.001 + (0.1 - 0.001) * progress;

    // 1. Обновляем награду (монеты)
    if (rewardLabel) {
        rewardLabel.textContent = formatMeeValue(megaCurrentReward) + " $MEGA";
    }

    // 2. Обновляем доллары награды (в скобках, зеленым)
    if (usdLabel && typeof currentAptPrice !== 'undefined' && currentAptPrice > 0) {
        const rewardNum = Number(megaCurrentReward) / 100000000;
        const rewardUsd = rewardNum * priceInApt * currentAptPrice;
        usdLabel.innerHTML = formatUsdGreen(rewardUsd, 8);
    }

    // 3. ОБНОВЛЯЕМ ТЕКУЩИЙ КУРС (новая строка)
    if (priceLabel && typeof currentAptPrice !== 'undefined' && currentAptPrice > 0) {
        const priceInUsd = priceInApt * currentAptPrice;
        // Выводим: 0,0032 APT ($0,0057)
        // priceLabel.innerHTML = `${priceInApt.toFixed(6).replace('.', ',')} APT <span style="color: #228B22; font-weight: bold;">($${priceInUsd.toFixed(4)})</span>`;
    }

    if (rateLabel && megaStakedAmountRaw > 0n) {
        const rate = (Number(megaStakedAmountRaw) * 15) / (31536000 * 100 * 100000000);
        rateLabel.textContent = `Доходность: 15% APR (${rate.toFixed(10).replace('.', ',')} $MEGA / сек)`;
    }
}

const END_TIME_BIGINT = 1795075200n;


function calculateMegaRewardLocally() {
    // Если стейка нет или мы только что обновились (текущее время == время обновления), награда 0
    if (megaStakedAmountRaw === 0n || megaLastUpdate === 0n) {
        megaCurrentReward = 0n;
        return;
    }

    const nowSynced = BigInt(Math.floor(Date.now() / 1000)) + megaNetworkTimeOffset;
    
    // Проверка на unlock_time > 0 или если время не прошло — reward = 0, как в контракте
    if (megaUnlockTime > 0n || nowSynced <= megaLastUpdate) {
        megaCurrentReward = 0n;
        return;
    }

    const duration = nowSynced - megaLastUpdate;
    // Считаем награду ТОЛЬКО за время, прошедшее с момента последнего last_update в блокчейне
    megaCurrentReward = (megaStakedAmountRaw * MEGA_APY * duration) / (SECONDS_IN_YEAR * 100n);
}

function startMegaSimulation() {
    if (window.megaSimInterval) return;

    window.megaSimInterval = setInterval(() => {
        if (megaStakedAmountRaw > 0n) {
            calculateMegaRewardLocally();
            updateMegaLabels();
            updateMegaUnlockTimer();

            const ticker = document.getElementById('megaRewardTicker');
            if (ticker) {
                ticker.textContent =
                    Math.floor(Date.now() / 500) % 2 === 0 ? '💎' : '✨';
            }
        }
    }, 1000);
}

function initMegaButtons() {
    const actions = {
        'addMegaBtn': `stake_all`,
        'harvestMegaBtn': `claim_staking_rewards`,
        'harvest10MegaBtn': `harvest10`, 
        'harvest100MegaBtn': `harvest100`, 
        'unstakeMegaBtn': `unstake_request`,
        'confirmUnstakeBtn': `unstake_confirm`,
        'cancelUnstakeMegaBtn': `cancel_unstake`
    };

    Object.entries(actions).forEach(([id, funcName]) => {
        const btn = document.getElementById(id);
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(MEGA_COIN_TYPE);
                window.open(`https://explorer.aptoslabs.com/account/${MEGA_POOL_ADDRESS}/modules/run/mega_coin/${funcName}?network=mainnet`, '_blank');
            });
        }
    });
}

// Запуск
initMegaButtons();
startMegaSimulation();
setInterval(runMegaUpdateCycle, 20000);
setTimeout(runMegaUpdateCycle, 500);


// ==========================================
// === БИРЖА ЗАДАНИЙ MEGA (только просмотр) ===
// ==========================================

const EXCHANGE_CONTRACT = "0x350f1f65a2559ad37f95b8ba7c64a97c23118856ed960335fce4cd222d5577d3";
const APTOS_VIEW_URL = "https://fullnode.mainnet.aptoslabs.com/v1/view";

// Превращает текст с URL в HTML с кликабельными ссылками (открываются в новой вкладке)
function linkifyText(text) {
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    return text.replace(urlRegex, (url) => {
        // Обрезаем трейлинг пунктуацию
        let clean = url.replace(/[.,!?)]+$/, '');
        const trail = url.slice(clean.length);
        const short = clean.length > 40 ? clean.slice(0, 37) + '...' : clean;
        return `<a href="${clean}" target="_blank" rel="noopener noreferrer"
            style="color:#1565C0; word-break:break-all; font-size:0.85em;"
            onclick="event.stopPropagation(); chrome.tabs.create({url:'${clean}'}); event.preventDefault();"
            >${short}</a>${trail}`;
    });
}

async function fetchExchangeTasks() {
    const list = document.getElementById('exchangeTaskList');
    const statsEl = document.getElementById('exchangeStats');
    if (!list) return;

    list.innerHTML = '<p style="text-align:center; color:#888;">⏳ Загрузка заданий...</p>';
    if (statsEl) statsEl.textContent = '';

    try {
        const [resV2, resStatusV2, resV3] = await Promise.all([
            fetch(APTOS_VIEW_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ function: `${EXCHANGE_CONTRACT}::mega_tasks::get_all_tasks_v2`, type_arguments: [], arguments: [] })
            }),
            fetch(APTOS_VIEW_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ function: `${EXCHANGE_CONTRACT}::mega_tasks::get_all_task_statuses`, type_arguments: [], arguments: [] })
            }),
            fetch(APTOS_VIEW_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ function: `${EXCHANGE_CONTRACT}::mega_tasks::get_all_tasks_v3`, type_arguments: [], arguments: [] })
            })
        ]);

        const dataV2 = resV2.ok ? await resV2.json() : [[]];
        const dataStatusV2 = resStatusV2.ok ? await resStatusV2.json() : [[]];
        const dataV3 = resV3.ok ? await resV3.json() : [[]];

        const rawV2 = (dataV2[0]) || [];
        const rawStatuses = (dataStatusV2[0]) || [];
        const rawV3 = (dataV3[0]) || [];

        // Парсим статусы V2
        let statusList = [];
        if (typeof rawStatuses === 'string') {
            const hexStr = rawStatuses.startsWith('0x') ? rawStatuses.slice(2) : rawStatuses;
            for (let i = 0; i < hexStr.length; i += 2) statusList.push(parseInt(hexStr.slice(i, i+2), 16));
        } else if (Array.isArray(rawStatuses)) {
            statusList = rawStatuses.map(Number);
        }

        const allTasks = [];
        let totalPoolApt = 0;

        // V2 задания
        rawV2.forEach((task, i) => {
            const status = (i < statusList.length) ? statusList[i] : 0;
            const rewardApt = parseInt(task.reward_per_claim_apt || 0) / 1e8;
            const remaining = parseInt(task.remaining_claims || 0);
            // Считаем весь пул APT (все задания, не только активные)
            totalPoolApt += rewardApt * remaining;
            if (status === 1) {
                allTasks.push({
                    id: task.id,
                    description: task.description || '',
                    reward: rewardApt.toFixed(4),
                    remaining,
                    total: parseInt(task.total_claims || 0),
                    expires: parseInt(task.expires_at || 0),
                    version: 'v2',
                    status
                });
            }
        });

        // V3 задания — получаем статусы
        for (const raw of rawV3) {
            let taskStatus = 0;
            try {
                const sr = await fetch(APTOS_VIEW_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ function: `${EXCHANGE_CONTRACT}::mega_tasks::get_task_status`, type_arguments: [], arguments: [raw.id.toString()] })
                });
                if (sr.ok) { const sd = await sr.json(); taskStatus = (sd[0]) || 0; }
            } catch(e) {}

            const rewardApt = parseInt(raw.reward_per_claim_apt || 0) / 1e8;
            const remaining = parseInt(raw.remaining_claims || 0);
            totalPoolApt += rewardApt * remaining;

            if (taskStatus === 1) {
                allTasks.push({
                    id: raw.id,
                    description: raw.description || '',
                    reward: rewardApt.toFixed(4),
                    remaining,
                    total: parseInt(raw.total_claims || 0),
                    expires: parseInt(raw.expires_at || 0),
                    version: 'v3',
                    status: taskStatus
                });
            }
        }

        // Сортировка: новые сверху
        allTasks.sort((a, b) => parseInt(b.id) - parseInt(a.id));

        // Статистика пула
        if (statsEl) {
            const activeCount = allTasks.length;
            const totalCount = rawV2.length + rawV3.length;
            statsEl.innerHTML = `<span style="color:#555;">Всего заданий: <b>${totalCount}</b> &nbsp;|&nbsp; Активных: <b style="color:#2E7D32">${activeCount}</b> &nbsp;|&nbsp; Пул: <b style="color:#e07000">${totalPoolApt.toFixed(4)} APT</b></span>`;
        }

        if (allTasks.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#888; padding: 20px;">📭 Нет активных заданий</p>';
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        list.innerHTML = allTasks.map(task => {
            const expired = task.expires > 0 && now > task.expires;
            const noSlots = task.remaining === 0;
            const inactive = expired || noSlots;
            const expDate = task.expires > 0 ? new Date(task.expires * 1000).toLocaleDateString('ru-RU') : '∞';
            const aptStr = parseFloat(task.reward) > 0 ? `💰 ${task.reward} APT` : '';
            const bgColor = inactive ? '#f5f5f5' : '#f0fff0';
            const borderColor = inactive ? '#ddd' : '#4CAF50';
            const descHtml = linkifyText(task.description);
            return `
            <div style="border:1px solid ${borderColor}; border-radius:6px; padding:10px; margin-bottom:10px; background:${bgColor}; opacity:${inactive ? 0.65 : 1}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.8em; color:#888;">#${task.id} · ${task.version.toUpperCase()}</span>
                    <span style="font-size:0.95em; font-weight:bold; color:#2E7D32;">${aptStr}</span>
                </div>
                <div style="margin:0 0 7px 0; font-size:0.97em; line-height:1.6; word-break:break-word;">${descHtml}</div>
                <div style="font-size:0.82em; color:#555; display:flex; justify-content:space-between; margin-top:5px;">
                    <span>Мест: <b>${task.remaining}/${task.total}</b></span>
                    <span>До: ${expDate}</span>
                </div>
                ${inactive ? `<div style="font-size:0.82em; color:#c62828; margin-top:4px; font-weight:bold;">${expired ? '⏰ Срок истёк' : '🚫 Мест нет'}</div>` : ''}
            </div>`;
        }).join('');

    } catch(e) {
        console.error('Exchange fetch error', e);
        list.innerHTML = '<p style="text-align:center; color:red; padding: 20px;">❌ Ошибка загрузки заданий</p>';
    }
}

// Инициализация кнопки Биржа
document.addEventListener('DOMContentLoaded', () => {
    const exchangeBtn = document.getElementById('exchangeBtn');
    const exchangePanel = document.getElementById('exchangePanel');
    const closeExchangeBtn = document.getElementById('closeExchangeBtn');
    const refreshExchangeBtn = document.getElementById('refreshExchangeBtn');

    if (exchangeBtn && exchangePanel) {
        exchangeBtn.addEventListener('click', () => {
            const isVisible = exchangePanel.style.display !== 'none';
            exchangePanel.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) fetchExchangeTasks();
        });
    }
    if (closeExchangeBtn) {
        closeExchangeBtn.addEventListener('click', () => {
            if (exchangePanel) exchangePanel.style.display = 'none';
        });
    }
    if (refreshExchangeBtn) {
        refreshExchangeBtn.addEventListener('click', fetchExchangeTasks);
    }
});

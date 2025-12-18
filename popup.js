// --- КОНСТАНТЫ ---
const DEFAULT_EXAMPLE_ADDRESS = "0x9ba27fc8a65ba4507fc4cca1b456e119e4730b8d8cfaf72a2a486e6d0825b27b";
const MEE_COIN_T0_T1 = "0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin";
const APT_COIN = "0x1::aptos_coin::AptosCoin";

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
const URL_GRAPH = "https://dexscreener.com/aptos/pcs-167";
const URL_SWAP = "https://aptos.pancakeswap.finance/swap?outputCurrency=0x1%3A%3Aaptos_coin%3A%3AAptosCoin&inputCurrency=0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9%3A%3Amee_coin%3A%3AMeeCoin";
const URL_SWAP_EARNIUM = "https://app.panora.exchange/swap/aptos?pair=MEE-APT";
const URL_SUPPORT = "https://t.me/cripto_karta";

// --- КОНСТАНТЫ: ПРОВЕРКА ВЕРСИИ ---
const GITHUB_RELEASES_API = "https://api.github.com/repos/pavekscb/mee/releases/latest";
const GITHUB_REPO_URL = "https://github.com/pavekscb/mee"; 
let currentVersion = chrome.runtime.getManifest().version; 
// ------------------------------------


let currentWalletAddress = DEFAULT_EXAMPLE_ADDRESS;
let meeCurrentReward = 0n;
let meeRatePerSec = 0.0;
let meeAccumulatedFloatReward = 0.0;

const ANIMATION_FRAMES = ['🌱', '🌿', '💰']; 
let currentFrameIndex = 0;

// =======================================================
// === 1. Балансы кошелька (из Python) ===
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

        const apt = Number(aptRaw) / 1e8; // APT = 8 decimals
        const mee = Number(meeRaw) / 1e6; // MEE = 6 decimals (переносим запятую на 2 знака влево относительно APT)

        document.getElementById('walletAptBalance').textContent = apt.toFixed(8);
        document.getElementById('walletMeeBalance').textContent = mee.toFixed(6);
    } catch (e) {
        console.error("UI Update error:", e);
    }
}

// =======================================================
// === 2. Функции расчета и API (Без изменений) ===
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

    const displayAddress = currentWalletAddress === DEFAULT_EXAMPLE_ADDRESS 
        ? `${currentWalletAddress.substring(0, 6)}... (ПРИМЕР)`
        : `${currentWalletAddress.substring(0, 6)}...${currentWalletAddress.substring(currentWalletAddress.length - 4)}`;
    walletLabel.textContent = `Кошелек: ${displayAddress}`;
    walletLabel.style.color = currentWalletAddress === DEFAULT_EXAMPLE_ADDRESS ? 'darkorange' : 'purple';
    
    if (meeBalance === null) {
        balanceLabel.textContent = 'Ошибка!';
        return;
    }
    
    meeCurrentReward = meeTotalRewardRaw;
    meeRatePerSec = meeRate; 
    meeAccumulatedFloatReward = 0.0;
    
    balanceLabel.textContent = meeBalance.toLocaleString('ru-RU', { minimumFractionDigits: 8 }).replace(/\s/g, ' ').replace('.', ',') + ' $MEE';
    rewardLabel.textContent = formatMeeValue(meeCurrentReward) + ' $MEE';
    rateLabel.textContent = `Скорость: ${meeRatePerSec.toFixed(12).replace('.', ',')} MEE/сек`;
    tickerLabel.textContent = ANIMATION_FRAMES[currentFrameIndex];

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
        document.getElementById('meeReward').textContent = formatMeeValue(meeCurrentReward) + ' $MEE';
        currentFrameIndex = (currentFrameIndex + 1) % ANIMATION_FRAMES.length;
        document.getElementById('rewardTicker').textContent = ANIMATION_FRAMES[currentFrameIndex];
    }, 1000); 
}

function stopSimulationAndTimers() {
    if (window.simulationInterval) { clearInterval(window.simulationInterval); window.simulationInterval = null; }
    if (window.updateTimeout) { clearTimeout(window.updateTimeout); window.updateTimeout = null; }
}

function handleSaveWallet() {
    const trimmedAddress = document.getElementById('newWalletInput').value.trim();
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
    const results = await fetchAndCalculateRewards();
    updateLabels(results);
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadWalletAddress();
    document.getElementById('meeContractValue').textContent = MEE_COIN_T0_T1;
    
    document.getElementById('editWalletBtn').addEventListener('click', () => {
        document.getElementById('modalOverlay').style.display = 'flex';
        document.getElementById('newWalletInput').value = currentWalletAddress;
    });
    document.getElementById('saveNewWalletBtn').addEventListener('click', handleSaveWallet);
    document.getElementById('cancelNewWalletBtn').addEventListener('click', () => document.getElementById('modalOverlay').style.display = 'none');
    
    document.getElementById('addMeeBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        document.getElementById('stakeModal').style.display = 'flex';
    });
    document.getElementById('harvestBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        document.getElementById('harvestModal').style.display = 'flex';
    });
    document.getElementById('unstakeBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        document.getElementById('unstakeModal').style.display = 'flex';
    });

    const linkMap = {
        'linkSourceBtn': URL_SOURCE, 'linkSiteBtn': URL_SITE, 'linkGraphBtn': URL_GRAPH,
        'linkSwapBtn': URL_SWAP, 'linkSwapEarniumBtn': URL_SWAP_EARNIUM, 'linkSupportBtn': URL_SUPPORT
    };
    Object.keys(linkMap).forEach(id => {
        document.getElementById(id).addEventListener('click', () => chrome.tabs.create({ url: linkMap[id] }));
    });

    document.getElementById('copyContractBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1);
        alert("Скопировано!");
    });

    document.getElementById('proceedHarvestModalBtn').addEventListener('click', () => chrome.tabs.create({ url: HARVEST_BASE_URL }));
    document.getElementById('proceedStakeModalBtn').addEventListener('click', () => chrome.tabs.create({ url: ADD_MEE_URL }));
    document.getElementById('closeUnstakeModalBtn').addEventListener('click', () => chrome.tabs.create({ url: UNSTAKE_BASE_URL }));
    ['cancelHarvestModalBtn', 'cancelStakeModalBtn', 'cancelUnstakeModalBtn'].forEach(id => {
        document.getElementById(id).addEventListener('click', (e) => e.target.closest('div[id$=\"Modal\"]').style.display = 'none');
    });

// --- ЛОГИКА ПРОВЕРКИ ВЕРСИИ ---
    const checkVersionBtn = document.getElementById('checkVersionBtn');
    const updateModal = document.getElementById('updateModal');
    const updateModalHeader = document.getElementById('updateModalHeader');
    const updateModalText = document.getElementById('updateModalText');
    const updateModalActions = document.getElementById('updateModalActions');
    const closeUpdateModalBtn = document.getElementById('closeUpdateModalBtn');
    const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
    const cancelUpdateModalBtn = document.getElementById('cancelUpdateModalBtn');
    const newVersionTagSpan = document.getElementById('newVersionTag');

    checkVersionBtn.addEventListener('click', async () => {
        checkVersionBtn.textContent = "Проверка...";
        checkVersionBtn.disabled = true;

        try {
            const response = await fetch(GITHUB_RELEASES_API);
            if (!response.ok) throw new Error("Ошибка сети");
            
            const data = await response.json();
            const latestVersion = data.tag_name.replace('v', '').replace('V', ''); // Убираем 'v' если есть
            
            updateModal.style.display = 'flex';

            // Сравниваем версии
            if (latestVersion !== currentVersion) {
                updateModalHeader.textContent = "🚀 Доступно обновление!";
                updateModalHeader.style.color = "#1E90FF";
                updateModalText.textContent = `Ваша версия: ${currentVersion}. Новая версия: ${latestVersion}`;
                newVersionTagSpan.textContent = latestVersion;
                
                updateModalActions.style.display = 'flex';
                closeUpdateModalBtn.style.display = 'none';
            } else {
                updateModalHeader.textContent = "✅ У вас последняя версия!";
                updateModalHeader.style.color = "#4CAF50";
                updateModalText.textContent = `Текущая версия V${currentVersion} является актуальной.`;
                
                updateModalActions.style.display = 'none';
                closeUpdateModalBtn.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            alert("Не удалось проверить обновление. Проверьте соединение или GitHub API.");
        } finally {
            checkVersionBtn.textContent = "Проверить последнюю версию";
            checkVersionBtn.disabled = false;
        }
    });

    // Обработка кнопок в модальном окне
    closeUpdateModalBtn.addEventListener('click', () => updateModal.style.display = 'none');
    cancelUpdateModalBtn.addEventListener('click', () => updateModal.style.display = 'none');
    downloadUpdateBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: GITHUB_REPO_URL + "/releases/latest" });
        updateModal.style.display = 'none';
    });




    runUpdateCycle();
});

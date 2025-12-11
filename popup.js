// --- КОНСТАНТЫ ---
const DEFAULT_EXAMPLE_ADDRESS = "0x9ba27fc8a65ba4507fc4cca1b456e119e4730b8d8cfaf72a2a486e6d0825b27b";
const MEE_COIN_T0_T1 = "0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin";
const UPDATE_INTERVAL_SECONDS = 60;
const TOKEN_DECIMALS = 8; // Единая точность для расчетов и отображения (8 знаков)
const RAW_DATA_CORRECTION_FACTOR = 100n; // Коэффициент для коррекции скейлинга данных из API (10^6 -> 10^8)
const ACC_PRECISION = 100000000000n; // 10^11
const RAW_UNIT = 1n; // Минимальная единица BigInt (10^-8 MEE)
const MEE_PER_RAW_UNIT = 1 / (10 ** TOKEN_DECIMALS); // 10^-8 MEE (Минимальное значение для float)
const HARVEST_BASE_URL = "https://explorer.aptoslabs.com/account/0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5/modules/run/Staking/harvest?network=mainnet";
const ADD_MEE_URL = "https://explorer.aptoslabs.com/account/0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5/modules/run/Staking/stake?network=mainnet";
const UNSTAKE_BASE_URL = "https://explorer.aptoslabs.com/account/0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5/modules/run/Staking/unstake?network=mainnet";
const APTOS_LEDGER_URL = "https://fullnode.mainnet.aptoslabs.com/v1";

// КОНСТАНТЫ: Ссылки для кнопок
const URL_SOURCE = "https://github.com/pavekscb/mee"; // НОВАЯ ССЫЛКА
const URL_SITE = "https://meeiro.xyz/staking";
const URL_GRAPH = "https://dexscreener.com/aptos/pcs-167";
const URL_SWAP = "https://aptos.pancakeswap.finance/swap?outputCurrency=0x1%3A%3Aaptos_coin%3A%3AAptosCoin&inputCurrency=0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9%3A%3Amee_coin%3A%3AMeeCoin";
const URL_SUPPORT = "https://t.me/cripto_karta";

let currentWalletAddress = DEFAULT_EXAMPLE_ADDRESS;
let meeCurrentReward = 0n;
let meeRatePerSec = 0.0;
let lastUpdateTime = 0;
let meeAccumulatedFloatReward = 0.0;

// =======================================================
// === 1. Функции для Aptos API (без изменений) ===
// =======================================================

function generateApiUrls(accountAddress) {
    if (accountAddress.length !== 66 || !accountAddress.startsWith("0x")) {
        return null; 
    }
    
    const STAKE_RESOURCE_TYPE = "0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5::Staking::StakeInfo<0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin,0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin>";
    const STAKE_API_URL = `${APTOS_LEDGER_URL}/accounts/${accountAddress}/resource/${encodeURIComponent(STAKE_RESOURCE_TYPE)}`;

    const POOL_ADDRESS = "0x482b8d35e320cca4f2d49745a1f702d052aa0366ac88e375c739dc479e81bc98";
    const POOL_RESOURCE_TYPE = "0x514cfb77665f99a2e4c65a5614039c66d13e00e98daf4c86305651d29fd953e5::Staking::PoolInfo<0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin,0xe9c192ff55cffab3963c695cff6dbf9dad6aff2bb5ac19a6415cad26a81860d9::mee_coin::MeeCoin>";
    const POOL_API_URL = `${APTOS_LEDGER_URL}/accounts/${POOL_ADDRESS}/resource/${encodeURIComponent(POOL_RESOURCE_TYPE)}`;

    return { stakeUrl: STAKE_API_URL, poolUrl: POOL_API_URL };
}

async function fetchData(apiUrl) {
    try {
        const response = await fetch(apiUrl, { timeout: 5000 });
        if (response.status === 404) {
            if (apiUrl.includes("StakeInfo")) {
                return { amount: "0", reward_amount: "0", reward_debt: "0" };
            }
            return null; 
        }
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error("Fetch error:", error);
        return null;
    }
}

async function fetchLedgerTimestamp() {
    try {
        const response = await fetch(APTOS_LEDGER_URL, { timeout: 5000 });
        const data = await response.json();
        return Math.floor(parseInt(data.ledger_timestamp) / 1000000); 
    } catch (e) {
        console.error("Error fetching timestamp:", e);
        return null;
    }
}


// =======================================================
// === 2. Функции расчетов (без изменений) ===
// =======================================================

function calculateRatePerSecond(stakeData, poolData) {
    const amount = BigInt(stakeData.amount) * RAW_DATA_CORRECTION_FACTOR; 
    if (amount === 0n) return 0.0;

    const tokenPerSecond = BigInt(poolData.token_per_second); 
    const unlockingAmount = BigInt(poolData.unlocking_amount);
    const stakedValue = BigInt(poolData.staked_coins.value);
    
    const poolTotalAmount = stakedValue - unlockingAmount;
    
    if (poolTotalAmount <= 0n) return 0.0;
        
    const rateRaw = (Number(tokenPerSecond) * Number(amount)) / Number(poolTotalAmount);
    const rateMee = rateRaw / (10 ** TOKEN_DECIMALS); 
    
    return rateMee * 100.0; 
}


function calculateStakeReward(stakeData, poolData, currentTime) {
    if (!stakeData || !poolData || currentTime === null) {
        return { stakeBalance: null, totalReward: null };
    }
    
    const CORRECT_FACTOR = RAW_DATA_CORRECTION_FACTOR;

    const amount = BigInt(stakeData.amount) * CORRECT_FACTOR;
    const rewardAmount = BigInt(stakeData.reward_amount) * CORRECT_FACTOR;
    const rewardDebt = BigInt(stakeData.reward_debt) * CORRECT_FACTOR;
    
    if (amount === 0n) {
        return { stakeBalance: 0.0, totalReward: 0n };
    }

    const accRewardPerShare = BigInt(poolData.acc_reward_per_share);
    const tokenPerSecond = BigInt(poolData.token_per_second);
    const lastRewardTime = parseInt(poolData.last_reward_time);
    const unlockingAmount = BigInt(poolData.unlocking_amount);
    const stakedValue = BigInt(poolData.staked_coins.value);
    
    const poolTotalAmount = stakedValue - unlockingAmount;
    const passedSeconds = BigInt(currentTime - lastRewardTime);
    
    let rewardPerShare = 0n;
    if (poolTotalAmount > 0n && passedSeconds > 0n) {
        rewardPerShare = (tokenPerSecond * passedSeconds * ACC_PRECISION) / poolTotalAmount;
    }
    
    const newAcc = accRewardPerShare + rewardPerShare;
    const pending = (amount * newAcc / ACC_PRECISION) - rewardDebt;
    const totalRewardRaw = rewardAmount + pending;
    
    const stakeBalance = Number(amount) / (10 ** TOKEN_DECIMALS); 
    
    return { stakeBalance: stakeBalance, totalReward: totalRewardRaw };
}


async function fetchAndCalculateRewards() {
    const urls = generateApiUrls(currentWalletAddress);
    if (!urls) return { meeBalance: null, meeTotalRewardRaw: null, meeRate: 0.0 };
    
    const currentTime = await fetchLedgerTimestamp();

    const [meeStakeData, meePoolData] = await Promise.all([
        fetchData(urls.stakeUrl),
        fetchData(urls.poolUrl)
    ]);
    
    if (!meeStakeData || !meePoolData || currentTime === null) {
        return { meeBalance: null, meeTotalRewardRaw: null, meeRate: 0.0 };
    }

    const { stakeBalance, totalReward } = calculateStakeReward(
        meeStakeData, meePoolData, currentTime
    );
    
    const meeRate = calculateRatePerSecond(meeStakeData, meePoolData);

    return { meeBalance: stakeBalance, meeTotalRewardRaw: totalReward, meeRate: meeRate };
}


// =======================================================
// === 3. Функции для GUI и Chrome Storage (без изменений) ===
// =======================================================

function loadWalletAddress() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['walletAddress'], (result) => {
            let address = result.walletAddress;
            if (!address || address.length !== 66 || !address.startsWith("0x")) {
                address = DEFAULT_EXAMPLE_ADDRESS;
            }
            currentWalletAddress = address;
            resolve(address);
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
    let fractionalPart = rawValue % divisor;
    
    let fractionalStr = fractionalPart.toString().padStart(TOKEN_DECIMALS, '0');
    
    return `${integerPart.toLocaleString('ru-RU')},${fractionalStr}`;
}

function updateLabels(results) {
    const { meeBalance, meeTotalRewardRaw, meeRate } = results;
    
    const walletLabel = document.getElementById('walletAddressDisplay');
    const balanceLabel = document.getElementById('meeBalance');
    const rewardLabel = document.getElementById('meeReward');

    const displayAddress = currentWalletAddress === DEFAULT_EXAMPLE_ADDRESS 
        ? `${currentWalletAddress.substring(0, 6)}...${currentWalletAddress.substring(currentWalletAddress.length - 4)} (ПРИМЕР)`
        : `${currentWalletAddress.substring(0, 6)}...${currentWalletAddress.substring(currentWalletAddress.length - 4)}`;
    walletLabel.textContent = `Кошелек: ${displayAddress}`;
    walletLabel.style.color = currentWalletAddress === DEFAULT_EXAMPLE_ADDRESS ? 'darkorange' : 'purple';
    
    if (meeBalance === null || meeTotalRewardRaw === null) {
        balanceLabel.textContent = 'Ошибка! Проверьте адрес или сеть.';
        rewardLabel.textContent = 'Ошибка! Проверьте адрес или сеть.';
        balanceLabel.style.color = 'red';
        rewardLabel.style.color = 'red';
        return;
    }
    
    meeCurrentReward = meeTotalRewardRaw;
    meeRatePerSec = meeRate; 
    lastUpdateTime = Date.now(); 

    meeAccumulatedFloatReward = 0.0;
    
    const balanceStr = meeBalance.toLocaleString('ru-RU', { 
        minimumFractionDigits: TOKEN_DECIMALS, 
        maximumFractionDigits: TOKEN_DECIMALS
    });
    balanceLabel.textContent = balanceStr + ' $MEE';
    balanceLabel.style.color = 'black';
    
    rewardLabel.textContent = formatMeeValue(meeCurrentReward) + ' $MEE';
    rewardLabel.style.color = 'green';
    
    if (!window.simulationInterval) {
        startSimulation();
    }
    
    window.updateTimeout = setTimeout(runUpdateCycle, UPDATE_INTERVAL_SECONDS * 1000);
}


// =======================================================
// === 4. Симуляция роста награды (без изменений) ===
// =======================================================

function startSimulation() {
    if (window.simulationInterval) return; 

    window.simulationInterval = setInterval(() => {
        const rateMeePerSec = meeRatePerSec / 100;
        
        meeAccumulatedFloatReward += rateMeePerSec; 

        let addedRewardRaw = 0n;
        
        while (meeAccumulatedFloatReward >= MEE_PER_RAW_UNIT) {
            meeAccumulatedFloatReward -= MEE_PER_RAW_UNIT;
            addedRewardRaw += RAW_UNIT;
        }

        meeCurrentReward += addedRewardRaw; 
        
        const rewardLabel = document.getElementById('meeReward');
        rewardLabel.textContent = formatMeeValue(meeCurrentReward) + ' $MEE';
        
    }, 1000); 
}

function stopSimulationAndTimers() {
    if (window.simulationInterval) {
        clearInterval(window.simulationInterval);
        window.simulationInterval = null; 
    }
    if (window.updateTimeout) {
        clearTimeout(window.updateTimeout);
        window.updateTimeout = null;
    }
}

function resetSimulationState() {
    meeCurrentReward = 0n; 
    meeRatePerSec = 0.0;
    lastUpdateTime = 0; 
    meeAccumulatedFloatReward = 0.0;
}


// =======================================================
// === 5. Функции обработчиков (С ИЗМЕНЕНИЯМИ) ===
// =======================================================

function openEditWalletDialog() {
    document.getElementById('modalOverlay').style.display = 'flex';
    document.getElementById('newWalletInput').value = currentWalletAddress;
    document.getElementById('newWalletInput').focus();
    document.getElementById('newWalletInput').select();
}

function handleSaveWallet() {
    const newAddress = document.getElementById('newWalletInput').value;
    const trimmedAddress = newAddress.trim();

    if (trimmedAddress.length === 66 && trimmedAddress.startsWith("0x")) {
        document.getElementById('modalOverlay').style.display = 'none';

        saveWalletAddress(trimmedAddress).then(() => {
            
            stopSimulationAndTimers();
            resetSimulationState(); 
            
            const displayAddress = `${trimmedAddress.substring(0, 6)}...${trimmedAddress.substring(trimmedAddress.length - 4)}`;
            document.getElementById('walletAddressDisplay').textContent = `Кошелек: ${displayAddress}`;
            alert("Адрес кошелька обновлен и сохранен. Обновление данных...");
            
            runUpdateCycle();
        }).catch(e => {
            alert(`Ошибка сохранения: ${e}`);
        });
    } else {
        alert("Неверный формат адреса кошелька (должен быть 66 символов и начинаться с 0x).");
    }
}

function harvestAndCopy() {
    navigator.clipboard.writeText(MEE_COIN_T0_T1).then(() => {
        document.getElementById('harvestModal').style.display = 'flex';
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        alert('Не удалось скопировать контракт. Пожалуйста, скопируйте его вручную. Открывается страница Harvest.');
        chrome.tabs.create({ url: HARVEST_BASE_URL });
    });
}


function addMeeStake() {
    navigator.clipboard.writeText(MEE_COIN_T0_T1).then(() => {
        document.getElementById('stakeModal').style.display = 'flex';
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        alert('Не удалось скопировать контракт. Пожалуйста, скопируйте его вручную. Открывается страница Stake.');
        chrome.tabs.create({ url: ADD_MEE_URL });
    });
}

function unstakeMee() {
    navigator.clipboard.writeText(MEE_COIN_T0_T1).then(() => {
        document.getElementById('unstakeModal').style.display = 'flex';
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        alert('Не удалось скопировать контракт. Пожалуйста, скопируйте его вручную. Открывается страница Unstake.');
        chrome.tabs.create({ url: UNSTAKE_BASE_URL });
    });
}

// ФУНКЦИЯ: Обработчик для открытия ссылок
function openLink(url) {
    chrome.tabs.create({ url: url });
}


async function runUpdateCycle() {
    stopSimulationAndTimers(); 
    
    const results = await fetchAndCalculateRewards();
    updateLabels(results);
}

/**
 * Инициализация при загрузке Popup.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Загрузка адреса и установка начального вида
    await loadWalletAddress();
    
    // Отображение контракта
    document.getElementById('meeContractValue').textContent = MEE_COIN_T0_T1;
    
    // Установка обработчиков кнопок
    document.getElementById('editWalletBtn').addEventListener('click', openEditWalletDialog);
    document.getElementById('addMeeBtn').addEventListener('click', addMeeStake);
    document.getElementById('harvestBtn').addEventListener('click', harvestAndCopy);
    document.getElementById('unstakeBtn').addEventListener('click', unstakeMee); 
    
    document.getElementById('copyContractBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(MEE_COIN_T0_T1).then(() => {
            alert("Контракт $MEE скопирован!");
        });
    });

    // ОБРАБОТЧИКИ: Кнопки-ссылки
    document.getElementById('linkSourceBtn').addEventListener('click', () => openLink(URL_SOURCE)); // НОВЫЙ ОБРАБОТЧИК
    document.getElementById('linkSiteBtn').addEventListener('click', () => openLink(URL_SITE));
    document.getElementById('linkGraphBtn').addEventListener('click', () => openLink(URL_GRAPH));
    document.getElementById('linkSwapBtn').addEventListener('click', () => openLink(URL_SWAP));
    document.getElementById('linkSupportBtn').addEventListener('click', () => openLink(URL_SUPPORT));


    // Обработчики для модальных окон (остаются без изменений)
    document.getElementById('saveNewWalletBtn').addEventListener('click', handleSaveWallet);
    document.getElementById('cancelNewWalletBtn').addEventListener('click', () => {
        document.getElementById('modalOverlay').style.display = 'none';
    });
    
    document.getElementById('proceedHarvestModalBtn').addEventListener('click', () => {
        document.getElementById('harvestModal').style.display = 'none';
        chrome.tabs.create({ url: HARVEST_BASE_URL }); 
    });
    document.getElementById('cancelHarvestModalBtn').addEventListener('click', () => {
        document.getElementById('harvestModal').style.display = 'none';
    });

    document.getElementById('proceedStakeModalBtn').addEventListener('click', () => {
        document.getElementById('stakeModal').style.display = 'none';
        chrome.tabs.create({ url: ADD_MEE_URL }); 
    });
    document.getElementById('cancelStakeModalBtn').addEventListener('click', () => {
        document.getElementById('stakeModal').style.display = 'none';
    });

    document.getElementById('closeUnstakeModalBtn').addEventListener('click', () => {
        document.getElementById('unstakeModal').style.display = 'none';
        chrome.tabs.create({ url: UNSTAKE_BASE_URL }); 
    });
    document.getElementById('cancelUnstakeModalBtn').addEventListener('click', () => {
        document.getElementById('unstakeModal').style.display = 'none';
    });


    // Первый запуск цикла обновления
    runUpdateCycle();
});

// Очистка при закрытии окна (важно для производительности)
window.addEventListener('unload', () => {
    stopSimulationAndTimers();
});

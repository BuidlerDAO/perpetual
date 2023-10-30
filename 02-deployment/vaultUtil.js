const { deployContract } = require("../shared/helpers");
const { utils } = require("ethers");

const errors = [
  "Vault: zero error", // 0
  "Vault: already initialized", // 1
  "Vault: invalid _maxLeverage", // 2
  "Vault: invalid _taxBasisPoints", // 3
  "Vault: invalid _stableTaxBasisPoints", // 4
  "Vault: invalid _mintBurnFeeBasisPoints", // 5
  "Vault: invalid _swapFeeBasisPoints", // 6
  "Vault: invalid _stableSwapFeeBasisPoints", // 7
  "Vault: invalid _marginFeeBasisPoints", // 8
  "Vault: invalid _liquidationFeeUsd", // 9
  "Vault: invalid _fundingInterval", // 10
  "Vault: invalid _fundingRateFactor", // 11
  "Vault: invalid _stableFundingRateFactor", // 12
  "Vault: token not whitelisted", // 13
  "Vault: _token not whitelisted", // 14
  "Vault: invalid tokenAmount", // 15
  "Vault: _token not whitelisted", // 16
  "Vault: invalid tokenAmount", // 17
  "Vault: invalid usdgAmount", // 18
  "Vault: _token not whitelisted", // 19
  "Vault: invalid usdgAmount", // 20
  "Vault: invalid redemptionAmount", // 21
  "Vault: invalid amountOut", // 22
  "Vault: swaps not enabled", // 23
  "Vault: _tokenIn not whitelisted", // 24
  "Vault: _tokenOut not whitelisted", // 25
  "Vault: invalid tokens", // 26
  "Vault: invalid amountIn", // 27
  "Vault: leverage not enabled", //28
  "Vault: insufficient collateral for fees", // 29
  "Vault: invalid position.size", // 30
  "Vault: empty position31", // 31
  "Vault: position size exceeded", // 32
  "Vault: position collateral exceeded", // 33
  "Vault: invalid liquidator", // 34
  "Vault: empty position", // 35
  "Vault: position cannot be liquidated", // 36
  "Vault: invalid position", // 37
  "Vault: invalid _averagePrice", // 38
  "Vault: collateral should be withdrawn", // 39
  "Vault: _size must be more than _collateral", // 40
  "Vault: invalid msg.sender", // 41
  "Vault: mismatched tokens", // 42
  "Vault: _collateralToken not whitelisted", // 43
  "Vault: _collateralToken must not be a stableToken", // 44
  "Vault: _collateralToken not whitelisted", // 45
  "Vault: _collateralToken must be a stableToken", // 46
  "Vault: _indexToken must not be a stableToken", // 47
  "Vault: _indexToken not shortable", // 48
  "Vault: invalid increase", // 49
  "Vault: reserve exceeds pool", // 50
  "Vault: max USDG exceeded", // 51
  "Vault: reserve exceeds pool", // 52
  "Vault: forbidden53", // 53
  "Vault: forbidden", // 54
  "Vault: maxGasPrice exceeded", // 55
];

async function initVaultErrors(vault) {
  const vaultErrorController = await deployContract("VaultErrorController", []);
  await vault.setErrorController(vaultErrorController.address);
  await vaultErrorController.setErrors(vault.address, errors);
  return vaultErrorController;
}

async function initVaultUtils(vault) {
  const vaultUtils = await deployContract("VaultUtils", [vault.address]);
  await vault.setVaultUtils(vaultUtils.address);
  return vaultUtils;
}

async function initVault(vault, router, usdg, priceFeed) {
  await vault.initialize(
    router.address, // router
    usdg.address, // usdg
    priceFeed.address, // priceFeed
    utils.parseUnits("5", 30), // liquidationFeeUsd
    600, // fundingRateFactor
    600 // stableFundingRateFactor
  );

  const vaultUtils = await initVaultUtils(vault);
  const vaultErrorController = await initVaultErrors(vault);

  return { vault, vaultUtils, vaultErrorController };
}

async function validateVaultBalance(expect, vault, token, offset) {
  if (!offset) {
    offset = 0;
  }
  const poolAmount = await vault.poolAmounts(token.address);
  const feeReserve = await vault.feeReserves(token.address);
  const balance = await token.balanceOf(vault.address);
  let amount = poolAmount.add(feeReserve);
  expect(balance).gt(0);
  expect(poolAmount.add(feeReserve).add(offset)).eq(balance);
}

function getBnbConfig(bnb) {
  return [
    bnb.address, // _token
    18, // _tokenDecimals
    10000, // _tokenWeight
    75, // _minProfitBps,
    0, // _maxUsdgAmount
    false, // _isStable
    true, // _isShortable
  ];
}

function getEthConfig(eth) {
  return [
    eth.address, // _token
    18, // _tokenDecimals
    10000, // _tokenWeight
    75, // _minProfitBps
    0, // _maxUsdgAmount
    false, // _isStable
    true, // _isShortable
  ];
}

function getBtcConfig(btc) {
  return [
    btc.address, // _token
    18, // _tokenDecimals
    10000, // _tokenWeight
    75, // _minProfitBps
    0, // _maxUsdgAmount
    false, // _isStable
    true, // _isShortable
  ];
}

function getBusdConfig(dai) {
  return [
    dai.address, // _token
    18, // _tokenDecimals
    10000, // _tokenWeight
    75, // _minProfitBps
    0, // _maxUsdgAmount
    true, // _isStable
    false, // _isShortable
  ];
}

module.exports = {
  errors,
  initVault,
  validateVaultBalance,
  getBnbConfig,
  getBtcConfig,
  getEthConfig,
  getBusdConfig,
};

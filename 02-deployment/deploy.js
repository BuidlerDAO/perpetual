const { deployContract } = require("./helpers")
const {
  initVault,
  getBtcConfig,
  getEthConfig,
  getBnbConfig,
  getBusdConfig,
} = require("./vaultUtil")
const {
  mockTokenAndPriceFeed,
  mockInitLP,
  mockExecutePosition,
  mockExecutePositionsBot,
} = require("./mockEnv")
const { utils, constants } = require("ethers")
const { expect } = require("chai")

async function main() {
  const [signer, positionKeeper, fastPriceFeedUpdater] =
    await ethers.getSigners()

  // alias function
  const parseUnits = utils.parseUnits
  const parseEther = utils.parseEther
  const formatEther = utils.formatEther

  // constants
  const maxUint256 = constants.MaxUint256

  // constants
  const depositFee = 50
  const minExecutionFee = 4000
  const priceDecimals = 8 // oracle price decimal
  const tokenManager = signer

  const {
    bnb,
    bnbPriceFeed,
    btc,
    btcPriceFeed,
    eth,
    ethPriceFeed,
    busd,
    busdPriceFeed,
  } = await mockTokenAndPriceFeed()

  const vault = await deployContract("Vault")
  const vaultReader = await deployContract("VaultReader")

  const glp = await deployContract("GLP")

  const usdg = await deployContract("USDG", [vault.address])

  const router = await deployContract("Router", [
    vault.address,
    usdg.address,
    bnb.address,
  ])

  const positionRouter = await deployContract("PositionRouter", [
    vault.address,
    router.address,
    bnb.address,
    depositFee,
    minExecutionFee,
  ])
  const referralStorage = await deployContract("ReferralStorage")
  const vaultPriceFeed = await deployContract("VaultPriceFeed")
  await positionRouter.setReferralStorage(referralStorage.address)
  await referralStorage.setHandler(positionRouter.address, true)
  const glpManager = await deployContract("GlpManager", [
    vault.address,
    usdg.address,
    glp.address,
    24 * 60 * 60,
  ])

  const timelock = await deployContract("Timelock", [
    signer.address, // admin
    5 * 24 * 60 * 60, // buffer
    tokenManager.address, // tokenManager
    signer.address, // mintReceiver
    glpManager.address, // glpManager
    parseUnits("1000"), // maxTokenSupply
    10, // marginFeeBasisPoints 0.1%
    500, // maxMarginFeeBasisPoints 5%
  ])

  await initVault(vault, router, usdg, vaultPriceFeed)

  await glp.setMinter(glpManager.address, true)

  distributor0 = await deployContract("TimeDistributor")
  yieldTracker0 = await deployContract("YieldTracker", [usdg.address])

  await yieldTracker0.setDistributor(distributor0.address)
  await distributor0.setDistribution(
    [yieldTracker0.address],
    [1000],
    [bnb.address]
  )

  await bnb.mint(distributor0.address, 5000)
  await usdg.setYieldTrackers([yieldTracker0.address])

  const reader = await deployContract("Reader")

  await vaultPriceFeed.setTokenConfig(
    bnb.address, // token
    bnbPriceFeed.address, // priceFeed
    priceDecimals, // priceDecimals
    false // isStrictStable
  )
  await vaultPriceFeed.setTokenConfig(
    btc.address,
    btcPriceFeed.address,
    priceDecimals,
    false
  )
  await vaultPriceFeed.setTokenConfig(
    eth.address,
    ethPriceFeed.address,
    priceDecimals,
    false
  )

  await vaultPriceFeed.setTokenConfig(
    busd.address,
    busdPriceFeed.address,
    priceDecimals,
    true
  )

  // mock price
  await btcPriceFeed.setLatestAnswer(parseUnits("20000", priceDecimals))
  await vault.setTokenConfig(...getBtcConfig(btc))

  await bnbPriceFeed.setLatestAnswer(parseUnits("300", priceDecimals))
  await vault.setTokenConfig(...getBnbConfig(bnb))

  await ethPriceFeed.setLatestAnswer(parseUnits("2000", priceDecimals))
  await vault.setTokenConfig(...getEthConfig(eth))

  await busdPriceFeed.setLatestAnswer(parseUnits("1", priceDecimals))
  await vault.setTokenConfig(...getBusdConfig(busd))

  await vault.setIsLeverageEnabled(false)
  await vault.setGov(timelock.address)

  const fastPriceEvents = await deployContract("FastPriceEvents")
  const fastPriceFeed = await deployContract("FastPriceFeed", [
    5 * 60, // _priceDuration
    120 * 60, // _maxPriceUpdateDelay
    2, // _minBlockInterval
    250, // _maxDeviationBasisPoints
    fastPriceEvents.address, // _fastPriceEvents
    tokenManager.address, // _tokenManager
    positionRouter.address, // _positionRouter
  ])
  await fastPriceFeed.initialize(
    2, // minAuthorizations
    [signer.address], //signers
    [fastPriceFeedUpdater.address] //updaters
  )

  await fastPriceEvents.setIsPriceFeed(fastPriceFeed.address, true)
  await fastPriceFeed.setVaultPriceFeed(vaultPriceFeed.address)
  await vaultPriceFeed.setSecondaryPriceFeed(fastPriceFeed.address)
  // ----------------------------gmx and glp------------------------------------
  const gmx = await deployContract("GMX")
  const esGmx = await deployContract("EsGMX", [], "ES_GMX")
  const bnGmx = await deployContract(
    "MintableBaseToken",
    ["Bonus GMX", "bnGMX", 0],
    "BN_GMX"
  )

  const stakedGmxTracker = await deployContract(
    "RewardTracker",
    ["Staked GMX", "sGMX"],
    "StakedGmxTracker"
  )

  const stakedGmxDistributor = await deployContract(
    "RewardDistributor",
    [esGmx.address, stakedGmxTracker.address],
    "StakedGmxDistributor"
  )

  await stakedGmxTracker.initialize(
    [gmx.address, esGmx.address],
    stakedGmxDistributor.address
  )
  await stakedGmxDistributor.updateLastDistributionTime()

  const bonusGmxTracker = await deployContract(
    "RewardTracker",
    ["Staked + Bonus GMX", "sbGMX"],
    "BonusGmxTracker"
  )
  bonusGmxDistributor = await deployContract(
    "BonusDistributor",
    [bnGmx.address, bonusGmxTracker.address],
    "BonusGmxDistributor"
  )
  await bonusGmxTracker.initialize(
    [stakedGmxTracker.address],
    bonusGmxDistributor.address
  )
  await bonusGmxDistributor.updateLastDistributionTime()

  const feeGmxTracker = await deployContract(
    "RewardTracker",
    ["Staked + Bonus + Fee GMX", "sbfGMX"],
    "FeeGmxTracker"
  )
  let feeGmxDistributor = await deployContract(
    "RewardDistributor",
    [eth.address, feeGmxTracker.address],
    "FeeGmxDistributor"
  )
  await feeGmxTracker.initialize(
    [bonusGmxTracker.address, bnGmx.address],
    feeGmxDistributor.address
  )
  await feeGmxDistributor.updateLastDistributionTime()

  const feeGlpTracker = await deployContract(
    "RewardTracker",
    ["Fee GLP", "fGLP"],
    "FeeGlpTracker"
  )
  await glp.connect(signer).approve(feeGlpTracker.address, maxUint256)

  const feeGlpDistributor = await deployContract(
    "RewardDistributor",
    [eth.address, feeGlpTracker.address],
    "FeeGlpDistributor"
  )
  await feeGlpTracker.initialize([glp.address], feeGlpDistributor.address)

  await feeGlpDistributor.updateLastDistributionTime()

  const stakedGlpTracker = await deployContract(
    "RewardTracker",
    ["Fee + Staked GLP", "fsGLP"],
    "StakedGlpTracker"
  )
  await feeGlpTracker.setHandler(stakedGlpTracker.address, true)

  await feeGlpTracker
    .connect(signer)
    .approve(stakedGlpTracker.address, maxUint256)

  await feeGlpTracker
    .connect(signer)
    .approve(stakedGlpTracker.address, maxUint256)

  const stakedGlpDistributor = await deployContract(
    "RewardDistributor",
    [esGmx.address, stakedGlpTracker.address],
    "StakedGlpDistributor"
  )
  await stakedGlpTracker.initialize(
    [feeGlpTracker.address],
    stakedGlpDistributor.address
  )
  await stakedGlpDistributor.updateLastDistributionTime()

  await stakedGmxTracker.setInPrivateTransferMode(true)
  await stakedGmxTracker.setInPrivateStakingMode(true)
  await bonusGmxTracker.setInPrivateTransferMode(true)
  await bonusGmxTracker.setInPrivateStakingMode(true)
  await bonusGmxTracker.setInPrivateClaimingMode(true)
  await feeGmxTracker.setInPrivateTransferMode(true)
  await feeGmxTracker.setInPrivateStakingMode(true)

  await feeGlpTracker.setInPrivateTransferMode(true)
  await feeGlpTracker.setInPrivateStakingMode(true)
  await stakedGlpTracker.setInPrivateTransferMode(true)
  await stakedGlpTracker.setInPrivateStakingMode(true)

  const vestingDuration = 365 * 24 * 60 * 60

  const gmxVester = await deployContract(
    "Vester",
    [
      "Vested GMX", // _name
      "vGMX", // _symbol
      vestingDuration, // _vestingDuration
      esGmx.address, // _esToken
      feeGmxTracker.address, // _pairToken
      gmx.address, // _claimableToken
      stakedGmxTracker.address, // _rewardTracker
    ],
    "GmxVester"
  )

  const glpVester = await deployContract(
    "Vester",
    [
      "Vested GLP", // _name
      "vGLP", // _symbol
      vestingDuration, // _vestingDuration
      esGmx.address, // _esToken
      stakedGlpTracker.address, // _pairToken
      gmx.address, // _claimableToken
      stakedGlpTracker.address, // _rewardTracker
    ],
    "GlpVester"
  )

  const rewardRouter = await deployContract("RewardRouter")
  await rewardRouter.initialize(
    bnb.address,
    gmx.address,
    esGmx.address,
    bnGmx.address,
    glp.address,
    stakedGmxTracker.address,
    bonusGmxTracker.address,
    feeGmxTracker.address,
    feeGlpTracker.address,
    stakedGlpTracker.address,
    glpManager.address
  )

  await feeGlpTracker.setHandler(rewardRouter.address, true)
  await stakedGlpTracker.setHandler(rewardRouter.address, true)

  await glpManager.setHandler(rewardRouter.address, true)

  {
    // check some status
    expect(await positionRouter.vault()).eq(vault.address)
    expect(await positionRouter.router()).eq(router.address)
    expect(await positionRouter.weth()).eq(bnb.address)
    expect(await positionRouter.depositFee()).eq(depositFee)
    expect(await positionRouter.minExecutionFee()).eq(minExecutionFee)
    expect(await positionRouter.admin()).eq(signer.address)
    expect(await positionRouter.gov()).eq(signer.address)
    // error mock
    // expect(await positionRouter.gov()).eq(signer1.address);
  }

  // mock create position in s 300s 500s
  await positionRouter.setDelayValues(
    0, //_minBlockDelayKeeper
    // TODO: online
    // 300, //_minTimeDelayPublic
    0, //_minTimeDelayPublic
    500 //_maxTimeDelay
  )
  // await bnb.mint(vault.address, parseUnits("30"));
  // await vault.buyUSDG(bnb.address, user1.address);

  await timelock.setContractHandler(positionRouter.address, true)
  await timelock.setShouldToggleIsLeverageEnabled(true)
  const esGmxBatchSender = await deployContract("EsGmxBatchSender", [
    esGmx.address,
  ])
  const stakedGlp = await deployContract("StakedGlp", [
    glp.address,
    glpManager.address,
    stakedGlpTracker.address,
    feeGlpTracker.address,
  ])
  const glpBalance = await deployContract("GlpBalance", [
    glpManager.address,
    stakedGlpTracker.address,
  ])

  // await timelock.setHandler(esGmx.address, esGmxBatchSender.address, true);
  // await timelock.setHandler(gmxVester.address, esGmxBatchSender.address, true);
  // await timelock.setHandler(glpVester.address, esGmxBatchSender.address, true);
  // await timelock.setHandler(stakedGlpTracker.address, stakedGlp.address, true);
  // await timelock.setHandler(feeGlpTracker.address, stakedGlp.address, true);
  // await timelock.setHandler(stakedGlpTracker.address, glpBalance.address, true);

  await router.addPlugin(positionRouter.address)

  const rewardReader = await deployContract("RewardReader")

  // order book
  const orderBook = await deployContract("OrderBook")

  // start order book
  await orderBook.initialize(
    router.address,
    vault.address,
    bnb.address,
    usdg.address,
    minExecutionFee,
    // expandDecimals(5, 30) // minPurchaseTokenAmountUsd
    parseUnits("5", 30)
  )

  positionManager = await deployContract("PositionManager", [
    vault.address,
    router.address,
    bnb.address,
    50, // deposit fee
    orderBook.address,
  ])

  positionManager.setLiquidator(positionKeeper.address, true)
  await timelock.setContractHandler(positionManager.address, true)

  await router.addPlugin(orderBook.address)

  const orderBookReader = await deployContract("OrderBookReader")
  const referralReader = await deployContract("ReferralReader")

  await mockInitLP(rewardRouter, glpManager, btc, eth, busd)
  console.log("deploy phase 1 done...")

  await mockExecutePosition(
    busd,
    bnb,
    bnbPriceFeed,
    eth,
    btc,
    positionRouter,
    router,
    vault
  )

  const mockOracleParams = [
    {
      priceFeed: btcPriceFeed,
      baseLine: 20000,
      priceDecimals: priceDecimals,
    },
    {
      priceFeed: bnbPriceFeed,
      baseLine: 300,
      priceDecimals: priceDecimals,
    },
    {
      priceFeed: ethPriceFeed,
      baseLine: 2000,
      priceDecimals: priceDecimals,
    },
    {
      priceFeed: busdPriceFeed,
      baseLine: 1,
      priceDecimals: priceDecimals,
      stable: true,
    },
  ]
  await mockExecutePositionsBot(positionRouter, mockOracleParams)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

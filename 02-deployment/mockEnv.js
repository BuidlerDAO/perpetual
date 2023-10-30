const { deployContract } = require("./helpers")
const { utils, constants } = require("ethers")

const parseEther = utils.parseEther
const parseUnits = utils.parseUnits

async function mockTokenAndPriceFeed() {
  const [signer, signer0, signer1, user0] = await ethers.getSigners()
  const defaultMintAmount = utils.parseEther("100000")
  //   deploy mock tokens and mint
  const bnb = await deployContract("Token", ["BNB", "BNB"], "NATIVE_TOKEN")
  const bnbPriceFeed = await deployContract(
    "PriceFeed",
    ["bnbPriceFeed"],
    "bnbPriceFeed"
  )

  await bnb.mint(user0.address, defaultMintAmount)
  await bnb.mint(signer.address, defaultMintAmount)

  const btc = await deployContract("Token", ["BTC", "BTC"], "BTC")
  const btcPriceFeed = await deployContract(
    "PriceFeed",
    ["btcPriceFeed"],
    "btcPriceFeed"
  )

  await btc.mint(user0.address, defaultMintAmount)
  await btc.mint(signer.address, defaultMintAmount)

  const eth = await deployContract("Token", ["ETH", "ETH"], "ETH")
  const ethPriceFeed = await deployContract(
    "PriceFeed",
    ["ethPriceFeed"],
    "ethPriceFeed"
  )
  await eth.mint(user0.address, defaultMintAmount)
  await eth.mint(signer.address, defaultMintAmount)

  const busd = await deployContract("Token", ["BUSD", "BUSD"], "BUSD")
  const busdPriceFeed = await deployContract(
    "PriceFeed",
    ["busdPriceFeed"],
    "busdPriceFeed"
  )
  await busd.mint(user0.address, defaultMintAmount)
  await busd.mint(signer.address, defaultMintAmount)
  console.log("p1 done")
  return {
    bnb,
    bnbPriceFeed,
    btc,
    btcPriceFeed,
    eth,
    ethPriceFeed,
    busd,
    busdPriceFeed,
  }
}

async function mockInitLP(rewardRouter, glpManager, btc, eth, busd) {
  const [signer] = await ethers.getSigners()

  // constants
  const maxUint256 = constants.MaxUint256

  await rewardRouter.mintAndStakeGlpETH(0, parseEther("200"), {
    value: parseEther("100"),
  })

  const aumT = await glpManager.getAumInUsdg(true)
  console.log("aumT: " + aumT)
  const aumF = await glpManager.getAumInUsdg(false)
  console.log("aumF: " + aumF)

  await btc.connect(signer).approve(glpManager.address, maxUint256)
  await btc.approve(glpManager.address, maxUint256)
  await rewardRouter.mintAndStakeGlp(
    btc.address,
    parseEther("2"),
    0,
    parseEther("1.8")
  )

  const aumT1 = await glpManager.getAumInUsdg(true)
  console.log("aumT1: " + aumT1)
  const aumF1 = await glpManager.getAumInUsdg(false)
  console.log("aumF1: " + aumF1)

  await busd.connect(signer).approve(glpManager.address, maxUint256)
  await rewardRouter.mintAndStakeGlp(
    busd.address,
    parseEther("10000"),
    0,
    parseEther("9000")
  )
  await rewardRouter.mintAndStakeGlp(
    busd.address,
    parseEther("10000"),
    0,
    parseEther("9000")
  )

  const aumT2 = await glpManager.getAumInUsdg(true)
  console.log("aumT2: " + aumT2)
  const aumF2 = await glpManager.getAumInUsdg(false)
  console.log("aumF2: " + aumF2)

  await eth.connect(signer).approve(glpManager.address, maxUint256)
  await rewardRouter.mintAndStakeGlp(
    eth.address,
    parseEther("10"),
    0,
    parseEther("9000")
  )
  console.log("mockInitLP done")
}

// 0-max
function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

function toUsd(value) {
  return parseUnits(value + "", 30)
}
function getRandomInRange(min, max) {
  return Math.random() * (max - min) + min
}

// for stable coin 1%, unstable coin 10%
function getVariation(stable) {
  let variation
  if (stable) {
    let factor = getRandomInt(10)
    if (factor % 2 == 0) {
      variation = 1 + 1 / 100
    } else {
      variation = 1 - 1 / 100
    }
  } else {
    let factor = getRandomInRange(-10, 10)
    if (factor === 0) {
      factor = 1
    }
    variation = 1 + factor / 100
  }
  return variation
}

async function mockExecutePosition(
  busd,
  bnb,
  eth,
  btc,
  positionRouter,
  router,
  vault
) {
  const [signer, signer0, signer1, user0, feeReceiver] =
    await ethers.getSigners()

  await router.connect(signer).approvePlugin(positionRouter.address)

  await busd.approve(router.address, constants.MaxUint256)
  await eth.approve(router.address, constants.MaxUint256)
  await btc.approve(router.address, constants.MaxUint256)

  const referralCode =
    "0x0000000000000000000000000000000000000000000000000000000000000123"

  // _path[-1] collateral token
  let params = [
    [busd.address, bnb.address], // _path
    bnb.address, // _indexToken
    parseUnits("600"), // _amountIn
    parseUnits("1"), // _minOut
    toUsd(6000), // _sizeDelta
    true, // _isLong
    // utils.parseUnits("290", 30), // _acceptablePrice
    toUsd(320), // _acceptablePrice
  ]

  await positionRouter.createIncreasePosition(
    ...params.concat([4000, referralCode]),
    {
      value: 4000,
    }
  )
  let index1 = await positionRouter.increasePositionsIndex(signer.address)
  console.log("increasePositionsIndex1", index1)
  let key = await positionRouter.getRequestKey(signer.address, 1)
  await positionRouter
    .connect(signer)
    .executeIncreasePosition(key, feeReceiver.address)

  const position = await vault.getPosition(
    signer.address, // address _account,
    bnb.address, // address _collateralToken,
    bnb.address, // address _indexToken,
    true // bool _isLong
  )
  console.log("position:", position)
}

async function mockExecutePositionsBot(positionRouter, mockOracleParams) {
  const [
    signer,
    signer0,
    signer1,
    user0,
    feeReceiver,
    positionKeeper,
    updater1,
    priceFeedUpdater,
    fastPriceFeedUpdater,
  ] = await ethers.getSigners()

  await positionRouter.setPositionKeeper(positionKeeper.address, true)
  await mockOracleParams.map((oracle, index) =>
    oracle.priceFeed.setAdmin(priceFeedUpdater.address, true)
  )

  await new Promise(function (resolve, reject) {
    setInterval(function () {
      positionRouter.connect(positionKeeper).executeIncreasePositions(
        500, // _endIndex
        signer0.address // _executionFeeReceiver
      )

      positionRouter.connect(positionKeeper).executeDecreasePositions(
        500, // _endIndex
        signer0.address // _executionFeeReceiver
      )
    }, 1000 * 30) // 30 seconds
  })
}

module.exports = {
  mockTokenAndPriceFeed,
  mockInitLP,
  mockExecutePosition,
  mockExecutePositionsBot,
}

const fs = require("fs")
const path = require("path")
const parse = require("csv-parse")

async function sendTxn(txnPromise, label) {
  const txn = await txnPromise
  console.info(`Sending ${label}...`)
  await txn.wait()
  console.info(`... Sent! ${txn.hash}`)
  return txn
}

async function deployContract(name, args = [], label, options) {
  let info = name
  if (label) {
    info = name + ":" + label
  }
  const contractFactory = await ethers.getContractFactory(name)
  let contract
  if (options) {
    contract = await contractFactory.deploy(...args, options)
  } else {
    contract = await contractFactory.deploy(...args)
  }

  await contract.deployTransaction.wait()

  let obj = {}
  if (label) {
    obj[label] = contract.address
  } else {
    obj[info] = contract.address
  }
  writeContractAddresses(obj)

  return contract
}

const contractAddressesFilepath = path.join(
  __dirname,
  "..",
  "..",
  `contract-addresses-${process.env.HARDHAT_NETWORK || "local-dev"}.json`
)

function readContractAddresses() {
  if (fs.existsSync(contractAddressesFilepath)) {
    return JSON.parse(fs.readFileSync(contractAddressesFilepath))
  }
  return {}
}

function writeContractAddresses(json) {
  const tmpAddresses = Object.assign(readContractAddresses(), json)
  fs.writeFileSync(contractAddressesFilepath, JSON.stringify(tmpAddresses))
}

module.exports = {
  sendTxn,
  deployContract,
}
